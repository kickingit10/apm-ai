# APM.AI

AI-powered project management for solar and energy EPC contractors.

## Tech Stack
- **Frontend:** Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Auth + Storage), pgvector for embeddings
- **AI:** Anthropic Claude (chat responses), OpenAI (embeddings)
- **Hosting:** Vercel
- **GitHub:** github.com/kickingit10/apm-ai

## Project Structure
```
src/
  app/           → Pages and API routes (Next.js App Router)
  components/    → Reusable React components
  lib/
    supabase/    → Supabase client (browser, server, middleware)
supabase/
  migrations/    → SQL migration files
```

## Conventions
- Use lowercase-and-dashes for file names
- TypeScript strict mode
- Mobile-responsive from the start
- All AI answers must cite sources — no exceptions

## Phases
- Phase 1: Auth, database, project dashboard (current)
- Phase 2: Document library + upload
- Phase 3: RAG pipeline + AI chat
- Phase 4: Polish, Google Drive sync, daily logs
