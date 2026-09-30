"""Cấu hình tập trung. Mọi giá trị đều ghi đè được bằng biến môi trường."""
import os
from pathlib import Path

import torch

ROOT = Path(os.environ.get("APP_ROOT", Path(__file__).resolve().parent))
DATA_DIR = ROOT / "data"
ART_DIR = ROOT / "artifacts"

# Ultralytics mặc định ghi cấu hình vào AppData của user. Đặt thư mục trong project
# để backend vẫn nạp detector được ở máy bị giới hạn quyền ghi profile Windows.
os.environ.setdefault("YOLO_CONFIG_DIR", str(ROOT))

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# Mô hình (đổi tên model = đổi biến môi trường, không sửa code)
YOLO_WEIGHTS = os.environ.get("YOLO_WEIGHTS", str(ART_DIR / "detector" / "yolo11n.pt"))
CLIP_MODEL = os.environ.get("CLIP_MODEL", "openai/clip-vit-base-patch32")
TRANSLATION_MODEL = os.environ.get("TRANSLATION_MODEL", "Helsinki-NLP/opus-mt-vi-en")
EMBED_MODEL = os.environ.get("EMBED_MODEL", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
LLM_MODEL = os.environ.get(
    "LLM_MODEL",
    "Qwen/Qwen2.5-1.5B-Instruct" if DEVICE == "cuda" else "Qwen/Qwen2.5-0.5B-Instruct",
)
LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "gemini").strip().lower()
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

# Mô hình được nạp lần đầu khi người dùng mở từng tính năng.
ENABLED_MODELS = {
    m.strip() for m in os.environ.get("ENABLED_MODELS", "classifier,detector,retrieval,llm").split(",") if m.strip()
}

MAX_UPLOAD_MB = int(os.environ.get("MAX_UPLOAD_MB", "8"))
CORS_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        "CORS_ORIGINS",
        "http://localhost:5173,http://localhost:5175,http://127.0.0.1:5173,http://127.0.0.1:5175,http://localhost:8501",
    ).split(",")
    if origin.strip()
]


def resolve_path(path: str) -> Path:
    """Dữ liệu lưu đường dẫn tương đối so với ROOT để mang sang máy khác (Docker, HF Spaces)."""
    p = Path(path)
    return p if p.is_absolute() else ROOT / p
