"""Cấu hình tập trung. Mọi giá trị đều ghi đè được bằng biến môi trường."""
import os
from pathlib import Path

from dotenv import load_dotenv

try:
    import torch
except ImportError:  # API schema tests do not need the inference runtime.
    torch = None

# Cloud Run is configured for two vCPUs and concurrency two. One intra-op
# thread per request avoids oversubscribing those cores under concurrent inference.
TORCH_NUM_THREADS = max(1, int(os.environ.get("TORCH_NUM_THREADS", "1")))
if torch is not None:
    torch.set_num_threads(TORCH_NUM_THREADS)
    try:
        torch.set_num_interop_threads(1)
    except RuntimeError:
        # Another imported library already initialized the inter-op pool.
        pass

ROOT = Path(os.environ.get("APP_ROOT", Path(__file__).resolve().parent))
# Read local secrets from the ignored project-root .env without overriding shell/host secrets.
load_dotenv(ROOT / ".env", override=False)
DATA_DIR = ROOT / "data"
ART_DIR = ROOT / "artifacts"

# Ultralytics mặc định ghi cấu hình vào AppData của user. Đặt thư mục trong project
# để backend vẫn nạp detector được ở máy bị giới hạn quyền ghi profile Windows.
os.environ.setdefault("YOLO_CONFIG_DIR", str(ROOT))

DEVICE = "cuda" if torch is not None and torch.cuda.is_available() else "cpu"

# Mô hình (đổi tên model = đổi biến môi trường, không sửa code)
YOLO_WEIGHTS = os.environ.get("YOLO_WEIGHTS", str(ART_DIR / "detector" / "flower_yolo11n.pt"))
CLIP_MODEL = os.environ.get("CLIP_MODEL", "MobileCLIP2-S0")
CLIP_PRETRAINED = os.environ.get("CLIP_PRETRAINED", "dfndr2b")
TRANSLATION_MODEL = os.environ.get("TRANSLATION_MODEL", "Helsinki-NLP/opus-mt-vi-en")
EMBED_MODEL = os.environ.get("EMBED_MODEL", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
LLM_MODEL = os.environ.get(
    "LLM_MODEL",
    "Qwen/Qwen2.5-1.5B-Instruct" if DEVICE == "cuda" else "Qwen/Qwen2.5-0.5B-Instruct",
)
LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "gemini").strip().lower()
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash-lite")

# Mô hình được nạp lần đầu khi người dùng mở từng tính năng.
ENABLED_MODELS = {
    m.strip() for m in os.environ.get("ENABLED_MODELS", "classifier,detector,retrieval,llm").split(",") if m.strip()
}

MAX_UPLOAD_MB = int(os.environ.get("MAX_UPLOAD_MB", "8"))
CLASSIFIER_OOD_MIN_CONFIDENCE = float(os.environ.get("CLASSIFIER_OOD_MIN_CONFIDENCE", "0.6967"))
if not 0.0 <= CLASSIFIER_OOD_MIN_CONFIDENCE <= 1.0:
    raise ValueError("CLASSIFIER_OOD_MIN_CONFIDENCE must be between 0 and 1")
CORS_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        "CORS_ORIGINS",
        "http://localhost:5173,http://localhost:5175,http://127.0.0.1:5173,http://127.0.0.1:5175,http://localhost:8501,https://tkwnc-nhom10.vercel.app,https://tkwnc-nhom10-aq7ahbp1b-tkwnc-nhom10.vercel.app",
    ).split(",")
    if origin.strip()
]


def resolve_path(path: str) -> Path:
    """Dữ liệu lưu đường dẫn tương đối so với ROOT để mang sang máy khác (Docker, HF Spaces)."""
    p = Path(path)
    return p if p.is_absolute() else ROOT / p
