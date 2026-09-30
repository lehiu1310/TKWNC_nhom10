"""Prepare a 103-class flower catalog from Oxford Flowers 102 plus the existing tulip class."""
import argparse
import json
import os
import random
import re
import sys
import tarfile
import urllib.request
from collections import defaultdict
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageFilter, ImageStat
from scipy.io import loadmat
from sklearn.model_selection import train_test_split
from torch import nn
from torch.utils.data import DataLoader, Dataset, Subset
from torchvision import models, transforms

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
DATA_DIR = ROOT / "data"
OXFORD_DIR = DATA_DIR / "flowers-102"
PHOTOS_DIR = DATA_DIR / "flowers" / "flower_photos"
SPECIES_FILE = DATA_DIR / "species.json"
LABELS_FILE = DATA_DIR / "oxford102_labels.json"
ART_DIR = ROOT / "artifacts"
os.environ.setdefault("TORCH_HOME", str(ART_DIR / "torch"))
MEAN = [0.485, 0.456, 0.406]
STD = [0.229, 0.224, 0.225]
TRAIN_TF = transforms.Compose([
    transforms.RandomResizedCrop(160, scale=(0.7, 1.0)),
    transforms.RandomHorizontalFlip(),
    transforms.ColorJitter(0.15, 0.15, 0.15),
    transforms.ToTensor(), transforms.Normalize(MEAN, STD),
])
EVAL_TF = transforms.Compose([
    transforms.Resize(184), transforms.CenterCrop(160), transforms.ToTensor(), transforms.Normalize(MEAN, STD),
])
PALETTE = ["#FF6F91", "#FF8A5B", "#FFC93C", "#9B7EDE", "#5BAE6B", "#6B9DD4", "#EEE8DF"]
SPECIAL_IDS = {
    "oxeye daisy": "daisy", "common dandelion": "dandelion", "rose": "roses", "sunflower": "sunflowers",
}
TF_IDS = {"daisy": "daisy", "dandelion": "dandelion", "roses": "roses", "sunflowers": "sunflowers", "tulips": "tulips"}
# Hand-picked, flower-forward photos for the five large homepage/scroll features.
FEATURED_PHOTOS = {
    "daisy": "data/flowers/flower_photos/daisy/16401288243_36112bd52f_m.jpg",
    "dandelion": "data/flowers/flower_photos/dandelion/3469112805_6cc8640236.jpg",
    "roses": "data/flowers/flower_photos/roses/10503217854_e66a804309.jpg",
    "sunflowers": "data/flowers/flower_photos/sunflowers/5970301989_fe3a68aac8_m.jpg",
    "tulips": "data/flowers/flower_photos/tulips/14087361621_9fefb8dbef.jpg",
}
VI_NAMES = {
    "pink primrose": "Anh thảo hồng", "globe thistle": "Kế cầu", "blanket flower": "Cúc Gaillardia",
    "trumpet creeper": "Đăng tiêu", "blackberry lily": "Diên vĩ báo", "snapdragon": "Hoa mõm sói",
    "colt's foot": "Khoản đông hoa", "king protea": "Protea hoàng đế", "spear thistle": "Kế gai",
    "yellow iris": "Diên vĩ vàng", "globe-flower": "Cầu hoa vàng", "purple coneflower": "Cúc Echinacea",
    "peruvian lily": "Ly Peru", "balloon flower": "Hoa cát cánh", "hard-leaved pocket orchid": "Lan hài",
    "giant white arum lily": "Rum trắng", "fire lily": "Huệ lửa", "pincushion flower": "Hoa scabiosa",
    "fritillary": "Hoa fritillaria", "red ginger": "Gừng đỏ", "grape hyacinth": "Dạ hương nho",
    "corn poppy": "Anh túc đỏ", "prince of wales feathers": "Mào gà đuôi phụng", "stemless gentian": "Long đởm không thân",
    "artichoke": "Atisô", "canterbury bells": "Chuông Canterbury", "sweet william": "Cẩm chướng chùm",
    "carnation": "Cẩm chướng", "garden phlox": "Phlox vườn", "love in the mist": "Hoa tình yêu trong sương",
    "mexican aster": "Cúc Mexico", "alpine sea holly": "Kế biển Alpine", "ruby-lipped cattleya": "Lan Cattleya môi ruby",
    "cape flower": "Hoa Cape", "great masterwort": "Astrantia", "siam tulip": "Nghệ Thái",
    "sweet pea": "Đậu thơm", "lenten rose": "Hồng mùa chay", "barbeton daisy": "Hoa đồng tiền",
    "daffodil": "Thủy tiên vàng", "sword lily": "Lay ơn", "poinsettia": "Trạng nguyên",
    "bolero deep blue": "Cát tường xanh", "wallflower": "Hoa wallflower", "marigold": "Vạn thọ",
    "buttercup": "Mao lương", "oxeye daisy": "Cúc mắt bò", "english marigold": "Cúc kim tiền",
    "common dandelion": "Bồ công anh", "petunia": "Dạ yên thảo", "wild pansy": "Viola ba màu",
    "primula": "Anh thảo", "sunflower": "Hướng dương", "pelargonium": "Phong lữ thảo",
    "bishop of llandaff": "Thược dược Bishop of Llandaff", "gaura": "Gaura", "geranium": "Phong lữ",
    "orange dahlia": "Thược dược cam", "tiger lily": "Ly hổ", "pink-yellow dahlia": "Thược dược hồng vàng",
    "cautleya spicata": "Gừng cảnh Cautleya", "japanese anemone": "Hải quỳ Nhật", "black-eyed susan": "Cúc mắt đen",
    "silverbush": "Bìm bạc", "californian poppy": "Anh túc California", "osteospermum": "Cúc châu Phi",
    "spring crocus": "Nghệ tây mùa xuân", "bearded iris": "Diên vĩ râu", "windflower": "Cỏ chân ngỗng",
    "moon orchid": "Lan hồ điệp", "tree poppy": "Anh túc thân gỗ", "gazania": "Cúc Gazania",
    "azalea": "Đỗ quyên", "water lily": "Hoa súng", "rose": "Hoa hồng", "thorn apple": "Cà độc dược",
    "morning glory": "Bìm bìm", "passion flower": "Lạc tiên", "lotus": "Hoa sen", "toad lily": "Lily cóc",
    "bird of paradise": "Thiên điểu", "anthurium": "Hồng môn", "frangipani": "Hoa sứ", "clematis": "Ông lão",
    "hibiscus": "Dâm bụt", "columbine": "Hoa bồ câu", "desert-rose": "Sứ Thái", "tree mallow": "Cẩm quỳ thân gỗ",
    "magnolia": "Mộc lan", "cyclamen": "Anh thảo Cyclamen", "watercress": "Cải xoong ra hoa", "monkshood": "Ô đầu",
    "canna lily": "Dong riềng cảnh", "hippeastrum": "Huệ tây", "bee balm": "Bạc hà ong",
    "ball moss": "Rêu cầu", "foxglove": "Mao địa hoàng", "bougainvillea": "Hoa giấy", "camellia": "Trà mi",
    "mallow": "Cẩm quỳ", "mexican petunia": "Dạ yên thảo Mexico", "bromelia": "Dứa cảnh",
}
OLD_SPECIES = {item["id"]: item for item in json.loads(SPECIES_FILE.read_text(encoding="utf-8"))}


