"""FastAPI backend: một server giữ cả 4 mô hình, Streamlit và React đều gọi vào đây."""
import base64
import importlib
import io
import json
import logging
import os
import sys
import threading
import time
from functools import partial
from contextlib import asynccontextmanager
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # để import config, core khi chạy uvicorn

from fastapi import FastAPI, File, Form, HTTPException, Path as ApiPath, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field

from config import CORS_ORIGINS, DEVICE, ENABLED_MODELS, LLM_PROVIDER, MAX_UPLOAD_MB, ROOT, resolve_path
from core.gift_advisor import recommend_gifts

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("api")
MODELS: dict = {}
MODEL_ERRORS: dict[str, str] = {}
MODEL_STATES: dict[str, str] = {}
MODEL_STATE_LOCK = threading.Lock()


LOADERS = {  # tên → (module, lớp); import trễ để chỉ nạp thư viện của mô hình được bật
    "classifier": ("core.classifier", "ImageClassifier"),
    "detector": ("core.detector", "ObjectDetector"),
    "retrieval": ("core.retrieval", "ImageSearch"),
    "llm": ("core.llm", "RAGChatbot"),
}
MODEL_LOCKS = {name: threading.Lock() for name in LOADERS}
MODEL_STATES.update({name: "not_loaded" for name in LOADERS})


def _set_model_state(name: str, state: str) -> None:
    with MODEL_STATE_LOCK:
        MODEL_STATES[name] = state


def _model_health() -> dict:
    with MODEL_STATE_LOCK:
        states = {
            name: ("ready" if name in ENABLED_MODELS and name in MODELS
                   else MODEL_STATES.get(name, "not_loaded"))
            for name in LOADERS
        }
    ready = all(name in ENABLED_MODELS and states[name] == "ready" for name in LOADERS)
    return {"ready": ready, "models": {name: state == "ready" for name, state in states.items()},
            "model_states": states}


def _warm_model(name: str, model) -> None:
    """Run a small local inference so the first visitor does not pay model setup cost."""
    from PIL import Image

    sample = Image.new("RGB", (256, 256), color=(118, 142, 92))
    if name == "classifier":
        model.predict(sample, top_k=1)
    elif name == "detector":
        model.detect(sample, conf=0.25)
    elif name == "retrieval":
        model.search_text_with_query("a flower in a garden", k=1)
    elif name == "llm":
        # The chatbot's local RAG component is lexical; Gemini is an external
        # API and must not incur a paid generation just to mark this instance ready.
        model.retriever.search("hoa hồng", k=1)


def _warm_models() -> None:
    for name in LOADERS:
        if name not in ENABLED_MODELS:
            continue
        _set_model_state(name, "loading")
        started = time.perf_counter()
        try:
            model = _require(name)
            _warm_model(name, model)
            MODEL_ERRORS.pop(name, None)
            _set_model_state(name, "ready")
            log.info("model warm-up completed model=%s elapsed_s=%.2f", name, time.perf_counter() - started)
        except Exception as exc:
            MODEL_ERRORS[name] = str(exc)
            _set_model_state(name, "failed")
            log.exception("model warm-up failed model=%s", name)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Keep HTTP startup responsive while a single background thread warms each
    # model in order. Cloud Run's startup probe waits on /api/startup.
    warmup_enabled = os.environ.get("MODEL_WARMUP", "1").strip().lower() not in {"0", "false", "no"}
    warmup_thread = None
    if warmup_enabled:
        warmup_thread = threading.Thread(target=_warm_models, name="model-warmup", daemon=True)
        warmup_thread.start()
    try:
        yield
    finally:
        if warmup_thread and warmup_thread.is_alive():
            log.warning("server shutdown while model warm-up is still running")


app = FastAPI(title="AI Web Apps API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])


@app.middleware("http")
async def timing(request: Request, call_next):
    t0 = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - t0) * 1000
    response.headers["X-Process-Time-ms"] = f"{elapsed_ms:.1f}"
    if request.url.path in {
        "/api/classify", "/api/detect", "/api/search", "/api/search/text", "/api/search/image",
        "/api/chat", "/api/chat/sync", "/api/ask", "/api/gifts/greeting",
    }:
        log.info(
            "API_PERF route=%s status=%s latency_ms=%.1f process_peak_rss_mb=%s",
            request.url.path, response.status_code, elapsed_ms, _process_peak_rss_mb(),
        )
    return response


def _require(name: str):
    if name not in ENABLED_MODELS:
        raise HTTPException(503, f"Tính năng '{name}' đang tắt trong cấu hình.")
    if name not in MODELS:
        _set_model_state(name, "loading")
        with MODEL_LOCKS[name]:
            if name not in MODELS:
                try:
                    module, cls = LOADERS[name]
                    MODELS[name] = getattr(importlib.import_module(module), cls)()
                    MODEL_ERRORS.pop(name, None)
                    _set_model_state(name, "ready")
                except Exception as exc:
                    MODEL_ERRORS[name] = str(exc)
                    _set_model_state(name, "failed")
                    log.exception("cannot load %s: %s", name, exc)
                    detail = f"Mô hình '{name}' chưa sẵn sàng."
                    if name in ("classifier", "retrieval"):
                        detail += " Hãy tải dữ liệu và tạo model/index theo hướng dẫn trong README.md."
                    raise HTTPException(503, detail) from exc
    return MODELS[name]


