-- ============================================================================
-- 001_rules_assistant.sql
-- Tables, indexes, functions, and RLS for the Rules Assistant feature.
-- Requires pgvector (already enabled in the Sector1 Supabase project).
-- ============================================================================

-- pgvector for embedding storage and similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- pg_trgm for full-text fallback search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- Tables
-- ============================================================================

CREATE TABLE rulebooks (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text        NOT NULL,
  version_label text,
  file_path     text        NOT NULL,
  status        text        NOT NULL DEFAULT 'processing'
                            CHECK (status IN ('processing', 'ready', 'failed', 'archived')),
  is_active     boolean     NOT NULL DEFAULT false,
  effective_date date,
  uploaded_at   timestamptz NOT NULL DEFAULT now(),
  processing_error text,
  page_count    integer,
  chunk_count   integer,
  created_by    uuid        REFERENCES auth.users(id)
);

CREATE TABLE rule_chunks (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rulebook_id   uuid        NOT NULL REFERENCES rulebooks(id) ON DELETE CASCADE,
  chunk_index   integer     NOT NULL,
  section_label text,
  heading_path  text,
  page_number   integer,
  content       text        NOT NULL,
  token_count   integer,
  embedding     vector(1024),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Full-text trigram index for keyword fallback search
CREATE INDEX idx_rule_chunks_content_trgm
  ON rule_chunks
  USING gin (content gin_trgm_ops);

-- IVFFlat index for cosine similarity vector search
CREATE INDEX idx_rule_chunks_embedding_cosine
  ON rule_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ============================================================================
-- Functions
-- ============================================================================

CREATE OR REPLACE FUNCTION match_rule_chunks(
  query_embedding vector(1024),
  rulebook_id_filter uuid,
  match_count int DEFAULT 6,
  similarity_threshold float DEFAULT 0.35
)
RETURNS TABLE (
  id uuid,
  rulebook_id uuid,
  chunk_index int,
  section_label text,
  heading_path text,
  page_number int,
  content text,
  token_count int,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rc.id,
    rc.rulebook_id,
    rc.chunk_index,
    rc.section_label,
    rc.heading_path,
    rc.page_number,
    rc.content,
    rc.token_count,
    1 - (rc.embedding <=> query_embedding) AS similarity
  FROM rule_chunks rc
  WHERE rc.rulebook_id = rulebook_id_filter
    AND rc.embedding IS NOT NULL
    AND 1 - (rc.embedding <=> query_embedding) >= similarity_threshold
  ORDER BY rc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE rulebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read rulebooks"
  ON rulebooks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anon can read active rulebook"
  ON rulebooks FOR SELECT
  TO anon
  USING (is_active = true);

CREATE POLICY "Anyone can read rule chunks"
  ON rule_chunks FOR SELECT
  TO anon, authenticated
  USING (true);

-- ============================================================================
-- Storage bucket (manual step)
-- ============================================================================
-- NOTE: You must manually create a Supabase Storage bucket named 'rulebooks'
-- via the Supabase dashboard (Storage > New bucket).
--   - Set it to PRIVATE (not public).
--   - The upload API route uses the service role key to write files and
--     generate signed download URLs, so no public access is needed.
-- ============================================================================
