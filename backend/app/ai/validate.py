"""Post-generation checks on the LLM answer.

1. clean_text: enforce plain professional text (no emoji, headings, bold markers).
2. ungrounded_numbers: every number in the answer must match a number in the
   context (or the user's question). Formatting differences are allowed:
   1,050,000 / 10,50,000 / 10.5 lakh / 1.05 million / 15.3% / -15.3% vs "fell 15.3%".

Small integers (0-12, e.g. "3 months", "Q2") and F/D citation ids are ignored.
"""

import re


SCALES = {
    "thousand": 1e3, "k": 1e3,
    "lakh": 1e5, "lakhs": 1e5, "lac": 1e5, "lacs": 1e5, "l": 1e5,
    "million": 1e6, "mn": 1e6, "m": 1e6,
    "crore": 1e7, "crores": 1e7, "cr": 1e7,
    "billion": 1e9, "bn": 1e9, "b": 1e9,
}

# A number not glued to a letter on the left (skips F1, Q2, D3), optional scale word after.
_NUMBER_RE = re.compile(
    r"(?<![A-Za-z0-9.])([-−]?\d[\d,]*(?:\.\d+)?)(?:\s*(%)|\s*(" + "|".join(
        sorted(SCALES, key=len, reverse=True)) + r")\b)?",
    re.IGNORECASE,
)

_EMOJI_RE = re.compile(
    "[\U0001F000-\U0001FAFF\U00002600-\U000027BF\U0001F1E6-\U0001F1FF⬀-⯿️‍]"
)

SMALL_INT_LIMIT = 12


def clean_text(text: str) -> str:
    """Strip emoji, markdown headings, bold/italic markers and horizontal rules."""
    text = _EMOJI_RE.sub("", text)
    text = text.replace("‑", "-").replace("−", "-")  # non-breaking hyphen / minus sign
    text = re.sub(r"(?<![\w\d])[–—](?=\d)", "-", text)  # en/em dash used as minus
    text = text.replace(" ", " ").replace(" ", " ")
    text = re.sub(r"^\s{0,3}#{1,6}\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"\*\*(.+?)\*\*|__(.+?)__", lambda m: m.group(1) or m.group(2), text)
    text = re.sub(r"(?<!\w)\*(?!\s)(.+?)(?<!\s)\*(?!\w)", r"\1", text)
    text = re.sub(r"^\s*([-*_])\1{2,}\s*$", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*[*•]\s+", "- ", text, flags=re.MULTILINE)
    text = re.sub(r"([.!?])[ \t]+- (?=\S)", r"\1\n- ", text)  # "...INR. - It rose" -> new bullet line
    text = "\n".join(line.rstrip() for line in text.splitlines())
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_numbers(text: str) -> list[tuple[str, float, float]]:
    """[(raw text, value, tolerance)] for every number in `text`.

    Tolerance = half of the last shown digit (times the scale word), so a
    rounded "10.5 lakh" still matches 10,49,876.
    """
    found = []
    for m in _NUMBER_RE.finditer(text):
        raw, pct, scale_word = m.group(1), m.group(2), m.group(3)
        digits = raw.replace(",", "").replace("−", "-")
        try:
            value = float(digits)
        except ValueError:
            continue
        decimals = len(digits.split(".")[1]) if "." in digits else 0
        scale = SCALES[scale_word.lower()] if scale_word else 1.0
        # "m"/"b"/"l"/"k" alone are risky (e.g. "5 m" could be anything) but we
        # only ever use them to make a match MORE likely, never to reject.
        tolerance = 0.5 * 10 ** (-decimals) * scale
        found.append((m.group(0).strip(), value * scale, tolerance))
    return found


def _is_trivial(value: float, raw: str) -> bool:
    return float(value).is_integer() and 0 <= abs(value) <= SMALL_INT_LIMIT and "%" not in raw


_MONTH = r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?"
_DAY_DATE_RE = re.compile(
    rf"\b{_MONTH}\s+\d{{1,2}}(?:st|nd|rd|th)?,?(?=\s+\d{{4}})|\b\d{{1,2}}(?:st|nd|rd|th)?\s+(?={_MONTH}\s+\d{{4}})"
    r"|\b\d{4}-\d{2}-\d{2}\b",
    re.IGNORECASE,
)


def ungrounded_numbers(answer: str, context: str, question: str = "") -> list[str]:
    """Numbers in `answer` that match nothing in `context` or `question`."""
    allowed = [abs(v) for _, v, _ in extract_numbers(context + "\n" + question)]
    answer = _DAY_DATE_RE.sub(" ", answer)  # "March 31, 2025" -> " 2025": day numbers aren't data
    missing = []
    for raw, value, tolerance in extract_numbers(answer):
        if _is_trivial(value, raw):
            continue
        target = abs(value)
        if not any(abs(target - a) <= tolerance + 1e-9 for a in allowed):
            missing.append(raw)
    return missing
