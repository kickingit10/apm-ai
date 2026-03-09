-- Lower default match_threshold from 0.7 to 0.3
-- 0.7 was too aggressive — most real-world document queries score 0.2-0.5
CREATE OR REPLACE FUNCTION public.match_document_chunks(
  query_embedding vector,
  match_project_id uuid DEFAULT NULL,
  match_threshold double precision DEFAULT 0.3,
  match_count integer DEFAULT 5
)
RETURNS TABLE(id uuid, document_id uuid, content text, metadata jsonb, similarity double precision)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id, dc.document_id, dc.content, dc.metadata,
    (1 - (dc.embedding <=> query_embedding))::float AS similarity
  FROM public.document_chunks dc
  JOIN public.documents d ON dc.document_id = d.id
  WHERE (match_project_id IS NULL OR d.project_id = match_project_id)
    AND (1 - (dc.embedding <=> query_embedding)) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
