import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 120 // Allow up to 2 minutes for OCR processing

const debug = process.env.DEBUG === 'true'

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

// OCR via OpenAI vision API (gpt-4o-mini) — works for scanned PDFs and photos
async function ocrWithVision(base64Image: string, mimeType: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Extract all text from this document image. Return only the raw text content, preserving structure and formatting.' },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } },
        ],
      }],
      max_tokens: 4096,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    console.error('[OCR] Vision API error:', errText)
    return ''
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content ?? ''
}

function getExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? ''
}

function getMimeType(ext: string): string {
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp', heic: 'image/heic',
    pdf: 'application/pdf',
  }
  return mimeMap[ext] ?? 'application/octet-stream'
}

async function extractText(buffer: Buffer, fileName: string): Promise<string> {
  const ext = getExtension(fileName)

  // Plain text
  if (['txt', 'csv'].includes(ext)) {
    return buffer.toString('utf-8')
  }

  // PDF: try pdf-parse first, fall back to OCR for scanned PDFs
  if (ext === 'pdf') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse')
    let text = ''
    try {
      const data = await pdfParse(buffer)
      text = data.text?.trim() ?? ''
    } catch (e) {
      console.warn('[Extract] pdf-parse failed, trying OCR:', e)
    }

    // If pdf-parse returned meaningful text, use it
    if (text.length >= 50) {
      return text
    }

    // Scanned/image PDF — OCR the whole file as one image
    if (debug) console.log(`[Extract] PDF text too short (${text.length} chars), falling back to OCR`)
    const base64 = buffer.toString('base64')
    const ocrText = await ocrWithVision(base64, 'application/pdf')
    return ocrText || text // Return whatever we got
  }

  // Word documents
  if (['docx', 'doc'].includes(ext)) {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }

  // Outlook .msg emails
  if (ext === 'msg') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const MsgReader = require('msgreader').default || require('msgreader')
    const msgReader = new MsgReader(buffer)
    const fileData = msgReader.getFileData()
    const parts = []
    if (fileData.subject) parts.push(`Subject: ${fileData.subject}`)
    if (fileData.senderName || fileData.senderEmail) {
      parts.push(`From: ${fileData.senderName || ''} ${fileData.senderEmail ? `<${fileData.senderEmail}>` : ''}`.trim())
    }
    if (fileData.sentOn) parts.push(`Date: ${fileData.sentOn}`)
    if (parts.length > 0) parts.push('')
    parts.push(fileData.body || '')
    return parts.join('\n')
  }

  // Images — OCR via vision API
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext)) {
    const base64 = buffer.toString('base64')
    const mimeType = getMimeType(ext)
    return await ocrWithVision(base64, mimeType)
  }

  // Unsupported file type
  console.warn(`[Extract] Unsupported file type: .${ext}`)
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

  let documentId: string | undefined

  try {
    const body = await request.json()
    documentId = body.documentId
    const { storagePath, fileName, category } = body

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
      console.error(`[Process] Download failed for ${fileName}:`, downloadError)
      await supabase.from('documents').update({ processing_status: 'failed' }).eq('id', documentId)
      return NextResponse.json({ error: 'Failed to download file' }, { status: 500 })
    }

    const buffer = Buffer.from(await fileData.arrayBuffer())

    // Extract text (with OCR fallback for scanned PDFs and images)
    const text = await extractText(buffer, fileName)

    if (!text || text.trim().length === 0) {
      console.warn(`[Process] No text extracted from ${fileName}`)
      await supabase.from('documents').update({ processing_status: 'failed' }).eq('id', documentId)
      return NextResponse.json({ error: 'No text could be extracted from this file', chunks: 0 }, { status: 200 })
    }

    if (debug) console.log(`[Process] Extracted ${text.length} chars from ${fileName}`)

    // Chunk the text
    const chunks = chunkText(text)

    // Generate embeddings and store chunks
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

    // Mark as ready
    await supabase.from('documents').update({ processing_status: 'ready' }).eq('id', documentId)

    if (debug) console.log(`[Process] Complete: ${fileName} → ${chunks.length} chunks`)
    return NextResponse.json({ message: 'Processing complete', chunks: chunks.length })
  } catch (error) {
    console.error('[Process] Pipeline error:', documentId, error)
    // ALWAYS update status on failure — never leave stuck at 'processing'
    if (documentId) {
      await supabase.from('documents').update({ processing_status: 'failed' }).eq('id', documentId)
    }
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}
