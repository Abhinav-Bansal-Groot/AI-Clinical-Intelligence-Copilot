import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  getDashboardCopilotBootstrap,
  streamDashboardCopilot,
  type DashboardCopilotMessage,
} from '../api/dashboardCopilot'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useTypewriterReveal } from '../hooks/useTypewriterReveal'
import { MarkdownText } from './MarkdownText'

type ChatMessage = DashboardCopilotMessage & {
  id: string
}

const FALLBACK_SUGGESTIONS = [
  "Show today's high-risk patients",
  'Which patients missed appointments?',
  'Which patients need more attention?',
  'How many claims are denied?',
]

let preservedDashboardMessages: ChatMessage[] = []
let preservedDashboardSuggestions = FALLBACK_SUGGESTIONS

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function greetingFor(doctorName: string) {
  const hour = new Date().getHours()
  const period = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
  const cleanName = doctorName.replace(/^dr\.?\s+/i, '').trim()
  const displayName = cleanName ? `Dr. ${cleanName}` : 'Doctor'
  return `Good ${period}, ${displayName}. How can I help you today?`
}

export function DashboardCopilot() {
  const { token } = useAuth()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(() => preservedDashboardMessages)
  const [suggestions, setSuggestions] = useState(() => preservedDashboardSuggestions)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const typewriter = useTypewriterReveal(12)

  useEffect(() => {
    preservedDashboardMessages = messages
  }, [messages])

  useEffect(() => {
    preservedDashboardSuggestions = suggestions
  }, [suggestions])

  useEffect(() => {
    if (!open || !token || messages.length > 0) return

    let cancelled = false
    const load = async () => {
      try {
        const data = await getDashboardCopilotBootstrap(token)
        if (cancelled) return
        setSuggestions(data.suggested_queries)
        setMessages((current) =>
          current.length > 0
            ? current
            : [
                {
                  id: createId(),
                  role: 'assistant',
                  content: greetingFor(data.doctor_name),
                },
              ],
        )
      } catch {
        if (!cancelled) {
          setMessages((current) =>
            current.length > 0
              ? current
              : [
                  {
                    id: createId(),
                    role: 'assistant',
                    content: greetingFor(''),
                  },
                ],
          )
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [open, token, messages.length])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages, streaming])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  const sendMessage = async (message: string) => {
    if (!token || streaming) return
    const trimmed = message.trim()
    if (!trimmed) return

    const history = messages
      .filter((item) => item.content.trim())
      .slice(-10)
      .map(({ role, content }) => ({ role, content }))
    const assistantId = createId()

    setInput('')
    setError('')
    setStreaming(true)
    setMessages((current) => [
      ...current,
      { id: createId(), role: 'user', content: trimmed },
      { id: assistantId, role: 'assistant', content: '' },
    ])

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    typewriter.start(assistantId, (messageId, visibleText) => {
      setMessages((current) =>
        current.map((item) =>
          item.id === messageId ? { ...item, content: visibleText } : item,
        ),
      )
    })

    try {
      await streamDashboardCopilot({
        token,
        message: trimmed,
        history,
        signal: controller.signal,
        onToken: (tokenText) => {
          typewriter.push(tokenText)
        },
      })
      await typewriter.finish()
    } catch (err) {
      if (controller.signal.aborted) {
        if (abortRef.current === controller) typewriter.reset()
        return
      }
      typewriter.reset()
      setError(err instanceof ApiError ? err.message : 'AI Copilot is unavailable.')
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantId && !item.content
            ? {
                ...item,
                content: 'Sorry, I could not complete that request. Please try again.',
              }
            : item,
        ),
      )
    } finally {
      if (abortRef.current === controller) setStreaming(false)
    }
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    void sendMessage(input)
  }

  const handleClose = () => {
    abortRef.current?.abort()
    setStreaming(false)
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open AI Copilot"
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-slate-800 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 hover:bg-slate-900 hover:shadow-xl"
      >
        <img
          aria-hidden="true"
          src="/InsightMD-logo/icon.svg"
          alt=""
          className="h-8 w-8 animate-[pulse_1.8s_ease-in-out_infinite] rounded-full bg-white p-0.5"
        />
        AI Copilot
      </button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close AI Copilot"
            onClick={handleClose}
            className="absolute inset-0 bg-slate-950/25 backdrop-blur-[1px]"
          />

          <aside
            role="dialog"
            aria-modal="true"
            aria-label="InsightMD AI Copilot"
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl"
          >
            <header className="flex shrink-0 items-center justify-between bg-slate-800 px-5 py-4 text-white">
              <div className="flex items-center gap-3">
                <img
                  aria-hidden="true"
                  src="/InsightMD-logo/icon.svg"
                  alt=""
                  className="h-10 w-10 animate-[pulse_1.8s_ease-in-out_infinite] rounded-full bg-white p-0.5"
                />
                <div>
                  <h2 className="font-semibold">InsightMD AI Copilot</h2>
                  <p className="text-xs text-slate-300">Clinical intelligence assistant</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close"
                className="rounded-lg p-2 text-slate-300 transition hover:bg-slate-700 hover:text-white"
              >
                ✕
              </button>
            </header>

            {error ? (
              <div className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
                {error}
              </div>
            ) : null}

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-5">
              {messages.length === 0 ? (
                <p className="text-center text-sm text-slate-500">Starting AI Copilot…</p>
              ) : (
                <>
                  {messages.map((message, index) => (
                    <div key={message.id}>
                      <div
                        className={[
                          'w-fit max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm',
                          message.role === 'user'
                            ? 'ml-auto bg-teal-700 text-white'
                            : 'mr-auto border border-slate-200 bg-white text-slate-800',
                        ].join(' ')}
                      >
                        <MarkdownText content={message.content || (streaming ? '…' : '')} />
                      </div>

                      {index === 0 && message.role === 'assistant' ? (
                        <div className="mt-3 flex flex-col items-end gap-2">
                          {suggestions.map((suggestion) => (
                            <button
                              key={suggestion}
                              type="button"
                              disabled={streaming}
                              onClick={() => void sendMessage(suggestion)}
                              className="w-fit max-w-[90%] rounded-2xl border border-teal-200 bg-white px-3.5 py-2 text-left text-xs font-medium text-teal-800 shadow-sm transition hover:bg-teal-50 disabled:opacity-50"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </>
              )}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={handleSubmit} className="shrink-0 border-t border-slate-200 bg-white p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  disabled={streaming}
                  placeholder="Ask about patients, appointments, claims…"
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none ring-teal-600/20 transition focus:border-teal-600 focus:ring-4 disabled:bg-slate-50"
                />
                <button
                  type="submit"
                  disabled={streaming || !input.trim()}
                  className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {streaming ? '…' : 'Send'}
                </button>
              </div>
              <p className="mt-2 text-center text-[10px] text-slate-400">
                Clinical decision support only. Please Verify before acting.
              </p>
            </form>
          </aside>
        </div>
      ) : null}
    </>
  )
}
