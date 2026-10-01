"""Measure source retrieval Hit@3 on the reviewed question set."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from core.llm import Retriever, load_chunks  # noqa: E402


QUESTIONS = ROOT / "data" / "kb_eval" / "rag_hit_at_3.json"


def main() -> None:
    examples = json.loads(QUESTIONS.read_text(encoding="utf-8"))
    retriever = Retriever(load_chunks())
    rows = []
    hits = 0
    for item in examples:
        found = retriever.search(item["question"], k=3)
        hit = any(row["source"] == item["source"] for row in found)
        hits += hit
        rows.append({
            "question": item["question"],
            "expected_source": item["source"],
            "retrieved_sources": [row["source"] for row in found],
            "hit_at_3": hit,
        })
    report = {
        "metric": "Hit@3",
        "hits": hits,
        "total": len(examples),
        "score": hits / len(examples) if examples else 0,
        "retriever": "BM25",
        "kb_files": len(list((ROOT / "data" / "kb").glob("*.md"))),
        "results": rows,
    }
    out = ROOT / "reports" / "rag_hit_at_3.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k != "results"}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
