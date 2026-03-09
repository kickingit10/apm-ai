import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function chunkText(text: string, maxTokens = 500, overlapTokens = 50): string[] {
  // Approximate: 1 token ≈ 4 characters
  const maxChars = maxTokens * 4
  const overlapChars = overlapTokens * 4
  const chunks: string[] = []

  let start = 0
  while (start < text.length) {
    let end = start + maxChars

    // Try to break at a paragraph or sentence boundary
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
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

  try {
    const { documentId, storagePath, fileName, fileType, category } = await request.json()

    // Mark as processing
    await supabase
      .from('documents')
      .update({ processing_status: 'processing' })
      .eq('id', documentId)

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(storagePath)

    if (downloadError || !fileData) {
      await supabase
        .from('documents')
        .update({ processing_status: 'failed' })
        .eq('id', documentId)
      return NextResponse.json({ error: 'Failed to download file' }, { status: 500 })
    }

    const buffer = Buffer.from(await fileData.arrayBuffer())

    // Extract text
    const text = await extractText(buffer, fileType, fileName)

    if (!text || text.trim().length === 0) {
      // No extractable text (e.g., images)
      await supabase
        .from('documents')
        .update({ processing_status: 'completed' })
        .eq('id', documentId)
      return NextResponse.json({ message: 'No text to extract', chunks: 0 })
    }

    // Chunk the text
    const chunks = chunkText(text)

    // Generate embeddings in batches
    for (let i = 0; i < chunks.length; i++) {
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: chunks[i],
      })

      const embedding = embeddingResponse.data[0].embedding

      await supabase.from('document_chunks').insert({
        document_id: documentId,
        content: chunks[i],
        chunk_index: i,
        embedding,
        metadata: { file_name: fileName, category, chunk_index: i },
      })
    }

    // Mark as completed
    await supabase
      .from('documents')
      .update({ processing_status: 'completed' })
      .eq('id', documentId)

    return NextResponse.json({ message: 'Processing complete', chunks: chunks.length })
  } catch (error) {
    console.error('Document processing error:', error)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}
