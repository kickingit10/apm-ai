'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LandingPage() {
  const [demoLoading, setDemoLoading] = useState(false)
  const [demoError, setDemoError] = useState<string | null>(null)
  const router = useRouter()

  async function handleTryDemo() {
    setDemoLoading(true)
    setDemoError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: 'demo@apm-ai.com',
      password: 'demo1234',
    })
    if (error) {
      setDemoError('Demo temporarily unavailable. Please try again.')
      setDemoLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-4 border-b border-gray-100">
        <span className="text-xl font-bold text-slate-900 tracking-tight">APM.AI</span>
        <a
          href="/login"
          className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          Sign In
        </a>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 md:px-12 pt-16 md:pt-24 pb-12">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-blue-600 tracking-wide uppercase mb-3">
            For Solar &amp; Energy EPC Contractors
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight leading-tight">
            Your project documents,<br />
            searchable with AI
          </h1>
          <p className="text-lg md:text-xl text-slate-500 mt-5 leading-relaxed max-w-xl">
            Upload your daily logs, RFIs, submittals, and safety docs. Ask questions in plain English.
            Get answers with citations from your actual project files.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mt-8">
            <button
              onClick={handleTryDemo}
              disabled={demoLoading}
              className="bg-blue-600 text-white rounded-lg px-6 py-3 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              {demoLoading ? 'Loading demo...' : 'Try the Demo →'}
            </button>
            <a
              href="/login"
              className="border border-gray-300 text-slate-700 rounded-lg px-6 py-3 text-sm font-semibold hover:bg-gray-50 transition-colors text-center"
            >
              Sign In
            </a>
          </div>

          {demoError && (
            <p className="text-red-600 text-sm mt-3">{demoError}</p>
          )}

          <p className="text-xs text-slate-400 mt-4">
            Demo loads a sample solar project with real document types. No signup needed.
          </p>
        </div>
      </section>

      {/* How it Works */}
      <section className="bg-slate-50 border-t border-gray-100">
        <div className="max-w-4xl mx-auto px-6 md:px-12 py-16">
          <h2 className="text-sm font-medium text-slate-400 tracking-wide uppercase mb-8">How it works</h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-bold text-sm mb-4">1</div>
              <h3 className="font-semibold text-slate-900 mb-2">Upload your docs</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Daily logs, RFIs, submittals, safety reports, inspection records — any PDF or document your team produces.
              </p>
            </div>

            <div>
              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-bold text-sm mb-4">2</div>
              <h3 className="font-semibold text-slate-900 mb-2">Ask JIM anything</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                JIM is your Jobsite Information Manager. Ask questions like &ldquo;What was the delay reason on March 3rd?&rdquo; or &ldquo;Show me all RFIs related to inverter specs.&rdquo;
              </p>
            </div>

            <div>
              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-bold text-sm mb-4">3</div>
              <h3 className="font-semibold text-slate-900 mb-2">Get cited answers</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Every answer references the specific document and page. No hallucinations — just your actual project data.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="max-w-4xl mx-auto px-6 md:px-12 py-16">
        <h2 className="text-sm font-medium text-slate-400 tracking-wide uppercase mb-6">Built for</h2>
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="border border-gray-200 rounded-lg p-5">
            <h3 className="font-semibold text-slate-900 mb-1">Project Managers</h3>
            <p className="text-sm text-slate-500">
              Stop digging through SharePoint folders. Find what you need in seconds, not hours.
            </p>
          </div>
          <div className="border border-gray-200 rounded-lg p-5">
            <h3 className="font-semibold text-slate-900 mb-1">Mid-Size Solar EPCs</h3>
            <p className="text-sm text-slate-500">
              3–20 active projects. Too many docs for manual tracking, not enough staff for a Procore deployment.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 px-6 md:px-12">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <span className="text-sm text-slate-400">&copy; 2026 APM.AI</span>
          <a href="mailto:levine10.sl@gmail.com" className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
            Contact
          </a>
        </div>
      </footer>
    </div>
  )
}
