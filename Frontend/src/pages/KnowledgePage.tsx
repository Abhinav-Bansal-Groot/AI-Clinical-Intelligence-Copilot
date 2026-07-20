import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import {
  CheckCircle2,
  CloudUpload,
  FileText,
  Heart,
  Lock,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import { ApiError } from '../api/client'
import { streamKnowledgeQuery, uploadKnowledgePdf } from '../api/knowledge'
import { useAuth } from '../auth/AuthContext'
import { MarkdownText } from '../components/MarkdownText'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

type UploadedFileInfo = {
  name: string
  sizeLabel: string
  progress: number
  done: boolean
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

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
  const [uploadInfo, setUploadInfo] = useState<UploadedFileInfo | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    preservedKnowledgeMessages = messages
  }, [messages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages, streaming])

  const clearSelectedFile = () => {
    setSelectedFile(null)
    setUploadInfo(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const pickFile = (file: File | null) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF uploads are supported.')
      return
    }
    setError('')
    setSelectedFile(file)
    setUploadInfo(null)
  }

  const handleUpload = async (event?: FormEvent) => {
    event?.preventDefault()
    if (!token || !selectedFile || uploading) return

    setUploading(true)
    setError('')
    setUploadInfo({
      name: selectedFile.name,
      sizeLabel: formatFileSize(selectedFile.size),
      progress: 35,
      done: false,
    })

    try {
      const result = await uploadKnowledgePdf(token, selectedFile)
      setUploadInfo({
        name: selectedFile.name,
        sizeLabel: `${formatFileSize(selectedFile.size)} · ${result.indexed_chunks} chunks`,
        progress: 100,
        done: true,
      })
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setUploadInfo(null)
      setError(err instanceof ApiError ? err.message : 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragOver(false)
    pickFile(event.dataTransfer.files?.[0] ?? null)
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
    <div className="flex h-[calc(100vh-4.5rem)] flex-col gap-3 overflow-hidden">
      <div className="shrink-0">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">
          Knowledge Assistant
        </h2>
        <p className="text-sm text-slate-500">
          Ask clinical guideline and SOP questions with conversational follow-ups.
        </p>
      </div>

      {error ? (
        <div className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="shrink-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
            <CloudUpload className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">Upload Documents</h3>
            <p className="text-xs text-slate-500">
              Supported format: PDF (clinical guidelines, SOPs, protocols)
            </p>
          </div>
        </div>

        <form onSubmit={handleUpload} className="space-y-3">
          <div
            onDragOver={(event) => {
              event.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={[
              'flex flex-col items-stretch gap-3 rounded-xl border-2 border-dashed px-4 py-4 transition sm:flex-row sm:items-center sm:justify-between',
              dragOver
                ? 'border-teal-500 bg-teal-50/60'
                : 'border-slate-200 bg-slate-50/60',
            ].join(' ')}
          >
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <CloudUpload className="h-5 w-5 text-teal-600" />
              {selectedFile ? (
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1.5 font-medium text-teal-900">
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{selectedFile.name}</span>
                  <button
                    type="button"
                    onClick={clearSelectedFile}
                    disabled={uploading}
                    className="ml-0.5 rounded-md p-0.5 text-teal-700 transition hover:bg-teal-100 hover:text-teal-950 disabled:opacity-50"
                    aria-label="Remove selected PDF"
                    title="Remove selected PDF"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ) : (
                <span className="font-medium">Drag & drop your PDF here</span>
              )}
              <span className="text-slate-400">or</span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-teal-600 bg-white px-3 py-1.5 text-sm font-semibold text-teal-700 transition hover:bg-teal-50"
              >
                Choose File
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
              />
            </div>

            <button
              type="submit"
              disabled={!selectedFile || uploading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60 sm:shrink-0"
            >
              <Upload className="h-4 w-4" />
              {uploading ? 'Uploading…' : 'Upload PDF'}
            </button>
          </div>

          {uploadInfo ? (
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {uploadInfo.name}
                    </p>
                    <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                      {uploadInfo.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                      {uploadInfo.progress}%
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">{uploadInfo.sizeLabel}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-teal-500 transition-all"
                      style={{ width: `${uploadInfo.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </form>
      </section>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="shrink-0 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 px-5 py-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <Sparkles className="h-5 w-5 text-violet-300" />
                Ask for Assistance
              </h3>
              <p className="mt-1 text-sm text-slate-300">
                Get instant answers from your clinical guidelines, SOPs, and protocols.
              </p>
            </div>
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

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <div className="flex h-full min-h-[140px] flex-col items-center justify-center gap-2 px-4 text-center text-sm text-slate-500">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-50 text-violet-600">
                <Sparkles className="h-5 w-5" />
              </div>
              Ask anything about your guidelines or SOPs. Our AI will find answers from your
              uploaded documents.
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
