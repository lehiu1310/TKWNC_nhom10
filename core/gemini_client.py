"""Shared Gemini client configuration with bounded latency under transient errors."""
from google import genai
from google.genai import types


def create_gemini_client(api_key: str, timeout_ms: int) -> genai.Client:
    """Create a client that makes at most one short retry before falling back."""
    return genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(
            timeout=timeout_ms,
            retry_options=types.HttpRetryOptions(
                attempts=2,
                initial_delay=0.25,
                max_delay=0.5,
                exp_base=2.0,
                jitter=0.0,
            ),
        ),
    )
