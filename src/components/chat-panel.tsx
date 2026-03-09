'use client'

import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: { file_name: string; category: string }[]
}

type ChatSession = {
  id: string
  title: string | null
  created_at: string
}

const STARTER_PROMPTS = [
  'Summarize today\'s progress across all daily logs',
  'What are the open safety issues on this project?',
  'List all RFIs and their current status',
  'What are the highest priority punch list items?',
]

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

export default function ChatPanel({
  projectId,
  initialSessions,
}: {
  projectId: string
  initialSessions: ChatSession[]
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessions, setSessions] = useState(initialSessions)
  const [showSessions, setShowSessions] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadSession(id: string) {
    const response = await fetch(`/api/chat/history?sessionId=${id}`)
    if (response.ok) {
      const data = await response.json()
      setMessages(data.messages)
      setSessionId(id)
      setShowSessions(false)
      setExpanded(true)
    }
  }

  function handleNewChat() {
    setMessages([])
    setSessionId(null)
    setShowSessions(false)
  }

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setExpanded(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          projectId,
          sessionId,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        if (!sessionId && data.sessionId) {
          setSessionId(data.sessionId)
          setSessions((prev) => [
            { id: data.sessionId, title: text.trim().slice(0, 50), created_at: new Date().toISOString() },
            ...prev,
          ])
        }

        const assistantMsg: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.message,
          sources: data.sources,
        }
        setMessages((prev) => [...prev, assistantMsg])
      } else {
        const errorMsg: Message = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `Error: ${data.error || 'Something went wrong. Please try again.'}`,
        }
        setMessages((prev) => [...prev, errorMsg])
      }
    } catch {
      const errorMsg: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Network error. Please check your connection and try again.',
      }
      setMessages((prev) => [...prev, errorMsg])
    }

    setLoading(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    sendMessage(input)
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg flex flex-col ${
      expanded ? 'h-[600px] lg:h-full' : 'h-auto'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">JIM</h2>
          <p className="text-xs text-gray-400 -mt-0.5">Jobsite Information Manager</p>
        </div>
        <div className="flex items-center gap-2">
          {sessions.length > 0 && (
            <button
              onClick={() => setShowSessions(!showSessions)}
              className="text-xs text-gray-500 hover:text-gray-700 font-medium px-2 py-1 rounded hover:bg-gray-100 transition-colors"
            >
              History ({sessions.length})
            </button>
          )}
          <button
            onClick={handleNewChat}
            className="text-xs bg-blue-600 text-white font-medium px-3 py-1.5 rounded-md hover:bg-blue-700 transition-colors"
          >
            New Chat
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-gray-500 hover:text-gray-700 font-medium px-2 py-1 rounded hover:bg-gray-100 transition-colors lg:hidden"
          >
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>

      {/* Session list dropdown */}
      {showSessions && (
        <div className="border-b border-gray-100 max-h-48 overflow-y-auto">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => loadSession(session.id)}
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${
                sessionId === session.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
              }`}
            >
              <p className="font-medium truncate">{session.title || 'Untitled chat'}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(session.created_at).toLocaleDateString()}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Messages area */}
      <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${expanded ? '' : 'max-h-0 overflow-hidden lg:max-h-none lg:overflow-y-auto'}`}>
        {messages.length === 0 && !loading ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-400 text-center mb-4">
              Ask JIM about your project documents
            </p>
            <div className="grid grid-cols-1 gap-2">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="text-left text-sm p-3 rounded-lg border border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-all"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1 prose-p:my-1 prose-li:my-0.5 prose-ul:my-1 prose-ol:my-1 prose-strong:text-gray-900">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-gray-200/50">
                      {msg.sources.map((source, i) => (
                        <span
                          key={i}
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            categoryColors[source.category] ?? 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {source.file_name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-gray-100 shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask JIM about your project..."
            disabled={loading}
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            onFocus={() => setExpanded(true)}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors shrink-0"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}
