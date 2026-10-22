import json
import threading
from collections import OrderedDict

import numpy as np

from core.retrieval_light import ClassifierFeatureSearch
from core.retrieval import ImageSearch


class _Shape:
    in_features = 2


class _Model:
    fc = _Shape()


class _Encoder:
    model = _Model()

    def encode_images(self, images):
        return np.asarray([[1.0, 0.0] for _ in images], dtype=np.float32)


class _ClassifyingEncoder(_Encoder):
    min_confidence = 0.7

    def __init__(self, label, score, vector):
        self.label = label
        self.score = score
        self.vector = np.asarray(vector, dtype=np.float32)

    def predict_and_encode(self, image, top_k=1):
        return {"predictions": [{"label": self.label, "score": self.score}]}, self.vector


def _search(tmp_path):
    metadata = [
        {"path": "rose-a.jpg", "label": "Hoa hồng", "species_id": "roses"},
        {"path": "rose-b.jpg", "label": "Hoa hồng", "species_id": "roses"},
        {"path": "daisy.jpg", "label": "Cúc mắt bò", "species_id": "daisy"},
    ]
    (tmp_path / "meta.json").write_text(json.dumps(metadata, ensure_ascii=False), encoding="utf-8")
    np.save(tmp_path / "classifier_features.npy", np.asarray([
        [1.0, 0.0], [0.8, 0.2], [0.0, 1.0],
    ], dtype=np.float32))
    return ClassifierFeatureSearch(_Encoder(), index_dir=tmp_path)


def test_image_query_ranks_similar_classifier_features(tmp_path):
    result = _search(tmp_path).search_image(object(), k=2)
    assert [item["species_id"] for item in result] == ["roses", "roses"]


def test_confident_image_class_constrains_lightweight_gallery(tmp_path):
    search = _search(tmp_path)
    search.classifier = _ClassifyingEncoder("roses", 0.91, [0.0, 1.0])
    result = search.search_image(object(), k=2)
    assert [item["species_id"] for item in result] == ["roses", "roses"]


def test_uncertain_image_class_keeps_global_feature_ranking(tmp_path):
    search = _search(tmp_path)
    search.classifier = _ClassifyingEncoder("roses", 0.3, [0.0, 1.0])
    result = search.search_image(object(), k=1)
    assert [item["species_id"] for item in result] == ["daisy"]


def test_vietnamese_name_query_returns_matching_species(tmp_path):
    result = _search(tmp_path).search_text_with_query("hoa hồng đỏ", k=2)
    assert result["translated"] is False
    assert len(result["results"]) == 2
    assert all(item["species_id"] == "roses" for item in result["results"])


def test_unmatched_text_query_does_not_return_unrelated_photos(tmp_path):
    assert _search(tmp_path).search_text("qzxv nonsense", k=5) == []


def test_offline_query_translation_maps_visual_terms_and_species_names(monkeypatch):
    search = object.__new__(ImageSearch)
    search._translation_cache = OrderedDict()
    search._translation_lock = threading.Lock()
    search._translator_client = None
    search._species_names = [
        ("daisy", "cúc mắt bò"), ("roses", "hoa hồng"),
        ("dandelion", "bồ công anh"),
    ]
    search._english_name_by_id = {
        "daisy": "Oxeye daisy", "roses": "Rose", "dandelion": "Dandelion",
    }
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    translated = search._english_query("Cánh trắng mỏng xếp vòng quanh nhụy vàng, đứng giữa cỏ xanh")
    assert "white" in translated and "yellow" in translated
    assert "green grass" in translated
    assert "arranged in a ring" in translated

    named = search._english_query("Hoa hồng đỏ nhiều lớp")
    assert "rose" in named and "red" in named and "layered petals" in named


def test_offline_query_translation_handles_accentless_vietnamese(monkeypatch):
    search = object.__new__(ImageSearch)
    search._translation_cache = OrderedDict()
    search._translation_lock = threading.Lock()
    search._translator_client = None
    search._species_names = [("dandelion", "Bồ công anh")]
    search._english_name_by_id = {"dandelion": "Dandelion"}
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    assert "dandelion" in search._english_query("bo cong anh vang")


def test_explicit_species_query_matches_with_or_without_vietnamese_accents():
    search = object.__new__(ImageSearch)
    search._species_names = [("roses", "hoa hồng"), ("daisy", "cúc mắt bò")]
    assert search._label_from_query("tìm hoa hồng đỏ") == "roses"
    assert search._label_from_query("tim hoa hong do") == "roses"
