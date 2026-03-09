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
  'Photos': 'bg-emerald-100 text-emerald-700',
  'Other': 'bg-gray-100 text-gray-600',
}

export default function DocumentList({
  initialDocuments,
}: {
  initialDocuments: Document[]
  projectId?: string
}) {
  const [documents, setDocuments] = useState(initialDocuments)
  const [activeFilter, setActiveFilter] = useState<string>('All')
  const [deleting, setDeleting] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()

  const filteredDocs = activeFilter === 'All'
    ? documents
    : documents.filter((d) => d.category === activeFilter)

  // Only show category tabs that have documents
  const activeCategorySet = new Set(documents.map((d) => d.category))
  const filterTabs = ['All', ...DOCUMENT_CATEGORIES.filter((c) => activeCategorySet.has(c))]

  async function handleDownload(doc: Document) {
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.storage_path, 60)

    if (!error && data?.signedUrl) {
      window.open(data.signedUrl, '_blank')
    }
  }

  async function handleDelete(doc: Document) {
    if (!confirm(`Delete "${doc.file_name}"?`)) return

    setDeleting(doc.id)

    await supabase.storage.from('documents').remove([doc.storage_path])
    await supabase.from('documents').delete().eq('id', doc.id)

    setDocuments(documents.filter((d) => d.id !== doc.id))
    setDeleting(null)
    router.refresh()
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">
        Documents
        <span className="text-sm font-normal text-gray-400 ml-2">({documents.length})</span>
      </h2>

      {/* Category filter tabs */}
      {documents.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-3 mb-3 border-b border-gray-100">
          {filterTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
                activeFilter === tab
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab}
              {tab !== 'All' && (
                <span className="ml-1">
                  ({documents.filter((d) => d.category === tab).length})
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Document rows */}
      {filteredDocs.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <p className="text-sm">
            {documents.length === 0
              ? 'No documents uploaded yet.'
              : 'No documents in this category.'}
          </p>
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
                  {doc.processing_status === 'pending' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">Queued</span>
                  )}
                  {doc.processing_status === 'processing' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium animate-pulse">Processing...</span>
                  )}
                  {(doc.processing_status === 'completed' || doc.processing_status === 'ready') && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">AI Ready</span>
                  )}
                  {doc.processing_status === 'failed' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">Failed</span>
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
