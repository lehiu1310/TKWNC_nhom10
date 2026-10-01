"""Ứng dụng 3 — Tìm kiếm ảnh (CLIP + FAISS): tìm bằng câu mô tả hoặc bằng ảnh mẫu."""
import json
import logging
import re
from pathlib import Path

import faiss
import numpy as np
import open_clip
import torch
import torch.nn.functional as F
from PIL import Image

from config import ART_DIR, CLIP_MODEL, CLIP_PRETRAINED, DEVICE, TRANSLATION_MODEL, resolve_path

log = logging.getLogger(__name__)


class ClipEncoder:
    def __init__(self, model_name: str = CLIP_MODEL, pretrained: str = CLIP_PRETRAINED):
        # MobileCLIP2-S0 fits the 512 MB Render free container where ViT-B/32
        # previously exhausted memory before an image query could finish.
        self.model, _, self.preprocess = open_clip.create_model_and_transforms(
            model_name, pretrained=pretrained, device=DEVICE,
        )
        # Store the compact encoder in half precision on CPU; FP32 MobileCLIP
        # still pushes a small 512 MB container over its memory limit.
        self.model.to(dtype=torch.float16).eval()
        self.dtype = next(self.model.parameters()).dtype
        self.model_name = model_name
        self.pretrained = pretrained
        self.tokenizer = open_clip.get_tokenizer(model_name)

    @torch.inference_mode()
    def encode_images(self, images: list[Image.Image], batch_size: int = 64) -> np.ndarray:
        chunks = []
        for i in range(0, len(images), batch_size):
            batch = torch.stack([self.preprocess(im.convert("RGB")) for im in images[i:i + batch_size]]).to(DEVICE, dtype=self.dtype)
            chunks.append(F.normalize(self.model.encode_image(batch).float(), dim=-1).cpu())
        return torch.cat(chunks).numpy().astype("float32")

    @torch.inference_mode()
    def encode_texts(self, texts: list[str]) -> np.ndarray:
        tokens = self.tokenizer(texts).to(DEVICE)
        feats = self.model.encode_text(tokens).float()
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
    if hasattr(encoder, "model_name") and hasattr(encoder, "pretrained"):
        (out_dir / "encoder.json").write_text(json.dumps({
            "model": encoder.model_name,
            "pretrained": encoder.pretrained,
            "embedding_dimension": int(embs.shape[1]),
            "images": len(items),
        }, ensure_ascii=False, indent=2), encoding="utf-8")
    return index


class ImageSearch:
    def __init__(self, index_dir: Path = ART_DIR / "retrieval", encoder: ClipEncoder | None = None):
        index_dir = Path(index_dir)
        self.encoder = encoder or ClipEncoder()
        manifest_path = index_dir / "encoder.json"
        if not manifest_path.is_file():
            raise RuntimeError("FAISS index thiếu encoder.json; hãy tạo lại index theo README.md")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if manifest.get("model") != self.encoder.model_name or manifest.get("pretrained") != self.encoder.pretrained:
            raise RuntimeError("FAISS index không khớp model; hãy tạo lại index theo README.md")
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

    def _search(self, query_vec: np.ndarray, k: int, label: str | None = None) -> list[dict]:
        # Filter after ranking so a sparse label still fills the requested page.
        candidate_k = self.index.ntotal if label else k
        scores, ids = self.index.search(query_vec, candidate_k)
        results = [
            {"id": int(i), "score": round(float(s), 4), **self.meta[i]}
            for s, i in zip(scores[0], ids[0]) if i != -1
        ]
        if label:
            needle = label.strip().casefold()
            results = [r for r in results if needle in {
                str(r.get("label", "")).casefold(), str(r.get("species_id", "")).casefold()
            }]
        return results[:k]

    def search_text(self, query: str, k: int = 8, label: str | None = None) -> list[dict]:
        return self._search(self.encoder.encode_texts([self._english_query(query)]), k, label)

    def search_image(self, image: Image.Image, k: int = 8, label: str | None = None) -> list[dict]:
        return self._search(self.encoder.encode_images([image]), k, label)
