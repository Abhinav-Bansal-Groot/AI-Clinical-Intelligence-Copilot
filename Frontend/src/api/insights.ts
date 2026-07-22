import { apiRequest } from './client'
import type {
  ClaimDenialsSummary,
  HighRiskPatientsSummary,
  NoShowTrendPoint,
  RevenueTrendPoint,
} from '../types'

type InsightsQuery = {
  startDate?: string | null
  endDate?: string | null
}

const inflight = new Map<string, Promise<unknown>>()

function cacheKey(path: string, query: InsightsQuery) {
  return `${path}|${query.startDate ?? ''}|${query.endDate ?? ''}`
}

function buildSuffix(query: InsightsQuery) {
  const params = new URLSearchParams()
  if (query.startDate) params.set('start_date', query.startDate)
  if (query.endDate) params.set('end_date', query.endDate)
  return params.toString() ? `?${params.toString()}` : ''
}

function fetchInsightsSection<T>(path: string, token: string, query: InsightsQuery = {}) {
  const key = cacheKey(path, query)
  const existing = inflight.get(key)
  if (existing) return existing as Promise<T>

  const request = apiRequest<T>(`/api/v1/insights/${path}${buildSuffix(query)}`, {
    token,
  }).finally(() => {
    inflight.delete(key)
  })

  inflight.set(key, request)
  return request
}

export function getRevenueTrend(token: string, query: InsightsQuery = {}) {
  return fetchInsightsSection<RevenueTrendPoint[]>('revenue-trend', token, query)
}

export function getNoShowTrend(token: string, query: InsightsQuery = {}) {
  return fetchInsightsSection<NoShowTrendPoint[]>('no-show-trend', token, query)
}

export function getClaimDenials(token: string, query: InsightsQuery = {}) {
  return fetchInsightsSection<ClaimDenialsSummary>('claim-denials', token, query)
}

export function getHighRiskPatients(token: string, query: InsightsQuery = {}) {
  return fetchInsightsSection<HighRiskPatientsSummary>('high-risk-patients', token, query)
}
