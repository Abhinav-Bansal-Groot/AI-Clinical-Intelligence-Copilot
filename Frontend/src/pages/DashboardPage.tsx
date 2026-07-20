import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDashboardSummary } from '../api/dashboard'
import { listPatients } from '../api/patients'
import { useAuth } from '../auth/AuthContext'
import { DashboardCopilot } from '../components/DashboardCopilot'
import { PatientIdCopy } from '../components/PatientIdCopy'
import { SearchInput } from '../components/SearchInput'
import type { DashboardSummary, PatientListItem } from '../types'
import { getPatientName } from '../utils/patient'

const APPOINTMENTS_TODAY = 6

function riskBadgeClass(risk: string | null) {
  const value = (risk || '').toLowerCase()
  if (value === 'high') return 'bg-red-50 text-red-700 ring-red-200'
  if (value === 'medium') return 'bg-orange-50 text-orange-700 ring-orange-200'
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
        valueClassName: 'text-blue-700',
      },
      {
        label: 'High Risk Patients',
        value: summary?.high_risk_patients ?? '—',
        hint: 'Needs closer attention',
        valueClassName: 'text-orange-600',
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
        valueClassName: 'text-blue-700',
      },
    ],
    [summary],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">Dashboard</h2>
          <p className="text-sm text-slate-500">Quick overview.</p>
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search patients…"
          className="w-full sm:w-80"
        />
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article
            key={card.label}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-sm font-medium text-slate-500">{card.label}</p>
            <p
              className={`mt-2 text-3xl font-semibold tracking-tight ${card.valueClassName ?? 'text-slate-900'}`}
            >
              {loading && summary === null ? '…' : card.value}
            </p>
            <p className="mt-1.5 text-xs text-slate-500">{card.hint}</p>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-800 px-4 py-3">
          <h3 className="text-base font-semibold text-white">Recent Patients</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[640px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium sm:px-5">Patient</th>
                <th className="px-4 py-3 font-medium sm:px-5">Age</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell sm:px-5">Gender</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell md:px-5">Conditions</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell lg:px-5">Last Visit</th>
                <th className="px-4 py-3 font-medium sm:px-5">Risk</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500 sm:px-5">
                    Loading patients…
                  </td>
                </tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500 sm:px-5">
                    No patients found{debouncedSearch ? ` for “${debouncedSearch}”` : ''}.
                  </td>
                </tr>
              ) : (
                patients.map((patient) => (
                  <tr
                    key={patient.id}
                    className="border-t border-slate-100 transition hover:bg-teal-50/40"
                  >
                    <td className="px-4 py-4 sm:px-5">
                      <button
                        type="button"
                        onClick={() => navigate(`/patients/${patient.id}`)}
                        className="cursor-pointer text-left font-medium text-slate-900 hover:text-teal-700 hover:underline"
                      >
                        {getPatientName(patient)}
                      </button>
                      <PatientIdCopy patientId={patient.id} />
                    </td>
                    <td className="px-4 py-4 text-slate-700 sm:px-5">{patient.age ?? '—'}</td>
                    <td className="hidden px-4 py-4 text-slate-700 sm:table-cell sm:px-5">
                      {patient.gender || '—'}
                    </td>
                    <td className="hidden max-w-xs truncate px-4 py-4 text-slate-700 md:table-cell md:px-5">
                      {patient.conditions || '—'}
                    </td>
                    <td className="hidden px-4 py-4 text-slate-700 lg:table-cell lg:px-5">
                      {patient.last_visit || '—'}
                    </td>
                    <td className="px-4 py-4 sm:px-5">
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
