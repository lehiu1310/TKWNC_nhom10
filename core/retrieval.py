"""Ứng dụng 3 — Tìm kiếm ảnh (CLIP + FAISS): tìm bằng câu mô tả hoặc bằng ảnh mẫu."""
import json
import logging
import re
from pathlib import Path

import faiss
import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

from config import ART_DIR, CLIP_MODEL, DEVICE, TRANSLATION_MODEL, resolve_path

log = logging.getLogger(__name__)


def _features(out) -> torch.Tensor:
    # transformers 4.x trả tensor; 5.x trả object có pooler_output đã chiếu sang không gian CLIP
    return out if torch.is_tensor(out) else out.pooler_output


class ClipEncoder:
    def __init__(self, model_name: str = CLIP_MODEL):
        self.model = CLIPModel.from_pretrained(model_name).to(DEVICE).eval()
        self.processor = CLIPProcessor.from_pretrained(model_name)

    @torch.inference_mode()
    def encode_images(self, images: list[Image.Image], batch_size: int = 64) -> np.ndarray:
        chunks = []
        for i in range(0, len(images), batch_size):
            batch = [im.convert("RGB") for im in images[i:i + batch_size]]
            inputs = self.processor(images=batch, return_tensors="pt").to(DEVICE)
            chunks.append(F.normalize(_features(self.model.get_image_features(**inputs)), dim=-1).cpu())
        return torch.cat(chunks).numpy().astype("float32")

    @torch.inference_mode()
    def encode_texts(self, texts: list[str]) -> np.ndarray:
        inputs = self.processor(text=texts, return_tensors="pt", padding=True, truncation=True).to(DEVICE)
        feats = _features(self.model.get_text_features(**inputs))
        return F.normalize(feats, dim=-1).cpu().numpy().astype("float32")


def build_index(encoder: ClipEncoder, items: list[dict], out_dir: Path = ART_DIR / "retrieval") -> faiss.Index:
    """items: [{"path": <tương đối so với ROOT>, "label": ..., "source": ...}] → lưu index.faiss + meta.json."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    embeddings = []
    for start in range(0, len(items), 32):
        batch = items[start:start + 32]
        with_images = []
        for item in batch:
            with Image.open(resolve_path(item["path"])) as image:
                with_images.append(image.convert("RGB"))
        embeddings.append(encoder.encode_images(with_images, batch_size=32))
    embs = np.concatenate(embeddings, axis=0)
    index = faiss.IndexFlatIP(embs.shape[1])  # vector đã chuẩn hoá → inner product = cosine
    index.add(embs)
    faiss.write_index(index, str(out_dir / "index.faiss"))
    (out_dir / "meta.json").write_text(json.dumps(items, ensure_ascii=False), encoding="utf-8")
    return index


class ImageSearch:
    def __init__(self, index_dir: Path = ART_DIR / "retrieval", encoder: ClipEncoder | None = None):
        index_dir = Path(index_dir)
        self.encoder = encoder or ClipEncoder()
        self.index = faiss.read_index(str(index_dir / "index.faiss"))
        self.meta: list[dict] = json.loads((index_dir / "meta.json").read_text(encoding="utf-8"))
        self._translator = None

    def _english_query(self, query: str) -> str:
        """CLIP checkpoint in this project is English-first; translate Vietnamese queries locally."""
        vietnamese_words = r"\b(hoa|vuon|buom|mua|canh|hong|huong duong|cuc|tulip|vang|trang|do)\b"
        if not any("\u00c0" <= ch <= "\u1ef9" for ch in query) and not re.search(vietnamese_words, query, re.IGNORECASE):
            return query
        try:
            if self._translator is None:
                from transformers import MarianMTModel, MarianTokenizer
                tokenizer = MarianTokenizer.from_pretrained(TRANSLATION_MODEL)
                model = MarianMTModel.from_pretrained(TRANSLATION_MODEL).to(DEVICE).eval()
                self._translator = (tokenizer, model)
            tokenizer, model = self._translator
            inputs = tokenizer([query], return_tensors="pt", padding=True, truncation=True).to(DEVICE)
            with torch.inference_mode():
                translated = model.generate(**inputs, max_new_tokens=96)
            return tokenizer.decode(translated[0], skip_special_tokens=True)
        except Exception:
            log.exception("Vietnamese query translation failed; falling back to the original query")
            return query

    def _search(self, query_vec: np.ndarray, k: int) -> list[dict]:
        scores, ids = self.index.search(query_vec, k)
        return [
            {"id": int(i), "score": round(float(s), 4), **self.meta[i]}
            for s, i in zip(scores[0], ids[0]) if i != -1
        ]

    def search_text(self, query: str, k: int = 8) -> list[dict]:
        return self._search(self.encoder.encode_texts([self._english_query(query)]), k)

    def search_image(self, image: Image.Image, k: int = 8) -> list[dict]:
        return self._search(self.encoder.encode_images([image]), k)
