"""Document retrieval: embed the question, cosine search in pgvector, ALWAYS filtered by company_id.

Only chunks with similarity >= MIN_SIMILARITY and within MAX_GAP of the best
chunk are returned (top TOP_K), so an unrelated question gets no excerpts
rather than the "least bad" ones.
"""

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.ai.embeddings import embed_query
from app.models.ai_document import AIDocument, AIDocumentChunk


TOP_K = 4
MIN_SIMILARITY = 0.60  # calibrated on the mock docs: relevant 0.64-0.79, unrelated 0.40-0.53
MAX_GAP = 0.06  # drop chunks scoring this far below the best one


@dataclass
class Excerpt:
    chunk_id: int
    document_title: str
    doc_type: str
    section_header: str | None
    content: str
    similarity: float

    @property
    def label(self) -> str:
        kind = self.doc_type.replace("_", " ").capitalize()
        return f"{kind} · {self.section_header}" if self.section_header else kind


def search(
    db: Session,
    company_id: int,
    query: str,
    top_k: int = TOP_K,
    min_similarity: float = MIN_SIMILARITY,
    max_gap: float = MAX_GAP,
) -> list[Excerpt]:
    vector = embed_query(query)
    distance = AIDocumentChunk.embedding.cosine_distance(vector)
    rows = (
        db.query(AIDocumentChunk, AIDocument, distance.label("distance"))
        .join(AIDocument, AIDocument.id == AIDocumentChunk.document_id)
        .filter(AIDocumentChunk.company_id == company_id)
        .order_by(distance)
        .limit(top_k)
        .all()
    )
    excerpts = [
        Excerpt(
            chunk_id=chunk.id,
            document_title=doc.title,
            doc_type=doc.doc_type,
            section_header=chunk.section_header,
            content=chunk.content,
            similarity=1.0 - float(dist),
        )
        for chunk, doc, dist in rows
    ]
    if not excerpts:
        return []
    best = excerpts[0].similarity
    return [e for e in excerpts if e.similarity >= min_similarity and best - e.similarity <= max_gap]


def has_documents(db: Session, company_id: int) -> bool:
    return db.query(AIDocumentChunk.id).filter(AIDocumentChunk.company_id == company_id).first() is not None
