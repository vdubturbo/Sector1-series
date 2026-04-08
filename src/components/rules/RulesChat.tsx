'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface SourceCitation {
  chunk_id: string
  section_label: string | null
  page_number: number | null
  excerpt: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: SourceCitation[]
  isStreaming?: boolean
}

interface ActiveRulebook {
  title: string
  version_label: string | null
  effective_date: string | null
}

const SUGGESTED_QUESTIONS = [
  'What are the general safety requirements?',
  'What equipment is mandatory for all competitors?',
  'What are the technical inspection rules?',
]

const MAX_CHARS = 500

/* ── Icons ─────────────────────────────────────────────────────────── */

function BookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function ChevronIcon({ className, direction }: { className?: string; direction: 'up' | 'down' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {direction === 'down' ? (
        <polyline points="6 9 12 15 18 9" />
      ) : (
        <polyline points="18 15 12 9 6 15" />
      )}
    </svg>
  )
}

/* ── Sources Panel ─────────────────────────────────────────────────── */

function SourcesPanel({ sources }: { sources: SourceCitation[] }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-[11px] text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
      >
        <BookIcon className="w-3 h-3" />
        {expanded ? 'Hide' : 'View'} sources ({sources.length})
        <ChevronIcon className="w-3 h-3" direction={expanded ? 'up' : 'down'} />
      </button>
      {expanded && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {sources.map((src) => (
            <div
              key={src.chunk_id}
              className="text-[10px] bg-bg-elevated border border-border-subtle rounded px-2 py-1 max-w-[280px]"
            >
              <span className="text-accent-orange font-medium">
                {src.section_label || 'Section'}
                {src.page_number != null && `, p.${src.page_number}`}
              </span>
              <p className="text-text-muted mt-0.5 leading-snug">
                {src.excerpt.length > 120 ? src.excerpt.slice(0, 120) + '...' : src.excerpt}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Streaming Dots ────────────────────────────────────────────────── */

function StreamingDots() {
  return (
    <span className="inline-flex items-center gap-0.5 ml-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1 h-1 bg-text-muted rounded-full pulse-dot"
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </span>
  )
}

/* ── Main Chat Component ───────────────────────────────────────────── */

export default function RulesChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeRulebook, setActiveRulebook] = useState<ActiveRulebook | null>(null)
  const [rulebookChecked, setRulebookChecked] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Fetch active rulebook on mount
  useEffect(() => {
    fetch('/api/rules/current')
      .then((res) => res.json())
      .then((data) => {
        if (data.active) {
          setActiveRulebook(data)
        }
        setRulebookChecked(true)
      })
      .catch(() => setRulebookChecked(true))
  }, [])

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    if (val.length <= MAX_CHARS) {
      setInput(val)
    }
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 96) + 'px'
  }, [])

  const handleSubmit = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return

    setError(null)

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
    }
    const assistantId = crypto.randomUUID()
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      isStreaming: true,
    }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setInput('')
    setIsLoading(true)

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    try {
      const res = await fetch('/api/rules/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Request failed.' }))
        throw new Error(errData.error || `HTTP ${res.status}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response stream.')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const event = JSON.parse(line)
            if (event.type === 'token') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + event.content } : m
                )
              )
            } else if (event.type === 'done') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, isStreaming: false, sources: event.sources }
                    : m
                )
              )
            } else if (event.type === 'error') {
              setError(event.message)
              setMessages((prev) => prev.filter((m) => m.id !== assistantId))
            }
          } catch {
            // skip malformed lines
          }
        }
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId && m.isStreaming ? { ...m, isStreaming: false } : m))
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.'
      setError(message)
      setMessages((prev) => prev.filter((m) => m.id !== assistantId))
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const selectSuggestion = (q: string) => {
    setInput(q)
    textareaRef.current?.focus()
  }

  // Loading state
  if (!rulebookChecked) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-5 h-5 border-2 border-accent-orange/30 border-t-accent-orange rounded-full animate-spin" />
      </div>
    )
  }

  // No active rulebook
  if (!activeRulebook) {
    return (
      <div className="bg-bg-card border border-border-default rounded-lg p-4 min-h-[300px] flex items-center justify-center">
        <p className="text-text-muted text-sm text-center">
          The rules assistant is not yet configured. Upload and activate a rulebook above.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-0">
      {/* Active rulebook badge */}
      <div className="mb-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] bg-bg-elevated border border-border-subtle rounded-full px-3 py-1 text-text-muted">
          <BookIcon className="w-3 h-3" />
          Answering from: <span className="text-text-primary font-medium">{activeRulebook.title}</span>
          {activeRulebook.version_label && (
            <span className="text-text-muted">{activeRulebook.version_label}</span>
          )}
        </span>
      </div>

      {/* Messages area */}
      <div className="bg-bg-card border border-border-default rounded-lg p-3 mb-3 min-h-[300px] max-h-[450px] overflow-y-auto">
        {messages.length === 0 ? (
          <div className="h-full min-h-[280px] flex flex-col items-center justify-center gap-4">
            <ChatIcon className="w-8 h-8 text-text-muted/30" />
            <p className="text-text-muted text-xs text-center">
              Ask a question about the series rulebook
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => selectSuggestion(q)}
                  className="text-[11px] bg-bg-elevated border border-border-subtle hover:border-accent-orange/30 text-text-secondary hover:text-text-primary rounded-full px-3 py-1.5 transition-colors text-left cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-accent-orange-dim border border-accent-orange/30 text-text-primary'
                      : 'bg-bg-elevated border border-border-subtle text-text-secondary'
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">
                    {msg.content}
                    {msg.isStreaming && <StreamingDots />}
                  </div>
                  {msg.sources && msg.sources.length > 0 && (
                    <SourcesPanel sources={msg.sources} />
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-status-red text-xs mb-2">
          <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      {/* Input area */}
      <div className="flex gap-2 items-end">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask about the rules..."
            rows={1}
            disabled={isLoading}
            className="w-full bg-bg-elevated border border-border-subtle rounded px-3 py-2.5 text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:border-accent-orange resize-none disabled:opacity-50"
            style={{ maxHeight: '96px' }}
          />
          <span
            className={`absolute right-2 bottom-1 text-[10px] ${
              input.length > MAX_CHARS * 0.9 ? 'text-accent-orange' : 'text-text-muted/30'
            }`}
          >
            {MAX_CHARS - input.length}
          </span>
        </div>
        <button
          onClick={handleSubmit}
          disabled={isLoading || !input.trim()}
          className="bg-accent-orange hover:bg-accent-amber text-white p-2.5 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 cursor-pointer"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <SendIcon className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Disclaimer */}
      <p className="text-[10px] text-text-muted/50 mt-2 leading-snug">
        Answers are informational only. Consult the official rulebook and authorized officials
        for binding interpretations.
      </p>
    </div>
  )
}
