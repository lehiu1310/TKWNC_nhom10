"""Ứng dụng 3 — Tìm kiếm ảnh (CLIP + FAISS): tìm bằng câu mô tả hoặc bằng ảnh mẫu."""
from __future__ import annotations
import json
import logging
import re
import os
import threading
import unicodedata
from collections import OrderedDict
from pathlib import Path

import numpy as np
from PIL import Image

from config import ART_DIR, CLIP_MODEL, CLIP_PRETRAINED, DATA_DIR, DEVICE, GEMINI_MODEL, resolve_path
from core.search_filter import filter_by_label

log = logging.getLogger(__name__)


# A compact, deterministic Vietnamese-to-English vocabulary for visual flower
# queries. MobileCLIP's text encoder is English-oriented, so passing raw
# Vietnamese on Gemini outage produces poor rankings. This is deliberately a
# vocabulary fallback, not a claim of general-purpose machine translation.
_VI_QUERY_PHRASES = (
    ("cuc mat bo", "oxeye daisy"),
    ("bo cong anh", "dandelion"),
    ("huong duong", "sunflower"),
    ("hoa hong", "rose"),
    ("hoa hong phan", "pink rose"),
    ("hong phan", "pale pink"),
    ("do nhung", "velvet red"),
    ("canh hoa", "flower petals"),
    ("qua cau", "seed globe"),
    ("bay khoi", "blowing away"),
    ("noi bat", "vivid"),
    ("tan la", "foliage"),
    ("xanh dam", "dark green"),
    ("vang ruc", "bright yellow"),
    ("vay quanh", "surrounding"),
    ("toa ra ngoai", "radiating outward"),
    ("xep toa ra ngoai", "arranged radiating outward"),
    ("phia sau", "background"),
    ("thanh xanh", "green stem"),
    ("than thang", "straight stem"),
    ("li ti", "tiny"),
    ("mo xanh", "soft focus green"),
    ("canh dong", "field"),
    ("la dai", "long leaves"),
    ("xanh la", "green leaves"),
    ("hat trang", "white seeds"),
    ("xep vong", "arranged in a ring"),
    ("dung giua", "standing among"),
    ("xung quanh", "around"),
    ("quanh", "around"),
    ("la thap", "low leaves"),
    ("than xanh", "green stem"),
    ("om goc", "hugging the base"),
    ("nhieu lop", "layered petals"),
    ("tam nau", "brown center"),
    ("nhuy vang", "yellow center"),
    ("hat trang", "white seeds"),
    ("bay theo gio", "blowing in the wind"),
    ("co xanh", "green grass"),
    ("dong co", "meadow"),
    ("than manh", "slender stem"),
    ("la xanh", "green leaves"),
    ("la dai", "long leaves"),
    ("canh khum", "cup-shaped petals"),
    ("hinh chen", "cup-shaped"),
    ("don doc", "single"),
    ("meo", "edge"),
    ("canh", "petals"),
    ("cuc", "daisy"),
    ("nhuy", "center"),
    ("tam", "center"),
    ("trang", "white"),
    ("vang", "yellow"),
    ("do", "red"),
    ("hong", "pink"),
    ("cam", "orange"),
    ("tim", "purple"),
    ("la", "leaves"),
    ("doa", "bloom"),
    ("nhung", "velvet"),
    ("dam", "dark"),
    ("sam", "dark"),
    ("tron", "round"),
    ("vay", "surrounding"),
    ("ruc", "bright"),
    ("day", "dense"),
    ("thang", "upright"),
    ("manh", "slender"),
    ("moc", "growing"),
    ("khu", "garden"),
    ("mep", "edge"),
    ("ong", "meadow"),
    ("gio", "wind"),
    ("bay", "flying"),
    ("qua", "seed"),
    ("hat", "seeds"),
    ("cau", "globe"),
    ("toa", "radiating"),
    ("noi", "prominent"),
    ("bat", "bright"),
    ("noi", "prominent"),
    ("xanh la", "green"),
    ("xanh duong", "blue"),
    ("den", "dark"),
    ("mong", "thin"),
    ("xoay", "spiral"),
    ("cuon", "curled"),
    ("nho", "small"),
    ("lon", "large"),
    ("thap", "low"),
    ("cao", "tall"),
    ("canh dong", "field"),
    ("vuon", "garden"),
    ("mua xuan", "spring"),
    ("gia ret", "cold weather"),
    ("nang", "sunlight"),
)
_VI_FILLER_WORDS = {
    "hoa", "bong", "mot", "nhung", "cac", "co", "duoc",
    "giua", "ben", "trong", "ngoai", "phia", "sau", "truoc", "tren",
    "duoi", "va", "voi", "tu", "cua", "nay", "kia", "dang",
    "nhin", "giong", "nao", "gi", "the", "ra", "khoi", "mau", "o", "dung", "thanh",
}


