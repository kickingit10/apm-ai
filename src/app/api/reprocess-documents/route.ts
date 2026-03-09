import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function chunkText(text: string, maxTokens = 500, overlapTokens = 50): string[] {
  const maxChars = maxTokens * 4
  const overlapChars = overlapTokens * 4
  const chunks: string[] = []

  let start = 0
  while (start < text.length) {
    let end = start + maxChars

    if (end < text.length) {
      const slice = text.slice(start, end)
      const lastParagraph = slice.lastIndexOf('\n\n')
      const lastNewline = slice.lastIndexOf('\n')
      const lastSentence = slice.lastIndexOf('. ')

      if (lastParagraph > maxChars * 0.5) {
        end = start + lastParagraph + 2
      } else if (lastNewline > maxChars * 0.5) {
        end = start + lastNewline + 1
      } else if (lastSentence > maxChars * 0.5) {
        end = start + lastSentence + 2
      }
    }

    const chunk = text.slice(start, end).trim()
    if (chunk.length > 0) {
      chunks.push(chunk)
    }

    start = end - overlapChars
    if (start >= text.length) break
  }

  return chunks
}

async function extractText(buffer: Buffer, fileType: string, fileName: string): Promise<string> {
  if (fileType === 'text' || fileName.endsWith('.txt') || fileName.endsWith('.csv')) {
    return buffer.toString('utf-8')
  }

  if (fileType === 'pdf' || fileName.endsWith('.pdf')) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse')
    const data = await pdfParse(buffer)
    return data.text
  }

  if (fileType === 'docx' || fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }

  return ''
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  let body: { documentId?: string } = {}
  try {
    body = await request.json()
  } catch {
    // Empty body is fine — means reprocess all stuck docs
  }

  const details: { file_name: string; status: string; chunks: number; error?: string }[] = []
  let processed = 0
  let failed = 0

  // Get documents to reprocess
  let query = supabase
    .from('documents')
    .select('id, file_name, file_type, category, storage_path, project_id')

  if (body.documentId) {
    query = query.eq('id', body.documentId)
  } else {
    query = query.in('processing_status', ['pending', 'failed'])
  }

  const { data: documents, error: queryError } = await query

  if (queryError) {
    return NextResponse.json({ error: queryError.message }, { status: 500 })
  }

  if (!documents || documents.length === 0) {
    return NextResponse.json({ processed: 0, failed: 0, details: [], message: 'No documents to reprocess' })
  }

  for (const doc of documents) {
    try {
      // Mark as processing
      await supabase
        .from('documents')
        .update({ processing_status: 'processing' })
        .eq('id', doc.id)

      // Delete any existing chunks (in case of partial previous run)
      await supabase
        .from('document_chunks')
        .delete()
        .eq('document_id', doc.id)

      // Download file
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('documents')
        .download(doc.storage_path)

      if (downloadError || !fileData) {
        await supabase.from('documents').update({ processing_status: 'failed' }).eq('id', doc.id)
        details.push({ file_name: doc.file_name, status: 'failed', chunks: 0, error: 'Download failed' })
        failed++
        continue
      }

      const buffer = Buffer.from(await fileData.arrayBuffer())
      const text = await extractText(buffer, doc.file_type, doc.file_name)

      if (!text || text.trim().length === 0) {
        await supabase.from('documents').update({ processing_status: 'ready' }).eq('id', doc.id)
        details.push({ file_name: doc.file_name, status: 'ready', chunks: 0 })
        processed++
        continue
      }

      // Chunk and embed
      const chunks = chunkText(text)

      for (let i = 0; i < chunks.length; i++) {
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: chunks[i],
        })

        await supabase.from('document_chunks').insert({
          document_id: doc.id,
          content: chunks[i],
          chunk_index: i,
          embedding: embeddingResponse.data[0].embedding,
          metadata: { file_name: doc.file_name, category: doc.category, chunk_index: i },
        })
      }

      await supabase.from('documents').update({ processing_status: 'ready' }).eq('id', doc.id)
      details.push({ file_name: doc.file_name, status: 'ready', chunks: chunks.length })
      processed++
    } catch (err) {
      await supabase.from('documents').update({ processing_status: 'failed' }).eq('id', doc.id)
      details.push({
        file_name: doc.file_name,
        status: 'failed',
        chunks: 0,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
      failed++
    }
  }

  return NextResponse.json({ processed, failed, details })
}
