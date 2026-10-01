"""Test API không cần GPU hay tải mô hình: thay mô hình thật bằng bản giả (dependency injection).
Chạy: ENABLED_MODELS= pytest -q"""
import io
import os

os.environ["ENABLED_MODELS"] = ""  # không nạp mô hình thật khi khởi động

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from api import main


class FakeClassifier:
    def predict(self, image, top_k=3):
        return {"predictions": [{"label": "roses", "score": 0.9}][:top_k], "confident": True}

    def explain(self, image):
        return image


class FakeDetector:
    def detect(self, image, conf=0.25):
        return {"detections": [{"label": "person", "score": 0.8, "box_xyxy": [0, 0, 10, 10]}],
                "summary": {"person": 1}}, image


class FakeBot:
    def stream(self, message, history=None):
        return [{"source": "doi_tra.md", "text": "7 ngày", "score": 0.9}], iter(["Được ", "7 ngày."])

    def answer(self, message, history=None):
        return {"answer": "Được 7 ngày.", "sources": []}


class FakeSearch:
    def __init__(self, image_path=None):
        self.meta = [{"id": 0, "path": str(image_path or __file__)}]

    def search_text(self, query, k=8, label=None):
        return [{"id": 0, "path": self.meta[0]["path"], "score": 0.9}]

    def search_image(self, image, k=8, label=None):
        return [{"id": 0, "path": self.meta[0]["path"], "score": 0.9}]


def png_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (32, 32), "red").save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture()
def client():
    with TestClient(main.app) as c:
        main.ENABLED_MODELS = {"classifier", "detector", "retrieval", "llm"}
        main.MODELS.update(classifier=FakeClassifier(), detector=FakeDetector(), llm=FakeBot())
        yield c
        main.MODELS.clear()


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


def test_health_unknown_component_is_400(client):
    assert client.get("/api/health", params={"model": "not-a-component"}).status_code == 400


def test_health_invalid_component_length_is_422(client):
    assert client.get("/api/health", params={"model": "x" * 33}).status_code == 422


def test_species_list_query_validation(client):
    assert client.get("/api/species").status_code == 200
    assert client.get("/api/species", params={"limit": 0}).status_code == 400
    assert client.get("/api/species", params={"limit": "many"}).status_code == 422


def test_classify_ok(client):
    r = client.post("/api/classify", files={"file": ("a.png", png_bytes(), "image/png")}, data={"top_k": 1})
    assert r.status_code == 200
    assert r.json()["predictions"][0]["label"] == "roses"


def test_classify_gradcam_overlay_is_optional(client):
    response = client.post("/api/classify", files={"file": ("rose.png", png_bytes(), "image/png")},
                           data={"explain": "true"})
    assert response.status_code == 200
    assert response.json()["grad_cam"].startswith("data:image/jpeg;base64,")


def test_classify_rejects_non_image(client):
    r = client.post("/api/classify", files={"file": ("a.txt", b"hello", "text/plain")})
    assert r.status_code == 400


def test_detect_returns_annotated_image(client):
    r = client.post("/api/detect", files={"file": ("a.png", png_bytes(), "image/png")})
    assert r.status_code == 200 and r.json()["image"].startswith("data:image/jpeg;base64,")


def test_model_not_enabled_returns_503(client, monkeypatch):
    monkeypatch.setattr(main, "ENABLED_MODELS", {"classifier", "detector", "llm"})
    r = client.post("/api/search/text", json={"query": "a dog"})
    assert r.status_code == 503


def test_empty_query_returns_422(client):
    assert client.post("/api/search/text", json={"query": ""}).status_code == 422


def test_chat_stream_events(client):
    with client.stream("POST", "/api/chat", json={"message": "Đổi trả?"}) as r:
        body = "".join(r.iter_text())
    assert '"type": "sources"' in body and '"type": "done"' in body and "7 ngày" in body


def test_species_list_ok(client):
    r = client.get("/api/species")
    assert r.status_code == 200 and len(r.json()) >= 5


def test_species_image_ok(client, tmp_path, monkeypatch):
    image_path = tmp_path / "flower.png"
    Image.new("RGB", (4, 4), "pink").save(image_path)
    monkeypatch.setattr(main, "ROOT", tmp_path)
    monkeypatch.setattr(main, "resolve_path", lambda path: image_path)
    monkeypatch.setattr(main, "species", lambda: [{"id": "test-flower", "image": "flower.png"}])
    r = client.get("/api/species/test-flower/image")
    assert r.status_code == 200 and r.headers["content-type"] == "image/png"