def _strip_vietnamese_marks(value: str) -> str:
    value = unicodedata.normalize("NFD", value.casefold())
    value = "".join(ch for ch in value if unicodedata.category(ch) != "Mn")
    value = value.replace("đ", "d")
    return re.sub(r"[^a-z0-9]+", " ", value).strip()


def _inference_mode(function):
    try:
        import torch
    except ImportError:
        return function
    return torch.inference_mode()(function)


class ClipEncoder:
    def __init__(self, model_name: str = CLIP_MODEL, pretrained: str = CLIP_PRETRAINED):
        # Keep retrieval dependencies lazy so API tests and lightweight tools can
        # import the query helpers without installing PyTorch/OpenCLIP/FAISS.
        import open_clip
        import torch

        # MobileCLIP2-S0 fits the 512 MB Render free container where ViT-B/32
        # previously exhausted memory before an image query could finish.
        self.model, _, self.preprocess = open_clip.create_model_and_transforms(
            model_name, pretrained=pretrained, device=DEVICE,
        )
        # MobileCLIP2's CPU FP16 kernels are dramatically slower than FP32 on
        # typical x86 CPUs. Keep FP16 on CUDA, where it is accelerated; use
        # FP32 on CPU. Cloud Run has enough memory for this and the same
        # checkpoint produces numerically equivalent embeddings.
        inference_dtype = torch.float16 if DEVICE == "cuda" else torch.float32
        self.model.to(dtype=inference_dtype).eval()
        self.dtype = next(self.model.parameters()).dtype
        self.model_name = model_name
        self.pretrained = pretrained
        self.tokenizer = open_clip.get_tokenizer(model_name)

    @_inference_mode
    def encode_images(self, images: list[Image.Image], batch_size: int = 64) -> np.ndarray:
        import torch
        import torch.nn.functional as F

        chunks = []
        for i in range(0, len(images), batch_size):
            batch = torch.stack([self.preprocess(im.convert("RGB")) for im in images[i:i + batch_size]]).to(DEVICE, dtype=self.dtype)
            chunks.append(F.normalize(self.model.encode_image(batch).float(), dim=-1).cpu())
        return torch.cat(chunks).numpy().astype("float32")

    @_inference_mode
    def encode_texts(self, texts: list[str]) -> np.ndarray:
        import torch
        import torch.nn.functional as F

        tokens = self.tokenizer(texts).to(DEVICE)
        feats = self.model.encode_text(tokens).float()
        return F.normalize(feats, dim=-1).cpu().numpy().astype("float32")


