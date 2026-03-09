# APM.AI — AI-Powered Document Hub for Solar Construction

Upload project documents, organize them by category, and chat with an AI that answers questions from your actual files — with source citations on every response.

**Live at:** [apm-ai-five.vercel.app](https://apm-ai-five.vercel.app)

## The Problem

Solar construction PMs at mid-size EPCs manage projects with spreadsheets, WhatsApp, and shared drives. Finding a specific permit condition or RFI response means digging through folders manually. APM.AI organizes documents by solar construction category and uses RAG (Retrieval-Augmented Generation) so you can ask questions and get answers grounded in your actual project documents.

## What It Does

- **Document management** — Upload PDFs, Word docs, and text files. Organize by 13 solar construction categories (RFIs, Submittals, Safety, Daily Logs, Permits, etc.).
- **AI chat with citations** — Ask questions about your project. The AI searches your documents, finds relevant sections, and responds with source citations you can verify.
- **Project isolation** — Row Level Security ensures each user only sees their own projects and documents.

## How the AI Works

1. When you upload a document, it gets split into ~500-token chunks
2. Each chunk is converted to a vector embedding (OpenAI text-embedding-3-small)
3. Embeddings are stored in PostgreSQL via pgvector
4. When you ask a question, your question is embedded and compared against all chunks using cosine similarity
5. The most relevant chunks are sent to Claude along with your question
6. Claude generates an answer citing the specific documents it used

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Auth | Supabase Auth (email/password) |
| Database | Supabase PostgreSQL + pgvector |
| File Storage | Supabase Storage |
| Embeddings | OpenAI text-embedding-3-small |
| Chat | Anthropic Claude |
| Hosting | Vercel |

## Project Structure

```
src/
├── app/
│   ├── login/page.tsx           # Login/signup with hero section
│   ├── dashboard/page.tsx       # Project list
│   ├── project/[id]/page.tsx    # Project detail: documents + AI chat
│   ├── auth/callback/route.ts   # Email confirmation handler
│   └── api/
│       ├── chat/route.ts        # RAG chat endpoint
│       └── process-document/route.ts  # Text extraction + chunking + embedding
├── components/
│   ├── project-list.tsx         # Project cards + create form
│   ├── document-upload.tsx      # Drag-and-drop upload with category picker
│   └── document-list.tsx        # Document table with status badges
└── lib/
    ├── categories.ts            # 13 solar construction document categories
    └── supabase/                # Client and server Supabase helpers
```

## Database

Five tables with Row Level Security on all:

- **projects** — Solar construction projects (name, number, location, status)
- **documents** — Uploaded file metadata (name, category, processing status)
- **document_chunks** — Text chunks with 1536-dimension vector embeddings
- **chat_sessions** — AI chat conversations per project
- **chat_messages** — Messages with source citations (jsonb)

## Getting Started

```bash
git clone https://github.com/kickingit10/apm-ai.git
cd apm-ai
npm install
```

Create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=       # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Supabase anonymous key
NEXT_PUBLIC_SITE_URL=           # Production URL (for auth redirects)
OPENAI_API_KEY=                 # OpenAI (for embeddings)
ANTHROPIC_API_KEY=              # Anthropic (for Claude chat)
```

```bash
npm run dev
# Open http://localhost:3000
```

## Demo

Try it with the demo account: `demo@apm-ai.com` / `demo1234`

Includes a sample solar farm project with 23 construction documents (daily logs, RFIs, submittals, safety reports, permits, and more) — all processed and ready for AI chat.

## Target Users

Mid-size solar EPCs (10–75 employees) managing 3–20 active projects. Competing with spreadsheets and WhatsApp, not Sitetracker or Procore.

## License

Private repository.
