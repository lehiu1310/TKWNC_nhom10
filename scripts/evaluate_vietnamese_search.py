"""Measure Precision@5 for ten hand-labeled Vietnamese CLIP search prompts.

Run with the deployed retrieval artifacts and GOOGLE_API_KEY configured. This
measures retrieval against the expected flower category, not human relevance.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from core.retrieval import ImageSearch  # noqa: E402

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
    output = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "reports" / "vietnamese_search_precision_at5.json"
    search = ImageSearch()
    rows = []
    for query, expected in QUERIES:
        response = search.search_text_with_query(query, k=5)
        matches = [item for item in response["results"] if item.get("species_id") == expected]
        rows.append({
            "query_vi": query,
            "query_used": response["query_used"],
            "translated": response["translated"],
            "expected_species_id": expected,
            "retrieved_species_ids": [item.get("species_id") for item in response["results"]],
            "hits_at_5": len(matches),
            "precision_at_5": len(matches) / 5,
        })
    result = {
        "checkpoint": "artifacts/retrieval/encoder.json",
        "query_count": len(rows),
        "mean_precision_at_5": sum(row["precision_at_5"] for row in rows) / len(rows),
        "translated_query_count": sum(row["translated"] for row in rows),
        "protocol": "Ten manually written Vietnamese flower descriptions, two per expected class among the five homepage classes; precision counts retrieved photos matching the target species_id. Not a random or independently annotated production sample.",
        "results": rows,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: result[key] for key in ("query_count", "mean_precision_at_5", "translated_query_count", "protocol")}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
