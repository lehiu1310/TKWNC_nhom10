"""Build sharper, lightweight gallery photos from the bundled species sources."""

import json
from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SPECIES_FILE = ROOT / "data" / "species.json"
OUTPUT_DIR = ROOT / "web" / "public" / "images" / "species"
MAX_EDGE = 960


def main() -> None:
    species = json.loads(SPECIES_FILE.read_text(encoding="utf-8"))
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    total_bytes = 0

    for flower in species:
        source = ROOT / flower["image"]
        if not source.is_file():
            raise FileNotFoundError(source)

        with Image.open(source) as original:
            image = ImageOps.exif_transpose(original).convert("RGB")
            image.thumbnail((MAX_EDGE, MAX_EDGE), Image.Resampling.LANCZOS)
            target = OUTPUT_DIR / f"{flower['id']}.webp"
            image.save(target, "WEBP", quality=88, method=5)
            total_bytes += target.stat().st_size

    print(f"Built {len(species)} gallery images at up to {MAX_EDGE}px; {total_bytes:,} bytes total.")


if __name__ == "__main__":
    main()
