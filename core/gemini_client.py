"""Shared Gemini client configuration with bounded latency under transient errors."""
from google import genai
from google.genai import types


def create_gemini_client(api_key: str, timeout_ms: int) -> genai.Client:
    """Create a client that makes at most one short retry before falling back."""
    return genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(
            timeout=timeout_ms,
            # Keep retries explicit in RAGChatbot: the SDK's retries combined
            # with our 429 fallback retry could otherwise multiply user wait time.
            retry_options=types.HttpRetryOptions(attempts=1, max_delay=0.5),
        ),
    )
