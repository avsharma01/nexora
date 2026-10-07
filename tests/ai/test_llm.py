"""LLM wrapper tests: no network, the OpenAI client is faked."""

from types import SimpleNamespace

import openai
import pytest

from app.ai import llm


@pytest.fixture
def env(monkeypatch):
    monkeypatch.setenv("AI_API_KEY", "test-key")
    monkeypatch.delenv("AI_MODEL", raising=False)
    monkeypatch.delenv("AI_BASE_URL", raising=False)
    llm._client.cache_clear()
    yield monkeypatch
    monkeypatch.undo()
    llm._client.cache_clear()


class FakeCompletions:
    def __init__(self, result):
        self.result = result
        self.kwargs = None

    def create(self, **kwargs):
        self.kwargs = kwargs
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


def _install(env, result) -> FakeCompletions:
    completions = FakeCompletions(result)
    fake = SimpleNamespace(chat=SimpleNamespace(completions=completions))
    env.setattr(llm, "_client", lambda api_key, base_url: fake)
    return completions


def _response(text):
    return SimpleNamespace(
        model="llama-3.3-70b-versatile",
        choices=[SimpleNamespace(message=SimpleNamespace(content=text))],
        usage=SimpleNamespace(prompt_tokens=12, completion_tokens=5),
    )


@pytest.mark.parametrize("value", ["", "change_me", "  "])
def test_missing_or_placeholder_key_is_clear_error(env, value):
    env.setenv("AI_API_KEY", value)
    with pytest.raises(llm.LLMConfigError, match="AI_API_KEY"):
        llm.chat([{"role": "user", "content": "hi"}])


def test_defaults_are_groq(env):
    config = llm.load_config()
    assert config.base_url == "https://api.groq.com/openai/v1"
    assert config.model == "llama-3.3-70b-versatile"


def test_env_overrides(env):
    env.setenv("AI_MODEL", "llama-3.1-8b-instant")
    env.setenv("AI_BASE_URL", "https://example.test/v1")
    config = llm.load_config()
    assert (config.model, config.base_url) == ("llama-3.1-8b-instant", "https://example.test/v1")


def test_chat_sends_defaults_and_returns_text(env):
    completions = _install(env, _response("  Hello team!  "))
    reply = llm.chat([{"role": "user", "content": "hi"}])

    assert reply.text == "Hello team!"
    assert reply.completion_tokens == 5
    assert completions.kwargs["temperature"] == 0.2
    assert completions.kwargs["max_tokens"] == 400
    assert completions.kwargs["model"] == "llama-3.3-70b-versatile"


def test_provider_error_becomes_llm_error(env):
    _install(env, openai.OpenAIError("connection refused"))
    with pytest.raises(llm.LLMError, match="connection refused"):
        llm.chat([{"role": "user", "content": "hi"}])


def test_empty_reply_is_llm_error(env):
    _install(env, _response(None))
    with pytest.raises(llm.LLMError, match="empty"):
        llm.chat([{"role": "user", "content": "hi"}])
