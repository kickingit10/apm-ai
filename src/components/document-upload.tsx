'use client'

import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { DOCUMENT_CATEGORIES } from '@/lib/categories'

export default function DocumentUpload({ projectId }: { projectId: string }) {
  const [files, setFiles] = useState<File[]>([])
  const [category, setCategory] = useState<string>(DOCUMENT_CATEGORIES[0])
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const router = useRouter()

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files?.length) {
      setFiles(Array.from(e.dataTransfer.files))
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      setFiles(Array.from(e.target.files))
    }
  }

  function getFileType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
    const typeMap: Record<string, string> = {
      pdf: 'pdf', docx: 'docx', doc: 'docx',
      xlsx: 'xlsx', xls: 'xlsx', csv: 'csv',
      png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image',
      txt: 'text',
    }
    return typeMap[ext] ?? 'other'
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (files.length === 0) return

    setUploading(true)
    setError(null)

    for (const file of files) {
      const timestamp = Date.now()
      const storagePath = `${projectId}/${timestamp}-${file.name}`

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, file)

      if (uploadError) {
        setError(`Failed to upload ${file.name}: ${uploadError.message}`)
        setUploading(false)
        return
      }

      const { error: dbError } = await supabase.from('documents').insert({
        project_id: projectId,
        file_name: file.name,
        file_type: getFileType(file.name),
        category,
        storage_path: storagePath,
        file_size: file.size,
      })

      if (dbError) {
        setError(`Failed to save record for ${file.name}: ${dbError.message}`)
        setUploading(false)
        return
      }
    }

    setFiles([])
    if (inputRef.current) inputRef.current.value = ''
    setUploading(false)
    router.refresh()
  }

  return (
    <form onSubmit={handleUpload} className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Upload Documents</h2>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md mb-3">{error}</div>
      )}

      {/* Drop zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <p className="text-sm text-gray-600">
          {files.length > 0 ? (
            <span className="font-medium text-gray-900">
              {files.length} file{files.length > 1 ? 's' : ''} selected:{' '}
              {files.map(f => f.name).join(', ')}
            </span>
          ) : (
            <>
              <span className="font-medium text-blue-600">Click to browse</span>
              {' '}or drag and drop files here
            </>
          )}
        </p>
        <p className="text-xs text-gray-400 mt-1">PDF, Word, Excel, images, or any project file</p>
      </div>

      {/* Category + Upload button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 mt-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {DOCUMENT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={uploading || files.length === 0}
          className="bg-blue-600 text-white text-sm font-medium px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {uploading ? 'Uploading...' : `Upload${files.length > 0 ? ` (${files.length})` : ''}`}
        </button>
      </div>
    </form>
  )
}
