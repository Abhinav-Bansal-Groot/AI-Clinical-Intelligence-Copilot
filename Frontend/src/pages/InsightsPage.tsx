import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  XCircle,
} from 'lucide-react'
import { getInsightsSummary } from '../api/insights'
import { useAuth } from '../auth/AuthContext'
import {
  createPresetRange,
  DateRangeFilter,
  type DateRangeValue,
} from '../components/DateRangeFilter'
import type { InsightsSummary } from '../types'

const DENIAL_COLORS = {
  approved: '#10b981',
  pending: '#f59e0b',
  denied: '#ef4444',
}

const RISK_COLORS: Record<string, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#10b981',
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

function ChartHeader({
  title,
  subtitle,
  range,
  onRangeChange,
}: {
  title: string
  subtitle: string
  range: DateRangeValue
  onRangeChange: (next: DateRangeValue) => void
}) {
  return (
    <div className="flex items-start justify-between gap-3 bg-slate-800 px-4 py-3">
      <div>
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <p className="text-xs text-slate-300">{subtitle}</p>
      </div>
      <DateRangeFilter value={range} onChange={onRangeChange} />
    </div>
  )
}

function useInsightsForRange(token: string | null, range: DateRangeValue) {
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
        const data = await getInsightsSummary(token, {
          startDate: range.startDate,
          endDate: range.endDate,
        })
        if (!cancelled) setSummary(data)
      } catch {
        if (!cancelled) {
          setError('Failed to load insights for this date range.')
          setSummary(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [token, range.preset, range.startDate, range.endDate])

  return { summary, loading, error }
}

export function InsightsPage() {
  const { token } = useAuth()
  const [revenueRange, setRevenueRange] = useState(() => createPresetRange('all'))
  const [noShowRange, setNoShowRange] = useState(() => createPresetRange('all'))
  const [claimsRange, setClaimsRange] = useState(() => createPresetRange('all'))
  const [riskRange, setRiskRange] = useState(() => createPresetRange('all'))

  const revenueQuery = useInsightsForRange(token, revenueRange)
  const noShowQuery = useInsightsForRange(token, noShowRange)
  const claimsQuery = useInsightsForRange(token, claimsRange)
  const riskQuery = useInsightsForRange(token, riskRange)

  const pageError =
    revenueQuery.error || noShowQuery.error || claimsQuery.error || riskQuery.error

  const revenueData = useMemo(
    () =>
      (revenueQuery.summary?.revenue_trend ?? []).map((point) => ({
        date: point.date,
        label: formatShortDate(point.date),
        amount: Number(point.amount),
      })),
    [revenueQuery.summary],
  )

  const totalRevenue = useMemo(
    () => revenueData.reduce((sum, point) => sum + point.amount, 0),
    [revenueData],
  )

  const revenueChange = useMemo(() => {
    if (revenueData.length < 2) return 0
    const first = revenueData[0].amount || 1
    const last = revenueData[revenueData.length - 1].amount
    return ((last - first) / first) * 100
  }, [revenueData])

  const denialData = useMemo(() => {
    if (!claimsQuery.summary) return []
    const { approved, pending, denied } = claimsQuery.summary.claim_denials
    const total = approved + pending + denied || 1
    return [
      {
        name: 'Approved',
        key: 'approved',
        value: approved,
        percent: Math.round((approved / total) * 100),
      },
      {
        name: 'Pending',
        key: 'pending',
        value: pending,
        percent: Math.round((pending / total) * 100),
      },
      {
        name: 'Denied',
        key: 'denied',
        value: denied,
        percent: Math.round((denied / total) * 100),
      },
    ]
  }, [claimsQuery.summary])

  const claimTotal = useMemo(
    () => denialData.reduce((sum, item) => sum + item.value, 0),
    [denialData],
  )

  const riskData = useMemo(() => {
    const levels = riskQuery.summary?.high_risk_patients.by_level ?? []
    const order = ['High', 'Medium', 'Low']
    const sorted = [...levels].sort(
      (a, b) => order.indexOf(a.risk_level) - order.indexOf(b.risk_level),
    )
    const total = sorted.reduce((sum, item) => sum + item.count, 0) || 1
    return sorted.map((item) => ({
      ...item,
      name: item.risk_level,
      value: item.count,
      percent: Math.round((item.count / total) * 100),
      color: RISK_COLORS[item.risk_level.toLowerCase()] ?? '#64748b',
    }))
  }, [riskQuery.summary])

  const riskTotal = useMemo(
    () => riskData.reduce((sum, item) => sum + item.count, 0),
    [riskData],
  )

  const noShowData = useMemo(
    () =>
      (noShowQuery.summary?.no_show_trend ?? []).map((point) => ({
        week: point.week,
        week_start: point.week_start,
        rate: Number(point.rate),
      })),
    [noShowQuery.summary],
  )

  const avgNoShow = useMemo(() => {
    if (noShowData.length === 0) return 0
    return noShowData.reduce((sum, point) => sum + point.rate, 0) / noShowData.length
  }, [noShowData])

  const noShowChange = useMemo(() => {
    if (noShowData.length < 2) return 0
    return noShowData[noShowData.length - 1].rate - noShowData[0].rate
  }, [noShowData])

  const approvedClaims = denialData.find((d) => d.key === 'approved')
  const pendingClaims = denialData.find((d) => d.key === 'pending')
  const deniedClaims = denialData.find((d) => d.key === 'denied')
  const highRisk = riskData.find((d) => d.risk_level.toLowerCase() === 'high')

  const insightSummary = useMemo(() => {
    const metricsParts: string[] = []

    if (revenueData.length > 0) {
      metricsParts.push(
        `Revenue ${formatCurrency(totalRevenue)} (${revenueChange >= 0 ? '+' : ''}${revenueChange.toFixed(1)}%)`,
      )
    }
    if (noShowData.length > 0) {
      metricsParts.push(`No-show avg ${avgNoShow.toFixed(1)}%`)
    }
    if (claimTotal > 0) {
      metricsParts.push(
        `Claims ${approvedClaims?.percent ?? 0}% approved / ${deniedClaims?.percent ?? 0}% denied`,
      )
    }
    if (riskTotal > 0) {
      metricsParts.push(
        `${highRisk?.count ?? 0} high-risk of ${riskTotal.toLocaleString()} patients`,
      )
    }

    const line1 =
      metricsParts.length > 0
        ? metricsParts.join(' · ')
        : 'No chart data available for the selected filters.'

    let line2 = 'Trends look stable — continue monitoring weekly.'
    if ((deniedClaims?.percent ?? 0) >= 15) {
      line2 = 'Focus: review denied claims to reduce revenue leakage.'
    } else if ((pendingClaims?.percent ?? 0) >= 25) {
      line2 = 'Focus: clear pending claims backlog to improve cash flow.'
    } else if (avgNoShow >= 15) {
      line2 = 'Focus: run a reminder campaign to lower no-show rates.'
    } else if ((highRisk?.percent ?? 0) >= 20 || (highRisk?.count ?? 0) >= 10) {
      line2 = 'Focus: prioritize outreach for high-risk patients.'
    }

    return { line1, line2 }
  }, [
    revenueData.length,
    totalRevenue,
    revenueChange,
    noShowData.length,
    avgNoShow,
    claimTotal,
    approvedClaims,
    pendingClaims,
    deniedClaims,
    riskTotal,
    highRisk,
  ])

  const anySummaryLoaded = Boolean(
    revenueQuery.summary ||
      noShowQuery.summary ||
      claimsQuery.summary ||
      riskQuery.summary,
  )

  const allLoading =
    revenueQuery.loading &&
    noShowQuery.loading &&
    claimsQuery.loading &&
    riskQuery.loading

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">
          Executive Insights
        </h2>
        <p className="text-sm text-slate-500">
          Revenue, claims, risk, and AI-highlighted trends for leadership review.
        </p>
      </div>

      {pageError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {pageError}
        </div>
      ) : null}

      {anySummaryLoaded ? (
        <section className="rounded-2xl border border-teal-200 bg-teal-50/70 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold tracking-wide text-teal-800 uppercase">
            AI Insight
          </p>
          <p className="mt-2 text-sm text-teal-950">{insightSummary.line1}</p>
          <p className="mt-1 text-sm font-medium text-teal-900">{insightSummary.line2}</p>
        </section>
      ) : allLoading ? (
        <section className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500 shadow-sm">
          Loading insights…
        </section>
      ) : null}

      <section className="grid gap-3 lg:grid-cols-2">
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <ChartHeader
            title="Revenue Trend"
            subtitle="Claim amounts by date"
            range={revenueRange}
            onRangeChange={setRevenueRange}
          />
          <div className="space-y-3 p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-500">Total Revenue</p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-2xl font-bold text-slate-900">
                    {formatCurrency(totalRevenue)}
                  </p>
                  <span
                    className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
                      revenueChange >= 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}
                  >
                    {revenueChange >= 0 ? (
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowDownRight className="h-3.5 w-3.5" />
                    )}
                    {Math.abs(revenueChange).toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="rounded-xl bg-emerald-50 px-2.5 py-1.5">
                  <p className="flex items-center gap-1 text-[10px] font-medium text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" /> Paid
                  </p>
                  <p className="text-sm font-semibold text-emerald-800">
                    {revenueQuery.summary?.claim_denials.approved ?? 0}
                  </p>
                </div>
                <div className="rounded-xl bg-amber-50 px-2.5 py-1.5">
                  <p className="flex items-center gap-1 text-[10px] font-medium text-amber-700">
                    <Clock3 className="h-3 w-3" /> Pending
                  </p>
                  <p className="text-sm font-semibold text-amber-800">
                    {revenueQuery.summary?.claim_denials.pending ?? 0}
                  </p>
                </div>
                <div className="rounded-xl bg-red-50 px-2.5 py-1.5">
                  <p className="flex items-center gap-1 text-[10px] font-medium text-red-700">
                    <XCircle className="h-3 w-3" /> Denied
                  </p>
                  <p className="text-sm font-semibold text-red-800">
                    {revenueQuery.summary?.claim_denials.denied ?? 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="h-52">
              {revenueQuery.loading ? (
                <p className="flex h-full items-center justify-center text-sm text-slate-500">
                  Loading…
                </p>
              ) : revenueData.length === 0 ? (
                <p className="flex h-full items-center justify-center text-sm text-slate-500">
                  No revenue data for this range.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      interval="preserveStartEnd"
                      minTickGap={28}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      tickFormatter={(value: number) =>
                        value >= 1000 ? `${Math.round(value / 1000)}K` : `${value}`
                      }
                      width={40}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value) => [formatCurrency(Number(value ?? 0)), 'Revenue']}
                      labelFormatter={(_, payload) => {
                        const point = payload?.[0]?.payload as { date?: string } | undefined
                        return point?.date ? formatShortDate(point.date) : ''
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="#2563eb"
                      strokeWidth={2.5}
                      fill="url(#revenueFill)"
                      dot={{ r: 3, fill: '#2563eb', strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                      name="Paid Claims"
                    />
                    <Legend verticalAlign="bottom" height={24} iconType="circle" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </article>

        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <ChartHeader
            title="No-Show Trend"
            subtitle="Weekly no-show rate from appointments"
            range={noShowRange}
            onRangeChange={setNoShowRange}
          />
          <div className="space-y-3 p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-500">Average No-Show Rate</p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-2xl font-bold text-violet-700">{avgNoShow.toFixed(1)}%</p>
                  <span
                    className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
                      noShowChange <= 0 ? 'text-emerald-600' : 'text-orange-600'
                    }`}
                  >
                    {noShowChange <= 0 ? (
                      <ArrowDownRight className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    )}
                    {noShowChange.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="rounded-xl bg-violet-50 px-2.5 py-1.5">
                  <p className="text-[10px] font-medium text-violet-700">Weeks tracked</p>
                  <p className="text-sm font-semibold text-violet-900">{noShowData.length}</p>
                </div>
                <div className="rounded-xl bg-violet-50 px-2.5 py-1.5">
                  <p className="text-[10px] font-medium text-violet-700">Latest rate</p>
                  <p className="text-sm font-semibold text-violet-900">
                    {noShowData.length
                      ? `${noShowData[noShowData.length - 1].rate.toFixed(1)}%`
                      : '—'}
                  </p>
                </div>
              </div>
            </div>

            <div className="h-52">
              {noShowQuery.loading ? (
                <p className="flex h-full items-center justify-center text-sm text-slate-500">
                  Loading…
                </p>
              ) : noShowData.length === 0 ? (
                <p className="flex h-full items-center justify-center text-sm text-slate-500">
                  No appointment data for this range.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={noShowData} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="week"
                      tick={{ fill: '#64748b', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      tickFormatter={(value: number) => `${value}%`}
                      width={40}
                      domain={[0, 'auto']}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value) => [
                        `${Number(value ?? 0).toFixed(1)}%`,
                        'No-show rate',
                      ]}
                    />
                    <ReferenceLine
                      y={avgNoShow}
                      stroke="#8b5cf6"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                    />
                    <Bar dataKey="rate" fill="#c4b5fd" radius={[6, 6, 0, 0]} maxBarSize={36}>
                      <LabelList
                        dataKey="rate"
                        position="top"
                        formatter={(value) => `${Number(value ?? 0).toFixed(0)}%`}
                        style={{ fill: '#6d28d9', fontSize: 10, fontWeight: 600 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </article>

        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <ChartHeader
            title="Claim Status"
            subtitle="Approved vs pending vs denied"
            range={claimsRange}
            onRangeChange={setClaimsRange}
          />
          <div className="p-4">
            {claimsQuery.loading ? (
              <p className="flex h-52 items-center justify-center text-sm text-slate-500">
                Loading…
              </p>
            ) : denialData.every((item) => item.value === 0) ? (
              <p className="flex h-52 items-center justify-center text-sm text-slate-500">
                No claim status data for this range.
              </p>
            ) : (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="h-48 w-full sm:w-1/2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={denialData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={78}
                        paddingAngle={3}
                      >
                        {denialData.map((entry) => (
                          <Cell
                            key={entry.key}
                            fill={DENIAL_COLORS[entry.key as keyof typeof DENIAL_COLORS]}
                          />
                        ))}
                        <LabelList
                          dataKey="percent"
                          position="outside"
                          formatter={(value) => `${value}%`}
                          style={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
                        />
                      </Pie>
                      <Tooltip formatter={(value) => [Number(value ?? 0), 'Claims']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-3">
                  {denialData.map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{
                            background:
                              DENIAL_COLORS[item.key as keyof typeof DENIAL_COLORS],
                          }}
                        />
                        <div>
                          <p className="text-sm font-medium text-slate-800">{item.name}</p>
                          <p className="text-xs text-slate-500">
                            {item.value.toLocaleString()} · {item.percent}%
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
            <span>
              Total Claims:{' '}
              <strong className="text-slate-900">{claimTotal.toLocaleString()}</strong>
            </span>
            <span>
              Approval Rate:{' '}
              <strong className="text-emerald-700">
                {denialData.find((d) => d.key === 'approved')?.percent ?? 0}%
              </strong>
            </span>
          </div>
        </article>

        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <ChartHeader
            title="Patient Risk Level"
            subtitle="Distribution by risk level"
            range={riskRange}
            onRangeChange={setRiskRange}
          />
          <div className="p-4">
            {riskQuery.loading ? (
              <p className="flex h-52 items-center justify-center text-sm text-slate-500">
                Loading…
              </p>
            ) : riskData.length === 0 ? (
              <p className="flex h-52 items-center justify-center text-sm text-slate-500">
                No patient risk data for this range.
              </p>
            ) : (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="h-48 w-full sm:w-1/2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={riskData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={78}
                        paddingAngle={3}
                      >
                        {riskData.map((entry) => (
                          <Cell key={entry.risk_level} fill={entry.color} />
                        ))}
                        <LabelList
                          dataKey="percent"
                          position="outside"
                          formatter={(value) => `${value}%`}
                          style={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
                        />
                      </Pie>
                      <Tooltip formatter={(value) => [Number(value ?? 0), 'Patients']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-3">
                  {riskData.map((item) => (
                    <div key={item.risk_level}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-800">{item.risk_level}</span>
                        <span className="text-xs text-slate-500">
                          {item.count} · {item.percent}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${item.percent}%`,
                            background: item.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-violet-100 bg-violet-50/70 px-4 py-2.5 text-xs text-slate-600">
            <span>
              Total Patients:{' '}
              <strong className="text-slate-900">{riskTotal.toLocaleString()}</strong>
            </span>
          </div>
        </article>
      </section>
    </div>
  )
}
