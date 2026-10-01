"""Train/evaluate MobileNetV3 against the current ResNet18 and benchmark ResNet ONNX."""
import argparse
import json
import random
import sys
import time
from pathlib import Path

import numpy as np
import torch
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import train_test_split
from torch import nn
from torch.utils.data import DataLoader, Subset
from torchvision import models

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from core.classifier import ImageClassifier  # noqa: E402
from scripts.prepare_flowers102 import EVAL_TF, TRAIN_TF, FlowerDataset, all_records  # noqa: E402


def make_mobile_net(class_count: int, pretrained: bool = True):
    weights = models.MobileNet_V3_Small_Weights.DEFAULT if pretrained else None
    model = models.mobilenet_v3_small(weights=weights)
    for parameter in model.parameters():
        parameter.requires_grad = False
    for parameter in model.features[-1].parameters():
        parameter.requires_grad = True
    model.classifier[-1] = nn.Linear(model.classifier[-1].in_features, class_count)
    return model


def predict(model, loader, device):
    actual, guesses = [], []
    model.eval()
    with torch.inference_mode():
        for images, labels in loader:
            guesses.extend(model(images.to(device)).argmax(1).cpu().tolist())
            actual.extend(labels.tolist())
    return np.asarray(actual), np.asarray(guesses)


