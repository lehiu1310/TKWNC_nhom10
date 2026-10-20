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
