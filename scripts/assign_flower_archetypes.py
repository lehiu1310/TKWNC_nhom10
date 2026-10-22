"""Assign each flower to a local geometry archetype without an LLM call.

Rules intentionally favor a real reference photo when a flower's silhouette
is distinctive enough that a generic radial flower would be misleading.
"""
from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Order is significant: specific morphological families precede broad words
# such as "lily", "flower", or Vietnamese "cúc".
RULES = [
    ("passionflower", .99, True, r"passion[- ]flower|passiflora|lạc tiên"),
    ("orchid", .99, True, r"orchid|orchidaceae|lan hài|lan cattleya|lan hồ điệp|cattleya|phalaenopsis"),
    ("iris", .98, False, r"iris|diên vĩ|diên vi|blackberry lily|iris râu"),
    ("water_lily", .99, False, r"water[- ]lily|water lily|lotus|hoa súng|hoa sen|sen|súng"),
    ("spadix", .98, False, r"arum|anthurium|hồng môn|mo hoa|calla|arum lily"),
    ("thistle", .97, False, r"thistle|atisô|atiso|artichoke|kế gai|kế cầu|kế biển"),
    ("exotic", .93, True, r"bird[- ]of[- ]paradise|thiên điểu|protea|king protea|bromelia|bromeliad|dứa cảnh|columbine|hoa bồ câu"),
    ("rose_rolled", .99, False, r"(^|[\s-])roses?($|[\s-])|hoa hồng"),
    ("long_spike", .94, False, r"sword lily|lay ơn|gladiolus|foxglove|digitalis|snapdragon|mõm sói|red ginger|gừng đỏ|cautleya|bee balm|bạc hà ong|prince of wales feathers|mào gà đuôi phụng|gaura"),
    ("bowl", .95, False, r"tulip|tulips|tulíp|crocus|nghệ tây|poppy|anh túc|buttercup|mao lương|balloon flower|cát cánh|globe[- ]flower|cầu hoa"),
    ("swirl5", .97, False, r"frangipani|plumeria|hoa sứ|hibiscus|dâm bụt|desert[- ]rose|sứ thái|geranium|phong lữ|mallow|cẩm quỳ|azalea|đỗ quyên|camellia|trà mi"),
    ("bell", .96, False, r"bell|chuông|morning glory|bìm bìm|petunia|dạ yên thảo|trumpet|đăng tiêu|gentian|long đởm|monkshood|ô đầu|cyclamen|anh thảo cyclamen"),
    ("star_lily", .96, False, r"lily|lilies|ly peru|ly hổ|huệ|daffodil|thủy tiên|canna|dong riềng|hippeastrum|magnolia|mộc lan|fritillary|lily cóc|toad lily|clematis|ông lão"),
    ("small_cluster", .92, False, r"grape hyacinth|dạ hương nho|carnation|cẩm chướng|sweet william|garden phlox|phlox|masterwort|astrantia|poinsettia|trạng nguyên|wallflower|watercress|cải xoong|ball moss|rêu cầu|bougainvillea|hoa giấy|siam tulip|nghệ thái|cautleya|cầu hoa|globe[- ]flower"),
    ("round_cluster", .90, False, r"dandelion|bồ công anh|globe thistle|scabiosa|pincushion|echinacea|coneflower|sea holly|kế biển|gaillardia|blanket flower|blanket-flower"),
    ("disk", .94, False, r"daisy|cúc|sunflower|hướng dương|marigold|vạn thọ|aster|osteospermum|gazania|anemone|windflower|colt'?s foot|khoản đông hoa|japanese anemone|black-eyed susan|cúc mắt đen|spring crocus"),
]

