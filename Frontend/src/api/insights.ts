import { apiRequest } from './client'
import type { InsightsSummary } from '../types'

export function getInsightsSummary(token: string) {
  return apiRequest<InsightsSummary>('/api/v1/insights/summary', { token })
}
