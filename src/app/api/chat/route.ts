import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

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

    // Find relevant document chunks
    const { data: chunks, error: rpcError } = await supabase.rpc('match_document_chunks', {
      query_embedding: queryEmbedding,
      match_project_id: projectId,
      match_threshold: 0.7,
      match_count: 5,
    })

    if (rpcError) {
      console.error('RPC error:', rpcError)
    }

    // Build context from chunks
    const relevantChunks = chunks ?? []
    let context = ''
    const sources: { file_name: string; category: string; chunk_index: number }[] = []

    for (const chunk of relevantChunks) {
      const meta = chunk.metadata ?? {}
      const fileName = meta.file_name ?? 'Unknown document'
      const category = meta.category ?? 'Uncategorized'
      context += `\n---\nDocument: ${fileName} (${category})\n${chunk.content}\n`
      if (!sources.find((s) => s.file_name === fileName)) {
        sources.push({ file_name: fileName, category, chunk_index: meta.chunk_index ?? 0 })
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
