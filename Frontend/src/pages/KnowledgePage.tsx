import { useEffect, useRef, useState, type FormEvent } from 'react'
import { FileText, Heart, Lock, Sparkles } from 'lucide-react'
import { ApiError } from '../api/client'
import { streamKnowledgeQuery } from '../api/knowledge'
import { useAuth } from '../auth/AuthContext'
import { MarkdownText } from '../components/MarkdownText'
import { useChatAutoScroll } from '../hooks/useChatAutoScroll'
import { useTypewriterReveal } from '../hooks/useTypewriterReveal'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

let preservedKnowledgeMessages: ChatMessage[] = []

const SUGGESTED_QUESTIONS = [
  {
    question: 'What is the latest hypertension guideline?',
    icon: Heart,
  },
  {
    question: 'What is first-line treatment for type 2 diabetes?',
    icon: Sparkles,
  },
  {
    question: 'Summarize medication reconciliation SOP steps.',
    icon: FileText,
  },
]

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function KnowledgePage() {
  const { token } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>(
    () => preservedKnowledgeMessages,
  )
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const typewriter = useTypewriterReveal(12)
  const { containerRef, bottomRef, handleScroll, pinToBottom } = useChatAutoScroll([
    messages,
    streaming,
  ])

  useEffect(() => {
    preservedKnowledgeMessages = messages
  }, [messages])

  const askQuestion = async (question: string) => {
    if (!token || streaming) return
    const trimmed = question.trim()
    if (!trimmed) return

    setError('')
    setInput('')
    pinToBottom()

    const history = messages
      .filter((msg) => msg.content.trim().length > 0)
      .slice(-10)
      .map((msg) => ({ role: msg.role, content: msg.content }))

    const assistantId = createId()
    setMessages((prev) => [
      ...prev,
      { id: createId(), role: 'user', content: trimmed },
      { id: assistantId, role: 'assistant', content: '' },
    ])
    setStreaming(true)

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    typewriter.start(assistantId, (messageId, visibleText) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, content: visibleText } : msg,
        ),
      )
    })

    try {
      await streamKnowledgeQuery({
        token,
        question: trimmed,
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
      setError(err instanceof ApiError ? err.message : 'Failed to query knowledge base.')
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId && !msg.content
            ? {
                ...msg,
                content: 'Sorry, I could not generate an answer right now. Please try again.',
              }
            : msg,
        ),
      )
    } finally {
      if (abortRef.current === controller) setStreaming(false)
    }
  }

  const handleAskSubmit = (event: FormEvent) => {
    event.preventDefault()
    void askQuestion(input)
  }

  return (
    <div className="flex h-[calc(100vh-4.5rem)] flex-col gap-3 overflow-hidden">
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">
            Knowledge Assistant
          </h2>
          <p className="text-sm text-slate-500">
            Ask clinical guideline and SOP questions with conversational follow-ups.
          </p>
        </div>
      </div>

      {error ? (
        <div className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="shrink-0 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 px-5 py-5 text-white">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <Sparkles className="h-5 w-5 text-violet-300" />
              Ask for Assistance
            </h3>
            <p className="mt-1 text-sm text-slate-300">
              Get instant answers from your clinical guidelines, SOPs and policies.
            </p>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {SUGGESTED_QUESTIONS.map(({ question, icon: Icon }) => (
              <button
                key={question}
                type="button"
                disabled={streaming}
                onClick={() => void askQuestion(question)}
                className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-left text-xs font-medium text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-300" />
                <span>{question}</span>
              </button>
            ))}
          </div>
        </div>

        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
        >
          {messages.length === 0 ? (
            <div className="flex h-full min-h-[140px] flex-col items-center justify-center gap-2 px-4 text-center text-sm text-slate-500">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-50 text-violet-600">
                <Sparkles className="h-5 w-5" />
              </div>
              Ask anything about your guidelines or SOPs.
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={[
                  'rounded-2xl px-4 py-3 text-sm leading-6',
                  message.role === 'user'
                    ? 'ml-auto w-fit max-w-[75%] bg-teal-600 text-white whitespace-pre-wrap'
                    : 'mr-auto w-fit max-w-[75%] border border-teal-100 bg-teal-50 text-teal-950',
                ].join(' ')}
              >
                <MarkdownText content={message.content || (streaming ? '…' : '')} />
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleAskSubmit} className="shrink-0 border-t border-slate-200 p-3">
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Sparkles className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-violet-500" />
              <input
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                disabled={streaming}
                placeholder="Ask a guideline or SOP question…"
                className="w-full rounded-xl border border-slate-200 py-2.5 pr-3.5 pl-9 text-sm outline-none ring-violet-500/20 transition focus:border-violet-500 focus:ring-4 disabled:bg-slate-50"
              />
            </div>
            <button
              type="submit"
              disabled={streaming || !input.trim()}
              className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:from-violet-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {streaming ? '…' : 'Ask →'}
            </button>
          </div>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <Lock className="h-3 w-3" />
            All answers are generated from your uploaded documents. Always review before use.
          </p>
        </form>
      </section>
    </div>
  )
}
