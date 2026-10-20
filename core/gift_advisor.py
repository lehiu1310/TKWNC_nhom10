"""Rule-based flower gift recommendations backed by the reviewed data file."""
from __future__ import annotations

import json
import re
from functools import lru_cache

from config import ROOT


@lru_cache(maxsize=1)
def _catalog() -> tuple[list[dict], dict[str, dict]]:
    gift = json.loads((ROOT / "data" / "gift_meanings.json").read_text(encoding="utf-8"))
    species = json.loads((ROOT / "data" / "species.json").read_text(encoding="utf-8"))
    return gift["species"], {item["id"]: item for item in species}


OCCASIONS = ["sinh nhật", "8/3", "20/10", "20/11", "Valentine", "kỷ niệm", "xin lỗi", "cảm ơn", "chúc mừng", "khai trương", "thăm bệnh", "chia buồn"]
RECIPIENTS = ["người yêu", "mẹ", "bố", "bạn", "thầy cô", "đồng nghiệp", "đối tác"]
SIZES = {"nhỏ": 5, "vừa": 9, "lớn": 15}


def _norm(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().casefold())


def recommend_gifts(occasion: str, recipient: str, color: str | None = None, size: str = "vừa",
                    preferred_species_id: str | None = None) -> dict:
    occasion_key = _norm(occasion)
    recipient_key = _norm(recipient)
    size_key = _norm(size)
    occasion = next((item for item in OCCASIONS if _norm(item) == occasion_key), None)
    recipient = next((item for item in RECIPIENTS if _norm(item) == recipient_key), None)
    size = next((item for item in SIZES if _norm(item) == size_key), None)
    if occasion is None:
        raise ValueError("Dịp tặng hoa chưa có trong danh sách.")
    if recipient is None:
        raise ValueError("Người nhận chưa có trong danh sách.")
    if size is None:
        raise ValueError("Quy mô bó phải là nhỏ, vừa hoặc lớn.")
    if preferred_species_id is not None and not isinstance(preferred_species_id, str):
        raise ValueError("Mã loài được chọn không hợp lệ.")
    preferred_species_id = preferred_species_id.strip() if preferred_species_id else None
    if preferred_species_id == "":
        preferred_species_id = None

    entries, species = _catalog()
    if preferred_species_id and preferred_species_id not in species:
        raise ValueError("Không tìm thấy loài hoa đã chọn.")
    preferred_entry = next((entry for entry in entries if entry["species_id"] == preferred_species_id), None)
    if preferred_species_id and not preferred_entry:
        raise ValueError("Loài đã chọn chưa có dữ liệu để gợi ý tặng.")
    candidates = []
    for entry in entries:
        if not entry.get("gift_ok"):
            continue
        if occasion not in entry.get("occasions", []):
            continue
        if occasion in entry.get("avoid_occasions", []):
            continue
        avoid_text = " ".join(entry.get("avoid_for", [])).casefold()
        if "không tự gợi ý cho dịp vui" in avoid_text and occasion != "chia buồn":
            continue
        flower = species.get(entry["species_id"])
        if not flower:
            continue
        matched_recipient = recipient in entry.get("recipients", [])
        matched_color = bool(color and color.casefold() in " ".join(entry.get("colors", [])).casefold())
        score = 4 + (3 if matched_recipient else 0) + (2 if matched_color else 0)
        candidates.append((score, entry, flower, matched_recipient, matched_color))

    if preferred_species_id and not any(item[2]["id"] == preferred_species_id for item in candidates):
        raise ValueError("Loài đã chọn chưa có dữ liệu phù hợp cho dịp này.")

    candidates.sort(key=lambda item: (
        0 if item[2]["id"] == preferred_species_id else 1,
        -item[0], item[2].get("featured_order", 999), item[2]["name_vi"],
    ))
    if not candidates:
        raise ValueError("Chưa có gợi ý đã duyệt phù hợp với dịp này. Hãy chọn dịp khác.")

    chosen = candidates[:3]
    suggestions = []
    for index, (score, entry, flower, matched_recipient, matched_color) in enumerate(chosen):
        supporting = next((other[2] for other in candidates if other[2]["id"] != flower["id"]), None)
        reasons = [f"dữ liệu nháp có gắn với dịp {occasion}"]
        if matched_recipient:
            reasons.append(f"phù hợp nhóm người nhận {recipient} theo dữ liệu nháp")
        if matched_color:
            reasons.append("màu được chọn có trong dữ liệu màu của loài")
        if flower["id"] == preferred_species_id:
            reasons.append("giữ loài hoa bạn đã chọn làm hoa chính")
        if not matched_recipient:
            reasons.append("điểm người nhận trung tính vì chưa có ghép cụ thể")
        meanings = entry.get("meanings", {}).get("chung") or flower.get("meaning", "")
        suggestions.append({
            "id": f"{flower['id']}-{index}", "main": _flower_card(flower, entry),
            "support": _flower_card(supporting, next(x for x in entries if x["species_id"] == supporting["id"])) if supporting else None,
            "foliage": "Lá xanh trung tính (phần phối trang trí, không phải dữ liệu loài).",
            "meaning": meanings, "reason": reasons, "caution": entry.get("avoid_for", []),
            "score": score, "stem_count": SIZES[size_key],
            "palette": [flower.get("color", "#78916A"), supporting.get("color") if supporting else None],
            "verified": bool(entry.get("verified")),
        })
    return {"occasion": occasion, "recipient": recipient, "size": size, "suggestions": suggestions,
            "label": "Gợi ý dựa trên dữ liệu ý nghĩa hoa", "verified": False}


def _flower_card(flower: dict, entry: dict) -> dict:
    return {"id": flower["id"], "name_vi": flower["name_vi"], "name_en": flower.get("name_en", ""),
            "meaning": entry.get("meanings", {}).get("chung") or flower.get("meaning", ""),
            "color": flower.get("color", "#78916A"), "image": flower.get("image", ""),
            "display_image_key": flower.get("display_image_key")}
