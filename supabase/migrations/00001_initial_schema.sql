-- Enable pgvector extension for embeddings (Phase 3)
create extension if not exists vector with schema extensions;

-- ============================================
-- PROJECTS
-- ============================================
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  project_number text not null unique,       -- e.g. "26001"
  name text not null,
  location text,
  status text not null default 'active' check (status in ('active', 'completed', 'on_hold')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- DOCUMENTS
-- ============================================
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  file_name text not null,
  file_type text not null,                   -- pdf, docx, xlsx, image, etc.
  category text not null,                    -- from Jim's IA: permits, daily_logs, etc.
  storage_path text not null,                -- path in Supabase Storage
  file_size bigint,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============================================
-- DOCUMENT CHUNKS (for RAG — Phase 3)
-- ============================================
create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  content text not null,                     -- the chunk text
  page_number int,
  section_heading text,
  embedding vector(1536),                    -- OpenAI text-embedding-3-small dimensions
  created_at timestamptz not null default now()
);

-- Index for fast similarity search
create index on public.document_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ============================================
-- CHAT SESSIONS
-- ============================================
create table public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- CHAT MESSAGES
-- ============================================
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  cited_chunks uuid[],                       -- references to document_chunks used
  created_at timestamptz not null default now()
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
alter table public.projects enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

-- For now, authenticated users can read/write all data.
-- We'll tighten this with team-based access in a later phase.
create policy "Authenticated users can do everything with projects"
  on public.projects for all using (auth.role() = 'authenticated');

create policy "Authenticated users can do everything with documents"
  on public.documents for all using (auth.role() = 'authenticated');

create policy "Authenticated users can do everything with document_chunks"
  on public.document_chunks for all using (auth.role() = 'authenticated');

create policy "Authenticated users can do everything with chat_sessions"
  on public.chat_sessions for all using (auth.role() = 'authenticated');

create policy "Authenticated users can do everything with chat_messages"
  on public.chat_messages for all using (auth.role() = 'authenticated');

-- ============================================
-- HELPER: updated_at trigger
-- ============================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.handle_updated_at();

create trigger chat_sessions_updated_at
  before update on public.chat_sessions
  for each row execute function public.handle_updated_at();
