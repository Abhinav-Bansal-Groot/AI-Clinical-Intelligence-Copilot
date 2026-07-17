import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import { getPatient } from '../api/patients'
import { useAuth } from '../auth/AuthContext'
import type { PatientDetail } from '../types'
import { getPatientName } from '../utils/patient'

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-100 py-4 last:border-b-0 sm:grid sm:grid-cols-[180px_1fr] sm:gap-6">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm leading-6 text-slate-900 sm:mt-0">{value}</dd>
    </div>
  )
}

export function PatientProfilePage() {
  const { patientId } = useParams()
  const { token } = useAuth()
  const [patient, setPatient] = useState<PatientDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token || !patientId) return

    let cancelled = false
    const id = Number(patientId)

    if (Number.isNaN(id)) {
      setError('Invalid patient id')
      setLoading(false)
      return
    }

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const data = await getPatient(token, id)
        if (!cancelled) setPatient(data)
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 404) {
          setError('Patient not found')
        } else {
          setError('Failed to load patient profile. Make sure the backend is running.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [token, patientId])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            Patient Profile
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Quick review of patient profile.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500 shadow-sm">
          Loading patient profile…
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {error}
        </div>
      ) : patient ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-2 border-b border-slate-100 pb-4">
            <h3 className="text-xl font-semibold text-slate-900">{getPatientName(patient)}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {patient.gender ? patient.gender : ''}
            </p>
          </div>

          <dl>
            <Field label="Name" value={getPatientName(patient)} />
            <Field label="Age" value={patient.age != null ? String(patient.age) : '—'} />
            <Field label="Conditions" value={patient.conditions || '—'} />
            <Field label="Medications" value={patient.medications || '—'} />
            <Field label="Allergies" value={patient.allergies || '—'} />
            <Field label="Last Visit" value={patient.last_visit || '—'} />
            <Field label="Recent Labs" value={patient.recent_labs || '—'} />
          </dl>

          <div className="mt-6 border-t border-slate-100 pt-5">
            <Link
              to={`/copilot?patientId=${patient.id}`}
              className="inline-flex rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
            >
              Open Patient Copilot
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  )
}
