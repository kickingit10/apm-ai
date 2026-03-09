-- HNSW index for cosine similarity search on document chunk embeddings
-- Replaces sequential scan with approximate nearest neighbor search
-- Parameters: m=16, ef_construction=64 (standard for 1536-dim vectors)
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
ON document_chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
