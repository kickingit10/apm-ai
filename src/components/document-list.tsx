'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { DOCUMENT_CATEGORIES } from '@/lib/categories'

type Document = {
  id: string
  file_name: string
  file_type: string
  category: string
  storage_path: string
  file_size: number | null
  processing_status?: string
  created_at: string
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const categoryColors: Record<string, string> = {
  'Action List': 'bg-purple-100 text-purple-700',
  'Permits': 'bg-blue-100 text-blue-700',
  'Daily Logs': 'bg-green-100 text-green-700',
  'RFIs': 'bg-orange-100 text-orange-700',
  'Submittals': 'bg-cyan-100 text-cyan-700',
  'Safety': 'bg-red-100 text-red-700',
  'Quality': 'bg-teal-100 text-teal-700',
  'Commissioning': 'bg-indigo-100 text-indigo-700',
  'Interconnection': 'bg-yellow-100 text-yellow-700',
  'Contracts': 'bg-slate-100 text-slate-700',
  'Change Orders': 'bg-pink-100 text-pink-700',
  'Drawings': 'bg-amber-100 text-amber-700',
  'Communications': 'bg-violet-100 text-violet-700',
  'Photos': 'bg-emerald-100 text-emerald-700',
  'Other': 'bg-gray-100 text-gray-600',
}

const categoryBorderColors: Record<string, string> = {
  'Action List': 'border-l-purple-400',
  'Permits': 'border-l-blue-400',
  'Daily Logs': 'border-l-green-400',
  'RFIs': 'border-l-orange-400',
  'Submittals': 'border-l-cyan-400',
  'Safety': 'border-l-red-400',
  'Quality': 'border-l-teal-400',
  'Commissioning': 'border-l-indigo-400',
  'Interconnection': 'border-l-yellow-400',
  'Contracts': 'border-l-slate-400',
  'Change Orders': 'border-l-pink-400',
  'Drawings': 'border-l-amber-400',
  'Communications': 'border-l-violet-400',
  'Photos': 'border-l-emerald-400',
  'Other': 'border-l-gray-400',
}

export default function DocumentList({
  initialDocuments,
}: {
  initialDocuments: Document[]
  projectId?: string
}) {
  const [documents, setDocuments] = useState(initialDocuments)
  const [activeFolder, setActiveFolder] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [retrying, setRetrying] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()

  const filteredDocs = activeFolder === null
    ? []
    : activeFolder === 'All'
      ? documents
      : documents.filter((d) => d.category === activeFolder)

  // Categories that have at least 1 document
  const activeCategorySet = new Set(documents.map((d) => d.category))
  const activeCategories = DOCUMENT_CATEGORIES.filter((c) => activeCategorySet.has(c))

  async function handleDownload(doc: Document) {
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.storage_path, 300, { download: doc.file_name })

    if (error || !data?.signedUrl) {
      alert(`Download failed: ${error?.message ?? 'Could not generate download link'}`)
      return
    }

    const link = document.createElement('a')
    link.href = data.signedUrl
    link.download = doc.file_name
    link.click()
  }

  async function handleDelete(doc: Document) {
    if (!confirm(`Delete "${doc.file_name}"?`)) return

    setDeleting(doc.id)

    await supabase.storage.from('documents').remove([doc.storage_path])
    await supabase.from('documents').delete().eq('id', doc.id)

    setDocuments((prev) => {
      const updated = prev.filter((d) => d.id !== doc.id)
      // If we're inside a folder and it's now empty, go back to grid
      if (activeFolder && activeFolder !== 'All') {
        const remaining = updated.filter((d) => d.category === activeFolder)
        if (remaining.length === 0) setActiveFolder(null)
      }
      return updated
    })
    setDeleting(null)
    router.refresh()
  }

  async function handleRetry(doc: Document) {
    setRetrying(doc.id)
    setDocuments((prev) =>
      prev.map((d) => d.id === doc.id ? { ...d, processing_status: 'processing' } : d)
    )

    try {
      const res = await fetch('/api/process-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: doc.id,
          storagePath: doc.storage_path,
          fileName: doc.file_name,
          fileType: doc.file_type,
          category: doc.category,
        }),
      })

      setDocuments((prev) =>
        prev.map((d) => d.id === doc.id
          ? { ...d, processing_status: res.ok ? 'ready' : 'failed' }
          : d
        )
      )
    } catch {
      setDocuments((prev) =>
        prev.map((d) => d.id === doc.id ? { ...d, processing_status: 'failed' } : d)
      )
    } finally {
      setRetrying(null)
    }
  }

  // ── View 1: Folder Grid ──
  if (activeFolder === null) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Documents
          <span className="text-sm font-normal text-gray-400 ml-2">({documents.length})</span>
        </h2>

        {documents.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm">No documents uploaded yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {/* All Documents card */}
            <button
              onClick={() => setActiveFolder('All')}
              className="border border-gray-200 border-l-4 border-l-blue-500 rounded-lg p-3 text-left hover:shadow-md hover:border-gray-300 transition-all"
            >
              <svg className="h-6 w-6 text-blue-500 mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
              </svg>
              <p className="text-sm font-medium text-gray-900 truncate">All Documents</p>
              <p className="text-xs text-gray-400 mt-0.5">{documents.length} file{documents.length !== 1 ? 's' : ''}</p>
            </button>

            {/* Category folder cards */}
            {activeCategories.map((cat) => {
              const count = documents.filter((d) => d.category === cat).length
              return (
                <button
                  key={cat}
                  onClick={() => setActiveFolder(cat)}
                  className={`border border-gray-200 border-l-4 ${categoryBorderColors[cat] ?? 'border-l-gray-400'} rounded-lg p-3 text-left hover:shadow-md hover:border-gray-300 transition-all`}
                >
                  <svg className="h-6 w-6 text-gray-400 mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                  </svg>
                  <p className="text-sm font-medium text-gray-900 truncate">{cat}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{count} file{count !== 1 ? 's' : ''}</p>
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── View 2: Document List (inside a folder) ──
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
      {/* Header with back button */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => setActiveFolder(null)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to folders
        </button>
      </div>
      <h2 className="text-lg font-semibold text-gray-900 mb-3">
        {activeFolder === 'All' ? 'All Documents' : activeFolder}
        <span className="text-sm font-normal text-gray-400 ml-2">({filteredDocs.length})</span>
      </h2>

      {/* Document rows */}
      {filteredDocs.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <p className="text-sm">No documents in this category.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {filteredDocs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">{doc.file_name}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryColors[doc.category] ?? 'bg-gray-100 text-gray-600'}`}>
                    {doc.category}
                  </span>
                  {(doc.processing_status === 'pending' || doc.processing_status === 'queued') && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">Queued</span>
                  )}
                  {doc.processing_status === 'processing' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium animate-pulse">Processing</span>
                  )}
                  {doc.processing_status === 'ready' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">AI Ready</span>
                  )}
                  {doc.processing_status === 'failed' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">Processing Failed</span>
                  )}
                  {(doc.processing_status === 'pending' || doc.processing_status === 'queued' || doc.processing_status === 'failed') && (
                    <button
                      onClick={() => handleRetry(doc)}
                      disabled={retrying === doc.id}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-0.5 rounded hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {retrying === doc.id ? (
                        <span className="inline-flex items-center gap-1">
                          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Retrying
                        </span>
                      ) : 'Retry'}
                    </button>
                  )}
                  <span className="text-xs text-gray-400">{formatFileSize(doc.file_size)}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleDownload(doc)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                >
                  Download
                </button>
                <button
                  onClick={() => handleDelete(doc)}
                  disabled={deleting === doc.id}
                  className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {deleting === doc.id ? '...' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
