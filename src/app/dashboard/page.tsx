import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProjectList from '@/components/project-list'
import Header from '@/components/header'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gray-50">
      <Header email={user.email ?? ''} />
      <main className="max-w-5xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        </div>
        <ProjectList projects={projects ?? []} />
      </main>
    </div>
  )
}
