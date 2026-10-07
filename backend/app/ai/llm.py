"""Thin, provider-agnostic LLM wrapper (OpenAI-compatible chat completions).

Default provider is Groq (https://console.groq.com/docs/openai). Switching
provider = changing AI_BASE_URL / AI_MODEL / AI_API_KEY in .env, no code change.

    AI_API_KEY   required, never hardcoded or committed
    AI_MODEL     default llama-3.3-70b-versatile
    AI_BASE_URL  default https://api.groq.com/openai/v1

Every failure surfaces as LLMError so the endpoint can map it to HTTP 503.
"""

import os
import time
from dataclasses import dataclass
from functools import lru_cache

import openai
from dotenv import load_dotenv

load_dotenv()


DEFAULT_BASE_URL = "https://api.groq.com/openai/v1"
DEFAULT_MODEL = "llama-3.3-70b-versatile"
PLACEHOLDER_KEYS = {"", "change_me"}

TEMPERATURE = 0.2
MAX_TOKENS = 400
TIMEOUT_SECONDS = 30


class LLMError(RuntimeError):
    """The LLM could not produce an answer (provider down, timeout, bad config)."""


class LLMConfigError(LLMError):
    """AI_API_KEY (or other config) is missing."""


@dataclass
class LLMConfig:
    api_key: str
    model: str
    base_url: str


@dataclass
class LLMReply:
    text: str
    model: str
    latency_ms: int
    prompt_tokens: int | None = None
    completion_tokens: int | None = None


def load_config() -> LLMConfig:
    api_key = os.getenv("AI_API_KEY", "").strip()
    if api_key in PLACEHOLDER_KEYS:
        raise LLMConfigError(
            "AI_API_KEY is not set. Put your Groq key in the repo-root .env "
            "(AI_API_KEY=gsk_...). Never commit it."
        )
    return LLMConfig(
        api_key=api_key,
        model=os.getenv("AI_MODEL", "").strip() or DEFAULT_MODEL,
        base_url=os.getenv("AI_BASE_URL", "").strip() or DEFAULT_BASE_URL,
    )


@lru_cache(maxsize=1)
def _client(api_key: str, base_url: str) -> openai.OpenAI:
    return openai.OpenAI(
        api_key=api_key,
        base_url=base_url,
        timeout=TIMEOUT_SECONDS,
        max_retries=1,
    )


def chat(
    messages: list[dict],
    *,
    temperature: float = TEMPERATURE,
    max_tokens: int = MAX_TOKENS,
) -> LLMReply:
    """Send [{"role": ..., "content": ...}] and return the reply text."""
    config = load_config()
    client = _client(config.api_key, config.base_url)

    started = time.perf_counter()
    try:
        response = client.chat.completions.create(
            model=config.model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
    except openai.OpenAIError as exc:
        raise LLMError(f"LLM provider error ({type(exc).__name__}): {exc}") from exc
    latency_ms = round((time.perf_counter() - started) * 1000)

    if not response.choices or response.choices[0].message.content is None:
        raise LLMError("LLM returned an empty response")

    usage = response.usage
    return LLMReply(
        text=response.choices[0].message.content.strip(),
        model=response.model or config.model,
        latency_ms=latency_ms,
        prompt_tokens=usage.prompt_tokens if usage else None,
        completion_tokens=usage.completion_tokens if usage else None,
    )
