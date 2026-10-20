"""Rule-based flower gift recommendations backed by the reviewed data file."""
from __future__ import annotations

import json
import re
import unicodedata
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

COLOR_ALIASES = {
    "hồng": "#FF6F91", "pink": "#FF6F91", "rose": "#FF6F91", "đỏ": "#E34B5F", "red": "#E34B5F",
    "cam đào": "#F4A98A", "cam": "#FF8A5B", "orange": "#FF8A5B", "đào": "#F4A98A", "peach": "#F4A98A",
    "vàng": "#FFC93C", "yellow": "#FFC93C", "gold": "#FFC93C", "tím": "#9B7EDE", "tía": "#9B7EDE",
    "purple": "#9B7EDE", "violet": "#9B7EDE", "lavender": "#B69ADE", "xanh lá": "#5BAE6B",
    "xanh lục": "#5BAE6B", "green": "#5BAE6B", "mint": "#8BC9A0", "xanh dương": "#6B9DD4",
    "xanh da trời": "#6B9DD4", "xanh biển": "#6B9DD4", "blue": "#6B9DD4", "navy": "#344C77",
    "trắng": "#F3F0E9", "white": "#F3F0E9", "kem": "#EEE5CF", "ivory": "#EEE5CF", "beige": "#DCCEB5",
}


def _norm(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().casefold())


def _fold(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value.casefold())
    return "".join(char for char in decomposed if not unicodedata.combining(char))


def _parse_color_preference(value: str | None) -> tuple[str | None, str | None]:
    if not value or not value.strip():
        return None, None
    text = value.strip()
    hex_match = re.search(r"#?([0-9a-fA-F]{6})\b", text)
    if hex_match:
        return f"#{hex_match.group(1)}", None
    folded = _fold(text)
    for alias in sorted(COLOR_ALIASES, key=len, reverse=True):
        if _fold(alias) in folded:
            return COLOR_ALIASES[alias], None
    return None, f"Chưa nhận diện được tông màu “{text}”. Gợi ý vẫn dựa trên dịp và người nhận; thử tên màu phổ biến hoặc mã HEX để ưu tiên màu chính xác hơn."


def _color_distance(left: str, right: str) -> float:
    """Perceptual-ish CIE Lab distance, used only to rank palette preferences."""
    def lab(value: str) -> tuple[float, float, float]:
        raw = [int(value[index:index + 2], 16) / 255 for index in (1, 3, 5)]
        rgb = [channel / 12.92 if channel <= .04045 else ((channel + .055) / 1.055) ** 2.4 for channel in raw]
        x = (rgb[0] * .4124 + rgb[1] * .3576 + rgb[2] * .1805) / .95047
        y = (rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722)
        z = (rgb[0] * .0193 + rgb[1] * .1192 + rgb[2] * .9505) / 1.08883
        def pivot(channel: float) -> float:
            return channel ** (1 / 3) if channel > .008856 else 7.787 * channel + 16 / 116
        fx, fy, fz = pivot(x), pivot(y), pivot(z)
        return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)
    return sum((a - b) ** 2 for a, b in zip(lab(left), lab(right))) ** .5


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
    preferred_color, color_note = _parse_color_preference(color)
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
        distance = _color_distance(preferred_color, flower.get("color", "#78916A")) if preferred_color else None
        color_score = max(0, 1 - distance / 100) if distance is not None else 0
        matched_color = distance is not None and distance <= 35
        score = 4 + (3 if matched_recipient else 0) + (3 * color_score)
        candidates.append((score, entry, flower, matched_recipient, matched_color, distance))

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
    for index, (score, entry, flower, matched_recipient, matched_color, color_distance) in enumerate(chosen):
        alternatives = [other for other in candidates if other[2]["id"] != flower["id"]]
        support_candidate = alternatives[0] if alternatives else None
        accent_candidate = next((other for other in alternatives[1:] if other[2]["id"] != support_candidate[2]["id"]), None) if support_candidate else None
        supporting = support_candidate[2] if support_candidate else None
        accent = accent_candidate[2] if accent_candidate else None
        mix_parts = [("Hoa chính", flower, entry)]
        if support_candidate:
            mix_parts.append(("Hoa phụ", support_candidate[2], support_candidate[1]))
        if accent_candidate:
            mix_parts.append(("Hoa điểm", accent_candidate[2], accent_candidate[1]))
        stem_counts = _allocate_stems(SIZES[size_key], len(mix_parts))
        mix = [{"role": role, "flower": _flower_card(mix_flower, mix_entry), "stems": stem_count}
               for (role, mix_flower, mix_entry), stem_count in zip(mix_parts, stem_counts)]
        reasons = [f"dữ liệu nháp có gắn với dịp {occasion}"]
        if matched_recipient:
            reasons.append(f"phù hợp nhóm người nhận {recipient} theo dữ liệu nháp")
        if matched_color:
            reasons.append("tông màu chủ đạo gần với màu bạn nhập")
        elif preferred_color and color_distance is not None:
            reasons.append("được xếp theo mức gần với tông màu bạn nhập")
        if len(mix) > 1:
            reasons.append(f"phối {len(mix)} loại hoa theo tỷ lệ cành cho bó cỡ {size}")
        if flower["id"] == preferred_species_id:
            reasons.append("giữ loài hoa bạn đã chọn làm hoa chính")
        if not matched_recipient:
            reasons.append("điểm người nhận trung tính vì chưa có ghép cụ thể")
        meanings = entry.get("meanings", {}).get("chung") or flower.get("meaning", "")
        suggestions.append({
            "id": f"{flower['id']}-{index}", "main": _flower_card(flower, entry),
            "support": _flower_card(supporting, support_candidate[1]) if support_candidate else None,
            "accent": _flower_card(accent, accent_candidate[1]) if accent_candidate else None,
            "mix": mix,
            "foliage": "Lá xanh trung tính (phần phối trang trí, không phải dữ liệu loài).",
            "meaning": meanings, "reason": reasons, "caution": entry.get("avoid_for", []),
            "score": score, "stem_count": SIZES[size_key],
            "palette": [part["flower"]["color"] for part in mix],
            "verified": bool(entry.get("verified")),
        })
    return {"occasion": occasion, "recipient": recipient, "size": size, "suggestions": suggestions,
            "color_note": color_note,
            "label": "Gợi ý dựa trên dữ liệu ý nghĩa hoa", "verified": False}


def _flower_card(flower: dict, entry: dict) -> dict:
    return {"id": flower["id"], "name_vi": flower["name_vi"], "name_en": flower.get("name_en", ""),
            "meaning": entry.get("meanings", {}).get("chung") or flower.get("meaning", ""),
            "color": flower.get("color", "#78916A"), "image": flower.get("image", ""),
            "display_image_key": flower.get("display_image_key")}


def _allocate_stems(total: int, flower_types: int) -> list[int]:
    if flower_types <= 1:
        return [total]
    weights = [0.53, 0.27, 0.20][:flower_types]
    raw = [total * weight for weight in weights]
    counts = [int(value) for value in raw]
    remainder = total - sum(counts)
    order = sorted(range(flower_types), key=lambda index: raw[index] - counts[index], reverse=True)
    for index in order[:remainder]:
        counts[index] += 1
    return counts
