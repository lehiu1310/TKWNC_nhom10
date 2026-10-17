"""Apply deterministic morphology checks to Gemini suggestions for review."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RULES = [
    ("spike", r"snapdragon|mõm sói|red ginger|gừng đỏ|grape hyacinth|dạ hương nho|sweet william|cẩm chướng chùm|carnation|cẩm chướng|garden phlox|phlox|prince of wales feathers|mào gà|cautleya|allium|hoa tỏi|gladiolus|lay ơn|bee balm|bạc hà ong|ball moss|rêu cầu"),
    ("star", r"iris|diên vĩ|poppy|anh túc|anemone|hải quỳ|pansy|viola|buttercup|mao lương|primrose|primula|anh thảo|gaura|hibiscus|dâm bụt|magnolia|mộc lan|clematis|columbine|hoa bồ câu|tree mallow|cẩm quỳ|petunia|dạ yên thảo|windflower|cỏ chân ngỗng|silverbush|bìm bạc|sweet pea|đậu thơm|wallflower|azalea|đỗ quyên|geranium|phong lữ|pelargonium|cyclamen|mallow|morning glory|bìm bìm|love in the mist|hoa tình yêu trong sương|sea holly|kế biển"),
    ("cluster", r"thistle|kế gai|kế cầu|pincushion|scabiosa|artichoke|atisô|globe flower|cầu hoa|hydrangea|cẩm tú cầu|lilac|tử đinh hương|elderflower|lantana|ngũ sắc|verbena|watercress|cải xoong"),
    ("layered", r"rose|hồng|dahlia|thược dược|peony|mẫu đơn|camellia|trà mi|carnation|cẩm chướng|poinsettia|trạng nguyên"),
    ("bowl", r"tulip|tulíp|crocus|anh thảo hồng|globe flower|cát tường|lisianthus|eustoma"),
    ("bell", r"bellflower|campanula|bluebell|chuông|foxglove|digitalis|daffodil|thủy tiên|trumpet creeper|đăng tiêu|lily|loa kèn|huệ|fritillary|gentian|long đởm|monkshood|ô đầu|thorn.?apple|cà độc dược"),
    ("disk", r"daisy|cúc|sunflower|hướng dương|dandelion|bồ công anh|aster|cosmos|sao nhái|marigold|vạn thọ|coneflower|echinacea|blanket flower|gaillardia|colt.?s foot|khoản đông"),
]
COMPLEX = re.compile(r"orchid|lan hài|lan cattleya|lan hồ điệp|lotus|hoa sen|water lily|hoa súng|bird of paradise|thiên điểu|heliconia|protea|anthurium|hồng môn|calla|arum|passion.?flower|lạc tiên|bromelia|dứa cảnh", re.I)


def add_source(item, label):
    parts = list(dict.fromkeys(part.strip() for part in item["suggestion_source"].split(";") if part.strip()))
    if label not in parts:
        parts.append(label)
    item["suggestion_source"] = "; ".join(parts)


def main():
    species = json.loads((ROOT / "data/species.json").read_text(encoding="utf-8"))
    path = ROOT / "data/flower_params.json"
    document = json.loads(path.read_text(encoding="utf-8"))
    records = {record["id"]: record for record in document["species"]}
    reclassified = 0
    for flower in species:
        item = records[flower["id"]]
        text = " ".join(str(flower.get(key) or "") for key in ("id", "name_vi", "name_en", "description", "long_description"))
        if COMPLEX.search(text):
            item["fallback_photo"] = True
            item["confidence"] = min(float(item["confidence"]), 0.49)
            item["reason"] = "Hình thái phức tạp/đặc trưng; ảnh thật được ưu tiên thay vì mô hình gần đúng."
            add_source(item, "complexity guard")
            continue
        match = next(((template, pattern) for template, pattern in RULES if re.search(pattern, text, re.I)), None)
        if match:
            template, _ = match
            if item["template"] != template or item["fallback_photo"]:
                item["template"] = template
                item["confidence"] = max(0.64, float(item["confidence"]))
                item["fallback_photo"] = False
                item["reason"] = f"Đã hiệu chỉnh silhouette '{template}' theo từ khóa hình thái; vẫn cần xem contact sheet."
                add_source(item, "morphology audit")
                # Keep only explicit palette advice from Gemini; the template
                # supplies shape-derived dimensions and leaf parameters.
                item["overrides"] = {k: v for k, v in item.get("overrides", {}).items() if k in {"petalColor", "edgeColor", "undersideColor", "centerColor"}}
                reclassified += 1
    document["templates"] = sorted(set(item["template"] for item in document["species"]))
    document["morphology_audited"] = True
    document["morphology_reclassified"] = reclassified
    document["source"] = (
        "Suggestions are an offline authoring table; no model calls occur in the web app. "
        "Deterministic morphology keyword audit applied after model suggestions."
    )
    path.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Reclassified {reclassified}; models={sum(not x['fallback_photo'] for x in document['species'])}; photo fallbacks={sum(x['fallback_photo'] for x in document['species'])}")


if __name__ == "__main__":
    main()
