from core.gift_advisor import recommend_gifts


def test_gift_recommendations_return_three_rule_based_bouquets():
    result = recommend_gifts("sinh nhật", "người yêu", size="vừa")
    assert result["label"] == "Gợi ý dựa trên dữ liệu ý nghĩa hoa"
    assert result["verified"] is False
    assert len(result["suggestions"]) == 3
    assert all(item["stem_count"] == 9 for item in result["suggestions"])


def test_consolation_suggestions_exclude_flowers_flagged_for_joyful_events():
    result = recommend_gifts("chia buồn", "mẹ")
    main_ids = {item["main"]["id"] for item in result["suggestions"]}
    assert main_ids == {"marigold", "lotus", "sword-lily"}
    assert not main_ids.intersection({"roses", "sunflowers", "tulips"})


def test_unsupported_occasion_is_rejected():
    try:
        recommend_gifts("ngày hội hoa", "bạn")
    except ValueError as error:
        assert "Dịp" in str(error)
    else:
        raise AssertionError("Unsupported occasion should be rejected")
