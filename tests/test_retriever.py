from core.llm import Retriever


def test_bm25_ranks_relevant_vietnamese_flower_chunks_first():
    retriever = Retriever([
        {"source": "hoa_hong.md", "text": "Hoa hồng tượng trưng cho tình yêu và lòng biết ơn."},
        {"source": "tulip.md", "text": "Tulip có nhiều màu sắc và thường nở vào mùa xuân."},
    ])

    results = retriever.search("Hoa hồng có ý nghĩa gì?", k=2)

    assert results
    assert results[0]["source"] == "hoa_hong.md"
    assert results[0]["score"] > 0


def test_bm25_returns_no_irrelevant_chunks():
    retriever = Retriever([
        {"source": "hoa_hong.md", "text": "Hoa hồng tượng trưng cho tình yêu."},
    ])

    assert retriever.search("máy bay vũ trụ", k=3) == []
