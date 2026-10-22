"""Classifier-feature image retrieval for memory-limited CPU deployments."""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

import numpy as np
from PIL import Image

from config import ART_DIR, CLASSIFIER_RETRIEVAL_LABEL_MIN_CONFIDENCE, DATA_DIR


def _normalize(value: str) -> str:
    value = unicodedata.normalize("NFD", value.casefold())
    value = "".join(char for char in value if unicodedata.category(char) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", value).strip()


class ClassifierFeatureSearch:
    """Reuse the flower classifier's ResNet features instead of loading a second CLIP model."""

    def __init__(self, classifier, index_dir: Path = ART_DIR / "retrieval"):
        self.classifier = classifier
        index_dir = Path(index_dir)
        self.meta = json.loads((index_dir / "meta.json").read_text(encoding="utf-8"))
        self.features = np.load(index_dir / "classifier_features.npy", mmap_mode="r")
        if self.features.ndim != 2 or len(self.meta) != len(self.features):
            raise RuntimeError("Classifier feature index does not match retrieval metadata")
        if self.features.shape[1] != classifier.model.fc.in_features:
            raise RuntimeError("Classifier feature index has an incompatible dimension")

        species_path = DATA_DIR / "species.json"
        species = json.loads(species_path.read_text(encoding="utf-8"))
        self._aliases = []
        self._text_by_id = {}
        for item in species:
            species_id = item["id"]
            fields = [item.get(key, "") for key in ("name_vi", "name_en", "meaning", "description", "long_description")]
            fields.extend(item.get("facts", []))
            self._text_by_id[species_id] = _normalize(" ".join(map(str, fields)))
            for alias in (species_id, item.get("name_vi", ""), item.get("name_en", "")):
                normalized = _normalize(str(alias))
                if len(normalized) >= 3 and normalized not in {"hoa", "flower"}:
                    self._aliases.append((normalized, species_id))

    def _rank(self, query: np.ndarray, k: int, label: str | None = None) -> list[dict]:
        ids = np.arange(len(self.meta))
        if label:
            ids = np.asarray([i for i, item in enumerate(self.meta)
                              if label.casefold() in {str(item.get("species_id", "")).casefold(),
                                                      str(item.get("label", "")).casefold()}], dtype=np.int64)
        if ids.size == 0:
            return []
        scores = np.asarray(self.features[ids], dtype=np.float32) @ query.astype(np.float32)
        order = np.argsort(-scores, kind="stable")[:max(1, min(int(k), 24))]
        return [{"id": int(i), "score": round(float(scores[pos]), 4), **self.meta[int(i)]}
                for pos, i in ((int(pos), int(ids[pos])) for pos in order)]

    def search_image(self, image: Image.Image, k: int = 8, label: str | None = None) -> list[dict]:
        predicted_label = None
        if hasattr(self.classifier, "predict_and_encode"):
            prediction, query = self.classifier.predict_and_encode(image, top_k=1)
            top = prediction.get("predictions", [{}])[0]
            if not label and float(top.get("score", 0)) >= CLASSIFIER_RETRIEVAL_LABEL_MIN_CONFIDENCE:
                predicted_label = str(top.get("label", "")) or None
        else:
            query = self.classifier.encode_images([image])[0]
        # On small deployments, the ResNet embedding is less discriminative
        # across flower species than CLIP. For a confident top-1 class, restrict
        # the similar-photo gallery to that class; keep global ranking when the
        # classifier is uncertain or the user explicitly supplies a label.
        return self._rank(query, k, label or predicted_label)

    def search_text_with_query(self, query: str, k: int = 8, label: str | None = None) -> dict:
        normalized = _normalize(query)
        matched = label
        if matched is None:
            matches = [(len(alias), species_id) for alias, species_id in self._aliases
                       if f" {alias} " in f" {normalized} "]
            if matches:
                matched = max(matches)[1]

        if matched is None:
            terms = {term for term in normalized.split() if len(term) > 2 and term not in {"hoa", "flower", "mau"}}
            lexical = []
            for species_id, text in self._text_by_id.items():
                overlap = len(terms.intersection(text.split()))
                if overlap:
                    lexical.append((overlap, species_id))
            if lexical:
                matched = max(lexical)[1]

        if matched is None:
            return {"results": [], "query_used": query, "translated": False}

        ids = [i for i, item in enumerate(self.meta) if item.get("species_id") == matched]
        if not ids:
            return {"results": [], "query_used": query, "translated": False}
        centroid = np.asarray(self.features[ids], dtype=np.float32).mean(axis=0)
        norm = float(np.linalg.norm(centroid))
        if norm:
            centroid /= norm
        return {"results": self._rank(centroid, k, matched), "query_used": query, "translated": False}

    def search_text(self, query: str, k: int = 8, label: str | None = None) -> list[dict]:
        return self.search_text_with_query(query, k, label)["results"]
