"""Generate a reviewable offline template table from data/species.json.

Reads GOOGLE_API_KEY from .env or the process environment; never prints it.
This script is a one-time authoring tool and is not imported by the web app.
"""
import json
import os
import re
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEMPLATES = {"disk", "bowl", "layered", "swirl5", "bell", "cluster", "star", "spike"}


def read_key():
    if os.getenv("GOOGLE_API_KEY"):
        return os.environ["GOOGLE_API_KEY"].strip()
    env_file = ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            match = re.match(r"\s*GOOGLE_API_KEY\s*=\s*(.*?)\s*$", line)
            if match:
                return match.group(1).strip().strip('"\'')
    raise RuntimeError("GOOGLE_API_KEY is not set in environment or .env")


def ask_gemini(api_key, batch, model):
    prompt = """For every flower record, propose a procedural 3D flower template and compact parameters.
Return ONLY a JSON array. Every item must include id, template (one of disk,bowl,layered,swirl5,bell,cluster,star,spike), confidence (0..1), fallback_photo (boolean), reason (short Vietnamese), and overrides object.
Overrides may contain petalCount (5..60), layerCount (1..5), curvature (0..0.45), petalLength (0.1..1.2), petalWidth (0.03..0.45), tip (round|spatulate|pointed|scallop), petalColor, edgeColor, undersideColor, centerColor, centerSize (0.05..0.4), stemLength (0.5..2.8), leafCount (1..6), leafColor, floretCount (10..48).
Use the supplied species' Vietnamese/international names and description. Select fallback_photo=true when the real morphology is poorly represented by all eight templates (for example orchids, lotus, bird-of-paradise, protea, calla-like spathes, or strongly irregular flowers), or confidence < 0.55. Do not invent species facts. Keep colors close to the provided dominant color, but use green foliage colors only for leaves. Output one item per input, preserve IDs exactly.
Records:\n""" + json.dumps(batch, ensure_ascii=False)
    body = {"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"}}
    model = model or "gemini-2.5-flash"
    req = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            payload = json.loads(response.read())
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")
        # Redact any echoed key and avoid dumping request headers.
        detail = detail.replace(api_key, "[REDACTED]")
        raise RuntimeError(f"Gemini HTTP {exc.code}: {detail[:1000]}") from None
    text = payload["candidates"][0]["content"]["parts"][0]["text"]
    return json.loads(text)


def main():
    species = json.loads((ROOT / "data/species.json").read_text(encoding="utf-8"))
    key = read_key()
    model = os.getenv("FLOWER_PARAMS_GEMINI_MODEL", "gemini-3.8-flash")
    output = []
    progress_path = ROOT / ".flower_params_progress.json"
    if progress_path.exists():
        saved = json.loads(progress_path.read_text(encoding="utf-8"))
        output = saved.get("items", [])
    else:
        output = []
    done_ids = {item.get("id") for item in output}
    for offset in range(0, len(species), 10):
        records = [{k: flower.get(k) for k in ("id", "name_vi", "name_en", "description", "color")} for flower in species[offset:offset + 10]]
        records = [record for record in records if record["id"] not in done_ids]
        if not records:
            continue
        print(f"Requesting Gemini suggestions for batch {offset // 10 + 1}...", flush=True)
        for attempt in range(4):
            try:
                result = ask_gemini(key, records, model)
                break
            except RuntimeError as exc:
                if attempt == 3 or "HTTP 503" not in str(exc):
                    raise
                delay = 3 * (attempt + 1)
                print(f"Gemini busy; retrying in {delay}s", flush=True)
                time.sleep(delay)
        if not isinstance(result, list):
            raise RuntimeError("Gemini returned a non-array response")
        output.extend(result)
        done_ids.update(item.get("id") for item in result)
        progress_path.write_text(json.dumps({"model": model, "items": output}, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Gemini suggestions: {min(offset + len(records), len(species))}/{len(species)}", flush=True)

    by_id = {item.get("id"): item for item in output}
    missing = [item["id"] for item in species if item["id"] not in by_id]
    if missing:
        raise RuntimeError(f"Gemini omitted species IDs: {missing[:12]}")
    normalized = []
    for flower in species:
        suggestion = by_id[flower["id"]]
        if suggestion.get("template") not in TEMPLATES:
            raise RuntimeError(f"Invalid template for {flower['id']}: {suggestion.get('template')}")
        if not isinstance(suggestion.get("overrides"), dict):
            raise RuntimeError(f"Invalid overrides for {flower['id']}")
        normalized.append({
            "id": flower["id"], "name_vi": flower.get("name_vi", ""), "name_en": flower.get("name_en", ""),
            "template": suggestion["template"], "confidence": max(0, min(1, float(suggestion.get("confidence", 0)))),
            "fallback_photo": bool(suggestion.get("fallback_photo", False)),
            "reason": str(suggestion.get("reason", ""))[:280], "color_source": "species.json",
            "dominant_color": flower.get("color"), "overrides": suggestion["overrides"],
        })
    document = {"schema_version": 1, "generated_by": model, "source": "Gemini suggestions from species.json; offline review table, not generated at runtime", "count": len(normalized), "templates": sorted(TEMPLATES), "species": normalized}
    (ROOT / "data/flower_params.json").write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    progress_path.unlink(missing_ok=True)
    fallback = sum(item["fallback_photo"] for item in normalized)
    print(f"Wrote {len(normalized)} species; fallback_photo={fallback}")


if __name__ == "__main__":
    main()
