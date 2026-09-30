"""Smoke/load test 4 AI routes against a deployed API.

Run: locust -f locustfile.py --host https://YOUR_BACKEND --headless -u 1 -r 1 \
     --run-time 20m --only-summary
Set FLOWER_TEST_IMAGE to a representative image file. Use a small user count on free tiers.
"""
import os
from pathlib import Path

from locust import HttpUser, between, tag, task

IMAGE_PATH = Path(os.environ.get("FLOWER_TEST_IMAGE", ""))


class FlowerApiUser(HttpUser):
    wait_time = between(0.2, 0.8)

    def on_start(self):
        if not IMAGE_PATH.is_file():
            raise RuntimeError("Set FLOWER_TEST_IMAGE to a valid flower image path")
        self.image = IMAGE_PATH.read_bytes()

    @task(1)
    @tag("classify")
    def classify(self):
        self.client.post("/api/classify", files={"file": (IMAGE_PATH.name, self.image, "image/jpeg")},
                         data={"top_k": "5"}, name="/api/classify")

    @task(1)
    @tag("detect")
    def detect(self):
        self.client.post("/api/detect", files={"file": (IMAGE_PATH.name, self.image, "image/jpeg")},
                         name="/api/detect")

    @task(1)
    @tag("search-image")
    def image_search(self):
        self.client.post("/api/search/image", files={"file": (IMAGE_PATH.name, self.image, "image/jpeg")},
                         data={"k": "8"}, name="/api/search/image")

    @task(1)
    @tag("chat")
    def rag_chat(self):
        self.client.post("/api/chat/sync", json={"message": "Hoa hồng thường nở vào mùa nào?"},
                         name="/api/chat/sync")
