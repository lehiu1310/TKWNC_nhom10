"""Reproduce validation metrics for the saved 103-class ResNet-18 checkpoint."""
import argparse
import json
import sys
from pathlib import Path

import numpy as np
import torch
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
from sklearn.model_selection import train_test_split
from torch.utils.data import DataLoader, Subset

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from core.classifier import ImageClassifier  # noqa: E402
from scripts.prepare_flowers102 import EVAL_TF, FlowerDataset, all_records  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "reports")
    args = parser.parse_args()

    classifier = ImageClassifier()
    records, _ = all_records()
    class_to_index = {name: index for index, name in enumerate(classifier.classes)}
    targets = np.asarray([class_to_index[row["class_id"]] for row in records])
    indices = np.arange(len(records))
    _, validation_indices = train_test_split(
        indices, test_size=.18, stratify=targets, random_state=42,
    )
    validation = FlowerDataset(records, class_to_index, EVAL_TF)
    loader = DataLoader(Subset(validation, validation_indices), batch_size=args.batch_size, shuffle=False, num_workers=0)

    predictions, actual = [], []
    with torch.inference_mode():
        for images, labels in loader:
            logits = classifier.model(images.to(classifier.model.fc.weight.device))
            predictions.extend(logits.argmax(dim=1).cpu().tolist())
            actual.extend(labels.tolist())

    report = classification_report(
        actual, predictions, labels=list(range(len(classifier.classes))),
        target_names=classifier.classes, output_dict=True, zero_division=0,
    )
    matrix = confusion_matrix(actual, predictions, labels=list(range(len(classifier.classes))))
    args.output_dir.mkdir(parents=True, exist_ok=True)
    result = {
        "checkpoint": "artifacts/classifier/model.pt",
        "dataset_records": len(records),
        "class_count": len(classifier.classes),
        "validation_count": len(actual),
        "split": "train_test_split(test_size=0.18, stratify=labels, random_state=42); same validation protocol as training",
        "accuracy": accuracy_score(actual, predictions),
        "macro_f1": f1_score(actual, predictions, average="macro", zero_division=0),
        "weighted_f1": f1_score(actual, predictions, average="weighted", zero_division=0),
        "per_class": report,
        "note": "Validation set was used during training to select the best checkpoint; these metrics are not an independent test set.",
    }
    (args.output_dir / "classifier_evaluation.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8",
    )
    with (args.output_dir / "classifier_confusion_matrix.csv").open("w", encoding="utf-8", newline="") as output:
        output.write("true_label," + ",".join(classifier.classes) + "\n")
        for label, row in zip(classifier.classes, matrix):
            output.write(label + "," + ",".join(str(int(value)) for value in row) + "\n")
    print(json.dumps({key: result[key] for key in ("dataset_records", "class_count", "validation_count", "accuracy", "macro_f1", "weighted_f1", "note")}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
