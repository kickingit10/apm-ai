# APM.AI — AI-Powered Document Hub for Solar Construction

An AI-powered project management tool built for solar and energy EPC contractors. Upload project documents, organize them by category, and chat with an AI assistant that answers questions grounded in your actual documents — with source citations on every response.

**Live at:** [apm-ai-five.vercel.app](https://apm-ai-five.vercel.app)

## Why This Exists

Solar construction PMs at mid-size EPCs (10–75 employees) manage projects with spreadsheets, WhatsApp, and email. When they need to find a specific permit condition or RFI response, they dig through folders and PDFs manually. ChatGPT was tried but hallucinated numbers and dates. APM.AI solves this by searching actual project documents before answering, so every response is traceable to a source.

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS | Server-rendered web app with App Router |
| Auth | Supabase Auth | Email/password authentication with session cookies |
| Database | Supabase (PostgreSQL 17) + pgvector | Data storage + vector similarity search for RAG |
| Storage | Supabase Storage | Private bucket for uploaded project documents |
| AI (Phase 3) | OpenAI embeddings + Anthropic Claude chat | Document chunking → vector search → grounded answers |
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
│   └── auth/
│       └── callback/
│           └── route.ts      # Email confirmation handler
├── components/
│   ├── header.tsx            # Nav bar with sign-out
│   └── project-list.tsx      # Project cards + create form
├── lib/
│   └── supabase/
│       ├── client.ts         # Browser Supabase client
│       ├── server.ts         # Server Supabase client
│       └── middleware.ts      # Session refresh + auth redirects
└── middleware.ts              # Route protection
supabase/
└── migrations/
    └── 00001_initial_schema.sql  # 5 tables, RLS, pgvector, search function
```

## Database Schema

5 tables with Row Level Security (RLS) enabled on all:

- **projects** — Solar construction projects (name, location, owner)
- **documents** — Uploaded files linked to projects, categorized (permits, RFIs, daily logs, etc.)
- **document_chunks** — Text chunks with vector embeddings (1536-dim) for semantic search
- **chat_sessions** — AI chat conversations per project
- **chat_messages** — Messages with role (user/assistant) and source citations (JSONB)

Custom function: `match_document_chunks(query_embedding, match_count, filter_project_id)` — cosine similarity search over document chunks.

## Getting Started

### Prerequisites
- Node.js 20+
- Supabase account with a project
- (Phase 3) OpenAI API key + Anthropic API key

### Setup

```bash
git clone https://github.com/kickingit10/apm-ai.git
cd apm-ai
npm install
cp .env.local.example .env.local
# Fill in your Supabase URL and anon key in .env.local
npm run dev
```

Then run the migration in your Supabase SQL Editor:
```sql
-- Paste contents of supabase/migrations/00001_initial_schema.sql
```

### Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
OPENAI_API_KEY=your-openai-key          # Phase 3
ANTHROPIC_API_KEY=your-anthropic-key     # Phase 3
```

## Build Phases

| Phase | What | Status |
|-------|------|--------|
| 1 | Auth, database, project dashboard, deployment | ✅ Complete |
| 2 | Document upload, category organization, storage | 🔜 Next |
| 3 | RAG pipeline: chunking → embeddings → vector search → AI chat with citations | 📋 Planned |
| 4 | Google Drive sync, daily logs, mobile optimization | 📋 Planned |

## Contributing

This is an early-stage project. If you want to help:

1. Check the build phases above — Phase 2 (document upload + library) is the current priority
2. The document categories follow a solar construction information architecture (permits, RFIs, daily logs, submittals, commissioning docs, etc.)
3. All AI responses must include source citations — no exceptions
4. Mobile-responsive from the start (Tailwind breakpoints)
5. TypeScript strict mode

### Key decisions already made:
- OpenAI `text-embedding-3-small` for embeddings (1536 dimensions)
- Anthropic Claude for chat responses (better at following citation instructions)
- Supabase pgvector for vector storage/search (no separate vector DB needed)
- Next.js App Router with server components for the dashboard

## License

Private — not open source (yet).
