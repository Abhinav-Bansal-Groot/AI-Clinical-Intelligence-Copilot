import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { listPatients } from '../api/patients'
import { useAuth } from '../auth/AuthContext'
import { PatientIdCopy } from '../components/PatientIdCopy'
import { SearchInput } from '../components/SearchInput'
import type { PatientListItem } from '../types'
import { getPatientName } from '../utils/patient'

const PAGE_SIZE = 10

function riskBadgeClass(risk: string | null) {
  const value = (risk || '').toLowerCase()
  if (value === 'high') return 'bg-red-50 text-red-700 ring-red-200'
  if (value === 'medium') return 'bg-orange-50 text-orange-700 ring-orange-200'
  return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
}

export function PatientsPage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [patients, setPatients] = useState<PatientListItem[]>([])
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '')
  const [debouncedSearch, setDebouncedSearch] = useState(() =>
    (searchParams.get('q') ?? '').trim(),
  )
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const q = searchParams.get('q')
    if (q === null) return
    setSearch(q)
  }, [searchParams])

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
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Patients</h2>
        <p className="text-sm text-slate-500">
          Search and browse patients in alphabetical order.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base font-semibold text-white">All Patients</h3>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search patients…"
            className="w-full sm:w-72"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Patient</th>
                <th className="px-4 py-3 font-medium">Age</th>
                <th className="px-4 py-3 font-medium">Gender</th>
                <th className="px-4 py-3 font-medium">Conditions</th>
                <th className="px-4 py-3 font-medium">Last Visit</th>
                <th className="px-4 py-3 font-medium">Risk</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    Loading patients...
                  </td>
                </tr>
              ) : visiblePatients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    No patients found{debouncedSearch ? ` for "${debouncedSearch}"` : ''}.
                  </td>
                </tr>
              ) : (
                visiblePatients.map((patient) => (
                  <tr
                    key={patient.id}
                    className="border-t border-slate-100 transition hover:bg-teal-50/40"
                  >
                    <td className="px-4 py-3.5">
                      <button
                        type="button"
                        onClick={() => navigate(`/patients/${patient.id}`)}
                        className="cursor-pointer text-left font-medium text-slate-900 hover:text-teal-700 hover:underline"
                      >
                        {getPatientName(patient)}
                      </button>
                      <PatientIdCopy patientId={patient.id} />
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">{patient.age ?? '-'}</td>
                    <td className="px-4 py-3.5 text-slate-700">{patient.gender || '-'}</td>
                    <td className="max-w-xs truncate px-4 py-3.5 text-slate-700">
                      {patient.conditions || '-'}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">{patient.last_visit || '-'}</td>
                    <td className="px-4 py-3.5">
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
          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
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