# Exact IDs disambiguate common names and resolve overlapping terms.
ID_RULES = {
    "daisy": ("disk", .99, False, "Oxeye daisy: một đầu hoa dạng đĩa với hoa tia và tâm vàng."),
    "dandelion": ("disk", .99, False, "Dandelion: đầu hoa dạng đĩa gồm nhiều hoa nhỏ hình ống."),
    "roses": ("rose_rolled", .99, False, "Rose: cánh nhiều lớp cuộn xoắn quanh nụ trung tâm."),
    "sunflowers": ("disk", .99, False, "Sunflower: đầu hoa lớn dạng đĩa, tia vàng và tâm hạt."),
    "tulips": ("bowl", .99, False, "Tulip: sáu cánh lớn khép thành chén."),
    "globe-thistle": ("thistle", .99, False, "Globe thistle: đầu hoa hình cầu với nhiều hoa nhỏ và lá bắc nhọn."),
    "spear-thistle": ("thistle", .99, False, "Spear thistle: đầu hoa có lá bắc gai nhọn."),
    "artichoke": ("thistle", .99, False, "Artichoke: cụm hoa dạng đầu lớn được bao bởi lá bắc nhọn."),
    "yellow-iris": ("iris", .99, False, "Yellow iris: ba cánh rủ và ba cánh đứng đặc trưng."),
    "bearded-iris": ("iris", .99, False, "Bearded iris: cánh rủ, cánh đứng và mào hoa riêng biệt."),
    "blackberry-lily": ("iris", .98, False, "Blackberry lily: dạng hoa sáu phần gần nhóm iris."),
    "water-lily": ("water_lily", .99, False, "Water lily: nhiều vòng cánh tỏa trên lá nổi tròn."),
    "lotus": ("water_lily", .99, False, "Lotus: nhiều vòng cánh tỏa, hình thái phù hợp khuôn sen/súng."),
    "passion-flower": ("passionflower", .99, True, "Lạc tiên có vòng tua và cấu trúc trung tâm phức tạp; ưu tiên ảnh thật."),
    "hard-leaved-pocket-orchid": ("orchid", .99, True, "Lan hài có môi hình túi đặc trưng; ưu tiên ảnh thật."),
    "ruby-lipped-cattleya": ("orchid", .99, True, "Lan Cattleya có môi hoa nổi bật; ưu tiên ảnh thật."),
    "moon-orchid": ("orchid", .99, True, "Lan hồ điệp có cánh và môi bất đối xứng tinh vi; ưu tiên ảnh thật."),
    "bird-of-paradise": ("exotic", .99, True, "Thiên điểu có lá bắc mỏ chim riêng biệt, chưa dựng khuôn an toàn."),
    "king-protea": ("exotic", .99, True, "Protea có lớp lá bắc lớn và hình thái đặc trưng; ưu tiên ảnh thật."),
    "bromelia": ("exotic", .99, True, "Dứa cảnh có cụm lá bắc phức tạp; ưu tiên ảnh thật."),
    "anthurium": ("spadix", .99, False, "Hồng môn có mo bao quanh trụ hoa."),
    "giant-white-arum-lily": ("spadix", .99, False, "Rum trắng có mo bao quanh trụ hoa."),
    "frangipani": ("swirl5", .99, False, "Hoa sứ có năm cánh bầu xoáy quanh họng hoa."),
    "hibiscus": ("swirl5", .99, False, "Dâm bụt có năm cánh tỏa và trụ nhị nổi."),
    "orange-dahlia": ("round_cluster", .82, True, "Thược dược có nhiều lớp dày khác hoa hồng; tạm ưu tiên ảnh thật đến khi có khuôn riêng."),
    "bishop-of-llandaff": ("round_cluster", .82, True, "Thược dược có nhiều lớp dày khác hoa hồng; tạm ưu tiên ảnh thật đến khi có khuôn riêng."),
    "pink-yellow-dahlia": ("round_cluster", .82, True, "Thược dược có nhiều lớp dày khác hoa hồng; tạm ưu tiên ảnh thật đến khi có khuôn riêng."),
    "lenten-rose": ("bowl", .88, False, "Hellebore (hồng mùa chay) có cánh hoa dạng chén, không phải hoa hồng cuộn."),
    "desert-rose": ("swirl5", .90, False, "Sứ Thái có hoa năm cánh xoè, không thuộc chi hoa hồng."),
    "snapdragon": ("long_spike", .98, False, "Hoa mõm sói xếp dọc trên trục dài."),
    "foxglove": ("long_spike", .98, False, "Mao địa hoàng tạo chuỗi chuông dọc một trục dài."),
    "globe-flower": ("bowl", .93, False, "Cầu hoa vàng có cánh dày khép thành chén."),
    "thorn-apple": ("bell", .94, False, "Cà độc dược có tràng hoa hình loa kèn."),
    "pink-primrose": ("swirl5", .92, False, "Anh thảo hồng có tràng năm thùy tỏa quanh tâm."),
    "primula": ("swirl5", .92, False, "Anh thảo có tràng năm thùy tỏa quanh tâm."),
    "bolero-deep-blue": ("swirl5", .88, False, "Cát tường có tràng năm thùy rộng; khuôn năm cánh là xấp xỉ hình học."),
    "wild-pansy": ("swirl5", .84, False, "Viola có năm cánh rộng; khuôn năm cánh là xấp xỉ hình học."),
    "silverbush": ("bell", .80, False, "Silverbush thuộc nhóm bìm, tràng hoa dạng phễu."),
    "marigold": ("disk", .92, False, "Vạn thọ có đầu hoa dạng đĩa nhiều cánh."),
}


def classify(flower: dict) -> dict:
    if flower["id"] in ID_RULES:
        archetype, confidence, fallback, reason = ID_RULES[flower["id"]]
        return {"id": flower["id"], "archetype": archetype, "confidence": confidence,
                "reason": reason, "fallback_photo": fallback}
    text = " ".join(str(flower.get(key) or "") for key in
                    ("id", "name_vi", "name_en", "description", "long_description", "facts")).lower()
    for archetype, confidence, fallback, pattern in RULES:
        if re.search(pattern, text, flags=re.IGNORECASE):
            return {"id": flower["id"], "archetype": archetype, "confidence": confidence,
                    "reason": f"Quy tắc cục bộ khớp tên/mô tả hình thái với nhóm {archetype}; chưa có hiệu chỉnh bằng Gemini.",
                    "fallback_photo": fallback}
    return {"id": flower["id"], "archetype": "exotic", "confidence": .35,
            "reason": "Không đủ dấu hiệu tên/mô tả để gán khuôn an toàn; dùng ảnh thật cho đến khi duyệt.",
            "fallback_photo": True}


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    species = json.loads((ROOT / "data/species.json").read_text(encoding="utf-8"))
    records = [classify(item) for item in species]
    document = {
        "schema_version": 1,
        "generated_by": "deterministic local name and morphology rules; no Gemini/API calls",
        "source": "data/species.json names, descriptions and facts; low-confidence or complex forms use reference photos",
        "count": len(records),
        "species": records,
    }
    target = ROOT / "data/flower_archetypes.json"
    target.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    groups: dict[str, list[str]] = defaultdict(list)
    for record, flower in zip(records, species):
        groups[record["archetype"]].append(f"{flower['id']} ({flower['name_vi']})" + (" [ảnh thật]" if record["fallback_photo"] else ""))
    print(f"Assigned {len(records)} species; photo fallback={sum(item['fallback_photo'] for item in records)}")
    for key in sorted(groups, key=lambda value: (-len(groups[value]), value)):
        print(f"\n{key}: {len(groups[key])}")
        print("; ".join(groups[key]))


if __name__ == "__main__":
    main()
