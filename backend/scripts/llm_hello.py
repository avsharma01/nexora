"""Smoke test for the LLM wrapper: prints a one-sentence reply.

Run from backend/:
    python -m scripts.llm_hello
"""

import sys

from app.ai.llm import LLMError, chat, load_config


def main() -> None:
    try:
        config = load_config()
        reply = chat(
            [{"role": "user", "content": "Say hello to the NEXORA team in one sentence."}],
            max_tokens=60,
        )
    except LLMError as exc:
        print(f"LLM error: {exc}")
        sys.exit(1)

    print(f"[{reply.model} via {config.base_url}, {reply.latency_ms} ms]")
    print(reply.text)


if __name__ == "__main__":
    main()
