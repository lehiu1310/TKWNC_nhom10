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
    applied_mismatches = [row for row in mismatches if row.get("samples", 0) >= 500]
    ignored_mismatches = [row for row in mismatches if row.get("samples", 0) < 500]
    lines = [
        "# Kiểm toán màu hoa",
        "",
        "Màu ảnh được ước lượng cục bộ từ vùng giữa ảnh, loại pixel xanh lá và ưu tiên pixel bão hòa. Đây là cảnh báo để rà soát bằng mắt, không phải nhãn chuẩn.",
        "Ảnh hưởng sản phẩm: `species.json` không bị sửa. Renderer chỉ dùng màu ảnh làm gợi ý khi cụm màu trung tâm có ít nhất 500 pixel và màu không thuộc dải xanh lá; mẫu nhỏ hoặc màu lá bị bỏ qua.",
        f"Vùng lấy mẫu chuẩn hóa: x={colors[0]['roi']['x'][0]:.0%}–{colors[0]['roi']['x'][1]:.0%}, y={colors[0]['roi']['y'][0]:.0%}–{colors[0]['roi']['y'][1]:.0%}. Ngưỡng lệch hue: 58°.",
        f"Đã phân tích {len(colors)} ảnh; {len(mismatches)} loài là cảnh báo lệch màu tiềm năng (ngưỡng hue >58°). Trong đó {len(applied_mismatches)} mẫu đủ điều kiện kích thước để màu ảnh được dùng làm gợi ý dựng 3D; {len(ignored_mismatches)} mẫu dưới 500 pixel bị bỏ qua. Cảnh báo vẫn cần duyệt bằng mắt vì crop giữa có thể chứa nhiều hoa hoặc nền.",
        "",
        "| Loài | Màu species.json | Màu ước lượng từ ảnh | Lệch hue | Mẫu màu | Xử lý trong 3D |",
        "|---|---|---|---:|---:|---|",
    ]
    for row in mismatches:
        flower = species_by_id[row["id"]]
        action = "gợi ý màu ảnh" if row.get("samples", 0) >= 500 else "bỏ qua mẫu nhỏ"
        lines.append(f"| {flower['name_vi']} (`{row['id']}`) | `{row['species_color']}` | `{row['photo_color']}` | {row['hue_difference']}° | {row['samples']} | {action} |")
    (ROOT / "reports/flower-color-audit.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote mapping report ({len(groups)} groups) and color audit ({len(mismatches)}/{len(colors)} potential mismatches; {len(applied_mismatches)} eligible for photo-color hint, {len(ignored_mismatches)} ignored for low sample count).")


if __name__ == "__main__":
    main()
