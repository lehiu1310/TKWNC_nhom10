"""Calibrate the classifier's reject threshold from labeled flower/non-flower images.

Example: python scripts/evaluate_classifier_ood.py --flower-dir data/eval/flowers --non-flower-dir data/eval/non_flowers
The two directories must each contain at least ten independent image files.
"""
import argparse
import json
import sys
from pathlib import Path

from PIL import Image, UnidentifiedImageError

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from core.classifier import ImageClassifier  # noqa: E402

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def collect(directory: Path) -> list[Path]:
    return sorted(path for path in directory.rglob("*") if path.is_file() and path.suffix.lower() in IMAGE_SUFFIXES)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--flower-dir", type=Path, required=True)
    parser.add_argument("--non-flower-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=ROOT / "reports" / "classifier_ood_evaluation.json")
    args = parser.parse_args()
    flower_paths = collect(args.flower_dir)
    non_flower_paths = collect(args.non_flower_dir)
    if len(flower_paths) < 10 or len(non_flower_paths) < 10:
        parser.error(f"need at least 10 images per group; found flowers={len(flower_paths)}, non_flowers={len(non_flower_paths)}")

    classifier = ImageClassifier()
    examples = []
    for is_flower, paths in ((True, flower_paths), (False, non_flower_paths)):
        for path in paths:
            try:
                with Image.open(path) as source:
                    top = classifier.predict(source.convert("RGB"), top_k=1)["predictions"][0]
            except (OSError, UnidentifiedImageError) as exc:
                parser.error(f"cannot read image {path}: {exc}")
            examples.append({
                "is_flower": is_flower,
                "file": path.name,
                "score": float(top["score"]),
                "top_label": top["label"],
            })

    thresholds = sorted({0.0, 1.000001, *(item["score"] for item in examples)})
    candidates = []
    for threshold in thresholds:
        tp = sum(item["is_flower"] and item["score"] >= threshold for item in examples)
        fn = sum(item["is_flower"] and item["score"] < threshold for item in examples)
        tn = sum(not item["is_flower"] and item["score"] < threshold for item in examples)
        fp = sum(not item["is_flower"] and item["score"] >= threshold for item in examples)
        tpr = tp / (tp + fn)
        tnr = tn / (tn + fp)
        candidates.append({"threshold": threshold, "balanced_accuracy": (tpr + tnr) / 2,
                           "flower_recall": tpr, "non_flower_rejection": tnr,
                           "tp": tp, "fn": fn, "tn": tn, "fp": fp})
    best = max(candidates, key=lambda item: (item["balanced_accuracy"], item["non_flower_rejection"], -item["threshold"]))
    result = {
        "checkpoint": "artifacts/classifier/model.pt",
        "flower_count": len(flower_paths),
        "non_flower_count": len(non_flower_paths),
        "flower_input_dir": args.flower_dir.as_posix(),
        "non_flower_input_dir": args.non_flower_dir.as_posix(),
        "threshold_selection": "maximum balanced accuracy; ties prefer higher non-flower rejection then lower threshold",
        "best": best,
        "samples": examples,
        "note": "Threshold-selection metrics are measured on the supplied calibration images; use a separate held-out image set for an unbiased final estimate.",
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
