import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { streamCopilotChat } from '../api/copilot'
import { listPatients, getPatient } from '../api/patients'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { MarkdownText } from '../components/MarkdownText'
import { SearchInput } from '../components/SearchInput'
import { useTypewriterReveal } from '../hooks/useTypewriterReveal'
import type { PatientDetail, PatientListItem } from '../types'
import { getPatientName } from '../utils/patient'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

let preservedCopilotPatientId: string | null = null
let preservedCopilotMessages: ChatMessage[] = []

const SUGGESTED_PROMPTS = [
  'Summarize this patient.',
  'Is this patient high risk?',
  'What care gaps exist?',
  'Generate SOAP Note',
  'Generate Referral Letter',
]

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function riskBadgeClass(risk: string | null) {
  const value = (risk || '').toLowerCase()
  if (value === 'high') return 'bg-red-50 text-red-700 ring-red-200'
  if (value === 'medium') return 'bg-orange-50 text-orange-700 ring-orange-200'
  return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
}

export function CopilotPage() {
  const { token } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const patientIdParam = searchParams.get('patientId')

  const [selectedPatient, setSelectedPatient] = useState<PatientDetail | null>(null)
  const [patientOptions, setPatientOptions] = useState<PatientListItem[]>([])
  const [patientSearch, setPatientSearch] = useState('')
  const [loadingPatient, setLoadingPatient] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(
    () => preservedCopilotMessages,
  )
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')

  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const typewriter = useTypewriterReveal(12)

  useEffect(() => {
    preservedCopilotMessages = messages
  }, [messages])

  useEffect(() => {
    if (!patientIdParam && preservedCopilotPatientId) {
      setSearchParams({ patientId: preservedCopilotPatientId }, { replace: true })
    }
  }, [patientIdParam, setSearchParams])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages, streaming])

  useEffect(() => {
    if (!token || !patientIdParam) {
      setSelectedPatient(null)
      return
    }

    const id = Number(patientIdParam)
    if (Number.isNaN(id)) {
      setError('Invalid patient id')
      return
    }

    let cancelled = false
    const load = async () => {
      setLoadingPatient(true)
      setError('')
      try {
        const patient = await getPatient(token, id)
        if (!cancelled) {
          setSelectedPatient(patient)
          if (preservedCopilotPatientId !== patientIdParam) {
            preservedCopilotPatientId = patientIdParam
            preservedCopilotMessages = []
            setMessages([])
          }
        }
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 404) {
          setError('Patient not found')
        } else {
          setError('Failed to load patient for Patient Copilot.')
        }
      } finally {
        if (!cancelled) setLoadingPatient(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [token, patientIdParam])

  useEffect(() => {
    if (!token || patientIdParam) return

    let cancelled = false
    const load = async () => {
      try {
        const data = await listPatients({
          token,
          search: patientSearch,
          page: 1,
          pageSize: 8,
        })
        if (!cancelled) setPatientOptions(data.items)
      } catch {
        if (!cancelled) setPatientOptions([])
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [token, patientSearch, patientIdParam])

  const selectPatient = (id: number) => {
    preservedCopilotPatientId = String(id)
    preservedCopilotMessages = []
    setSearchParams({ patientId: String(id) })
    setMessages([])
    setError('')
  }

  const sendMessage = async (message: string) => {
    if (!token || !selectedPatient || streaming) return
    const trimmed = message.trim()
    if (!trimmed) return

    setError('')
    setInput('')
    const userMessage: ChatMessage = { id: createId(), role: 'user', content: trimmed }
    const assistantId = createId()
    setMessages((prev) => [
      ...prev,
      userMessage,
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
      await streamCopilotChat({
        token,
        patientId: selectedPatient.id,
        message: trimmed,
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
      const detail =
        err instanceof ApiError ? err.message : 'Failed to generate AI response. Please try again.'
      setError(detail)
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId && !msg.content
            ? { ...msg, content: 'Sorry, I could not generate a response.' }
            : msg,
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

  return (
    <div className="flex h-[calc(100vh-4.5rem)] flex-col gap-3 overflow-hidden">
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">Patient Copilot</h2>
          <p className="text-sm text-slate-500">
            Ask clinical questions, identify care gaps, and generate notes for a selected patient.
          </p>
        </div>
        {selectedPatient ? (
          <Link
            to={`/patients/${selectedPatient.id}`}
            className="text-sm font-medium text-teal-700 hover:text-teal-800"
          >
            View patient profile →
          </Link>
        ) : null}
      </div>

      {error ? (
        <div className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!patientIdParam ? (
        <section className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 bg-slate-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-white">Select a patient</h3>
              <p className="mt-0.5 text-sm text-slate-300">
                Choose a patient to start the AI clinical chat.
              </p>
            </div>
            <SearchInput
              value={patientSearch}
              onChange={setPatientSearch}
              placeholder="Search patients…"
              className="w-full sm:w-72"
            />
          </div>
          <div className="h-[calc(100%-4.5rem)] overflow-y-auto p-4">
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {patientOptions.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-500">No patients found.</p>
              ) : (
                patientOptions.map((patient) => (
                  <div
                    key={patient.id}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => selectPatient(patient.id)}
                        className="cursor-pointer text-left font-medium text-slate-900 hover:text-teal-700 hover:underline"
                      >
                        {getPatientName(patient)}
                      </button>
                      <p className="text-xs text-slate-500">
                        Age {patient.age ?? '—'} · {patient.conditions || 'No conditions listed'}
                      </p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ring-1 ring-inset ${riskBadgeClass(patient.risk_level)}`}
                    >
                      {patient.risk_level || 'Unknown'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      ) : loadingPatient ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500 shadow-sm">
          Loading patient context…
        </div>
      ) : selectedPatient ? (
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="shrink-0 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 px-5 py-5 text-white">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  <Sparkles className="h-5 w-5 text-violet-300" />
                  Chatting about
                </h3>
                <p className="mt-1 text-base font-semibold text-white">
                  {getPatientName(selectedPatient)}
                </p>
                <p className="mt-0.5 text-sm text-slate-300">
                  Age {selectedPatient.age ?? '—'} · {selectedPatient.conditions || 'No conditions'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  abortRef.current?.abort()
                  preservedCopilotPatientId = null
                  preservedCopilotMessages = []
                  setSearchParams({})
                  setMessages([])
                  setSelectedPatient(null)
                }}
                className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/15 sm:shrink-0"
              >
                Change patient
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={streaming}
                  onClick={() => void sendMessage(prompt)}
                  className="w-fit max-w-full rounded-2xl border border-white/10 bg-white/5 px-3.5 py-2 text-left text-xs font-medium text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {prompt}
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
                Ask a question or tap a suggested prompt to begin.
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

          <form onSubmit={handleSubmit} className="shrink-0 border-t border-slate-200 p-3">
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Sparkles className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-violet-500" />
                <input
                  type="text"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  disabled={streaming}
                  placeholder="Ask about this patient…"
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
          </form>
        </section>
      ) : null}
    </div>
  )
}
