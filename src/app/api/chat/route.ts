import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const debug = process.env.DEBUG === 'true'

const SYSTEM_PROMPT = `You are APM.AI, an AI assistant for solar construction project managers. Answer questions based on the project documents provided. Always cite which document your answer comes from using the format [Document Name]. If the documents don't contain enough information to answer, say so honestly. Be concise and practical — these are busy construction professionals.`

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  if (!process.env.ANTHROPIC_API_KEY || !process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'AI API keys not configured' }, { status: 500 })
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  try {
    const { message, projectId, sessionId: existingSessionId } = await request.json()

    if (!message || !projectId) {
      return NextResponse.json({ error: 'message and projectId required' }, { status: 400 })
    }

    if (debug) console.log(`[RAG] START user=${user.id} project=${projectId} (type=${typeof projectId}) query="${message.slice(0, 60)}"`)

    // Create or use existing session
    let sessionId = existingSessionId
    if (!sessionId) {
      const title = message.length > 50 ? message.slice(0, 50) + '...' : message
      const { data: session, error: sessionError } = await supabase
        .from('chat_sessions')
        .insert({ project_id: projectId, user_id: user.id, title })
        .select()
        .single()

      if (sessionError || !session) {
        return NextResponse.json({ error: 'Failed to create chat session' }, { status: 500 })
      }
      sessionId = session.id
    }

    // Save user message
    await supabase.from('chat_messages').insert({
      session_id: sessionId,
      role: 'user',
      content: message,
    })

    // Generate embedding for the question
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: message,
    })
    const queryEmbedding = embeddingResponse.data[0].embedding

    if (debug) console.log(`[RAG] OpenAI embedding: type=${typeof queryEmbedding} isArray=${Array.isArray(queryEmbedding)} len=${queryEmbedding?.length} first3=[${queryEmbedding?.slice(0, 3).join(', ')}]`)

    if (debug) {
      // Diagnostic: can the server client see document_chunks at all?
      const { count: chunkCount, error: countError } = await supabase
        .from('document_chunks')
        .select('id', { count: 'exact', head: true })

      console.log(`[RAG] Diagnostic: document_chunks visible=${chunkCount} error=${countError?.message ?? 'none'}`)

      // Diagnostic: verify projectId matches documents
      const { data: projectDocs, error: projectDocsError } = await supabase
        .from('documents')
        .select('id, project_id')
        .eq('project_id', projectId)
        .limit(1)

      console.log(`[RAG] Diagnostic: docs for project=${projectDocs?.length ?? 0} error=${projectDocsError?.message ?? 'none'}`)
    }

    // Get the user's session token for direct REST API call
    const { data: { session: authSession } } = await supabase.auth.getSession()
    const accessToken = authSession?.access_token

    if (debug) console.log(`[RAG] Auth session: hasToken=${!!accessToken}`)

    // Bypass supabase.rpc() — use direct fetch to Supabase REST API
    // supabase.rpc() returns empty results for unknown reasons, but
    // direct REST API calls to the same function work perfectly
    const embeddingStr = `[${queryEmbedding.join(',')}]`

    let chunks: { id: string; document_id: string; content: string; metadata: Record<string, string>; similarity: number }[] = []

    const rpcHeaders = {
      'Content-Type': 'application/json',
      'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      'Authorization': `Bearer ${accessToken}`,
    }
    const rpcUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/match_document_chunks`

    if (accessToken) {
      if (debug) {
        // Diagnostic: check top similarity score with threshold 0.0
        const diagResponse = await fetch(rpcUrl, {
          method: 'POST',
          headers: rpcHeaders,
          body: JSON.stringify({
            query_embedding: embeddingStr,
            match_project_id: projectId,
            match_threshold: 0.0,
            match_count: 1,
          }),
        })
        if (diagResponse.ok) {
          const diagChunks = await diagResponse.json()
          const topSim = diagChunks[0]?.similarity ?? 'none'
          console.log(`[RAG] Diagnostic: top_similarity=${topSim} (threshold=0.0, count=1)`)
        }
      }

      // Main query with threshold 0.3
      const rpcResponse = await fetch(rpcUrl, {
        method: 'POST',
        headers: rpcHeaders,
        body: JSON.stringify({
          query_embedding: embeddingStr,
          match_project_id: projectId,
          match_threshold: 0.3,
          match_count: 10,
        }),
      })

      if (debug) console.log(`[RAG] Direct REST API: status=${rpcResponse.status}`)

      if (rpcResponse.ok) {
        chunks = await rpcResponse.json()
        if (debug) console.log(`[RAG] Direct REST API: chunks_found=${chunks.length}`)
      } else {
        const errText = await rpcResponse.text()
        console.error(`[RAG] Direct REST API error: ${errText}`)
      }
    } else {
      console.error('[RAG] No access token available — falling back to supabase.rpc()')
      const { data: rpcChunks, error: rpcError } = await supabase.rpc('match_document_chunks', {
        query_embedding: embeddingStr,
        match_project_id: projectId,
        match_threshold: 0.3,
        match_count: 10,
      })
      if (rpcError) {
        console.error('[RAG] supabase.rpc() error:', rpcError)
      }
      chunks = rpcChunks ?? []
    }

    if (debug) console.log(`[RAG] RESULT: ${chunks.length} chunks found`)

    // Build context from chunks
    let context = ''
    const sources: { file_name: string; category: string; chunk_index: number }[] = []

    for (const chunk of chunks) {
      const meta = chunk.metadata ?? {}
      const fileName = meta.file_name ?? 'Unknown document'
      const category = meta.category ?? 'Uncategorized'
      context += `\n---\nDocument: ${fileName} (${category})\n${chunk.content}\n`
      if (!sources.find((s) => s.file_name === fileName)) {
        sources.push({ file_name: fileName, category, chunk_index: Number(meta.chunk_index ?? 0) })
      }
    }

    // Get conversation history (last 10 messages)
    const { data: history } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(10)

    // Build messages for Claude
    const messages: { role: 'user' | 'assistant'; content: string }[] = []

    if (history && history.length > 1) {
      // Add previous messages (exclude the one we just saved)
      for (const msg of history.slice(0, -1)) {
        messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content })
      }
    }

    // Add current message with context
    const userMessageWithContext = context
      ? `Here are the relevant project documents:\n${context}\n\nQuestion: ${message}`
      : `No relevant documents were found for this question. Let the user know.\n\nQuestion: ${message}`

    messages.push({ role: 'user', content: userMessageWithContext })

    // Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
    })

    const assistantContent =
      response.content[0].type === 'text' ? response.content[0].text : ''

    // Save assistant response
    await supabase.from('chat_messages').insert({
      session_id: sessionId,
      role: 'assistant',
      content: assistantContent,
      sources,
    })

    return NextResponse.json({
      sessionId,
      message: assistantContent,
      sources,
    })
  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json({ error: 'Chat request failed' }, { status: 500 })
  }
}