def species_id(name: str) -> str:
    if name in SPECIAL_IDS:
        return SPECIAL_IDS[name]
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", name.lower())).strip("-")


def label_data():
    labels = json.loads(LABELS_FILE.read_text(encoding="utf-8"))
    return [(int(index), name, species_id(name)) for index, name in sorted(labels.items(), key=lambda item: int(item[0]))]


def image_sharpness(path: Path) -> float:
    with Image.open(path) as image:
        image.thumbnail((220, 220))
        return ImageStat.Stat(image.convert("L").filter(ImageFilter.FIND_EDGES)).var[0]


def dominant_color(path: Path, flower_name: str) -> str:
    preferred = {"daisy": "#FFC93C", "dandelion": "#FFC93C", "roses": "#FF6F91", "sunflowers": "#FFC93C", "tulips": "#9B7EDE"}
    if species_id(flower_name) in preferred:
        return preferred[species_id(flower_name)]
    with Image.open(path) as image:
        pixels = np.asarray(image.convert("HSV").resize((48, 48), Image.Resampling.BILINEAR))
    colorful = pixels[(pixels[:, :, 1] > 70) & (pixels[:, :, 2] > 65)][:, 0]
    hue = float(np.median(colorful)) / 255 if len(colorful) else .12
    palette_hues = [(.96, PALETTE[0]), (.05, PALETTE[1]), (.14, PALETTE[2]), (.74, PALETTE[3]), (.34, PALETTE[4]), (.58, PALETTE[5])]
    return min(palette_hues, key=lambda entry: min(abs(hue - entry[0]), 1 - abs(hue - entry[0])))[1]