def test_species_image_unknown_is_404(client):
    assert client.get("/api/species/not-a-species/image").status_code == 404


def test_species_image_invalid_id_is_400(client):
    assert client.get("/api/species/not_a_species/image").status_code == 400


def test_species_image_long_id_is_422(client):
    assert client.get(f"/api/species/{'x' * 129}/image").status_code == 422


def test_classify_missing_file_is_422(client):
    assert client.post("/api/classify").status_code == 422


def test_detect_bad_image_is_400(client):
    r = client.post("/api/detect", files={"file": ("bad.png", b"not an image", "image/png")})
    assert r.status_code == 400


def test_detect_missing_file_is_422(client):
    assert client.post("/api/detect").status_code == 422


def test_search_text_ok(client, monkeypatch):
    monkeypatch.setattr(main, "_require", lambda name: FakeSearch())
    r = client.post("/api/search/text", json={"query": "hoa hồng", "k": 2})
    assert r.status_code == 200 and r.json()["results"][0]["score"] == 0.9


def test_search_text_blank_query_is_400(client):
    assert client.post("/api/search/text", json={"query": "   "}).status_code == 400


def test_search_text_invalid_k_is_422(client):
    assert client.post("/api/search/text", json={"query": "hoa", "k": 0}).status_code == 422


def test_search_text_label_filter_is_forwarded(client, monkeypatch):
    class LabelSearch(FakeSearch):
        def search_text(self, query, k=8, label=None):
            assert label == "roses"
            return [{"id": 0, "path": self.meta[0]["path"], "score": 0.9}]

    monkeypatch.setattr(main, "_require", lambda name: LabelSearch())
    response = client.post("/api/search/text", json={"query": "red flower", "label": "roses"})
    assert response.status_code == 200


def test_search_text_invalid_label_is_422(client):
    assert client.post("/api/search/text", json={"query": "hoa", "label": ""}).status_code == 422


def test_search_image_ok(client, monkeypatch):
    monkeypatch.setattr(main, "_require", lambda name: FakeSearch())
    r = client.post("/api/search/image", files={"file": ("a.png", png_bytes(), "image/png")})
    assert r.status_code == 200 and len(r.json()["results"]) == 1


def test_search_image_bad_image_is_400(client, monkeypatch):
    monkeypatch.setattr(main, "_require", lambda name: FakeSearch())
    r = client.post("/api/search/image", files={"file": ("bad.png", b"bad", "image/png")})
    assert r.status_code == 400


def test_search_image_missing_file_is_422(client):
    assert client.post("/api/search/image").status_code == 422


def test_gallery_ok(client, monkeypatch, tmp_path):
    image_path = tmp_path / "gallery.png"
    Image.new("RGB", (4, 4), "red").save(image_path)
    monkeypatch.setattr(main, "_require", lambda name: FakeSearch(image_path))
    r = client.get("/api/gallery/0")
    assert r.status_code == 200 and r.headers["content-type"] == "image/png"


def test_gallery_invalid_id_is_422(client):
    assert client.get("/api/gallery/not-an-integer").status_code == 422


def test_gallery_negative_id_is_400(client):
    assert client.get("/api/gallery/-1").status_code == 400


def test_chat_sync_ok(client):
    r = client.post("/api/chat/sync", json={"message": "Hoa cần tưới không?"})
    assert r.status_code == 200 and r.json()["answer"]


def test_chat_and_sync_missing_message_are_422(client):
    assert client.post("/api/chat", json={}).status_code == 422
    assert client.post("/api/chat/sync", json={}).status_code == 422


def test_chat_and_sync_blank_message_are_400(client):
    assert client.post("/api/chat", json={"message": "   "}).status_code == 400
    assert client.post("/api/chat/sync", json={"message": "   "}).status_code == 400


def test_chat_message_too_long_is_422(client):
    payload = {"message": "hoa " * 251}
    assert client.post("/api/chat", json=payload).status_code == 422
    assert client.post("/api/chat/sync", json=payload).status_code == 422
