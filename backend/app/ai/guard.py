"""Gate that runs BEFORE any data is fetched or any LLM sees the question.

Blocks (-> out_of_scope):
  injection     keyword rules, plus Llama Prompt Guard 2 on Groq as an extra check
                (if that call fails we fall back to the keyword rules only)
  other_company "company 7", "id 7", or another company's name
  advice        investment / legal / tax advice
  off_topic     no business or metric words at all, or a non-business task
                ("write a poem", "python code")

Questions about metrics we don't have (churn, industry average) are NOT blocked
here: they are business questions and get insufficient_data later.
"""

import re
from dataclasses import dataclass

from app.ai import llm
from app.ai.intent import extract_periods, is_business_question


INJECTION_THRESHOLD = 0.5

INJECTION_PATTERNS = [
    r"\b(ignore|disregard|forget|override|bypass|skip)\b.{0,40}\b(instructions?|rules?|prompts?|guidelines?|restrictions?|above|previous|prior)\b",
    r"\bsystem\s*prompt\b",
    r"\byou are now\b",
    r"\b(act|behave)\s+as\b",
    r"\bpretend\b",
    r"\bjailbreak\b",
    r"\b(developer|dan|god)\s+mode\b",
    r"\bnew\s+(instructions?|rules?)\b",
    r"\b(reveal|show|print|repeat)\b.{0,30}\b(prompt|instructions?|rules?|context)\b",
    r"</?\s*(system|assistant|instructions?)\s*>",
]

ADVICE_PATTERNS = [
    r"\b(invest|investing|investment|investor)\b",
    r"\b(buy|sell|short)\b.{0,20}\b(shares?|stocks?|equity)\b",
    r"\bshould i (buy|sell|invest|lend)\b",
    r"\b(legal|tax|financial)\s+advice\b",
    r"\b(lawsuit|lawyer|sue|litigation)\b",
]

OFF_TOPIC_TASKS = [
    r"\b(poem|poetry|story|joke|song|lyrics|essay|recipe|horoscope)\b",
    r"\b(write|generate|give me)\b.{0,30}\b(code|script|program|function|sql query)\b",
    r"\b(python|javascript|java|c\+\+|html|css)\b",
    r"\btranslate\b",
]

OTHER_COMPANY_GENERIC = [
    r"\b(another|other|different)\s+compan(y|ies)\b",
    r"\ball\s+companies\b",
    r"\bevery\s+company\b",
]

# Generic words removed from company names before name matching.
_NAME_STOPWORDS = {"pvt", "ltd", "private", "limited", "co", "company", "inc", "corp",
                   "corporation", "llp", "labs", "group", "the", "&", "and"}


@dataclass
class GuardResult:
    allowed: bool
    reason: str | None = None  # injection | other_company | advice | off_topic
    detail: str | None = None
    injection_score: float | None = None  # Prompt Guard probability, None if not called/failed


def _match(patterns: list[str], text: str) -> str | None:
    for pattern in patterns:
        if m := re.search(pattern, text):
            return m.group(0)
    return None


def _name_variants(name: str) -> list[str]:
    full = name.lower().strip()
    core = " ".join(w for w in re.findall(r"[a-z0-9&]+", full) if w not in _NAME_STOPWORDS)
    return [v for v in {full, core} if len(v) >= 4]


def other_company_mention(
    text: str, company_id: int, companies: list[tuple[int, str]]
) -> str | None:
    text = text.lower()
    for m in re.finditer(r"\b(?:company|compan(?:y|ies)\s*(?:id|#|no\.?|number)?|id)\s*#?\s*(\d+)\b", text):
        if int(m.group(1)) != company_id:
            return m.group(0)
    own = next((name for cid, name in companies if cid == company_id), "")
    own_variants = set(_name_variants(own)) if own else set()
    for cid, name in companies:
        if cid == company_id:
            continue
        for variant in _name_variants(name):
            if variant in own_variants:
                continue
            if re.search(rf"\b{re.escape(variant)}\b", text):
                return name
    return _match(OTHER_COMPANY_GENERIC, text)


_FOLLOW_UP_RE = re.compile(r"^\s*(and|what about|how about|same for|also|then)\b")


def is_follow_up(text: str, history: list[dict] | None) -> bool:
    """Follow-up like "And in April?" after a business question: names a period or starts like one."""
    if not history or not any(
        t.get("role") == "user" and is_business_question(t.get("content", "")) for t in history
    ):
        return False
    periods, window = extract_periods(text, None)
    return bool(periods or window or _FOLLOW_UP_RE.search(text))


def keyword_check(
    question: str,
    company_id: int,
    companies: list[tuple[int, str]],
    history: list[dict] | None = None,
    extra_metrics: list[str] | tuple[str, ...] = (),
) -> GuardResult:
    text = question.lower()
    if hit := _match(INJECTION_PATTERNS, text):
        return GuardResult(False, "injection", hit)
    if hit := other_company_mention(text, company_id, companies):
        return GuardResult(False, "other_company", hit)
    if hit := _match(ADVICE_PATTERNS, text):
        return GuardResult(False, "advice", hit)
    if hit := _match(OFF_TOPIC_TASKS, text):
        return GuardResult(False, "off_topic", hit)
    if not is_business_question(text, extra_metrics) and not is_follow_up(text, history):
        return GuardResult(False, "off_topic", "no business or metric words")
    return GuardResult(True)


def check(
    question: str,
    company_id: int,
    companies: list[tuple[int, str]],
    history: list[dict] | None = None,
    use_model: bool = True,
    extra_metrics: list[str] | tuple[str, ...] = (),
) -> GuardResult:
    """Keyword rules first (free, deterministic); then Prompt Guard as an extra
    injection check. If the Prompt Guard call fails, the keyword result stands."""
    result = keyword_check(question, company_id, companies, history, extra_metrics)
    if not result.allowed or not use_model:
        return result

    try:
        score = llm.prompt_guard_score(question)
    except llm.LLMError:
        return result  # fallback: keyword rules only

    if score >= INJECTION_THRESHOLD:
        return GuardResult(False, "injection", f"prompt guard score {score:.3f}", score)
    return GuardResult(True, injection_score=score)
