import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import { streamKnowledgeQuery, uploadKnowledgePdf } from '../api/knowledge'
import { useAuth } from '../auth/AuthContext'
import { MarkdownText } from '../components/MarkdownText'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

let preservedKnowledgeMessages: ChatMessage[] = []

const SUGGESTED_QUESTIONS = [
  'What is the latest hypertension guideline?',
  'What is first-line treatment for type 2 diabetes?',
  'Summarize medication reconciliation SOP steps.',
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    preservedKnowledgeMessages = messages
  }, [messages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages, streaming])

  const handleUpload = async (event: FormEvent) => {
    event.preventDefault()
    if (!token || !selectedFile || uploading) return

    setUploading(true)
    setError('')
    setUploadStatus('')

    try {
      const result = await uploadKnowledgePdf(token, selectedFile)
      setUploadStatus(
        `Uploaded “${selectedFile.name}” · ${result.indexed_chunks} chunk${result.indexed_chunks === 1 ? '' : 's'} indexed`,
      )
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const askQuestion = async (question: string) => {
    if (!token || streaming) return
    const trimmed = question.trim()
    if (!trimmed) return

    setError('')
    setInput('')

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

    try {
      await streamKnowledgeQuery({
        token,
        question: trimmed,
        history,
        signal: controller.signal,
        onToken: (tokenText) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId ? { ...msg, content: msg.content + tokenText } : msg,
            ),
          )
        },
      })
    } catch (err) {
      if (controller.signal.aborted) return
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
      setStreaming(false)
    }
  }

  const handleAskSubmit = (event: FormEvent) => {
    event.preventDefault()
    void askQuestion(input)
  }

  return (
    <div className="flex h-[calc(100vh-11rem)] flex-col gap-4 overflow-hidden">
      <div className="shrink-0">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Knowledge Assistant
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Ask clinical guideline and SOP questions with conversational follow-ups.
        </p>
      </div>

      {error ? (
        <div className="shrink-0 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-slate-800 px-5 py-3">
          <h3 className="text-lg font-semibold text-white">Upload documents</h3>
          <p className="text-xs text-slate-300">
            Supported format: PDF (clinical guidelines, SOPs, protocols).
          </p>
        </div>
        <form
          onSubmit={handleUpload}
          className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-teal-800 hover:file:bg-teal-100"
          />
          <button
            type="submit"
            disabled={!selectedFile || uploading}
            className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70 sm:shrink-0"
          >
            {uploading ? 'Uploading…' : 'Upload PDF'}
          </button>
        </form>
        {uploadStatus ? (
          <p className="px-4 pb-3 text-sm text-teal-800">{uploadStatus}</p>
        ) : null}
      </section>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="shrink-0 border-b border-slate-200 bg-slate-800 px-5 py-4">
          <h3 className="text-lg font-semibold text-white">Ask the knowledge base</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((question) => (
              <button
                key={question}
                type="button"
                disabled={streaming}
                onClick={() => void askQuestion(question)}
                className="rounded-full border border-slate-500 bg-slate-700 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {question}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {messages.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              Ask something like “What is the latest hypertension guideline?”
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={[
                  'rounded-2xl px-4 py-3 text-sm leading-6',
                  message.role === 'user'
                    ? 'ml-auto w-fit max-w-[75%] bg-teal-700 text-white whitespace-pre-wrap'
                    : 'mr-auto w-fit max-w-[75%] border border-teal-200 bg-teal-50 text-teal-900',
                ].join(' ')}
              >
                <MarkdownText content={message.content || (streaming ? '…' : '')} />
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleAskSubmit} className="shrink-0 border-t border-slate-200 p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={streaming}
              placeholder="Ask a guideline or SOP question…"
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none ring-teal-600/20 transition focus:border-teal-600 focus:ring-4 disabled:bg-slate-50"
            />
            <button
              type="submit"
              disabled={streaming || !input.trim()}
              className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {streaming ? '…' : 'Ask'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
