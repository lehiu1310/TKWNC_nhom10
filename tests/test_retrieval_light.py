import json

import numpy as np

from core.retrieval_light import ClassifierFeatureSearch


class _Shape:
    in_features = 2


class _Model:
    fc = _Shape()


class _Encoder:
    model = _Model()

    def encode_images(self, images):
        return np.asarray([[1.0, 0.0] for _ in images], dtype=np.float32)


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


def test_vietnamese_name_query_returns_matching_species(tmp_path):
    result = _search(tmp_path).search_text_with_query("hoa hồng đỏ", k=2)
    assert result["translated"] is False
    assert len(result["results"]) == 2
    assert all(item["species_id"] == "roses" for item in result["results"])


def test_unmatched_text_query_does_not_return_unrelated_photos(tmp_path):
    assert _search(tmp_path).search_text("qzxv nonsense", k=5) == []
