"""Thin, provider-agnostic LLM wrapper (OpenAI-compatible chat completions).

Default provider is Groq (https://console.groq.com/docs/openai). Switching
provider = changing the AI_* values in .env, no code change.

    AI_API_KEY         required, never hardcoded or committed
    AI_MODEL           default openai/gpt-oss-120b (Groq production, reasoning model)
    AI_FALLBACK_MODEL  default qwen/qwen3.8-27b (Groq preview), used if AI_MODEL fails
    AI_GUARD_MODEL     default meta-llama/llama-prompt-guard-2-86m (Groq preview)
    AI_BASE_URL        default https://api.groq.com/openai/v1

Reasoning models think before answering. We ask for low effort and never return
the reasoning, only the final answer text (https://console.groq.com/docs/reasoning).

Every failure surfaces as LLMError so the endpoint can map it to HTTP 503.
"""

import os
import re
import time
from dataclasses import dataclass
from functools import lru_cache

import openai
from dotenv import load_dotenv

load_dotenv()


DEFAULT_BASE_URL = "https://api.groq.com/openai/v1"
DEFAULT_MODEL = "openai/gpt-oss-120b"
DEFAULT_FALLBACK_MODEL = "qwen/qwen3.8-27b"
DEFAULT_GUARD_MODEL = "meta-llama/llama-prompt-guard-2-86m"
PLACEHOLDER_KEYS = {"", "change_me"}

TEMPERATURE = 0.2
MAX_TOKENS = 1200  # reasoning tokens count towards this limit
TIMEOUT_SECONDS = 30
GUARD_TIMEOUT_SECONDS = 5
GUARD_MAX_CHARS = 2000  # Prompt Guard 2 has a 512-token window

_THINK_BLOCK = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)


class LLMError(RuntimeError):
    """The LLM could not produce an answer (provider down, timeout, bad config)."""


class LLMConfigError(LLMError):
    """AI_API_KEY (or other config) is missing."""


@dataclass
class LLMConfig:
    api_key: str
    model: str
    base_url: str
    fallback_model: str | None = None
    guard_model: str = DEFAULT_GUARD_MODEL


@dataclass
class LLMReply:
    text: str
    model: str
    latency_ms: int
    prompt_tokens: int | None = None
    completion_tokens: int | None = None


def _env(name: str, default: str) -> str:
    return os.getenv(name, "").strip() or default


def load_config() -> LLMConfig:
    api_key = os.getenv("AI_API_KEY", "").strip()
    if api_key in PLACEHOLDER_KEYS:
        raise LLMConfigError(
            "AI_API_KEY is not set. Put your Groq key in the repo-root .env "
            "(AI_API_KEY=gsk_...). Never commit it."
        )
    fallback = _env("AI_FALLBACK_MODEL", DEFAULT_FALLBACK_MODEL)
    return LLMConfig(
        api_key=api_key,
        model=_env("AI_MODEL", DEFAULT_MODEL),
        base_url=_env("AI_BASE_URL", DEFAULT_BASE_URL),
        fallback_model=None if fallback.lower() == "none" else fallback,
        guard_model=_env("AI_GUARD_MODEL", DEFAULT_GUARD_MODEL),
    )


@lru_cache(maxsize=1)
def _client(api_key: str, base_url: str) -> openai.OpenAI:
    return openai.OpenAI(
        api_key=api_key,
        base_url=base_url,
        timeout=TIMEOUT_SECONDS,
        max_retries=1,
    )


def reasoning_params(model: str) -> dict:
    """Groq reasoning settings per model family: low effort, answer text only."""
    name = model.lower()
    if "gpt-oss" in name:
        return {"reasoning_effort": "low", "extra_body": {"include_reasoning": False}}
    if name.startswith("qwen/"):
        return {"reasoning_effort": "low", "extra_body": {"reasoning_format": "hidden"}}
    return {}


def _final_text(content: str | None) -> str:
    """Final answer only: drop any <think>...</think> block a model leaks."""
    return _THINK_BLOCK.sub("", content or "").strip()


def _complete(
    client: openai.OpenAI,
    model: str,
    messages: list[dict],
    temperature: float,
    max_tokens: int,
) -> LLMReply:
    started = time.perf_counter()
    try:
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_completion_tokens=max_tokens,
            **reasoning_params(model),
        )
    except openai.OpenAIError as exc:
        raise LLMError(f"{model}: provider error ({type(exc).__name__}): {exc}") from exc
    latency_ms = round((time.perf_counter() - started) * 1000)

    text = _final_text(response.choices[0].message.content if response.choices else None)
    if not text:
        raise LLMError(f"{model}: empty response (max_tokens too low for its reasoning?)")

    usage = response.usage
    return LLMReply(
        text=text,
        model=response.model or model,
        latency_ms=latency_ms,
        prompt_tokens=usage.prompt_tokens if usage else None,
        completion_tokens=usage.completion_tokens if usage else None,
    )


def chat(
    messages: list[dict],
    *,
    temperature: float = TEMPERATURE,
    max_tokens: int = MAX_TOKENS,
) -> LLMReply:
    """Send [{"role": ..., "content": ...}]; try AI_MODEL, then AI_FALLBACK_MODEL."""
    config = load_config()
    client = _client(config.api_key, config.base_url)

    models = [config.model]
    if config.fallback_model and config.fallback_model != config.model:
        models.append(config.fallback_model)

    errors = []
    for model in models:
        try:
            return _complete(client, model, messages, temperature, max_tokens)
        except LLMError as exc:
            errors.append(str(exc))
    raise LLMError("All models failed: " + " | ".join(errors))


def prompt_guard_score(text: str) -> float:
    """Probability (0-1) that `text` is a prompt-injection / jailbreak attempt.

    Llama Prompt Guard 2 on Groq answers with the score as plain text.
    Raises LLMError on any failure; callers decide how to fall back.
    """
    config = load_config()
    client = _client(config.api_key, config.base_url)
    try:
        response = client.with_options(timeout=GUARD_TIMEOUT_SECONDS, max_retries=0).chat.completions.create(
            model=config.guard_model,
            messages=[{"role": "user", "content": text[:GUARD_MAX_CHARS]}],
        )
        return float(response.choices[0].message.content.strip())
    except (openai.OpenAIError, AttributeError, IndexError, TypeError, ValueError) as exc:
        raise LLMError(f"{config.guard_model}: {type(exc).__name__}: {exc}") from exc
