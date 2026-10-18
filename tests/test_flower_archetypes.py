import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_every_species_has_one_supported_archetype_assignment():
    species = json.loads((ROOT / "data/species.json").read_text(encoding="utf-8"))
    mapping = json.loads((ROOT / "data/flower_archetypes.json").read_text(encoding="utf-8"))
    assignments = mapping["species"]
    defaults = json.loads((ROOT / "data/flower_template_defaults.json").read_text(encoding="utf-8"))
    supported = set(defaults) | {"star_lily", "long_spike", "passionflower", "exotic"}

    assert mapping["count"] == len(species)
    assert {row["id"] for row in assignments} == {row["id"] for row in species}
    assert all(row["archetype"] in supported for row in assignments)
    assert all(0 <= row["confidence"] <= 1 and row["reason"] for row in assignments)
    assert all(row["fallback_photo"] for row in assignments if row["archetype"] in {"exotic", "passionflower"})


def test_color_audit_does_not_mutate_species_palette():
    species = json.loads((ROOT / "data/species.json").read_text(encoding="utf-8"))
    audit = json.loads((ROOT / "data/flower_photo_colors.json").read_text(encoding="utf-8-sig"))
    by_id = {row["id"]: row for row in species}

    assert len(audit) == len(species)
    assert all(row["species_color"] == by_id[row["id"]]["color"] for row in audit)
    assert all(row["roi"] == {"x": [0.3, 0.7], "y": [0.2, 0.68]} for row in audit)
