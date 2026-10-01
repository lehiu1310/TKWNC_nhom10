"""Convert the CC-BY flower COCO dataset into a reproducible YOLO11 split."""
import argparse
import json
import random
import shutil
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "detection_flowers"
ANNOTATIONS = SOURCE / "annotations" / "coco_annotations.json"
OUTPUT = ROOT / "data" / "detection_flowers_yolo"


def prepare(seed: int = 42) -> dict:
    coco = json.loads(ANNOTATIONS.read_text(encoding="utf-8"))
    names = {int(c["id"]): c["name"] for c in coco["categories"]}
    image_by_id = {int(i["id"]): i for i in coco["images"]}
    anns = defaultdict(list)
    for ann in coco["annotations"]:
        anns[int(ann["image_id"])].append(ann)
    valid = []
    missing = []
    for image_id, record in image_by_id.items():
        path = SOURCE / "images" / record["file_name"]
        if path.is_file():
            valid.append((image_id, record, path))
        else:
            missing.append(record["file_name"])
    if missing:
        raise FileNotFoundError(f"Missing {len(missing)} annotated images; dataset download incomplete")

    rng = random.Random(seed)
    rng.shuffle(valid)
    n = len(valid)
    n_train, n_val = int(n * .8), int(n * .1)
    splits = {"train": valid[:n_train], "val": valid[n_train:n_train + n_val], "test": valid[n_train + n_val:]}
    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    for split, records in splits.items():
        for image_id, item, source_path in records:
            relative = Path(item["file_name"])
            image_dst = OUTPUT / split / "images" / relative
            label_dst = OUTPUT / split / "labels" / relative.with_suffix(".txt")
            image_dst.parent.mkdir(parents=True, exist_ok=True)
            label_dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source_path, image_dst)
            width, height = float(item["width"]), float(item["height"])
            rows = []
            for ann in anns.get(image_id, []):
                x, y, w, h = map(float, ann["bbox"])
                category = int(ann["category_id"])
                class_index = list(names).index(category)
                rows.append(f"{class_index} {(x+w/2)/width:.6f} {(y+h/2)/height:.6f} {w/width:.6f} {h/height:.6f}")
            label_dst.write_text("\n".join(rows), encoding="utf-8")
    yaml = [
        f"path: {OUTPUT.as_posix()}",
        "train: train/images",
        "val: val/images",
        "test: test/images",
        f"nc: {len(names)}",
        f"names: {json.dumps(list(names.values()), ensure_ascii=False)}",
    ]
    (OUTPUT / "data.yaml").write_text("\n".join(yaml) + "\n", encoding="utf-8")
    report = {
        "dataset": "Weirdo-329/flower-detection-dataset",
        "license": "Apache-2.0",
        "source": "https://huggingface.co/datasets/Weirdo-329/flower-detection-dataset",
        "seed": seed,
        "categories": list(names.values()),
        "annotated_images": n,
        "annotation_boxes": len(coco["annotations"]),
        "split_images": {k: len(v) for k, v in splits.items()},
    }
    (OUTPUT / "dataset_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    print(json.dumps(prepare(args.seed), ensure_ascii=False, indent=2))
