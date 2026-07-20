import { apiRequest } from './client'
import type { InsightsSummary } from '../types'

type InsightsQuery = {
  startDate?: string | null
  endDate?: string | null
}

const inflight = new Map<string, Promise<InsightsSummary>>()

function cacheKey(query: InsightsQuery) {
  return `${query.startDate ?? ''}|${query.endDate ?? ''}`
}

export function getInsightsSummary(token: string, query: InsightsQuery = {}) {
  const key = cacheKey(query)
  const existing = inflight.get(key)
  if (existing) return existing

  const params = new URLSearchParams()
  if (query.startDate) params.set('start_date', query.startDate)
  if (query.endDate) params.set('end_date', query.endDate)
  const suffix = params.toString() ? `?${params.toString()}` : ''

  const request = apiRequest<InsightsSummary>(`/api/v1/insights/summary${suffix}`, {
    token,
  }).finally(() => {
    inflight.delete(key)
  })

  inflight.set(key, request)
  return request
}
