from core.llm import RAGChatbot, Retriever
from core.llm import load_chunks
from core.search_filter import filter_by_label


def test_vietnamese_query_translation_is_cached_and_uses_gemini(monkeypatch):
    from collections import OrderedDict
    from threading import Lock
    from core.retrieval import ImageSearch

    class Models:
        calls = 0

        def generate_content(self, **kwargs):
            self.calls += 1
            assert kwargs["config"]["temperature"] == 0
            return type("Response", (), {"text": "yellow flower in sunlight"})()

    engine = object.__new__(ImageSearch)
    engine._translation_cache = OrderedDict()
    engine._translation_lock = Lock()
    engine._translator_client = type("Client", (), {})()
    engine._translator_client.models = Models()
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")

    assert engine._english_query("một bông hoa vàng dưới nắng") == "yellow flower in sunlight"
    assert engine._english_query("một bông hoa vàng dưới nắng") == "yellow flower in sunlight"
    assert engine._translator_client.models.calls == 1


def test_vietnamese_query_translation_falls_back_to_original(monkeypatch):
    from collections import OrderedDict
    from threading import Lock
    from core.retrieval import ImageSearch

    class Models:
        def generate_content(self, **kwargs):
            raise RuntimeError("rate limited")

    engine = object.__new__(ImageSearch)
    engine._translation_cache = OrderedDict()
    engine._translation_lock = Lock()
    engine._translator_client = type("Client", (), {})()
    engine._translator_client.models = Models()
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")

    assert engine._english_query("hoa cúc trắng") == "hoa cúc trắng"
    assert not engine._translation_cache


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


def test_gemini_without_api_key_uses_grounded_rag_fallback(tmp_path, monkeypatch):
    (tmp_path / "hoa_hong.md").write_text(
        "## Ý nghĩa\n\nHoa hồng đỏ thường tượng trưng cho tình yêu và sự trân trọng.",
        encoding="utf-8",
    )
    (tmp_path / "hoa_cuc.md").write_text(
        "## Ý nghĩa\n\nHoa cúc tượng trưng cho lòng hiếu kính và niềm vui.",
        encoding="utf-8",
    )
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    answer = RAGChatbot(kb_dir=tmp_path, provider="gemini").answer("Hoa hồng có ý nghĩa gì?")

    assert "tình yêu" in answer["answer"]
    assert answer["sources"]
    assert answer["sources"][0]["source"] == "hoa_hong.md"
    assert "hoa_cuc.md" not in answer["answer"]


def test_gemini_without_key_says_when_kb_has_no_answer(tmp_path, monkeypatch):
    (tmp_path / "hoa_hong.md").write_text(
        "## Ý nghĩa\n\nHoa hồng đỏ tượng trưng cho tình yêu.", encoding="utf-8"
    )
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    answer = RAGChatbot(kb_dir=tmp_path, provider="gemini").answer("Tàu vũ trụ bay nhanh không?")

    assert answer["answer"] == "Mình chưa có thông tin này."
    assert answer["sources"] == []


def test_gemini_retries_rate_limit_once_then_streams_answer(monkeypatch):
    from threading import Lock

    class RateLimited(Exception):
        code = 429

    class Models:
        calls = 0

        def generate_content_stream(self, **kwargs):
            self.calls += 1
            if self.calls == 1:
                raise RateLimited("quota exceeded")
            return [type("Chunk", (), {"text": "Hoa hồng tượng trưng cho tình yêu."})()]

    bot = object.__new__(RAGChatbot)
    bot.provider = "gemini"
    bot.model_name = "test-model"
    bot._lock = Lock()
    bot.retriever = Retriever([{"source": "hoa_hong.md", "text": "Hoa hồng đỏ tượng trưng cho tình yêu và sự trân trọng."}])
    models = Models()
    bot.client = type("Client", (), {"models": models})()

    answer = bot.answer("Hoa hồng có ý nghĩa gì?")

    assert models.calls == 2
    assert "tình yêu" in answer["answer"]


def test_gemini_exhausted_rate_limit_returns_friendly_grounded_fallback(monkeypatch):
    from threading import Lock

    class RateLimited(Exception):
        code = 429

    class Models:
        calls = 0

        def generate_content_stream(self, **kwargs):
            self.calls += 1
            raise RateLimited("quota exceeded")

    bot = object.__new__(RAGChatbot)
    bot.provider = "gemini"
    bot.model_name = "test-model"
    bot._lock = Lock()
    bot.retriever = Retriever([{"source": "hoa_hong.md", "text": "Hoa hồng đỏ tượng trưng cho tình yêu và sự trân trọng."}])
    models = Models()
    bot.client = type("Client", (), {"models": models})()

    answer = bot.answer("Hoa hồng có ý nghĩa gì?")

    assert models.calls == 2
    assert "đã thử kết nối lại một lần" in answer["answer"]
    assert "tình yêu" in answer["answer"]


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