def build_index(encoder: ClipEncoder, items: list[dict], out_dir: Path = ART_DIR / "retrieval") -> faiss.Index:
    """items: [{"path": <tương đối so với ROOT>, "label": ..., "source": ...}] → lưu index.faiss + meta.json."""
    import faiss

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
        import faiss

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
        self._translation_cache: OrderedDict[str, str] = OrderedDict()
        self._translation_lock = threading.Lock()
        self._translator_client = None
        species_path = DATA_DIR / "species.json"
        species = json.loads(species_path.read_text(encoding="utf-8")) if species_path.is_file() else []
        self._english_name_by_id = {item["id"]: item.get("name_en", item["id"]) for item in species}
        self._species_names = [
            (item["id"], name.casefold())
            for item in species
            for name in (item.get("id", ""), item.get("name_vi", ""), item.get("name_en", ""))
            if name
        ]

    def _label_from_query(self, query: str) -> str | None:
        """Use an explicit flower name as a category constraint, then CLIP-rank its photos."""
        text = _strip_vietnamese_marks(query)
        matches = [
            (len(normalized), species_id)
            for species_id, name in self._species_names
            if (normalized := _strip_vietnamese_marks(name)) and f" {normalized} " in f" {text} "
        ]
        return max(matches)[1] if matches else None

    @staticmethod
    def _is_vietnamese_query(query: str) -> bool:
        vietnamese_words = r"\b(hoa|vườn|vuon|bồ công anh|bo cong anh|cúc|cuc|hồng|hong|hướng dương|huong duong|tulip|vàng|vang|trắng|trang|đỏ|do|nắng|nang|sáng|sang)\b"
        return any("\u00c0" <= ch <= "\u1ef9" for ch in query) or bool(
            re.search(vietnamese_words, query, re.IGNORECASE)
        )

    def _english_query(self, query: str) -> str:
        """Use cached Gemini translation for Vietnamese queries; never load a local MT model."""
        if not self._is_vietnamese_query(query):
            return query
        cache_key = " ".join(query.casefold().split())
        with self._translation_lock:
            cached = self._translation_cache.get(cache_key)
            if cached:
                self._translation_cache.move_to_end(cache_key)
                return cached
            from core.gemini_client import configured_gemini_api_key
            api_key = configured_gemini_api_key()
            if not api_key:
                log.info("Gemini key unavailable for search translation; using local flower vocabulary")
                return self._offline_english_query(query)
            try:
                if self._translator_client is None:
                    from core.gemini_client import create_gemini_client
                    self._translator_client = create_gemini_client(api_key, timeout_ms=8_000)
                response = self._translator_client.models.generate_content(
                    model=GEMINI_MODEL,
                    contents=(
                        "Translate this short Vietnamese visual image-search query into concise English. "
                        "Preserve flower names, colors, and scene details. Output only the translation.\n"
                        f"Query: {query}"
                    ),
                    config={"temperature": 0, "max_output_tokens": 96},
                )
                translated = (response.text or "").strip().strip('"')
                if not translated or len(translated) > 300:
                    return self._offline_english_query(query)
                self._translation_cache[cache_key] = translated
                self._translation_cache.move_to_end(cache_key)
                if len(self._translation_cache) > 256:
                    self._translation_cache.popitem(last=False)
                return translated
            except Exception as exc:
                # A failed/429 translation is intentionally not cached; the next query may retry.
                log.warning("Gemini search translation unavailable (%s); using local flower vocabulary", type(exc).__name__)
                return self._offline_english_query(query)

    def _offline_english_query(self, query: str) -> str:
        """Translate common botanical names/visual terms without network access."""
        text = _strip_vietnamese_marks(query)
        # Use the species catalog rather than maintaining a separate list of
        # flower names. Replacing longest names first avoids partial matches.
        species_names = getattr(self, "_species_names", [])
        english_names = getattr(self, "_english_name_by_id", {})
        for species_id, name in sorted(species_names, key=lambda pair: len(pair[1]), reverse=True):
            normalized = _strip_vietnamese_marks(name)
            if not normalized:
                continue
            english = english_names.get(species_id, species_id.replace("-", " "))
            text = re.sub(rf"\b{re.escape(normalized)}\b", f" {english.casefold()} ", text)

        for vi, en in sorted(_VI_QUERY_PHRASES, key=lambda pair: len(pair[0]), reverse=True):
            text = re.sub(rf"\b{re.escape(vi)}\b", f" {en} ", text)
        tokens = [word for word in re.findall(r"[a-z0-9]+", text) if word not in _VI_FILLER_WORDS]
        # Preserve only translated concepts. Unknown Vietnamese words are
        # usually harmful to an English-only text encoder.
        translated = " ".join(tokens)
        return f"a photograph of {translated or 'a flower'}"

    def _search(self, query_vec: np.ndarray, k: int, label: str | None = None) -> list[dict]:
        # Filter after ranking so a sparse label still fills the requested page.
        candidate_k = self.index.ntotal if label else k
        scores, ids = self.index.search(query_vec, candidate_k)
        results = [
            {"id": int(i), "score": round(float(s), 4), **self.meta[i]}
            for s, i in zip(scores[0], ids[0]) if i != -1
        ]
        results = filter_by_label(results, label)
        return results[:k]

    def search_text(self, query: str, k: int = 8, label: str | None = None) -> list[dict]:
        return self.search_text_with_query(query, k, label)["results"]

    def search_text_with_query(self, query: str, k: int = 8, label: str | None = None) -> dict:
        # A named class is stronger evidence than a weak English-only CLIP text match.
        # Keep CLIP ranking within that flower's photos; preserve the manual filter override.
        matched_label = self._label_from_query(query) if not label else None
        effective_label = label or matched_label
        if matched_label:
            query_used = query
            clip_query = f"a photograph of {self._english_name_by_id.get(matched_label, matched_label)} flower"
        else:
            query_used = self._english_query(query)
            translated_label = self._label_from_query(query_used)
            if translated_label:
                # Gemini may resolve a common Vietnamese synonym (for example
                # "bông cúc" -> "daisy"). Use that explicit class as a light
                # metadata filter, while retaining the translated query for UI.
                effective_label = effective_label or translated_label
                clip_query = f"a photograph of {self._english_name_by_id.get(translated_label, translated_label)} flower"
            else:
                clip_query = f"a photograph of {query_used}"
        return {
            "results": self._search(self.encoder.encode_texts([clip_query]), k, effective_label),
            "query_used": query_used,
            "translated": query_used.casefold() != query.casefold(),
        }

    def search_image(self, image: Image.Image, k: int = 8, label: str | None = None) -> list[dict]:
        return self._search(self.encoder.encode_images([image]), k, label)