def _process_peak_rss_mb() -> float | None:
    """Return process high-water RSS in MiB where the host exposes resource usage."""
    try:
        import resource
        peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    except (ImportError, AttributeError, OSError):
        return None
    # Linux reports KiB; macOS reports bytes.
    return round(peak / (1024 * 1024 if sys.platform == "darwin" else 1024), 1)


async def _read_image(file: UploadFile) -> Image.Image:
    data = await file.read()
    if len(data) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(413, f"Ảnh vượt quá {MAX_UPLOAD_MB} MB")
    try:
        image = Image.open(io.BytesIO(data))
        image.load()
        return image.convert("RGB")
    except (UnidentifiedImageError, OSError):
        raise HTTPException(400, "File không phải ảnh hợp lệ (jpg, png, webp)")


def _to_base64(image: Image.Image, max_dimension: int | None = None, quality: int = 88) -> str:
    if max_dimension:
        image = image.copy()
        image.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    image.save(buf, format="JPEG", quality=quality, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


# ---------- Hệ thống ----------
@app.get("/api/health")
def health(model: str | None = Query(None, max_length=32, description="Optional model component to inspect")):
    if model is not None and model not in LOADERS:
        raise HTTPException(400, f"Unknown model component: {model}")
    snapshot = _model_health()
    enabled = sorted(LOADERS if model is None else {model})
    revision = os.environ.get("RENDER_GIT_COMMIT") or os.environ.get("GIT_COMMIT")
    return {
        "status": "ok", "device": DEVICE,
        "revision": revision[:12] if revision else None,
        "ready": snapshot["ready"],
        "models": {m: snapshot["models"][m] for m in enabled},
        "model_states": {m: snapshot["model_states"][m] for m in enabled},
    }


@app.get("/api/startup")
def startup_probe():
    snapshot = _model_health()
    if not snapshot["ready"]:
        raise HTTPException(503, "AI models are warming up", headers={"Retry-After": "5"})
    return {"status": "ok", "ready": True}


@app.get("/api/species")
def species(limit: int | None = None, offset: int = 0):
    if (limit is not None and limit < 1) or offset < 0:
        raise HTTPException(400, "limit must be positive and offset cannot be negative")
    entries = json.loads((ROOT / "data" / "species.json").read_text(encoding="utf-8"))
    end = offset + limit if limit is not None else len(entries)
    return entries[offset:end]


@app.get("/api/species/{species_id}/image")
def species_image(species_id: str = ApiPath(..., max_length=128)):
    if not species_id or any(not (char.isalnum() or char == "-") for char in species_id):
        raise HTTPException(400, "Mã loài chỉ được gồm chữ, số và dấu gạch ngang")
    entries = species()
    entry = next((item for item in entries if item["id"] == species_id), None)
    if entry is None:
        raise HTTPException(404, "Không có loài hoa này")
    path = resolve_path(entry["image"]).resolve()
    if ROOT.resolve() not in path.parents or not path.is_file():
        raise HTTPException(404, "Ảnh minh hoạ dữ liệu chưa được chuẩn bị")
    return FileResponse(path)


# ---------- 1. Phân loại ảnh ----------
@app.post("/api/classify")
async def classify(file: UploadFile = File(...), top_k: int = Form(3), explain: bool = Form(False)):
    model = await run_in_threadpool(_require, "classifier")
    t0 = time.perf_counter()
    image = await _read_image(file)
    result = await run_in_threadpool(partial(model.predict, image, top_k=max(1, min(top_k, 5))))
    if explain:
        result["grad_cam"] = _to_base64(
            await run_in_threadpool(partial(model.explain, image)), max_dimension=512, quality=80,
        )
    return {**result, "latency_ms": round((time.perf_counter() - t0) * 1000, 1)}


# ---------- 2. Phát hiện đối tượng ----------
@app.post("/api/detect")
async def detect(file: UploadFile = File(...), conf: float = Form(0.25)):
    model = await run_in_threadpool(_require, "detector")
    t0 = time.perf_counter()
    image = await _read_image(file)
    result, annotated = await run_in_threadpool(partial(model.detect, image, conf=min(max(conf, 0.05), 0.95)))
    return {**result, "image": _to_base64(annotated), "latency_ms": round((time.perf_counter() - t0) * 1000, 1)}


# ---------- 3. Tìm kiếm ảnh ----------
class TextQuery(BaseModel):
    query: str = Field(..., min_length=1, max_length=200)
    k: int = Field(8, ge=1, le=24)
    label: str | None = Field(None, min_length=1, max_length=128, description="Optional exact species label or species ID")


def _with_urls(results: list[dict]) -> list[dict]:
    return [{k: v for k, v in r.items() if k != "path"} | {"url": f"/api/gallery/{r['id']}"} for r in results]


@app.post("/api/search")
@app.post("/api/search/text")
def search_text(q: TextQuery):
    if not q.query.strip():
        raise HTTPException(400, "Câu tìm kiếm không được chỉ chứa khoảng trắng")
    engine = _require("retrieval")
    payload = engine.search_text_with_query(q.query, q.k, q.label)
    return {"results": _with_urls(payload["results"]), "query_used": payload["query_used"],
            "translated": payload["translated"]}


@app.post("/api/search/image")
async def search_image(file: UploadFile = File(...), k: int = Form(8), label: str | None = Form(None, min_length=1, max_length=128)):
    engine = _require("retrieval")
    return {"results": _with_urls(engine.search_image(await _read_image(file), max(1, min(k, 24)), label))}


@app.get("/api/gallery/{item_id}")
def gallery(item_id: int):
    if item_id < 0:
        raise HTTPException(400, "Mã ảnh phải là số không âm")
    engine = _require("retrieval")
    if not 0 <= item_id < len(engine.meta):
        raise HTTPException(404, "Không có ảnh này")
    return FileResponse(resolve_path(engine.meta[item_id]["path"]))


# ---------- 4. Chatbot RAG ----------
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    history: list[dict] = Field(default_factory=list)


class GiftRecommendationRequest(BaseModel):
    occasion: str = Field(..., min_length=1, max_length=32)
    recipient: str = Field(..., min_length=1, max_length=32)
    color: str | None = Field(None, max_length=32)
    size: str = Field("vừa", min_length=1, max_length=16)
    preferred_species_id: str | None = Field(None, max_length=128)


class GiftGreetingRequest(BaseModel):
    occasion: str = Field(..., min_length=1, max_length=32)
    recipient: str = Field(..., min_length=1, max_length=32)
    flowers: list[str] = Field(..., min_length=1, max_length=3)
    situation: str = Field("", max_length=500)
    tone: str = Field("Chân thành, tự nhiên", min_length=1, max_length=40)


@app.post("/api/gifts/recommend")
def gift_recommendation(req: GiftRecommendationRequest):
    """Rule/data-based bouquet suggestions; this endpoint does not call an AI model."""
    try:
        return recommend_gifts(req.occasion, req.recipient, req.color, req.size, req.preferred_species_id)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@app.post("/api/gifts/greeting")
def gift_greeting(req: GiftGreetingRequest):
    """Create one direct, occasion-specific greeting without flower-guide retrieval."""
    if (
        not req.occasion.strip()
        or not req.recipient.strip()
        or any(not flower.strip() for flower in req.flowers)
    ):
        raise HTTPException(400, "Dịp, người nhận và tên hoa không được để trống")
    if LLM_PROVIDER != "gemini":
        raise HTTPException(503, "Tính năng viết lời chúc cần cấu hình Gemini.")
    try:
        message = _require("llm").generate_greeting(
            req.occasion, req.recipient, req.flowers, req.situation, req.tone,
        )
        return {"message": message, "source": "Gemini"}
    except HTTPException:
        raise
    except Exception as exc:
        log.warning("Gift greeting generation failed (%s)", type(exc).__name__)
        raise HTTPException(503, "AI viết lời chúc hiện chưa sẵn sàng. Hãy thử lại hoặc dùng mẫu dự phòng.") from exc


@app.post("/api/chat")
def chat(req: ChatRequest):
    """Server-Sent Events: sự kiện 'sources' trước, sau đó từng 'token', cuối cùng 'done'."""
    if not req.message.strip():
        raise HTTPException(400, "Câu hỏi không được chỉ chứa khoảng trắng")
    bot = _require("llm")
    contexts, tokens = bot.stream(req.message, req.history)

    def events():
        yield f"data: {json.dumps({'type': 'sources', 'items': contexts}, ensure_ascii=False)}\n\n"
        for piece in tokens:
            yield f"data: {json.dumps({'type': 'token', 'text': piece}, ensure_ascii=False)}\n\n"
        yield 'data: {"type": "done"}\n\n'

    return StreamingResponse(events(), media_type="text/event-stream; charset=utf-8", headers={"Cache-Control": "no-cache"})


@app.post("/api/ask")
@app.post("/api/chat/sync")
def chat_sync(req: ChatRequest):
    if not req.message.strip():
        raise HTTPException(400, "Câu hỏi không được chỉ chứa khoảng trắng")
    return _require("llm").answer(req.message, req.history)


# ---------- Giao diện React (nếu đã build) ----------
DIST = ROOT / "web" / "dist"
if DIST.exists():
    app.mount("/", StaticFiles(directory=DIST, html=True), name="web")