def latency(model, loader, device, sample_count=128):
    model.eval()
    images = []
    for batch, _ in loader:
        images.extend(batch)
        if len(images) >= sample_count:
            break
    durations = []
    with torch.inference_mode():
        for image in images[:5]:
            model(image.unsqueeze(0).to(device))
        for image in images[:sample_count]:
            start = time.perf_counter()
            model(image.unsqueeze(0).to(device))
            durations.append((time.perf_counter() - start) * 1000)
    return {"sample_count": len(durations), "p50_ms": float(np.percentile(durations, 50)),
            "p95_ms": float(np.percentile(durations, 95))}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "artifacts" / "comparison")
    parser.add_argument("--report", type=Path, default=ROOT / "reports" / "classifier_architecture_comparison.json")
    parser.add_argument("--skip-training", action="store_true", help="Only evaluate a previously saved MobileNet checkpoint")
    args = parser.parse_args()
    if args.epochs < 1 or args.batch_size < 1:
        parser.error("epochs and batch-size must be positive")
    torch.set_num_threads(min(torch.get_num_threads(), 2))
    random.seed(42)
    np.random.seed(42)
    torch.manual_seed(42)
    device = torch.device("cpu")

    baseline = ImageClassifier()
    records, _ = all_records()
    classes = baseline.classes
    class_to_index = {name: index for index, name in enumerate(classes)}
    labels = np.asarray([class_to_index[row["class_id"]] for row in records])
    indices = np.arange(len(records))
    train_ids, val_ids = train_test_split(indices, test_size=.18, stratify=labels, random_state=42)
    train_data = FlowerDataset(records, class_to_index, TRAIN_TF)
    val_data = FlowerDataset(records, class_to_index, EVAL_TF)
    train_loader = DataLoader(Subset(train_data, train_ids), batch_size=args.batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(Subset(val_data, val_ids), batch_size=args.batch_size, shuffle=False, num_workers=0)

    args.output_dir.mkdir(parents=True, exist_ok=True)
    mobile_path = args.output_dir / "mobilenet_v3_small.pt"
    if not args.skip_training:
        model = make_mobile_net(len(classes)).to(device)
        optimizer = torch.optim.AdamW((p for p in model.parameters() if p.requires_grad), lr=1e-4, weight_decay=1e-4)
        criterion = nn.CrossEntropyLoss(label_smoothing=.08)
        best_accuracy = -1.0
        for epoch in range(args.epochs):
            model.train()
            total_loss = 0.0
            for images, target in train_loader:
                optimizer.zero_grad(set_to_none=True)
                loss = criterion(model(images.to(device)), target.to(device))
                loss.backward()
                optimizer.step()
                total_loss += float(loss.detach())
            y_true, y_pred = predict(model, val_loader, device)
            accuracy = float(accuracy_score(y_true, y_pred))
            print(f"epoch={epoch + 1}/{args.epochs} train_loss={total_loss / max(1, len(train_loader)):.4f} val_accuracy={accuracy:.4f}", flush=True)
            if accuracy > best_accuracy:
                best_accuracy = accuracy
                torch.save(model.state_dict(), mobile_path)

    mobile = make_mobile_net(len(classes), pretrained=False).to(device)
    mobile.load_state_dict(torch.load(mobile_path, map_location=device, weights_only=True))
    models_to_compare = {"resnet18": baseline.model.cpu().eval(), "mobilenet_v3_small": mobile.eval()}
    result = {
        "dataset_records": len(records), "classes": len(classes), "validation_count": len(val_ids),
        "split": "same stratified 82/18 split; random_state=42",
        "hardware": {"processor": __import__("platform").processor(), "torch": torch.__version__,
                     "device": str(device), "threads": torch.get_num_threads()},
        "training": {"epochs": args.epochs, "frozen_backbone": "MobileNet features except final feature block; classifier trained",
                     "warning": "ResNet is the existing checkpoint; MobileNet is trained with the same split but a separate run. Compare as an engineering benchmark, not a controlled hyperparameter search."},
        "models": {},
    }
    for name, model in models_to_compare.items():
        actual, predicted = predict(model, val_loader, device)
        checkpoint_bytes = (ROOT / "artifacts" / "classifier" / "model.pt").stat().st_size if name == "resnet18" else mobile_path.stat().st_size
        result["models"][name] = {
            "accuracy": float(accuracy_score(actual, predicted)),
            "macro_f1": float(f1_score(actual, predicted, average="macro", zero_division=0)),
            "weighted_f1": float(f1_score(actual, predicted, average="weighted", zero_division=0)),
            "checkpoint_bytes": checkpoint_bytes,
            "parameter_count": sum(p.numel() for p in model.parameters()),
            "inference_latency": latency(model, val_loader, device),
        }

    # Export the production ResNet checkpoint to ONNX and verify CPU inference parity.
    import onnx
    import onnxruntime as ort
    onnx_path = args.output_dir / "resnet18.onnx"
    sample = torch.zeros(1, 3, 160, 160, dtype=torch.float32)
    torch.onnx.export(models_to_compare["resnet18"], sample, onnx_path,
                      input_names=["image"], output_names=["logits"],
                      dynamic_axes={"image": {0: "batch"}, "logits": {0: "batch"}},
                      opset_version=17, dynamo=False)
    graph = onnx.load(str(onnx_path))
    onnx.checker.check_model(graph)
    session_options = ort.SessionOptions()
    session_options.intra_op_num_threads = 1
    session_options.inter_op_num_threads = 1
    session = ort.InferenceSession(str(onnx_path), sess_options=session_options,
                                  providers=["CPUExecutionProvider"])
    sample_images = []
    for batch, _ in val_loader:
        sample_images.extend(batch)
        if len(sample_images) >= 64:
            break
    torch_times, onnx_times, max_errors = [], [], []
    warmup = sample_images[0].unsqueeze(0).numpy()
    with torch.inference_mode():
        for _ in range(10):
            models_to_compare["resnet18"](torch.from_numpy(warmup))
            session.run(["logits"], {"image": warmup})
    with torch.inference_mode():
        for image in sample_images[:64]:
            array = image.unsqueeze(0).numpy()
            start = time.perf_counter(); expected = models_to_compare["resnet18"](torch.from_numpy(array)).numpy(); torch_times.append((time.perf_counter() - start) * 1000)
            start = time.perf_counter(); actual = session.run(["logits"], {"image": array})[0]; onnx_times.append((time.perf_counter() - start) * 1000)
            max_errors.append(float(np.max(np.abs(expected - actual))))
    result["onnx_resnet18"] = {
        "path": str(onnx_path.relative_to(ROOT)).replace("\\", "/"),
        "bytes": onnx_path.stat().st_size,
        "runtime": ort.__version__, "opset": 17, "parity_samples": len(max_errors),
        "max_abs_logit_error": max(max_errors),
        "p50_ms": {"pytorch_cpu": float(np.percentile(torch_times, 50)), "onnxruntime_cpu": float(np.percentile(onnx_times, 50))},
        "p95_ms": {"pytorch_cpu": float(np.percentile(torch_times, 95)), "onnxruntime_cpu": float(np.percentile(onnx_times, 95))},
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
