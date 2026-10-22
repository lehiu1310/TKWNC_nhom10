"""Evaluate the Vietnamese text-to-flower search used in the production API."""
from __future__ import annotations

import json
import sys
from pathlib import Path
from types import SimpleNamespace

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from config import ART_DIR  # noqa: E402
from core.retrieval_light import ClassifierFeatureSearch  # noqa: E402


QUERIES = [
    ("cánh trắng mỏng xếp vòng quanh nhụy vàng, đứng giữa cỏ xanh", "daisy"),
    ("một bông cúc trắng đơn độc bên mép đồng cỏ", "daisy"),
    ("đóa vàng nhỏ mọc trên thân xanh mảnh, lá thấp ôm gốc", "dandelion"),
    ("quả cầu hạt trắng li ti bay khỏi một bông vàng dưới gió", "dandelion"),
    ("cánh hoa đỏ nhung cuộn thành nhiều lớp dày", "roses"),
    ("một đóa đỏ nổi bật giữa tán lá xanh đậm", "roses"),
    ("đóa vàng lớn với tâm nâu tròn, cánh xếp tỏa ra ngoài", "sunflowers"),
    ("cánh hoa vàng rực vây quanh nhụy sẫm, phía sau mờ xanh", "sunflowers"),
    ("bông hoa hình chén màu hồng trên thân thẳng, lá dài", "tulips"),
    ("một đóa hồng phấn cánh khum trong khu vườn mùa xuân", "tulips"),
]


def main() -> None:
    output = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "reports" / "classifier_text_search_precision_at_5.json"
    index = np.load(ART_DIR / "retrieval" / "classifier_features.npy", mmap_mode="r")
    # Text routing uses metadata only; no classifier forward pass is needed.
    classifier = SimpleNamespace(model=SimpleNamespace(fc=SimpleNamespace(in_features=index.shape[1])))
    search = ClassifierFeatureSearch(classifier)
    rows = []
    for query, expected in QUERIES:
        results = search.search_text_with_query(query, k=5)["results"]
        species = [str(item.get("species_id", "")) for item in results]
        rows.append({
            "query_vi": query,
            "expected_species_id": expected,
            "retrieved_species_ids": species,
            "top1_correct": bool(species and species[0] == expected),
            "precision_at_5": sum(item == expected for item in species) / 5,
        })
    result = {
        "metric": "Precision@5",
        "backend": "production ClassifierFeatureSearch text routing",
        "query_count": len(rows),
        "class_count": len({expected for _, expected in QUERIES}),
        "top1_accuracy": sum(row["top1_correct"] for row in rows) / len(rows),
        "mean_precision_at_5": sum(row["precision_at_5"] for row in rows) / len(rows),
        "protocol": (
            "Ten manually written Vietnamese descriptions, two per class among five featured flowers. "
            "This development set is not independently authored or a general-purpose relevance benchmark."
        ),
        "results": rows,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in result.items() if key != "results"}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
