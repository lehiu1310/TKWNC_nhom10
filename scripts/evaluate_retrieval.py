"""Measure image-search Precision@5 on deterministic held-out images."""
import argparse
import json
import random
import sys
from collections import defaultdict
from pathlib import Path

import faiss
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from config import ART_DIR, resolve_path  # noqa: E402
from core.retrieval import ClipEncoder  # noqa: E402
from scripts.prepare_flowers102 import all_records  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--queries-per-class", type=int, default=2)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--output", type=Path, default=ROOT / "reports" / "retrieval_precision_at_5.json")
    args = parser.parse_args()
    if args.queries_per_class < 1:
        parser.error("--queries-per-class must be positive")

    index_dir = ART_DIR / "retrieval"
    meta = json.loads((index_dir / "meta.json").read_text(encoding="utf-8"))
    manifest = json.loads((index_dir / "encoder.json").read_text(encoding="utf-8"))
    encoder = ClipEncoder()
    if (manifest["model"], manifest["pretrained"]) != (encoder.model_name, encoder.pretrained):
        raise RuntimeError("FAISS index and encoder configuration do not match")
    index = faiss.read_index(str(index_dir / "index.faiss"))

    indexed_paths = {item["path"].replace("data/deploy_images/", "data/") for item in meta}
    records, _ = all_records()
    candidates_by_class = defaultdict(list)
    for row in records:
        if row["path"] not in indexed_paths:
            candidates_by_class[row["class_id"]].append(row)

    rng = random.Random(args.seed)
    queries = []
    for class_id in sorted(candidates_by_class):
        candidates = sorted(candidates_by_class[class_id], key=lambda row: row["path"])
        queries.extend(rng.sample(candidates, min(args.queries_per_class, len(candidates))))
    if not queries:
        raise RuntimeError("No held-out image queries remain outside the FAISS index")

    query_embeddings = []
    for start in range(0, len(queries), 16):
        images = []
        for row in queries[start:start + 16]:
            with Image.open(resolve_path(row["path"])) as image:
                images.append(image.convert("RGB"))
        query_embeddings.append(encoder.encode_images(images, batch_size=16))
    vectors = np.concatenate(query_embeddings, axis=0).astype("float32")
    _, nearest = index.search(vectors, 5)
    per_query = []
    for row, ids in zip(queries, nearest):
        relevant = sum(1 for item_id in ids if item_id >= 0 and meta[item_id]["species_id"] == row["class_id"])
        per_query.append({"query_path": row["path"], "class_id": row["class_id"], "relevant_at_5": relevant, "precision_at_5": relevant / 5})

    result = {
        "metric": "Precision@5",
        "precision_at_5": float(np.mean([row["precision_at_5"] for row in per_query])),
        "query_count": len(queries),
        "queries_per_class_max": args.queries_per_class,
        "class_count": len(candidates_by_class),
        "index_count": len(meta),
        "encoder": manifest,
        "seed": args.seed,
        "method": "Queries are images from the same public flower dataset but are excluded from the FAISS index by path; relevance means retrieved species_id equals query class_id.",
        "per_query": per_query,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: result[key] for key in ("metric", "precision_at_5", "query_count", "class_count", "index_count", "encoder", "seed", "method")}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
