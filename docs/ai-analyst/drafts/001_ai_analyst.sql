-- DRAFT — do not apply until Anant Vaibhav approves (shared schema + Docker image change).
-- Needs: Postgres image with pgvector (e.g. pgvector/pgvector:pg16) and the real table names
-- for companies/users (check SQLAlchemy models). If the team uses Alembic, convert this to a migration.

CREATE EXTENSION IF NOT EXISTS vector;                                  -- Phase D

CREATE TABLE IF NOT EXISTS ai_insights (                                -- Phase C
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER,                                               -- FK to users table [CONFIRM name]
    company_id   INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    question     TEXT NOT NULL,
    answer       TEXT NOT NULL,
    status       TEXT NOT NULL,                                         -- answered | insufficient_data | out_of_scope
    is_grounded  BOOLEAN NOT NULL,
    sources      JSONB NOT NULL DEFAULT '[]',
    model        TEXT,
    latency_ms   INTEGER,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_insights_company ON ai_insights (company_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_documents (                               -- Phase D
    id          SERIAL PRIMARY KEY,
    company_id  INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    doc_type    TEXT NOT NULL,      -- board_memo | annual_narrative | risk_commentary | forecast_assumptions | uploaded
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_document_chunks (                         -- Phase D
    id             SERIAL PRIMARY KEY,
    document_id    INTEGER NOT NULL REFERENCES ai_documents(id) ON DELETE CASCADE,
    company_id     INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    chunk_index    INTEGER NOT NULL,
    section_header TEXT,
    content        TEXT NOT NULL,
    embedding      vector(384) NOT NULL                                 -- bge-small-en-v1.5
);
CREATE INDEX IF NOT EXISTS idx_chunks_company ON ai_document_chunks (company_id);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON ai_document_chunks USING hnsw (embedding vector_cosine_ops);
