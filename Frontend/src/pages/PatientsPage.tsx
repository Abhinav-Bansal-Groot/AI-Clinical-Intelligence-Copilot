import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listPatients } from '../api/patients'
import { useAuth } from '../auth/AuthContext'
import { PatientIdCopy } from '../components/PatientIdCopy'
import type { PatientListItem } from '../types'
import { getPatientName } from '../utils/patient'

const PAGE_SIZE = 10

function riskBadgeClass(risk: string | null) {
  const value = (risk || '').toLowerCase()
  if (value === 'high') return 'bg-rose-50 text-rose-700 ring-rose-200'
  if (value === 'medium') return 'bg-amber-50 text-amber-700 ring-amber-200'
  return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
}

export function PatientsPage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [patients, setPatients] = useState<PatientListItem[]>([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
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
        const data = await listPatients({
          token,
          search: debouncedSearch,
          page: 1,
          pageSize: 100,
        })

        if (!cancelled) {
          setPatients(data.items)
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load patients. Make sure the backend is running.')
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

  const sortedPatients = useMemo(
    () =>
      [...patients].sort((a, b) =>
        getPatientName(a).localeCompare(getPatientName(b), undefined, {
          sensitivity: 'base',
        }),
      ),
    [patients],
  )

  const totalPages = Math.max(1, Math.ceil(sortedPatients.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const visiblePatients = sortedPatients.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Patients</h2>
          <p className="mt-1 text-sm text-slate-600">
            Search and browse patients in alphabetical order.
          </p>
        </div>

        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search patient"
          className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none ring-teal-600/20 transition focus:border-teal-600 focus:ring-4 sm:w-80"
        />
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-800 px-5 py-4">
          <h3 className="text-lg font-semibold text-white">All Patients</h3>
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
                    Loading patients...
                  </td>
                </tr>
              ) : visiblePatients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                    No patients found{debouncedSearch ? ` for "${debouncedSearch}"` : ''}.
                  </td>
                </tr>
              ) : (
                visiblePatients.map((patient) => (
                  <tr
                    key={patient.id}
                    onClick={() => navigate(`/patients/${patient.id}`)}
                    className="cursor-pointer border-t border-slate-100 transition hover:bg-teal-50/40"
                  >
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-900">{getPatientName(patient)}</p>
                      <PatientIdCopy patientId={patient.id} />
                    </td>
                    <td className="px-5 py-4 text-slate-700">{patient.age ?? '-'}</td>
                    <td className="px-5 py-4 text-slate-700">{patient.gender || '-'}</td>
                    <td className="max-w-xs truncate px-5 py-4 text-slate-700">
                      {patient.conditions || '-'}
                    </td>
                    <td className="px-5 py-4 text-slate-700">{patient.last_visit || '-'}</td>
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

        {!loading && sortedPatients.length > 0 ? (
          <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}
