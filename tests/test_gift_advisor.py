import json
from pathlib import Path

from core.gift_advisor import OCCASIONS, RECIPIENTS, recommend_gifts


def test_gift_recommendations_return_three_rule_based_bouquets():
    result = recommend_gifts("sinh nhật", "người yêu", size="vừa")
    assert result["label"] == "Gợi ý dựa trên dữ liệu ý nghĩa hoa"
    assert result["verified"] is False
    assert len(result["suggestions"]) == 3
    assert all(item["stem_count"] == 9 for item in result["suggestions"])


def test_every_supported_occasion_and_recipient_has_three_suggestions():
    for occasion in OCCASIONS:
        for recipient in RECIPIENTS:
            result = recommend_gifts(occasion, recipient)
            assert len(result["suggestions"]) == 3, f"{occasion} / {recipient}"


def test_each_gift_eligible_flower_stays_primary_for_every_compatible_occasion():
    data_path = Path(__file__).resolve().parents[1] / "data" / "gift_meanings.json"
    gift_data = json.loads(data_path.read_text(encoding="utf-8"))
    for entry in gift_data["species"]:
        if not entry.get("gift_ok"):
            continue
        recipients = entry.get("recipients") or gift_data["recipients"]
        for occasion in entry.get("occasions", []):
            if occasion in entry.get("avoid_occasions", []):
                continue
            result = recommend_gifts(
                occasion,
                recipients[0],
                preferred_species_id=entry["species_id"],
            )
            assert result["suggestions"][0]["main"]["id"] == entry["species_id"]


def test_gift_data_covers_catalog_and_has_auditable_fields():
    root = Path(__file__).resolve().parents[1]
    gift_data = json.loads((root / "data" / "gift_meanings.json").read_text(encoding="utf-8"))
    species = json.loads((root / "data" / "species.json").read_text(encoding="utf-8"))
    entries = gift_data["species"]
    ids = [entry["species_id"] for entry in entries]

    assert len(ids) == len(set(ids))
    assert set(ids) == {flower["id"] for flower in species}
    for entry in entries:
        assert isinstance(entry["gift_ok"], bool)
        assert isinstance(entry["meanings"], dict)
        assert isinstance(entry["size_note"], str)
        assert isinstance(entry["sources"], list) and all(source.strip() for source in entry["sources"])
        if entry["gift_ok"]:
            assert entry["occasions"] and set(entry["occasions"]) <= set(gift_data["occasions"])
            assert entry["recipients"] and set(entry["recipients"]) <= set(gift_data["recipients"])
            assert entry["colors"]


def test_flowers_flagged_for_an_occasion_are_never_recommended_for_it():
    data_path = Path(__file__).resolve().parents[1] / "data" / "gift_meanings.json"
    gift_data = json.loads(data_path.read_text(encoding="utf-8"))
    for entry in gift_data["species"]:
        if not entry.get("gift_ok"):
            continue
        for occasion in entry.get("avoid_occasions", []):
            assert occasion in OCCASIONS
            result = recommend_gifts(occasion, RECIPIENTS[0])
            suggested_ids = {item["main"]["id"] for item in result["suggestions"]}
            assert entry["species_id"] not in suggested_ids
            try:
                recommend_gifts(occasion, RECIPIENTS[0], preferred_species_id=entry["species_id"])
            except ValueError:
                pass
            else:
                raise AssertionError(f"{entry['species_id']} must not be forced into {occasion}")


def test_consolation_suggestions_exclude_flowers_flagged_for_joyful_events():
    result = recommend_gifts("chia buồn", "mẹ")
    main_ids = {item["main"]["id"] for item in result["suggestions"]}
    assert main_ids == {"marigold", "lotus", "sword-lily"}
    assert not main_ids.intersection({"roses", "sunflowers", "tulips"})


def test_selected_flower_is_kept_as_primary_when_it_fits_the_occasion():
    result = recommend_gifts("Valentine", "người yêu", preferred_species_id="roses")

    assert result["suggestions"][0]["main"]["id"] == "roses"
    assert "giữ loài hoa bạn đã chọn làm hoa chính" in result["suggestions"][0]["reason"]


def test_selected_flower_is_rejected_when_it_does_not_fit_the_occasion():
    try:
        recommend_gifts("chia buồn", "mẹ", preferred_species_id="roses")
    except ValueError as error:
        assert "chưa có dữ liệu phù hợp" in str(error)
    else:
        raise AssertionError("A flower with no matching occasion must not be forced into the bouquet")


def test_unsupported_occasion_is_rejected():
    try:
        recommend_gifts("ngày hội hoa", "bạn")
    except ValueError as error:
        assert "Dịp" in str(error)
    else:
        raise AssertionError("Unsupported occasion should be rejected")
