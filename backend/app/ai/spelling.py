"""Forgiving spelling for the words that drive question understanding (no LLM).

Only words close to a small vocabulary are corrected: month names, period words
("quarter", "year"), metric names and their synonyms. Everything else is left
exactly as typed, so a correction can never invent a new meaning.

    "revnue in octobe"        -> "revenue in october"
    "compare quater 1 and 2"  -> "compare quarter 1 and 2"
    "expences last yaer"      -> "expenses last year"

Rules: a word is only considered if it has 4+ letters, isn't already a known
word, starts with the same letter as the candidate, and either has the same
letters in a different order ("yaer") or is at least 80% similar (difflib ratio),
75% for long words (8+ letters).
"""

import re
from difflib import SequenceMatcher

from app.ai.metrics_config import METRICS

MONTH_NAMES = [
    "january", "february", "march", "april", "may", "june", "july", "august",
    "september", "october", "november", "december",
]

PERIOD_WORDS = [
    "quarter", "quarters", "quarterly", "month", "months", "monthly", "year", "years",
    "yearly", "annual", "previous", "last", "this", "current", "between", "compare",
    "compared", "comparison", "versus", "trend", "trends", "highest", "lowest", "forecast",
    "growth", "increase", "decrease", "summary",
]


def _vocabulary() -> list[str]:
    words = set(MONTH_NAMES) | set(PERIOD_WORDS)
    for name, cfg in METRICS.items():
        words.add(name)
        words.update(s for s in cfg["synonyms"] if " " not in s)
    return sorted(words)


VOCABULARY = _vocabulary()
_KNOWN = set(VOCABULARY)

# Common English words that look like vocabulary words but must never be "corrected".
_PROTECTED = {
    "march", "marched", "mayor", "junior", "july", "decided", "decide", "decision", "member",
    "remember", "quiet", "quite", "quarry", "yeast", "test", "lasting", "costly", "spending",
    "sale", "sales", "salary", "sailed", "profile", "profiles", "products", "product",
    "process", "project", "provide", "reverse", "review", "reveal", "expected", "expense",
    "expert", "export", "trends", "months", "years", "comparing", "current", "currency",
}

_WORD_RE = re.compile(r"[A-Za-z]+")


def _best_match(word: str) -> str | None:
    low = word.lower()
    if len(low) < 4 or low in _KNOWN or low in _PROTECTED:
        return None
    best, best_ratio = None, 0.0
    for cand in VOCABULARY:
        if cand[0] != low[0] or abs(len(cand) - len(low)) > 2:
            continue
        if sorted(low) == sorted(cand):  # swapped letters: "yaer" -> "year"
            return cand
        ratio = SequenceMatcher(None, low, cand).ratio()
        if ratio > best_ratio:
            best, best_ratio = cand, ratio
    threshold = 0.75 if len(low) >= 8 else 0.8
    return best if best and best_ratio >= threshold else None


def correct(text: str) -> tuple[str, list[tuple[str, str]]]:
    """(corrected text, [(typed, corrected), ...]). Unchanged text when nothing matches."""
    fixes: list[tuple[str, str]] = []

    def repl(m: re.Match) -> str:
        word = m.group(0)
        fixed = _best_match(word)
        if fixed is None:
            return word
        fixes.append((word, fixed))
        return fixed

    return _WORD_RE.sub(repl, text), fixes
