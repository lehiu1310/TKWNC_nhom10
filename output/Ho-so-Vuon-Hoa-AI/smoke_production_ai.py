"""Run one cost-free production smoke request per AI route and save redacted evidence."""
from __future__ import annotations

import json
import time
from datetime import datetime
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
BASE = "https://tkwnc-nhom10.vercel.app"
SAMPLE = ROOT / "web/public/samples/detector/sunflowers.jpg"
REVISION = "ec114f731cd180f49e31d90631f9d1d87fc69b5d"
DEPLOY = "dep-dbd5kt6i0phs73es5v1g"


def request_json(path: str, *, fields: dict[str, str] | None = None, json_body: dict | None = None) -> tuple[int, dict, float]:
    headers = {"Accept": "application/json"}
    if json_body is not None:
        body = json.dumps(json_body).encode()
        headers["Content-Type"] = "application/json"
    else:
        boundary = "----CodexProductionSmokeBoundary"
        chunks: list[bytes] = []
        with SAMPLE.open("rb") as image:
            payload = image.read()
        chunks.extend([
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"sunflowers.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n".encode(),
            payload,
            b"\r\n",
        ])
        for name, value in (fields or {}).items():
            chunks.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n".encode())
        chunks.append(f"--{boundary}--\r\n".encode())
        body = b"".join(chunks)
        headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"

    request = Request(f"{BASE}{path}", data=body, headers=headers, method="POST")
    started = time.perf_counter()
    try:
        with urlopen(request, timeout=180) as response:
            status = response.status
            payload = json.loads(response.read())
    except HTTPError as exc:
        status = exc.code
        try:
            payload = json.loads(exc.read())
        except Exception:
            payload = {}
    elapsed = round(time.perf_counter() - started, 2)
    return status, payload, elapsed


def safe_result(name: str, path: str, *, fields: dict[str, str] | None = None, json_body: dict | None = None) -> dict:
    started = time.perf_counter()
    try:
        status, payload, elapsed = request_json(path, fields=fields, json_body=json_body)
        if name == "classify":
            values = payload.get("predictions", payload.get("results", []))
            labels = [item.get("species_id", item.get("label", item.get("class_name"))) for item in values[:3]]
            detail = {"top_labels": labels}
        elif name == "detect":
            values = payload.get("detections", payload.get("results", []))
            detail = {"detection_count": len(values), "labels": [item.get("species_id", item.get("label", item.get("class_name"))) for item in values[:5]]}
        elif name in {"image_search", "text_search_vi"}:
            values = payload.get("results", [])
            detail = {"result_count": len(values), "top_species_ids": [item.get("species_id", item.get("id")) for item in values[:5]]}
        else:
            detail = {"answer_present": bool(payload.get("answer")), "source_count": len(payload.get("sources", [])), "provider": payload.get("provider")}
        return {"name": name, "path": path, "status": status, "elapsed_seconds": elapsed, **detail}
    except (TimeoutError, URLError, OSError, ValueError) as exc:
        return {"name": name, "path": path, "status": None, "elapsed_seconds": round(time.perf_counter() - started, 2), "error_type": type(exc).__name__}


if __name__ == "__main__":
    if not SAMPLE.is_file():
        raise FileNotFoundError(SAMPLE)
    results = [
        safe_result("classify", "/api/classify", fields={"top_k": "3"}),
        safe_result("detect", "/api/detect", fields={"conf": "0.25"}),
        safe_result("image_search", "/api/search/image", fields={"k": "5"}),
        safe_result("text_search_vi", "/api/search/text", json_body={"query": "đóa vàng lớn với tâm nâu tròn, cánh xếp tỏa ra ngoài", "k": 5}),
        safe_result("rag_chat", "/api/chat/sync", json_body={"message": "Hoa hướng dương cần ánh sáng như thế nào?", "history": []}),
    ]
    record = {
        "observed_at_local": datetime.now().astimezone().isoformat(),
        "revision": REVISION,
        "deploy_id": DEPLOY,
        "api_origin": BASE,
        "sample_image": "web/public/samples/detector/sunflowers.jpg",
        "billing_enabled": False,
        "results": results,
        "scope_note": "One request per AI route on current Render live backend via the public Vercel same-origin gateway. This is a smoke check, not a benchmark or independent model evaluation. Only redacted status, timings, labels and counts are saved; no secrets or full generated response are retained.",
    }
    output = ROOT / "reports/current-production-ai-smoke-live-2026-10-23.json"
    output.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(record, ensure_ascii=False, indent=2))
