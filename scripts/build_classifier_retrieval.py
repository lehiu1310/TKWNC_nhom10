"""Build compact gallery embeddings using the existing ResNet classifier."""
import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config import ART_DIR, resolve_path
from core.classifier import ImageClassifier


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch-size", type=int, default=16)
    args = parser.parse_args()

    index_dir = ART_DIR / "retrieval"
    metadata = json.loads((index_dir / "meta.json").read_text(encoding="utf-8"))
    classifier = ImageClassifier()
    vectors = []
    for start in range(0, len(metadata), max(1, args.batch_size)):
        batch_meta = metadata[start:start + args.batch_size]
        images = []
        for item in batch_meta:
            with Image.open(resolve_path(item["path"])) as image:
                images.append(image.convert("RGB"))
        vectors.append(classifier.encode_images(images))
    matrix = np.concatenate(vectors, axis=0)
    destination = index_dir / "classifier_features.npy"
    np.save(destination, matrix.astype(np.float32, copy=False))
    print(f"images={len(metadata)} dimensions={matrix.shape[1]} bytes={destination.stat().st_size}")


if __name__ == "__main__":
    main()