def all_records():
    label_by_image = loadmat(OXFORD_DIR / "imagelabels.mat", squeeze_me=True)["labels"]
    names = dict((index, name) for index, name, _ in label_data())
    records = []
    by_class = defaultdict(list)
    for image_number, raw_label in enumerate(label_by_image, start=1):
        name = names[int(raw_label) - 1]
        class_id = species_id(name)
        image_path = OXFORD_DIR / "jpg" / f"image_{image_number:05d}.jpg"
        record = {"path": image_path.relative_to(ROOT).as_posix(), "class_id": class_id, "name": name}
        records.append(record)
        by_class[class_id].append(image_path)
    for folder_name, class_id in TF_IDS.items():
        folder = PHOTOS_DIR / folder_name
        if not folder.exists():
            continue
        for image_path in sorted(folder.glob("*.jpg")):
            records.append({"path": image_path.relative_to(ROOT).as_posix(), "class_id": class_id, "name": folder_name})
            by_class[class_id].append(image_path)
    return records, by_class


def ensure_tf_flowers():
    if PHOTOS_DIR.exists():
        return
    archive = DATA_DIR / "flower_photos.tgz"
    archive.parent.mkdir(parents=True, exist_ok=True)
    if not archive.exists():
        print("Downloading the legacy five-class flower photos (to retain the tulip class)…", flush=True)
        urllib.request.urlretrieve("https://storage.googleapis.com/download.tensorflow.org/example_images/flower_photos.tgz", archive)
    with tarfile.open(archive, "r:gz") as source:
        source.extractall(DATA_DIR / "flowers", filter="data")
    archive.unlink(missing_ok=True)


def write_species(by_class):
    rows = []
    labels = label_data()
    ordered = []
    # Keep the five current showcase flowers at the start of the site.
    for class_id in ("daisy", "dandelion", "roses", "sunflowers", "tulips"):
        ordered.append(class_id)
    ordered.extend(class_id for _, _, class_id in labels if class_id not in ordered)
    names_by_id = {class_id: name for _, name, class_id in labels}
    for class_id in ordered:
        if class_id == "tulips":
            row = dict(OLD_SPECIES["tulips"])
            row["image"] = FEATURED_PHOTOS[class_id]
            rows.append(row)
            continue
        english = names_by_id[class_id]
        best_image = max(by_class[class_id], key=image_sharpness)
        old = OLD_SPECIES.get(class_id)
        if class_id == "daisy":
            row = {
                "id": class_id, "name_vi": "Cúc mắt bò", "name_en": "Oxeye daisy",
                "meaning": "Vẻ thuần khiết, bình dị và sức sống giữa đồng cỏ.", "bloom_season": "Cuối xuân – đầu thu (tùy vùng)",
                "description": "Cánh hoa trắng bao quanh nhụy vàng nổi bật trên nền lá xanh.",
                "long_description": "Cúc mắt bò (Leucanthemum vulgare) là cây thân thảo lâu năm với cụm hoa dạng đầu: phần giữa gồm nhiều hoa nhỏ màu vàng, bao quanh bởi các hoa tia màu trắng. Loài này phổ biến ở đồng cỏ ôn đới; thời điểm nở thay đổi theo khí hậu và vùng trồng.",
                "facts": ["Họ thực vật: Asteraceae (họ Cúc)", "Cụm hoa có tâm vàng và hoa tia trắng", "Ưa nơi có nắng; mùa nở tùy khí hậu"],
            }
        elif old:
            row = dict(old)
        else:
            display = VI_NAMES.get(english, english.title())
            row = {
                "id": class_id, "name_vi": display, "name_en": english.title(),
                "meaning": "Ý nghĩa biểu tượng thay đổi theo màu sắc và văn hóa.",
                "bloom_season": "Tùy giống và vùng khí hậu",
                "description": f"Ảnh thực tế của {display.lower()} trong bộ dữ liệu nhận diện hoa.",
                "long_description": f"{display} (nhãn dữ liệu: {english}) là một trong các nhóm hoa có ảnh đại diện trong Oxford Flowers 102. Đặc điểm hình thái, mùa nở và cách trồng có thể khác nhau tùy giống và khí hậu địa phương.",
                "facts": [f"Nhãn phân loại trong bộ dữ liệu: {english}", "Ảnh đại diện là ảnh chụp hoa thật", "Mùa hoa và cách chăm sóc tùy giống, khí hậu"],
            }
        row["image"] = FEATURED_PHOTOS.get(class_id, best_image.relative_to(ROOT).as_posix())
        row["color"] = dominant_color(best_image, english)
        row["scene_background"] = row["color"]
        rows.append(row)
    SPECIES_FILE.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(rows)} species using {sum(map(len, by_class.values()))} real photos.")
    return ordered


class FlowerDataset(Dataset):
    def __init__(self, records, class_to_index, transform):
        self.records = records
        self.class_to_index = class_to_index
        self.transform = transform

    def __len__(self):
        return len(self.records)

    def __getitem__(self, index):
        row = self.records[index]
        with Image.open(ROOT / row["path"]) as image:
            return self.transform(image.convert("RGB")), self.class_to_index[row["class_id"]]


