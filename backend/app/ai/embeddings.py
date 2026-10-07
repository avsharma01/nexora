"""Local text embeddings: BAAI/bge-small-en-v1.5 (384-dim) via fastembed (ONNX, no API key).

The model (~67 MB) is downloaded once into AI_EMBED_CACHE (default
~/.cache/nexora/fastembed) and loaded once per process. Vectors are
L2-normalised, so cosine similarity = dot product.
"""

import os
from functools import lru_cache
from pathlib import Path


MODEL_NAME = "BAAI/bge-small-en-v1.5"
DIM = 384


class EmbeddingError(RuntimeError):
    """The embedding model could not be loaded or run."""


def _cache_dir() -> str:
    default = Path.home() / ".cache" / "nexora" / "fastembed"
    return os.getenv("AI_EMBED_CACHE", "").strip() or str(default)


@lru_cache(maxsize=1)
def _model():
    try:
        from fastembed import TextEmbedding

        return TextEmbedding(MODEL_NAME, cache_dir=_cache_dir())
    except Exception as exc:  # import error, download failure, ONNX runtime error
        raise EmbeddingError(f"Could not load {MODEL_NAME}: {type(exc).__name__}: {exc}") from exc


def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    try:
        return [vector.tolist() for vector in _model().embed(texts)]
    except EmbeddingError:
        raise
    except Exception as exc:
        raise EmbeddingError(f"Embedding failed: {type(exc).__name__}: {exc}") from exc


def embed_query(text: str) -> list[float]:
    try:
        return next(iter(_model().query_embed(text))).tolist()
    except EmbeddingError:
        raise
    except Exception as exc:
        raise EmbeddingError(f"Query embedding failed: {type(exc).__name__}: {exc}") from exc
