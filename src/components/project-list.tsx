'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type Project = {
  id: string
  project_number: string
  name: string
  location: string | null
  status: string
  created_at: string
}

export default function ProjectList({ projects: initialProjects }: { projects: Project[] }) {
  const [projects, setProjects] = useState(initialProjects)
  const [showForm, setShowForm] = useState(false)
  const [projectNumber, setProjectNumber] = useState('')
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { data, error } = await supabase
      .from('projects')
      .insert({ project_number: projectNumber, name, location: location || null })
      .select()
      .single()

    if (!error && data) {
      setProjects([data, ...projects])
      setProjectNumber('')
      setName('')
      setLocation('')
      setShowForm(false)
    }

    setLoading(false)
  }

  const statusColor: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    completed: 'bg-gray-100 text-gray-600',
    on_hold: 'bg-yellow-100 text-yellow-700',
  }

  return (
    <div>
      <button
        onClick={() => setShowForm(!showForm)}
        className="mb-4 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
      >
        {showForm ? 'Cancel' : 'New Project'}
      </button>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-lg p-4 mb-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project #</label>
              <input
                value={projectNumber}
                onChange={(e) => setProjectNumber(e.target.value)}
                required
                placeholder="26001"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Sunflower Solar Farm"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Fort Worth, TX"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating...' : 'Create Project'}
          </button>
        </form>
      )}

      {projects.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg font-medium">No projects yet</p>
          <p className="text-sm mt-1">Create your first project to get started.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {projects.map((project) => (
            <Link
              href={`/project/${project.id}`}
              key={project.id}
              className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-gray-400">
                      #{project.project_number}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[project.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {project.status}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mt-1">{project.name}</h3>
                  {project.location && (
                    <p className="text-sm text-gray-500 mt-0.5">{project.location}</p>
                  )}
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {new Date(project.created_at).toLocaleDateString()}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
