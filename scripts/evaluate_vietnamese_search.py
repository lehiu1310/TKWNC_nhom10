"""Measure Precision@5 for ten hand-labeled Vietnamese flower descriptions.

The offline path may expand a strong combination of botanical cues into a
category hint, then use CLIP to rank photos within that category. This measures
category agreement on a small hand-authored set, not general relevance.
"""
import json
import sys
import types
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from core.retrieval import ImageSearch, _visual_search_hint  # noqa: E402

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
    offline = "--offline" in sys.argv[1:]
    positional = [arg for arg in sys.argv[1:] if arg != "--offline"]
    default_name = "vietnamese_search_offline_precision_at5.json" if offline else "vietnamese_search_precision_at5.json"
    output = Path(positional[0]) if positional else ROOT / "reports" / default_name
    search = ImageSearch()
    if offline:
        search._english_query = types.MethodType(lambda self, query: self._offline_english_query(query), search)
    rows = []
    for query, expected in QUERIES:
        response = search.search_text_with_query(query, k=5)
        visual_hint = _visual_search_hint(query) if offline else None
        hinted_species_id = search._label_from_query(visual_hint) if visual_hint else None
        explicit_label = search._label_from_query(query)
        translated_label = search._label_from_query(response["query_used"])
        resolved_label = explicit_label or translated_label
        if resolved_label:
            clip_query = f"a photograph of {search._english_name_by_id.get(resolved_label, resolved_label)} flower"
        else:
            clip_query = f"a photograph of {response['query_used']}"
            if visual_hint:
                clip_query = f"{clip_query}; {visual_hint}"
        global_results = search._search(search.encoder.encode_texts([clip_query]), k=5)
        matches = [item for item in global_results if item.get("species_id") == expected]
        rows.append({
            "query_vi": query,
            "query_used": response["query_used"],
            "translated": response["translated"],
            "expected_species_id": expected,
            "visual_hint": visual_hint,
            "hinted_species_id": hinted_species_id,
            "routed_species_ids": [item.get("species_id") for item in response["results"]],
            "global_retrieved_species_ids": [item.get("species_id") for item in global_results],
            "hits_at_5": len(matches),
            "precision_at_5": len(matches) / 5,
        })
    hinted = [row for row in rows if row["hinted_species_id"]]
    result = {
        "checkpoint": "artifacts/retrieval/encoder.json",
        "query_count": len(rows),
        "mean_precision_at_5": sum(row["precision_at_5"] for row in rows) / len(rows),
        "category_hint_accuracy": sum(row["hinted_species_id"] == row["expected_species_id"] for row in hinted) / max(len(hinted), 1),
        "category_hint_coverage": len(hinted) / len(rows),
        "translated_query_count": sum(row["translated"] for row in rows),
        "protocol": (
            "Offline hybrid path: local Vietnamese vocabulary plus multi-cue botanical hints; Gemini disabled. " if offline else ""
        ) + "Ten manually written Vietnamese descriptions, two per class among the five featured classes. Precision@5 is measured on CLIP's global top five before category filtering; category hint accuracy/coverage are reported separately. This small hand-authored query set is not random, independently annotated or a general-purpose relevance benchmark.",
        "results": rows,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: result[key] for key in ("query_count", "mean_precision_at_5", "category_hint_accuracy", "category_hint_coverage", "translated_query_count", "protocol")}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
