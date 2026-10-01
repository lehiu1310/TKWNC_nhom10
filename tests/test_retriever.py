from core.llm import Retriever
from core.llm import load_chunks
from core.search_filter import filter_by_label


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


def test_markdown_chunking_has_bounded_overlap(tmp_path):
    text = "## Hướng dẫn\n\n" + ("A" * 230) + ". " + ("B" * 230) + ". " + ("C" * 230)
    (tmp_path / "hoa.md").write_text(text, encoding="utf-8")

    chunks = load_chunks(tmp_path, max_chars=260, overlap_chars=80)

    assert len(chunks) >= 2
    assert all(len(chunk["text"]) <= 260 for chunk in chunks)
    assert chunks[0]["text"][-40:] in chunks[1]["text"]


def test_image_search_label_filter_applies_before_page_limit():
    ranked = [
        {"label": "rose", "species_id": "roses"},
        {"label": "daisy", "species_id": "daisy"},
        {"label": "rose", "species_id": "roses"},
        {"label": "tulip", "species_id": "tulips"},
    ]

    result = filter_by_label(ranked, "roses")[:1]

    assert len(result) == 1
    assert result[0]["species_id"] == "roses"
