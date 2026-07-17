import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDashboardSummary } from '../api/dashboard'
import { listPatients } from '../api/patients'
import { useAuth } from '../auth/AuthContext'
import { DashboardCopilot } from '../components/DashboardCopilot'
import { PatientIdCopy } from '../components/PatientIdCopy'
import type { DashboardSummary, PatientListItem } from '../types'
import { getPatientName } from '../utils/patient'

const APPOINTMENTS_TODAY = 6

function riskBadgeClass(risk: string | null) {
  const value = (risk || '').toLowerCase()
  if (value === 'high') return 'bg-rose-50 text-rose-700 ring-rose-200'
  if (value === 'medium') return 'bg-amber-50 text-amber-700 ring-amber-200'
  return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
}

export function DashboardPage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [patients, setPatients] = useState<PatientListItem[]>([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, 300)

    return () => window.clearTimeout(timeoutId)
  }, [search])

  useEffect(() => {
    if (!token) return

    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [summaryData, patientData] = await Promise.all([
          getDashboardSummary(token),
          listPatients({ token, search: debouncedSearch, page: 1, pageSize: 10 }),
        ])

        if (cancelled) return
        setSummary(summaryData)
        setPatients(patientData.items)
      } catch {
        if (!cancelled) {
          setError('Failed to load dashboard data. Make sure the backend is running.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [token, debouncedSearch])

  const cards = useMemo(
    () => [
      {
        label: 'Total Patients',
        value: summary?.total_patients ?? '—',
        hint: 'Total Patients',
        valueClassName: 'text-blue-900',
      },
      {
        label: 'High Risk Patients',
        value: summary?.high_risk_patients ?? '—',
        hint: 'Needs closer attention',
        valueClassName: 'text-rose-600',
      },
      {
        label: 'Appointments Today',
        value: APPOINTMENTS_TODAY,
        hint: 'Appointments Scheduled',
        valueClassName: 'text-emerald-600',
      },
      {
        label: 'Claims Pending',
        value: summary?.claims_pending ?? '—',
        hint: 'Awaiting review',
      },
    ],
    [summary],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h2>
          <p className="mt-1 text-sm text-slate-600">
            Quick overview.
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article
            key={card.label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm font-medium text-slate-500">{card.label}</p>
            <p
              className={`mt-3 text-3xl font-semibold tracking-tight ${card.valueClassName ?? 'text-slate-900'}`}
            >
              {loading && summary === null ? '…' : card.value}
            </p>
            <p className="mt-2 text-xs text-slate-500">{card.hint}</p>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Recent Patients</h3>
          </div>

          <div className="flex w-full gap-2 sm:w-auto">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search patient"
              className="w-full rounded-xl border border-slate-600 bg-slate-900/40 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-400 outline-none ring-teal-400/20 transition focus:border-teal-400 focus:ring-4 sm:w-72"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Patient</th>
                <th className="px-5 py-3 font-medium">Age</th>
                <th className="px-5 py-3 font-medium">Gender</th>
                <th className="px-5 py-3 font-medium">Conditions</th>
                <th className="px-5 py-3 font-medium">Last Visit</th>
                <th className="px-5 py-3 font-medium">Risk</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                    Loading patients…
                  </td>
                </tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                    No patients found{debouncedSearch ? ` for “${debouncedSearch}”` : ''}.
                  </td>
                </tr>
              ) : (
                patients.map((patient) => (
                  <tr
                    key={patient.id}
                    onClick={() => navigate(`/patients/${patient.id}`)}
                    className="cursor-pointer border-t border-slate-100 transition hover:bg-teal-50/40"
                  >
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-900">{getPatientName(patient)}</p>
                      <PatientIdCopy patientId={patient.id} />
                    </td>
                    <td className="px-5 py-4 text-slate-700">{patient.age ?? '—'}</td>
                    <td className="px-5 py-4 text-slate-700">{patient.gender || '—'}</td>
                    <td className="max-w-xs truncate px-5 py-4 text-slate-700">
                      {patient.conditions || '—'}
                    </td>
                    <td className="px-5 py-4 text-slate-700">{patient.last_visit || '—'}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${riskBadgeClass(patient.risk_level)}`}
                      >
                        {patient.risk_level || 'Unknown'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <DashboardCopilot />
    </div>
  )
}
