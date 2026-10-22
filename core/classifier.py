"""Ứng dụng 1 — Phân loại ảnh (ResNet-18 fine-tune trên bộ Flowers)."""
import json
import threading
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image
from torchvision import models, transforms

from config import ART_DIR, CLASSIFIER_OOD_MIN_CONFIDENCE, DEVICE, RENDER_FREE_MEMORY

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

TRAIN_TF = transforms.Compose([
    transforms.RandomResizedCrop(224, scale=(0.7, 1.0)),
    transforms.RandomHorizontalFlip(),
    transforms.ColorJitter(0.2, 0.2, 0.2),
    transforms.ToTensor(),
    transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
])
EVAL_TF = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
])


def build_model(num_classes: int, pretrained: bool = True) -> torch.nn.Module:
    """ResNet-18 ImageNet, thay lớp cuối bằng num_classes đầu ra."""
    weights = models.ResNet18_Weights.IMAGENET1K_V1 if pretrained else None
    model = models.resnet18(weights=weights)
    model.fc = torch.nn.Linear(model.fc.in_features, num_classes)
    return model


class ImageClassifier:
    def __init__(self, model_dir: Path = ART_DIR / "classifier", min_confidence: float = CLASSIFIER_OOD_MIN_CONFIDENCE):
        model_dir = Path(model_dir)
        self.classes: list[str] = json.loads((model_dir / "classes.json").read_text(encoding="utf-8"))
        self.model = build_model(len(self.classes), pretrained=False)
        state = torch.load(model_dir / "model.pt", map_location=DEVICE, weights_only=True)
        self.model.load_state_dict(state)
        del state
        self.low_memory = DEVICE == "cpu" and RENDER_FREE_MEMORY
        if self.low_memory:
            # BF16 halves resident parameter memory on modern CPU kernels. The
            # classifier is validated on CPU; keep probabilities/features FP32.
            self.model.to(dtype=torch.bfloat16)
        self.model.to(DEVICE).eval()
        self.min_confidence = min_confidence
        self._inference_lock = threading.Lock()

    @torch.inference_mode()
    def predict(self, image: Image.Image, top_k: int = 3) -> dict:
        x = EVAL_TF(image.convert("RGB")).unsqueeze(0).to(device=DEVICE, dtype=self.model.fc.weight.dtype)
        with self._inference_lock, torch.inference_mode():
            probs = self.model(x).float().softmax(dim=-1)[0]
        scores, idx = probs.topk(min(top_k, len(self.classes)))
        preds = [{"label": self.classes[i], "score": round(float(s), 4)} for s, i in zip(scores.tolist(), idx.tolist())]
        return {
            "predictions": preds,
            # Ảnh ngoài phân phối vẫn có thể bị gán nhãn: báo "không chắc" thay vì khẳng định sai
            "confident": preds[0]["score"] >= self.min_confidence,
            "confidence_threshold": self.min_confidence,
        }

    @torch.inference_mode()
    def encode_images(self, images: list[Image.Image]) -> np.ndarray:
        """Return normalized ResNet penultimate-layer features for lightweight retrieval."""
        if not images:
            return np.empty((0, self.model.fc.in_features), dtype=np.float32)
        batch = torch.stack([EVAL_TF(image.convert("RGB")) for image in images]).to(
            device=DEVICE, dtype=self.model.fc.weight.dtype,
        )
        with self._inference_lock, torch.inference_mode():
            model = self.model
            features = model.conv1(batch)
            features = model.bn1(features)
            features = model.relu(features)
            features = model.maxpool(features)
            features = model.layer1(features)
            features = model.layer2(features)
            features = model.layer3(features)
            features = model.layer4(features)
            features = model.avgpool(features).flatten(1)
            features = F.normalize(features.float(), p=2, dim=1)
        return features.cpu().numpy().astype(np.float32, copy=False)

    @torch.inference_mode()
    def predict_and_encode(self, image: Image.Image, top_k: int = 3) -> tuple[dict, np.ndarray]:
        """Classify an image and return its normalized feature vector in one model pass."""
        x = EVAL_TF(image.convert("RGB")).unsqueeze(0).to(
            device=DEVICE, dtype=self.model.fc.weight.dtype,
        )
        with self._inference_lock, torch.inference_mode():
            model = self.model
            features = model.conv1(x)
            features = model.bn1(features)
            features = model.relu(features)
            features = model.maxpool(features)
            features = model.layer1(features)
            features = model.layer2(features)
            features = model.layer3(features)
            features = model.layer4(features)
            features = model.avgpool(features).flatten(1)
            probs = model.fc(features).float().softmax(dim=-1)[0]
            scores, indices = probs.topk(min(top_k, len(self.classes)))
            vector = F.normalize(features.float(), p=2, dim=1)[0].cpu().numpy().astype(np.float32, copy=False)
        predictions = [{
            "label": self.classes[int(index)],
            "score": round(float(score), 4),
        } for score, index in zip(scores.tolist(), indices.tolist())]
        prediction = {
            "predictions": predictions,
            "confident": predictions[0]["score"] >= self.min_confidence,
            "confidence_threshold": self.min_confidence,
        }
        return prediction, vector

    def explain(self, image: Image.Image, class_index: int | None = None) -> Image.Image:
        """Create a Grad-CAM overlay for the selected/predicted ResNet class."""
        activations = []
        gradients = []
        target_layer = self.model.layer4[-1]
        x = EVAL_TF(image.convert("RGB")).unsqueeze(0).to(device=DEVICE, dtype=self.model.fc.weight.dtype)

        def capture_activation(_module, _inputs, output):
            activations.append(output)
            output.register_hook(lambda grad: gradients.append(grad))

        with self._inference_lock:
            handle = target_layer.register_forward_hook(capture_activation)
            try:
                self.model.zero_grad(set_to_none=True)
                with torch.enable_grad():
                    logits = self.model(x)
                    selected_class = int(logits.float().argmax(dim=1).item()) if class_index is None else int(class_index)
                    logits[0, selected_class].backward()
                activation = activations[-1].detach()
                gradient = gradients[-1].detach()
                weights = gradient.mean(dim=(2, 3), keepdim=True)
                cam = F.relu((weights * activation).sum(dim=1, keepdim=True))
                cam = F.interpolate(cam, size=x.shape[-2:], mode="bilinear", align_corners=False)[0, 0]
                cam -= cam.min()
                cam /= cam.max().clamp_min(1e-8)
                heat = cam.float().cpu().numpy()
            finally:
                handle.remove()
                self.model.zero_grad(set_to_none=True)

        # Compact JET-like color mapping without adding an image-processing dependency.
        red = np.clip(1.5 - np.abs(4 * heat - 3), 0, 1)
        green = np.clip(1.5 - np.abs(4 * heat - 2), 0, 1)
        blue = np.clip(1.5 - np.abs(4 * heat - 1), 0, 1)
        heat_rgb = Image.fromarray((np.stack([red, green, blue], axis=-1) * 255).astype(np.uint8))
        original = image.convert("RGB")
        heat_rgb = heat_rgb.resize(original.size, Image.Resampling.BILINEAR)
        return Image.blend(original, heat_rgb, alpha=0.38)
