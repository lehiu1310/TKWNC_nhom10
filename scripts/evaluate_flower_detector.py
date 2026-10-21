"""Evaluate the saved flower detector on the fixed held-out test split."""
import argparse
import json
import platform
from pathlib import Path

import torch
from ultralytics import YOLO


ROOT = Path(__file__).resolve().parents[1]
WEIGHTS = ROOT / "artifacts" / "detector" / "flower_yolo11n.pt"
DATA_YAML = ROOT / "data" / "detection_flowers_yolo" / "data.yaml"
OUTPUT = ROOT / "reports" / "detector_evaluation.json"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=12, help="Training epochs used for this checkpoint")
    parser.add_argument("--imgsz", type=int, default=320)
    args = parser.parse_args()
    model = YOLO(str(WEIGHTS))
    metrics = model.val(
        data=str(DATA_YAML), split="test", imgsz=args.imgsz,
        device="cpu", workers=0, plots=False, verbose=False,
    )
    box = metrics.box
    per_class = {}
    for position, class_index in enumerate(box.ap_class_index):
        class_index = int(class_index)
        name = model.names[class_index]
        per_class[name] = {
            "precision": float(box.p[position]),
            "recall": float(box.r[position]),
            "mAP50": float(box.ap50[position]),
            "mAP50_95": float(box.ap[position]),
        }

    test_dir = ROOT / "data" / "detection_flowers_yolo" / "test"
    image_suffixes = {".jpg", ".jpeg", ".png", ".webp"}
    test_images = [path for path in (test_dir / "images").rglob("*")
                   if path.is_file() and path.suffix.lower() in image_suffixes]
    test_labels = list((test_dir / "labels").rglob("*.txt"))
    report = {
        "dataset": "Weirdo-329/flower-detection-dataset",
        "initial_weights": "Ultralytics YOLO11n pretrained COCO",
        "fine_tuned_weights": str(WEIGHTS.relative_to(ROOT)),
        "epochs": args.epochs,
        "image_size": args.imgsz,
        "test_split": "test (deterministic 10% split; see data/detection_flowers_yolo/dataset_report.json)",
        "test_images": len(test_images),
        "test_instances": sum(len(path.read_text(encoding="utf-8").splitlines())
                               for path in test_labels),
        "hardware": {
            "processor": platform.processor() or platform.uname().processor,
            "device": "CPU",
            "torch": torch.__version__,
            "ultralytics": __import__("ultralytics").__version__,
        },
        "metrics": {
            "mAP50": float(box.map50),
            "mAP50_95": float(box.map),
            "precision": float(box.mp),
            "recall": float(box.mr),
        },
        "per_class_metrics": per_class,
    }
    OUTPUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
