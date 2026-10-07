"""Ask the AI Business Analyst from the command line.

Run from backend/:
    python -m scripts.ask --company 1 "Why did revenue drop in March 2025?"
    python -m scripts.ask --company 1 --context "..."   # also print the context block
    python -m scripts.ask --company 1 --json "..."      # full response dict
"""

import argparse
import json
import sys

from sqlalchemy.orm import Session

from app.ai.ai_service import CompanyNotFoundError, ask
from app.ai.llm import LLMError
from app.database import engine


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Ask the NEXORA AI Business Analyst")
    parser.add_argument("question")
    parser.add_argument("--company", type=int, required=True, help="company id")
    parser.add_argument("--json", action="store_true", help="print the full response as JSON")
    parser.add_argument("--context", action="store_true", help="print the context sent to the LLM")
    parser.add_argument("--no-guard-model", action="store_true", help="keyword guard only")
    args = parser.parse_args()

    with Session(engine) as db:
        try:
            result = ask(db, args.company, args.question, use_guard_model=not args.no_guard_model)
        except CompanyNotFoundError as exc:
            print(f"404: {exc}")
            sys.exit(1)
        except LLMError as exc:
            print(f"503: LLM unavailable: {exc}")
            sys.exit(1)

    if args.json:
        print(json.dumps(result, indent=2, default=str))
        return

    meta = result["meta"]
    intent = meta.get("intent", {})
    print(f"Q: {args.question}  (company {args.company}: {meta.get('company')})")
    print(
        f"status={result['status']}  grounded={result['is_grounded']}  "
        f"intent={intent.get('code', '-')}/{intent.get('name', '-')}  "
        f"model={meta.get('model', '-')}  retried={meta.get('retried', False)}  "
        f"{meta.get('latency_ms')} ms"
    )
    guard = meta.get("guard", {})
    if guard.get("reason") or guard.get("injection_score") is not None:
        print(f"guard: reason={guard.get('reason')}  detail={guard.get('detail')}  "
              f"prompt_guard={guard.get('injection_score')}")
    print("-" * 72)
    print(result["answer"])
    print("-" * 72)
    for s in result["sources"]:
        print(f"source {s['id']}: {s['label']}")
    if args.context and "context" in meta:
        print("\n" + meta["context"])


if __name__ == "__main__":
    main()
