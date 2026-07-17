import { useState, type MouseEvent } from 'react'

type PatientIdCopyProps = {
  patientId: number
}

export function PatientIdCopy({ patientId }: PatientIdCopyProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (event: MouseEvent) => {
    event.stopPropagation()
    event.preventDefault()

    try {
      await navigator.clipboard.writeText(String(patientId))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = String(patientId)
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <div className="mt-0.5 flex items-center gap-1.5">
      <span className="text-xs text-slate-500">ID: {patientId}</span>
      <button
        type="button"
        onClick={handleCopy}
        title={copied ? 'Copied' : 'Copy patient ID'}
        aria-label={copied ? 'Patient ID copied' : 'Copy patient ID'}
        className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800"
      >
        {copied ? (
          <svg
            viewBox="0 0 20 20"
            aria-hidden="true"
            className="h-3.5 w-3.5 text-emerald-600"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m4 10 3.5 3.5L16 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 20 20"
            aria-hidden="true"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <rect x="6.5" y="6.5" width="9" height="9" rx="1.5" />
            <path d="M13.5 6.5v-2A1.5 1.5 0 0 0 12 3H4.5A1.5 1.5 0 0 0 3 4.5V12a1.5 1.5 0 0 0 1.5 1.5h2" />
          </svg>
        )}
      </button>
    </div>
  )
}
