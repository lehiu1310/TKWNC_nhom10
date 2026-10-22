"""Evaluate the memory-limited classifier-feature image search used in production."""
from __future__ import annotations

import argparse
import json
import random
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np
import torch
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from config import ART_DIR, CLASSIFIER_RETRIEVAL_LABEL_MIN_CONFIDENCE, DEVICE, resolve_path  # noqa: E402
from core.classifier import EVAL_TF, ImageClassifier  # noqa: E402
from scripts.prepare_flowers102 import all_records  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--queries-per-class", type=int, default=2)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument(
        "--output", type=Path,
        default=ROOT / "reports" / "classifier_retrieval_precision_at_5.json",
    )
    args = parser.parse_args()
    if args.queries_per_class < 1:
        parser.error("--queries-per-class must be positive")

    index_dir = ART_DIR / "retrieval"
    meta = json.loads((index_dir / "meta.json").read_text(encoding="utf-8"))
    gallery = np.load(index_dir / "classifier_features.npy", mmap_mode="r").astype(np.float32)
    indexed_paths = {item["path"].replace("data/deploy_images/", "data/") for item in meta}
    records, _ = all_records()
    candidates_by_class: dict[str, list[dict]] = defaultdict(list)
    for row in records:
        if row["path"] not in indexed_paths:
            candidates_by_class[row["class_id"]].append(row)

    rng = random.Random(args.seed)
    queries = []
    for class_id in sorted(candidates_by_class):
        candidates = sorted(candidates_by_class[class_id], key=lambda row: row["path"])
        queries.extend(rng.sample(candidates, min(args.queries_per_class, len(candidates))))
    if not queries:
        raise RuntimeError("No held-out image queries remain outside the classifier-feature gallery")

    classifier = ImageClassifier()
    model = classifier.model
    vectors = []
    predictions = []
    for start in range(0, len(queries), 16):
        batch_rows = queries[start:start + 16]
        images = []
        for row in batch_rows:
            with Image.open(resolve_path(row["path"])) as image:
                images.append(EVAL_TF(image.convert("RGB")))
        batch = torch.stack(images).to(device=DEVICE, dtype=model.fc.weight.dtype)
        captured = []
        hook = model.fc.register_forward_pre_hook(lambda _module, inputs: captured.append(inputs[0]))
        try:
            with torch.inference_mode():
                logits = model(batch).float()
                features = captured[0].float()
                features = torch.nn.functional.normalize(features, p=2, dim=1)
                probs = logits.softmax(dim=-1)
                scores, indices = probs.max(dim=-1)
            vectors.extend(features.cpu().numpy().astype(np.float32, copy=False))
            predictions.extend(zip(
                (classifier.classes[int(i)] for i in indices.cpu().tolist()),
                (float(s) for s in scores.cpu().tolist()),
            ))
        finally:
            hook.remove()

    query_vectors = np.asarray(vectors, dtype=np.float32)
    similarities = query_vectors @ gallery.T
    rows = []
    for query, (predicted_label, confidence), scores in zip(queries, predictions, similarities):
        global_ids = np.argsort(-scores, kind="stable")[:5]
        global_labels = [str(meta[int(index)]["species_id"]) for index in global_ids]
        use_label_filter = confidence >= CLASSIFIER_RETRIEVAL_LABEL_MIN_CONFIDENCE
        if use_label_filter:
            candidates = np.asarray([
                index for index, item in enumerate(meta)
                if item.get("species_id") == predicted_label
            ], dtype=np.int64)
            if candidates.size:
                filtered_ids = candidates[np.argsort(-scores[candidates], kind="stable")[:5]]
                filtered_labels = [str(meta[int(index)]["species_id"]) for index in filtered_ids]
            else:
                filtered_labels = global_labels
                use_label_filter = False
        else:
            filtered_labels = global_labels
        truth = str(query["class_id"])
        rows.append({
            "query_path": query["path"],
            "expected_species_id": truth,
            "predicted_species_id": predicted_label,
            "classifier_confidence": round(confidence, 4),
            "label_filter_used": use_label_filter,
            "global_top_5_species_ids": global_labels,
            "global_precision_at_5": sum(label == truth for label in global_labels) / 5,
            "filtered_top_5_species_ids": filtered_labels,
            "filtered_precision_at_5": sum(label == truth for label in filtered_labels) / 5,
        })

    result = {
        "metric": "Precision@5",
        "backend": "ResNet-18 penultimate-layer features (RETRIEVAL_BACKEND=classifier)",
        "query_count": len(rows),
        "queries_per_class_max": args.queries_per_class,
        "class_count": len(candidates_by_class),
        "index_count": len(meta),
        "seed": args.seed,
        "classifier_confidence_threshold": CLASSIFIER_RETRIEVAL_LABEL_MIN_CONFIDENCE,
        "global_precision_at_5": float(np.mean([row["global_precision_at_5"] for row in rows])),
        "predicted_class_filtered_precision_at_5": float(np.mean([row["filtered_precision_at_5"] for row in rows])),
        "top1_class_accuracy": float(np.mean([row["predicted_species_id"] == row["expected_species_id"] for row in rows])),
        "method": (
            "Held-out by file path from the same public flower sources used for training/index construction. "
            "The candidate strategy constrains gallery results to the classifier top-1 class only when "
            "confidence meets the production threshold; otherwise it uses global feature ranking."
        ),
        "per_query": rows,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in result.items() if key != "per_query"}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
