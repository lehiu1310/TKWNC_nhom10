"""Shared Gemini client configuration with bounded latency under transient errors."""
import os

from google import genai
from google.genai import types


def configured_gemini_api_key() -> str | None:
    """Return a key only after an explicit opt-in to external Gemini requests.

    API keys can remain in local or hosted secret stores after a feature is
    disabled. Requiring an explicit flag prevents those stale keys from causing
    unexpected paid API calls.
    """
    enabled = os.environ.get("ENABLE_GEMINI_API", "0").strip().lower() in {"1", "true", "yes"}
    if not enabled:
        return None
    return os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY") or None


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
