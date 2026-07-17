import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getInsightsSummary } from '../api/insights'
import { useAuth } from '../auth/AuthContext'
import type { InsightsSummary } from '../types'

const DENIAL_COLORS = {
  approved: '#0d9488',
  pending: '#f59e0b',
  denied: '#e11d48',
}

const RISK_COLORS: Record<string, string> = {
  high: '#e11d48',
  medium: '#f59e0b',
  low: '#059669',
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatShortDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function InsightsPage() {
  const { token } = useAuth()
  const [summary, setSummary] = useState<InsightsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return

    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const data = await getInsightsSummary(token)
        if (!cancelled) setSummary(data)
      } catch {
        if (!cancelled) {
          setError('Failed to load insights. Make sure the backend is running.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [token])

  const revenueData = useMemo(
    () =>
      (summary?.revenue_trend ?? []).map((point) => ({
        date: point.date,
        label: formatShortDate(point.date),
        amount: Number(point.amount),
      })),
    [summary],
  )

  const denialData = useMemo(() => {
    if (!summary) return []
    const { approved, pending, denied } = summary.claim_denials
    return [
      { name: 'Approved', key: 'approved', value: approved },
      { name: 'Pending', key: 'pending', value: pending },
      { name: 'Denied', key: 'denied', value: denied },
    ]
  }, [summary])

  const riskData = useMemo(() => {
    const levels = summary?.high_risk_patients.by_level ?? []
    const order = ['High', 'Medium', 'Low']
    return [...levels].sort(
      (a, b) => order.indexOf(a.risk_level) - order.indexOf(b.risk_level),
    )
  }, [summary])

  const noShowData = useMemo(
    () =>
      (summary?.no_show_trend ?? []).map((point) => ({
        week: point.week,
        week_start: point.week_start,
        rate: Number(point.rate),
      })),
    [summary],
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Executive Insights
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Revenue, claims, risk, and AI-highlighted trends for leadership review.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {summary ? (
        <section className="rounded-2xl border border-teal-200 bg-teal-50/70 px-5 py-4 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-800">
            AI Insight
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-teal-950">
            <li>
              Claims{' '}
              {summary.ai_insight.claims_change_percent >= 0 ? 'increased' : 'decreased'}{' '}
              <span className="font-semibold">
                {Math.abs(summary.ai_insight.claims_change_percent)}%
              </span>
            </li>
            <li>
              No-shows increased by{' '}
              <span className="font-semibold">
                {summary.ai_insight.no_shows_change_percent}%
              </span>
            </li>
            <li className="font-medium">{summary.ai_insight.recommendation}</li>
          </ul>
        </section>
      ) : loading ? (
        <section className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500 shadow-sm">
          Loading insights…
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-slate-800 px-5 py-3">
            <h3 className="text-lg font-semibold text-white">Revenue Trend</h3>
            <p className="text-xs text-slate-300">Claim amounts by date</p>
          </div>
          <div className="h-64 p-5">
            {loading && !summary ? (
              <p className="flex h-full items-center justify-center text-sm text-slate-500">
                Loading…
              </p>
            ) : revenueData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-slate-500">
                No revenue data yet.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    interval="preserveStartEnd"
                    minTickGap={28}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickFormatter={(value: number) => `$${Math.round(value / 100) * 100}`}
                    width={56}
                  />
                  <Tooltip
                    formatter={(value) => [formatCurrency(Number(value ?? 0)), 'Revenue']}
                    labelFormatter={(_, payload) => {
                      const point = payload?.[0]?.payload as { date?: string } | undefined
                      return point?.date ? formatShortDate(point.date) : ''
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="#0f766e"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>

        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-slate-800 px-5 py-3">
            <h3 className="text-lg font-semibold text-white">No-Show Trend</h3>
            <p className="text-xs text-slate-300">Weekly no-show rate from appointments</p>
          </div>
          <div className="h-64 p-5">
            {loading && !summary ? (
              <p className="flex h-full items-center justify-center text-sm text-slate-500">
                Loading…
              </p>
            ) : noShowData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-slate-500">
                No appointment data yet.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={noShowData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="week" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickFormatter={(value: number) => `${value}%`}
                    width={40}
                    domain={[0, 'auto']}
                  />
                  <Tooltip
                    formatter={(value) => [`${Number(value ?? 0).toFixed(1)}%`, 'No-show rate']}
                    labelFormatter={(_, payload) => {
                      const point = payload?.[0]?.payload as
                        | { week?: string; week_start?: string }
                        | undefined
                      if (!point?.week) return ''
                      return point.week_start
                        ? `${point.week} (${formatShortDate(point.week_start)})`
                        : point.week
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke="#c2410c"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>

        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-slate-800 px-5 py-3">
            <h3 className="text-lg font-semibold text-white">Claim Status</h3>
            <p className="text-xs text-slate-300">Approved vs pending vs denied</p>
          </div>
          <div className="h-64 p-5">
            {loading && !summary ? (
              <p className="flex h-full items-center justify-center text-sm text-slate-500">
                Loading…
              </p>
            ) : denialData.every((item) => item.value === 0) ? (
              <p className="flex h-full items-center justify-center text-sm text-slate-500">
                No claim status data yet.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={denialData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {denialData.map((entry) => (
                      <Cell
                        key={entry.key}
                        fill={DENIAL_COLORS[entry.key as keyof typeof DENIAL_COLORS]}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [Number(value ?? 0), 'Claims']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>

        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-end justify-between gap-3 bg-slate-800 px-5 py-3">
            <div>
              <h3 className="text-lg font-semibold text-white">Patient Risk Level</h3>
              <p className="text-xs text-slate-300">Distribution by risk level</p>
            </div>
            {summary ? (
              <p className="text-sm font-semibold text-rose-300">
                {summary.high_risk_patients.total} high risk
              </p>
            ) : null}
          </div>
          <div className="h-64 p-5">
            {loading && !summary ? (
              <p className="flex h-full items-center justify-center text-sm text-slate-500">
                Loading…
              </p>
            ) : riskData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-slate-500">
                No patient risk data yet.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={riskData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="risk_level" tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 11 }} width={32} />
                  <Tooltip formatter={(value) => [Number(value ?? 0), 'Patients']} />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                    {riskData.map((entry) => (
                      <Cell
                        key={entry.risk_level}
                        fill={RISK_COLORS[entry.risk_level.toLowerCase()] ?? '#64748b'}
                      />
                    ))}
                    <LabelList
                      dataKey="count"
                      position="center"
                      fill="#ffffff"
                      fontSize={14}
                      fontWeight={700}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>
      </section>
    </div>
  )
}
