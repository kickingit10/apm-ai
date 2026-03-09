# APM.AI — AI-Powered Document Hub for Solar Construction

An AI-powered project management tool built for solar and energy EPC contractors. Upload project documents, organize them by category, and chat with an AI assistant that answers questions grounded in your actual documents — with source citations on every response.

**Live at:** [apm-ai-five.vercel.app](https://apm-ai-five.vercel.app)

## Why This Exists

Solar construction PMs at mid-size EPCs (10–75 employees) manage projects with spreadsheets, WhatsApp, and email. When they need to find a specific permit condition or RFI response, they dig through folders and PDFs manually. APM.AI solves this by organizing documents by solar construction category and letting you ask AI questions that search your actual documents before answering — so every response is traceable to a source.

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS | Server-rendered web app with App Router |
| Auth | Supabase Auth | Email/password authentication with session cookies |
| Database | Supabase (PostgreSQL 17) + pgvector | Data storage + vector similarity search for RAG |
| Storage | Supabase Storage | Private bucket for uploaded project documents |
| AI | OpenAI embeddings + Anthropic Claude chat | Document chunking → vector search → grounded answers |
| Hosting | Vercel | Auto-deploy from GitHub on every push to main |

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Root redirect → /dashboard
│   ├── layout.tsx            # Root layout (fonts, metadata)
│   ├── globals.css           # Tailwind imports
│   ├── login/
│   │   ├── page.tsx          # Login/signup form
│   │   └── layout.tsx        # Force dynamic rendering
│   ├── dashboard/
│   │   └── page.tsx          # Project list (server component)
│   ├── project/
│   │   └── [id]/
│   │       └── page.tsx      # Project detail with documents + chat
│   └── auth/
│       └── callback/
│           └── route.ts      # Email confirmation handler
├── components/
│   ├── header.tsx            # Nav bar with sign-out
│   ├── project-list.tsx      # Project cards + create form
│   ├── document-upload.tsx   # Drag-and-drop file upload with category picker
│   └── document-list.tsx     # Document table with download, delete, category badges
├── lib/
│   ├── categories.ts         # 13 solar construction document categories
│   └── supabase/
│       ├── client.ts         # Browser Supabase client
│       ├── server.ts         # Server Supabase client
│       └── middleware.ts      # Session refresh + auth redirects
└── middleware.ts              # Route protection
```

## Database Schema

```sql
-- 5 tables with Row Level Security enabled on all

projects (id, name, project_number, status, location, description, owner_id)
documents (id, project_id, file_name, category, storage_path, file_type, file_size, uploaded_by)
document_chunks (id, document_id, content, chunk_index, embedding vector(1536), metadata jsonb)
chat_sessions (id, project_id, user_id, title)
chat_messages (id, session_id, role, content, sources jsonb)

-- Vector search function for RAG
match_document_chunks(query_embedding, match_project_id, match_threshold, match_count)
```

## Document Categories

Solar construction categories (from domain expert's information architecture):

Action List, Permits, Daily Logs, RFIs, Submittals, Safety, Quality, Commissioning, Interconnection, Contracts, Change Orders, Photos, Other

## Build Phases

| Phase | Features | Status |
|-------|----------|--------|
| 1 | Auth, project list, database schema, deployment | Complete |
| 2 | Document upload, category organization, project detail page | Complete |
| 3 | RAG pipeline, AI chat with citations, starter prompts | In Progress |
| 4 | Daily construction logs, photo uploads, weather auto-fill, PDF export | Planned |

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=       # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Supabase anonymous key
OPENAI_API_KEY=                 # OpenAI (for embeddings)
ANTHROPIC_API_KEY=              # Anthropic (for Claude chat)
```

## Getting Started

```bash
git clone https://github.com/kickingit10/apm-ai.git
cd apm-ai
npm install
# Add environment variables to .env.local
npm run dev
# Open http://localhost:3000
```

## Demo Account

For demonstrations: Contact

Includes 5 sample solar projects with realistic construction documents.
