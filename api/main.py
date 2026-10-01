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

from config import CORS_ORIGINS, DEVICE, ENABLED_MODELS, MAX_UPLOAD_MB, ROOT, resolve_path

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("api")
MODELS: dict = {}
MODEL_ERRORS: dict[str, str] = {}


LOADERS = {  # tên → (module, lớp); import trễ để chỉ nạp thư viện của mô hình được bật
    "classifier": ("core.classifier", "ImageClassifier"),
    "detector": ("core.detector", "ObjectDetector"),
    "retrieval": ("core.retrieval", "ImageSearch"),
    "llm": ("core.llm", "RAGChatbot"),
}
MODEL_LOCKS = {name: threading.Lock() for name in LOADERS}


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Nạp từng mô hình khi người dùng mở chức năng để API sẵn sàng nhanh hơn.
    yield
    MODELS.clear()


app = FastAPI(title="AI Web Apps API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])


@app.middleware("http")
async def timing(request: Request, call_next):
    t0 = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - t0) * 1000
    response.headers["X-Process-Time-ms"] = f"{elapsed_ms:.1f}"
    if request.url.path in {
        "/api/classify", "/api/detect", "/api/search/text", "/api/search/image",
        "/api/chat", "/api/chat/sync",
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
        with MODEL_LOCKS[name]:
            if name not in MODELS:
                try:
                    module, cls = LOADERS[name]
                    MODELS[name] = getattr(importlib.import_module(module), cls)()
                    MODEL_ERRORS.pop(name, None)
                except Exception as exc:
                    MODEL_ERRORS[name] = str(exc)
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


def _to_base64(image: Image.Image) -> str:
    buf = io.BytesIO()
    image.save(buf, format="JPEG", quality=88)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


# ---------- Hệ thống ----------
@app.get("/api/health")
def health(model: str | None = Query(None, max_length=32, description="Optional model component to inspect")):
    if model is not None and model not in LOADERS:
        raise HTTPException(400, f"Unknown model component: {model}")
    enabled = sorted(ENABLED_MODELS if model is None else ENABLED_MODELS & {model})
    revision = os.environ.get("RENDER_GIT_COMMIT") or os.environ.get("GIT_COMMIT")
    return {
        "status": "ok", "device": DEVICE,
        "revision": revision[:12] if revision else None,
        "models": {m: m in MODELS for m in enabled},
        "model_states": {m: ("ready" if m in MODELS else "failed" if m in MODEL_ERRORS else "not_loaded") for m in enabled},
    }


@app.get("/api/species")
def species(limit: int = 103, offset: int = 0):
    if limit < 1 or offset < 0:
        raise HTTPException(400, "limit must be positive and offset cannot be negative")
    entries = json.loads((ROOT / "data" / "species.json").read_text(encoding="utf-8"))
    return entries[offset:offset + limit]


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
        result["grad_cam"] = _to_base64(await run_in_threadpool(partial(model.explain, image)))
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


@app.post("/api/search/text")
def search_text(q: TextQuery):
    if not q.query.strip():
        raise HTTPException(400, "Câu tìm kiếm không được chỉ chứa khoảng trắng")
    return {"results": _with_urls(_require("retrieval").search_text(q.query, q.k, q.label))}


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


@app.post("/api/chat/sync")
def chat_sync(req: ChatRequest):
    if not req.message.strip():
        raise HTTPException(400, "Câu hỏi không được chỉ chứa khoảng trắng")
    return _require("llm").answer(req.message, req.history)


# ---------- Giao diện React (nếu đã build) ----------
DIST = ROOT / "web" / "dist"
if DIST.exists():
    app.mount("/", StaticFiles(directory=DIST, html=True), name="web")
