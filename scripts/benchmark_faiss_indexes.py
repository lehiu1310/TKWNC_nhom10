"""Compare exact IndexFlatIP and approximate IndexHNSWFlat on stored image vectors."""
import argparse
import json
import platform
import random
import sys
import time
from pathlib import Path

import faiss
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from config import ART_DIR  # noqa: E402


def timed_search(index, queries: np.ndarray, k: int) -> tuple[np.ndarray, list[float]]:
    rows, durations_ms = [], []
    for vector in queries:
        start = time.perf_counter()
        _, ids = index.search(vector.reshape(1, -1), k)
        durations_ms.append((time.perf_counter() - start) * 1000)
        rows.append(ids[0])
    return np.asarray(rows), durations_ms


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--query-count", type=int, default=206)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--hnsw-m", type=int, default=32)
    parser.add_argument("--ef-search", type=int, default=64)
    parser.add_argument("--output", type=Path, default=ROOT / "reports" / "faiss_index_comparison.json")
    args = parser.parse_args()
    if args.query_count < 1 or args.hnsw_m < 4 or args.ef_search < 1:
        parser.error("query-count and ef-search must be positive; hnsw-m must be >= 4")

    faiss.omp_set_num_threads(1)
    index_dir = ART_DIR / "retrieval"
    meta = json.loads((index_dir / "meta.json").read_text(encoding="utf-8"))
    manifest = json.loads((index_dir / "encoder.json").read_text(encoding="utf-8"))
    flat = faiss.read_index(str(index_dir / "index.faiss"))
    database_vectors = flat.reconstruct_n(0, flat.ntotal).astype("float32")

    rng = random.Random(args.seed)
    sample_ids = sorted(rng.sample(range(flat.ntotal), min(args.query_count, flat.ntotal)))
    queries = database_vectors[sample_ids]
    flat_ids, flat_ms = timed_search(flat, queries, 6)

    hnsw = faiss.IndexHNSWFlat(flat.d, args.hnsw_m, faiss.METRIC_INNER_PRODUCT)
    hnsw.hnsw.efConstruction = max(80, args.ef_search)
    hnsw.hnsw.efSearch = args.ef_search
    hnsw.add(database_vectors)
    hnsw_ids, hnsw_ms = timed_search(hnsw, queries, 6)

    def p5(ids):
        values = []
        for query_id, row in zip(sample_ids, ids):
            neighbors = [int(idx) for idx in row if idx >= 0 and int(idx) != query_id][:5]
            values.append(sum(meta[idx]["species_id"] == meta[query_id]["species_id"] for idx in neighbors) / 5)
        return float(np.mean(values))

    recall_at_5 = float(np.mean([
        len((set(map(int, exact)) - {query_id}) & (set(map(int, approx)) - {query_id})) / 5
        for query_id, exact, approx in zip(sample_ids, flat_ids, hnsw_ids)
    ]))
    result = {
        "metric": "FAISS index comparison",
        "index_count": flat.ntotal,
        "query_count": len(sample_ids),
        "encoder": manifest,
        "seed": args.seed,
        "hardware": {
            "processor": platform.processor() or "not reported by OS",
            "python": sys.version.split()[0],
            "faiss": getattr(faiss, "__version__", "unknown"),
        },
        "flat_ip": {
            "type": "IndexFlatIP exact search on normalized vectors",
            "precision_at_5_same_species": p5(flat_ids),
            "search_ms_p50": float(np.percentile(flat_ms, 50)),
            "search_ms_p95": float(np.percentile(flat_ms, 95)),
            "serialized_bytes": len(faiss.serialize_index(flat)),
        },
        "hnsw_flat": {
            "type": "IndexHNSWFlat approximate inner-product search",
            "M": args.hnsw_m,
            "efSearch": args.ef_search,
            "precision_at_5_same_species": p5(hnsw_ids),
            "search_ms_p50": float(np.percentile(hnsw_ms, 50)),
            "search_ms_p95": float(np.percentile(hnsw_ms, 95)),
            "recall_at_5_vs_flat": recall_at_5,
            "serialized_bytes": len(faiss.serialize_index(hnsw)),
        },
        "method": "Queries are a seeded sample of vectors already in this index; the query's own item is removed from Precision@5. Recall@5 compares approximate neighbors to exact Flat neighbors. This isolates ANN/index behavior, is not a held-out semantic evaluation, and excludes image encoding/network/API latency.",
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
