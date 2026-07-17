import { apiRequest } from './client'
import type { PatientDetail, PatientListResponse } from '../types'

type ListPatientsParams = {
  token: string
  search?: string
  page?: number
  pageSize?: number
}

export function listPatients({ token, search, page = 1, pageSize = 10 }: ListPatientsParams) {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  })

  if (search?.trim()) {
    params.set('search', search.trim())
  }

  return apiRequest<PatientListResponse>(`/api/v1/patients?${params.toString()}`, { token })
}

export function getPatient(token: string, patientId: number) {
  return apiRequest<PatientDetail>(`/api/v1/patients/${patientId}`, { token })
}
