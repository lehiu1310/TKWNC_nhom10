"""Lightweight exact-label filtering shared by image-search callers/tests."""


def filter_by_label(results: list[dict], label: str | None) -> list[dict]:
    if not label:
        return results
    needle = label.strip().casefold()
    if not needle:
        return results
    return [
        item for item in results
        if needle in {
            str(item.get("label", "")).casefold(),
            str(item.get("species_id", "")).casefold(),
        }
    ]