def train_classifier(records, classes, epochs=4):
    torch.manual_seed(42)
    np.random.seed(42)
    random.seed(42)
    class_to_index = {class_id: index for index, class_id in enumerate(classes)}
    targets = np.asarray([class_to_index[row["class_id"]] for row in records])
    indices = np.arange(len(records))
    train_idx, val_idx = train_test_split(indices, test_size=.18, stratify=targets, random_state=42)
    train_set = FlowerDataset(records, class_to_index, TRAIN_TF)
    val_set = FlowerDataset(records, class_to_index, EVAL_TF)
    train_dl = DataLoader(Subset(train_set, train_idx), batch_size=32, shuffle=True, num_workers=0)
    val_dl = DataLoader(Subset(val_set, val_idx), batch_size=64, shuffle=False, num_workers=0)
    model = models.resnet18(weights=models.ResNet18_Weights.IMAGENET1K_V1)
    for parameter in model.parameters():
        parameter.requires_grad = False
    model.fc = nn.Linear(model.fc.in_features, len(classes))
    for parameter in model.layer4.parameters():
        parameter.requires_grad = True
    model.to("cpu")
    optimizer = torch.optim.AdamW((p for p in model.parameters() if p.requires_grad), lr=1e-4, weight_decay=1e-4)
    loss_fn = nn.CrossEntropyLoss(label_smoothing=.08)
    out = ART_DIR / "classifier"
    out.mkdir(parents=True, exist_ok=True)
    best_accuracy = 0.0
    for epoch in range(epochs):
        model.train()
        total_loss = 0.0
        for images, labels in train_dl:
            optimizer.zero_grad(set_to_none=True)
            loss = loss_fn(model(images), labels)
            loss.backward()
            optimizer.step()
            total_loss += loss.detach().item()
        model.eval()
        correct = count = 0
        with torch.inference_mode():
            for images, labels in val_dl:
                correct += int((model(images).argmax(1) == labels).sum())
                count += len(labels)
        accuracy = correct / max(1, count)
        print(f"Epoch {epoch + 1}/{epochs}: loss={total_loss / max(1, len(train_dl)):.4f}, val_accuracy={accuracy:.4f}", flush=True)
        if accuracy > best_accuracy:
            best_accuracy = accuracy
            torch.save(model.cpu().state_dict(), out / "model.new.pt")
            model.to("cpu")
    (out / "model.new.pt").replace(out / "model.pt")
    (out / "classes.json").write_text(json.dumps(classes), encoding="utf-8")
    (out / "metrics.json").write_text(json.dumps({"validation_accuracy": best_accuracy, "validation_size": len(val_idx), "epochs": epochs, "classes": len(classes)}, indent=2), encoding="utf-8")


def build_retrieval_index(records):
    from core.retrieval import ClipEncoder, build_index
    names = {row["id"]: row["name_vi"] for row in json.loads(SPECIES_FILE.read_text(encoding="utf-8"))}
    # Keep a balanced, representative set so all 103 species are searchable without
    # making the local CPU indexing step take hours. Full photos remain available to train ResNet.
    grouped = defaultdict(list)
    for row in records:
        grouped[row["class_id"]].append(row)
    items = []
    for class_id, photos in sorted(grouped.items()):
        photos.sort(key=lambda row: row["path"])
        limit = min(12, len(photos))
        # Evenly sample sorted paths for visual variety instead of taking adjacent files.
        chosen = [photos[round(i * (len(photos) - 1) / max(1, limit - 1))] for i in range(limit)]
        items.extend({"path": row["path"], "label": names[class_id], "species_id": class_id,
                      "source": "Oxford Flowers 102" if "flowers-102" in row["path"] else "TF Flowers"}
                     for row in chosen)
    print(f"Encoding {len(items)} representative photos across {len(grouped)} species for CLIP + FAISS…", flush=True)
    build_index(ClipEncoder(), items, ART_DIR / "retrieval")
    print("CLIP index ready.", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--epochs", type=int, default=4)
    parser.add_argument("--skip-train", action="store_true")
    parser.add_argument("--skip-index", action="store_true")
    args = parser.parse_args()
    from torchvision.datasets import Flowers102
    Flowers102(root=DATA_DIR, split="train", download=True)
    ensure_tf_flowers()
    records, by_class = all_records()
    classes = write_species(by_class)
    if not args.skip_train:
        train_classifier(records, classes, max(1, args.epochs))
    if not args.skip_index:
        build_retrieval_index(records)
    print(f"Ready: {len(classes)} classifier species, {len(records)} flower photos.", flush=True)


if __name__ == "__main__":
    main()
