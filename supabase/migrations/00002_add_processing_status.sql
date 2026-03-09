-- Add processing status to documents table
alter table public.documents
  add column if not exists processing_status text not null default 'pending'
  check (processing_status in ('pending', 'processing', 'completed', 'failed'));
