import { apiRequest } from './client'
import type { DashboardSummary } from '../types'

export function getDashboardSummary(token: string) {
  return apiRequest<DashboardSummary>('/api/v1/dashboard/summary', { token })
}
