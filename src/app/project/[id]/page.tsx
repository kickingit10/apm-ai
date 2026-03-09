import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/header'
import DocumentUpload from '@/components/document-upload'
import DocumentList from '@/components/document-list'
import ChatPanel from '@/components/chat-panel'

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!project) notFound()

  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false })

  const { data: chatSessions } = await supabase
    .from('chat_sessions')
    .select('id, title, created_at')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false })

  const statusColor: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    completed: 'bg-gray-100 text-gray-600',
    on_hold: 'bg-yellow-100 text-yellow-700',
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header email={user.email ?? ''} />
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <Link href="/dashboard" className="hover:text-blue-600 transition-colors">
            Projects
          </Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">{project.name}</span>
        </nav>

        {/* Project Info */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 mb-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-gray-400">#{project.project_number}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[project.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {project.status}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
              {project.location && (
                <p className="text-gray-500 mt-1">{project.location}</p>
              )}
            </div>
            <span className="text-xs text-gray-400">
              Created {new Date(project.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Two-column layout: Documents left, Chat right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column: Documents */}
          <div className="space-y-6">
            <DocumentUpload projectId={project.id} />
            <DocumentList initialDocuments={documents ?? []} />
          </div>

          {/* Right column: Chat */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <ChatPanel projectId={project.id} initialSessions={chatSessions ?? []} />
          </div>
        </div>
      </main>
    </div>
  )
}
