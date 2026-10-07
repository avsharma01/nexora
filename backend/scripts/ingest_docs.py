"""Ingest company documents: markdown -> chunks -> embeddings -> ai_documents / ai_document_chunks.

Each folder under the docs dir needs a company.json {"company_name": "..."};
every *.md file in it is one document. Re-runnable: unchanged files (same
content hash) are skipped, changed files are replaced, and documents whose file
was deleted are removed.

Run from backend/ (after `python -m app.init_db`):
    python -m scripts.ingest_docs                      # data/mock_docs
    python -m scripts.ingest_docs --dir ../data/real_docs
"""

import argparse
import hashlib
import json
import sys
from pathlib import Path

from sqlalchemy.orm import Session

from app.ai import data_access
from app.ai.chunking import chunk_markdown, parse_title
from app.ai.embeddings import embed_texts
from app.database import engine
from app.models.ai_document import AIDocument, AIDocumentChunk


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DIR = REPO_ROOT / "data" / "mock_docs"


def _relative(path: Path) -> str:
    try:
        return path.resolve().relative_to(REPO_ROOT).as_posix()
    except ValueError:
        return path.resolve().as_posix()


def ingest_folder(db: Session, folder: Path, companies: dict[str, int]) -> None:
    meta = json.loads((folder / "company.json").read_text(encoding="utf-8"))
    company_id = companies.get(meta["company_name"])
    if company_id is None:
        print(f"skip   {folder.name}: company '{meta['company_name']}' not in DB")
        return

    seen = set()
    for path in sorted(folder.glob("*.md")):
        source = _relative(path)
        seen.add(source)
        text = path.read_text(encoding="utf-8")
        digest = hashlib.sha256(text.encode("utf-8")).hexdigest()

        existing = (
            db.query(AIDocument)
            .filter(AIDocument.company_id == company_id, AIDocument.source_path == source)
            .first()
        )
        if existing is not None and existing.content_hash == digest:
            print(f"same   {source}")
            continue
        if existing is not None:
            db.delete(existing)
            db.flush()

        title = parse_title(text, default=path.stem)
        chunks = chunk_markdown(text, title)
        vectors = embed_texts([c.content for c in chunks])

        document = AIDocument(
            company_id=company_id,
            title=title,
            doc_type=path.stem,
            source_path=source,
            content_hash=digest,
        )
        document.chunks = [
            AIDocumentChunk(
                company_id=company_id,
                chunk_index=c.index,
                section_header=c.section_header,
                content=c.content,
                token_count=c.token_count,
                embedding=vector,
            )
            for c, vector in zip(chunks, vectors)
        ]
        db.add(document)
        db.flush()
        print(f"{'update' if existing else 'insert'} {source}: {len(chunks)} chunks")

    for stale in (
        db.query(AIDocument)
        .filter(AIDocument.company_id == company_id, AIDocument.source_path.like(_relative(folder) + "/%"))
        .all()
    ):
        if stale.source_path not in seen:
            print(f"delete {stale.source_path} (file removed)")
            db.delete(stale)
    db.commit()


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Ingest company documents for the AI Analyst")
    parser.add_argument("--dir", type=Path, default=DEFAULT_DIR, help="folder of <company>/ subfolders")
    args = parser.parse_args()

    folders = sorted(p for p in args.dir.iterdir() if (p / "company.json").exists())
    if not folders:
        print(f"No company folders with company.json in {args.dir}")
        sys.exit(1)

    with Session(engine) as db:
        companies = {name: cid for cid, name in data_access.list_companies(db)}
        for folder in folders:
            ingest_folder(db, folder, companies)


if __name__ == "__main__":
    main()
