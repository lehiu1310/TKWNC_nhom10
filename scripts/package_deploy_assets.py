"""Copy only images referenced by the deployed API into a Git-trackable bundle.

The source training folders remain ignored; metadata is rewritten to the compact
deployment image tree so gallery and species-image routes work after cloning.
"""
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
DEST = DATA / "deploy_images"
META = ROOT / "artifacts" / "retrieval" / "meta.json"
SPECIES = DATA / "species.json"


def deployed_path(value: str) -> tuple[Path, str]:
    relative = Path(value.replace("\\", "/"))
    prefix = Path("data/deploy_images")
    if relative.parts[:len(prefix.parts)] == prefix.parts:
        return ROOT / relative, relative.as_posix()
    if relative.parts[0] != "data":
        raise ValueError(f"Expected a data-relative image path: {value}")
    target_relative = prefix.joinpath(*relative.parts[1:])
    return ROOT / relative, target_relative.as_posix()


def main() -> None:
    retrieval = json.loads(META.read_text(encoding="utf-8"))
    species = json.loads(SPECIES.read_text(encoding="utf-8"))
    mappings: dict[str, str] = {}

    for row in retrieval:
        source, target = deployed_path(row["path"])
        if not source.is_file():
            raise FileNotFoundError(source)
        if source != ROOT / target:
            destination = ROOT / target
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)
        mappings[row["path"]] = target
        row["path"] = target

    for row in species:
        source, target = deployed_path(row["image"])
        if not source.is_file():
            raise FileNotFoundError(source)
        if source != ROOT / target:
            destination = ROOT / target
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)
        row["image"] = target

    META.write_text(json.dumps(retrieval, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    SPECIES.write_text(json.dumps(species, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Prepared {len({row['path'] for row in retrieval} | {row['image'] for row in species})} unique API images.")


if __name__ == "__main__":
    main()
