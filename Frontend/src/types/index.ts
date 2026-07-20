export type LoginResponse = {
  access_token: string
}

export type AuthUser = {
  id: number
  full_name: string
  email: string
  role: string
}

export type DashboardSummary = {
  total_patients: number
  high_risk_patients: number
  claims_pending: number
}

export type PatientListItem = {
  id: number
  first_name: string | null
  last_name: string | null
  age: number | null
  gender: string | null
  risk_level: string | null
  last_visit: string | null
  conditions: string | null
}

export type PatientListResponse = {
  items: PatientListItem[]
  total: number
  page: number
  page_size: number
}

export type PatientDetail = {
  id: number
  first_name: string | null
  last_name: string | null
  age: number | null
  gender: string | null
  conditions: string | null
  medications: string | null
  allergies: string | null
  last_visit: string | null
  recent_labs: string | null
  risk_level: string | null
  notes: string | null
}

export type KnowledgeUploadResponse = {
  uploaded_documents: number
  indexed_chunks: number
  collection_name: string
}

export type KnowledgeChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type RevenueTrendPoint = {
  date: string
  amount: string | number
}

export type NoShowTrendPoint = {
  week: string
  week_start: string
  rate: number
}

export type ClaimDenialsSummary = {
  approved: number
  pending: number
  denied: number
}

export type RiskLevelCount = {
  risk_level: string
  count: number
}

export type HighRiskPatientsSummary = {
  total: number
  by_level: RiskLevelCount[]
}

export type AiInsight = {
  claims_change_percent: number
  no_shows_change_percent: number
  recommendation: string
}

export type InsightsSummary = {
  revenue_trend: RevenueTrendPoint[]
  no_show_trend: NoShowTrendPoint[]
  claim_denials: ClaimDenialsSummary
  high_risk_patients: HighRiskPatientsSummary
  ai_insight: AiInsight
}
