"""Split markdown documents into retrievable chunks.

1. Split by "## " section headers (the "# " line is the document title).
2. Sections longer than MAX_TOKENS are cut into TARGET_TOKENS windows with
   OVERLAP_TOKENS overlap, so a sentence near a cut appears in both chunks.
3. Every chunk starts with "<title> | <section>" so it makes sense on its own
   (both for the embedding and for the LLM reading the excerpt).

Token counts are approximate (words + punctuation), close enough for sizing.
Blockquote lines ("> ...") are metadata (e.g. the FAKE-document banner) and are dropped.
"""

import re
from dataclasses import dataclass


TARGET_TOKENS = 400
MAX_TOKENS = 500
OVERLAP_TOKENS = 50

_TOKEN_RE = re.compile(r"\w+|[^\w\s]")


@dataclass
class Chunk:
    index: int
    section_header: str | None
    content: str
    token_count: int


def count_tokens(text: str) -> int:
    return len(_TOKEN_RE.findall(text))


def parse_title(markdown: str, default: str = "Document") -> str:
    for line in markdown.splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return default


def _sections(markdown: str) -> list[tuple[str | None, str]]:
    sections: list[tuple[str | None, list[str]]] = [(None, [])]
    for line in markdown.splitlines():
        if line.startswith("# ") or line.lstrip().startswith(">"):
            continue
        if line.startswith("## "):
            sections.append((line[3:].strip(), []))
        else:
            sections[-1][1].append(line)
    return [(header, "\n".join(lines).strip()) for header, lines in sections if "\n".join(lines).strip()]


def _windows(words: list[str]) -> list[list[str]]:
    """Word windows of ~TARGET_TOKENS with OVERLAP_TOKENS overlap."""
    windows, start = [], 0
    while start < len(words):
        end = start
        tokens = 0
        while end < len(words) and tokens < TARGET_TOKENS:
            tokens += count_tokens(words[end])
            end += 1
        windows.append(words[start:end])
        if end >= len(words):
            break
        back, overlap = end, 0
        while back > start + 1 and overlap < OVERLAP_TOKENS:
            back -= 1
            overlap += count_tokens(words[back])
        start = back
    return windows


def chunk_markdown(markdown: str, title: str | None = None) -> list[Chunk]:
    title = title or parse_title(markdown)
    chunks: list[Chunk] = []
    for header, body in _sections(markdown):
        prefix = f"{title} | {header}" if header else title
        pieces = [body] if count_tokens(body) <= MAX_TOKENS else [
            " ".join(window) for window in _windows(body.split())
        ]
        for piece in pieces:
            content = f"{prefix}\n{piece}"
            chunks.append(Chunk(len(chunks), header, content, count_tokens(content)))
    return chunks
