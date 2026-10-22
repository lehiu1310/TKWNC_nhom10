"""Expand template defaults plus review suggestions into explicit species parameters."""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def green_accent(hex_color):
    if not isinstance(hex_color, str) or not re.fullmatch(r"#[0-9a-fA-F]{6}", hex_color):
        return False
    r, g, b = (int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5))
    maximum, minimum = max(r, g, b), min(r, g, b)
    delta = maximum - minimum
    if not delta:
        return False
    hue = 60 * (((g - b) / delta) % 6) if maximum == r else 60 * ((b - r) / delta + 2) if maximum == g else 60 * ((r - g) / delta + 4)
    return 78 <= hue <= 165


def main():
    species = json.loads((ROOT / "data/species.json").read_text(encoding="utf-8"))
    table_path = ROOT / "data/flower_params.json"
    table = json.loads(table_path.read_text(encoding="utf-8"))
    defaults = json.loads((ROOT / "data/flower_template_defaults.json").read_text(encoding="utf-8"))
    photo_colors = json.loads((ROOT / "data/flower_photo_colors.json").read_text(encoding="utf-8-sig"))
    rows = {row["id"]: row for row in table["species"]}
    colors_by_id = {row["id"]: row for row in photo_colors}
    for record in species:
        row = rows[record["id"]]
        base = defaults[row["template"]]["params"].copy()
        suggestion = row.get("overrides", {})
        parameters = {**base, **suggestion}
        digest = hashlib.sha256(record["id"].encode()).digest()
        seed = int.from_bytes(digest[:4], "big")
        template = row["template"]
        # Bounded variation gives each same-family specimen a distinct scale
        # and petal count without adding hand-authored per-species geometry.
        if record["id"] == "daisy":
            parameters = base.copy()
        else:
            count_base = {"disk": 22, "bowl": 6, "layered": 37, "swirl5": 5, "bell": 6, "cluster": 5, "star": 6, "spike": 5}[template]
            count_span = {"disk": 7, "bowl": 3, "layered": 13, "swirl5": 2, "bell": 3, "cluster": 1, "star": 3, "spike": 1}[template]
            parameters["petalCount"] = count_base + seed % count_span
            parameters["layerCount"] = (3 + (seed >> 5) % 3) if template == "layered" else 1
            scale = 0.94 + ((seed >> 9) % 13) / 100
            parameters["petalLength"] = round(float(parameters["petalLength"]) * scale, 3)
            parameters["petalWidth"] = round(float(parameters["petalWidth"]) * (1.06 - (seed >> 13) % 13 / 100), 3)
            parameters["stemLength"] = round(float(parameters["stemLength"]) * (0.94 + ((seed >> 17) % 13) / 100), 3)
            parameters["leafCount"] = 2 + (seed >> 21) % 4
            if template == "cluster":
                parameters["floretCount"] = 24 + (seed >> 25) % 17
            if template == "spike":
                parameters["floretCount"] = 38 + (seed >> 25) % 21
        dataset_color = record.get("color")
        photo_color = colors_by_id.get(record["id"], {}).get("photo_color")
        photo_mismatch = bool(colors_by_id.get(record["id"], {}).get("mismatch"))
        # species.json colors may be UI accent colors; use them as petal tones
        # only if they are chromatic and not foliage green.
        if record["id"] != "daisy":
            if photo_color and (photo_mismatch or green_accent(dataset_color or "")):
                parameters["petalColor"] = photo_color
            elif dataset_color and not green_accent(dataset_color):
                parameters["petalColor"] = dataset_color
        row["parameters"] = parameters
        row["photo_color"] = photo_color
        row["photo_color_mismatch"] = photo_mismatch
        row["parameter_source"] = "template defaults + bounded morphology variation + curated/Gemini overrides + photo hue when dataset color disagrees/is foliage"
    table["count"] = len(species)
    table["explicit_parameter_count"] = sum(bool(row.get("parameters")) for row in table["species"])
    table_path.write_text(json.dumps(table, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Expanded explicit parameters for {len(species)} species")


if __name__ == "__main__":
    main()
