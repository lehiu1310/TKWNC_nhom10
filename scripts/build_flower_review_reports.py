"""Write deterministic review reports from the generated flower mapping and color audit."""
from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    species = json.loads((ROOT / "data/species.json").read_text(encoding="utf-8"))
    assignments = json.loads((ROOT / "data/flower_archetypes.json").read_text(encoding="utf-8"))["species"]
    colors = json.loads((ROOT / "data/flower_photo_colors.json").read_text(encoding="utf-8-sig"))
    species_by_id = {row["id"]: row for row in species}
    groups: dict[str, list[str]] = defaultdict(list)
    for row in assignments:
        flower = species_by_id[row["id"]]
        suffix = " — ảnh thật" if row["fallback_photo"] else ""
        groups[row["archetype"]].append(f"{flower['name_vi']} (`{row['id']}`, {row['confidence']:.0%}){suffix}")

    lines = [
        "# Rà soát kiểu hình hoa",
        "",
        f"Nguồn: `data/species.json` ({len(species)} mục). Gán kiểu bằng quy tắc cục bộ theo ID, tên và mô tả; không gọi Gemini/API.",
        f"Kết quả: {sum(not row['fallback_photo'] for row in assignments)} mô hình 3D và {sum(row['fallback_photo'] for row in assignments)} ảnh thật ưu tiên, trên {len(groups)} kiểu hình.",
        "Các nhãn tin cậy là độ chắc của luật tên/hình thái, không phải xác nhận khoa học hoặc đánh giá chất lượng hình ảnh.",
        "",
    ]
    for archetype, names in sorted(groups.items(), key=lambda item: (-len(item[1]), item[0])):
        lines.extend([f"## {archetype} — {len(names)} loài", "", *[f"- {name}" for name in names], ""])
    (ROOT / "reports/flower-archetype-review.md").write_text("\n".join(lines), encoding="utf-8")

    mismatches = [row for row in colors if row.get("mismatch")]
    lines = [
        "# Kiểm toán màu hoa",
        "",
        "Màu ảnh được ước lượng cục bộ từ vùng giữa ảnh, loại pixel xanh lá và ưu tiên pixel bão hòa. Đây là cảnh báo để rà soát bằng mắt, không phải nhãn chuẩn.",
        "Ảnh hưởng sản phẩm: `species.json` không bị sửa. Màu dựng 3D chỉ dùng màu ảnh làm gợi ý khi cụm màu trung tâm có ít nhất 500 pixel; mẫu ít hơn dùng màu chủ đề của kiểu hoa.",
        f"Vùng lấy mẫu chuẩn hóa: x={colors[0]['roi']['x'][0]:.0%}–{colors[0]['roi']['x'][1]:.0%}, y={colors[0]['roi']['y'][0]:.0%}–{colors[0]['roi']['y'][1]:.0%}. Ngưỡng lệch hue: 58°.",
        f"Đã phân tích {len(colors)} ảnh; {len(mismatches)} loài bị gắn cờ lệch màu.",
        "",
        "| Loài | Màu species.json | Màu ước lượng từ ảnh | Lệch hue | Mẫu màu |",
        "|---|---|---|---:|---:|",
    ]
    for row in mismatches:
        flower = species_by_id[row["id"]]
        lines.append(f"| {flower['name_vi']} (`{row['id']}`) | `{row['species_color']}` | `{row['photo_color']}` | {row['hue_difference']}° | {row['samples']} |")
    (ROOT / "reports/flower-color-audit.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote mapping report ({len(groups)} groups) and color audit ({len(mismatches)}/{len(colors)} potential mismatches).")


if __name__ == "__main__":
    main()
