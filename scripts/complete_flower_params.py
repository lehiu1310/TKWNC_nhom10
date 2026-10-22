"""Complete a review table when the optional Gemini free quota is unavailable.

Uses partial authored Gemini responses plus conservative morphology keyword
rules. No runtime generation or fixed species count/name list is used.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def heuristic(flower):
    text = " ".join(str(flower.get(key) or "") for key in ("id", "name_vi", "name_en", "description", "long_description")).lower()
    families = [
        ("layered", r"rose|roses|hồng|peony|mẫu đơn|camellia|trà mi|dahlia|thược dược"),
        ("bowl", r"tulip|tulips|tulíp|crocus|saffron|nghệ tây|cup-shaped"),
        ("swirl5", r"plumeria|frangipani|hoa sứ|cherry blossom|sakura|anh đào|five-petal"),
        ("bell", r"bellflower|campanula|bluebell|chuông|foxglove|digitalis|lily|loa kèn|huệ|gladiolus"),
        ("cluster", r"hydrangea|cẩm tú cầu|lilac|tử đinh hương|elderflower|hoa cơm cháy|lantana|ngũ sắc|verbena|cluster"),
        ("disk", r"daisy|marguerite|cúc|aster|cosmos|sao nhái|marigold|vạn thọ|sunflower|hướng dương|dandelion|bồ công anh|chrysanthemum|gerbera"),
    ]
    for template, pattern in families:
        if re.search(pattern, text):
            confidence = 0.68
            break
    else:
        template, confidence = "disk", 0.32
    complex_pattern = r"orchid|lan hài|lan cattleya|lan hồ điệp|hoa sen|lotus|water lily|hoa súng|thiên điểu|bird of paradise|heliconia|protea|anthurium|hồng môn|calla|arum|passion flower|hoa lạc tiên|bromelia|dứa cảnh|complex"
    unsupported = bool(re.search(complex_pattern, text))
    color = flower.get("color")
    green_color = isinstance(color, str) and re.fullmatch(r"#[0-9a-fA-F]{6}", color) and int(color[3:5], 16) > int(color[1:3], 16) * 0.92
    overrides = {}
    if isinstance(color, str) and re.fullmatch(r"#[0-9a-fA-F]{6}", color) and not green_color:
        overrides["petalColor"] = color
    return {
        "id": flower["id"], "template": template,
        "confidence": 0.28 if unsupported else confidence,
        "fallback_photo": unsupported or confidence < 0.55,
        "reason": "Ảnh thật ưu tiên: hình thái phức tạp, không khớp tốt với sáu mẫu hiện có." if unsupported else (
            f"Gợi ý theo từ khóa hình thái; cần duyệt thủ công (mức tin cậy {confidence:.2f})." if confidence >= 0.55 else
            "Chưa đủ tín hiệu hình thái để chọn mẫu; dùng ảnh thật đến khi được duyệt."
        ),
        "overrides": overrides,
    }


def main():
    species = json.loads((ROOT / "data/species.json").read_text(encoding="utf-8"))
    progress = ROOT / ".flower_params_progress.json"
    gemini_items = json.loads(progress.read_text(encoding="utf-8")).get("items", []) if progress.exists() else []
    by_id = {entry.get("id"): entry for entry in gemini_items}
    records = []
    gemini_count = 0
    for flower in species:
        item = by_id.get(flower["id"])
        provenance = "Gemini"
        if item is None:
            item = heuristic(flower)
            provenance = "offline-keyword-fallback"
        else:
            gemini_count += 1
        records.append({
            "id": flower["id"], "name_vi": flower.get("name_vi", ""), "name_en": flower.get("name_en", ""),
            "template": item["template"], "confidence": max(0, min(1, float(item.get("confidence", 0)))),
            "fallback_photo": bool(item.get("fallback_photo", False)), "reason": str(item.get("reason", ""))[:280],
            "color_source": "species.json", "dominant_color": flower.get("color"),
            "overrides": item.get("overrides", {}), "suggestion_source": provenance,
        })
    document = {
        "schema_version": 1, "generated_by": "Gemini partial + deterministic morphology keyword fallback",
        "source": "Suggestions are an offline authoring table; no model calls occur in the web app.",
        "gemini_model": "gemini-3.8-flash", "gemini_suggestions": gemini_count,
        "note": "Gemini free-tier quota was exhausted during generation; records marked offline-keyword-fallback require manual review.",
        "count": len(records), "species": records,
    }
    (ROOT / "data/flower_params.json").write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(records)} records; Gemini={gemini_count}; local fallback={len(records)-gemini_count}; photo fallback={sum(x['fallback_photo'] for x in records)}")


if __name__ == "__main__":
    main()
