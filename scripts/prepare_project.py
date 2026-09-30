"""Download TF Flowers, fine-tune the flower classifier, and build the CLIP image index."""
import argparse
import json
import random
import sys
import tarfile
import urllib.request
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from sklearn.model_selection import train_test_split
from torch import nn
from torch.utils.data import DataLoader, Subset
from torchvision.datasets import ImageFolder

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
FLOWERS_URL = "https://storage.googleapis.com/download.tensorflow.org/example_images/flower_photos.tgz"
FLOWERS_DIR = ROOT / "data" / "flowers" / "flower_photos"
ART_DIR = ROOT / "artifacts"


def get_flowers():
    if FLOWERS_DIR.exists():
        return
    archive = ROOT / "data" / "flower_photos.tgz"
    archive.parent.mkdir(parents=True, exist_ok=True)
    if not archive.exists():
        print("Downloading the public TF Flowers dataset…")
        urllib.request.urlretrieve(FLOWERS_URL, archive)
    print("Extracting flower photos…")
    with tarfile.open(archive, "r:gz") as tf:
        tf.extractall(ROOT / "data" / "flowers", filter="data")
    archive.unlink(missing_ok=True)


def train_classifier(epochs: int):
    from core.classifier import EVAL_TF, TRAIN_TF, build_model
    torch.manual_seed(42)
    np.random.seed(42)
    random.seed(42)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    raw = ImageFolder(FLOWERS_DIR)
    targets = np.asarray(raw.targets)
    all_idx = np.arange(len(targets))
    train_idx, val_idx = train_test_split(all_idx, test_size=.2, stratify=targets, random_state=42)
    train_set = ImageFolder(FLOWERS_DIR, transform=TRAIN_TF)
    val_set = ImageFolder(FLOWERS_DIR, transform=EVAL_TF)
    train_dl = DataLoader(Subset(train_set, train_idx), batch_size=32, shuffle=True, num_workers=0)
    val_dl = DataLoader(Subset(val_set, val_idx), batch_size=64, shuffle=False, num_workers=0)
    model = build_model(len(raw.classes), pretrained=True).to(device)
    criterion = nn.CrossEntropyLoss(label_smoothing=.1)
    optimizer = torch.optim.AdamW(model.parameters(), lr=2e-4, weight_decay=1e-4)
    out = ART_DIR / "classifier"
    out.mkdir(parents=True, exist_ok=True)
    best_accuracy = -1.0
    for epoch in range(epochs):
        model.train()
        total = 0
        for images, labels in train_dl:
            images, labels = images.to(device), labels.to(device)
            optimizer.zero_grad(set_to_none=True)
            loss = criterion(model(images), labels)
            loss.backward()
            optimizer.step()
            total += float(loss)
        model.eval()
        correct = count = 0
        with torch.inference_mode():
            for images, labels in val_dl:
                predictions = model(images.to(device)).argmax(1).cpu()
                correct += int((predictions == labels).sum())
                count += len(labels)
        accuracy = correct / max(count, 1)
        print(f"Epoch {epoch + 1}/{epochs}: loss={total / max(len(train_dl), 1):.4f}, val_accuracy={accuracy:.4f}")
        if accuracy > best_accuracy:
            best_accuracy = accuracy
            torch.save(model.cpu().state_dict(), out / "model.pt")
            model.to(device)
    (out / "classes.json").write_text(json.dumps(raw.classes), encoding="utf-8")
    (out / "metrics.json").write_text(json.dumps({"validation_accuracy": best_accuracy, "validation_size": len(val_idx), "epochs": epochs}, indent=2), encoding="utf-8")


def build_retrieval_index():
    from core.retrieval import ClipEncoder, build_index
    items = []
    for folder in sorted(p for p in FLOWERS_DIR.iterdir() if p.is_dir()):
        for path in sorted(folder.glob("*.jpg")):
            items.append({"path": path.relative_to(ROOT).as_posix(), "label": folder.name, "source": "flowers"})
    print(f"Encoding {len(items)} flower photos for the search album…")
    encoder = ClipEncoder()
    build_index(encoder, items, ART_DIR / "retrieval")
    print("CLIP index ready.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--epochs", type=int, default=2, help="Classifier fine-tuning epochs (default: 2).")
    parser.add_argument("--skip-classifier", action="store_true")
    parser.add_argument("--skip-retrieval", action="store_true")
    args = parser.parse_args()
    get_flowers()
    if not args.skip_classifier:
        train_classifier(max(1, args.epochs))
    if not args.skip_retrieval:
        build_retrieval_index()
    print("Ready. Run the API with: uvicorn api.main:app --port 8000")


if __name__ == "__main__":
    main()
