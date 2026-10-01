"""Fine-tune YOLO11n on the downloaded, CC-BY flower detection dataset."""
import argparse
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_YAML = ROOT / "data" / "detection_flowers_yolo" / "data.yaml"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=8)
    parser.add_argument("--imgsz", type=int, default=416)
    parser.add_argument("--batch", type=int, default=8)
    args = parser.parse_args()
    if not DATA_YAML.is_file():
        raise FileNotFoundError("Run scripts/prepare_flower_detection.py first")
    from ultralytics import YOLO
    model = YOLO(str(ROOT / "artifacts" / "detector" / "yolo11n.pt"))
    model.train(
        data=str(DATA_YAML), epochs=args.epochs, imgsz=args.imgsz, batch=args.batch,
        device="cpu", workers=0, project=str(ROOT / "runs" / "detect"),
        name="flower_yolo11n", exist_ok=True, patience=args.epochs,
        seed=42, pretrained=True, cache=False, plots=True,
    )
    best = ROOT / "runs" / "detect" / "flower_yolo11n" / "weights" / "best.pt"
    target = ROOT / "artifacts" / "detector" / "flower_yolo11n.pt"
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(best, target)
    metrics = YOLO(str(target)).val(data=str(DATA_YAML), split="test", imgsz=args.imgsz, device="cpu", workers=0)
    report = {
        "dataset": "Weirdo-329/flower-detection-dataset",
        "initial_weights": "Ultralytics YOLO11n pretrained COCO",
        "fine_tuned_weights": str(target.relative_to(ROOT)),
        "epochs": args.epochs,
        "image_size": args.imgsz,
        "test_split": "test (deterministic 10% split; see data/detection_flowers_yolo/dataset_report.json)",
        "metrics": {
            "mAP50": float(metrics.box.map50),
            "mAP50_95": float(metrics.box.map),
            "precision": float(metrics.box.mp),
            "recall": float(metrics.box.mr),
        },
    }
    (ROOT / "reports" / "detector_evaluation.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
