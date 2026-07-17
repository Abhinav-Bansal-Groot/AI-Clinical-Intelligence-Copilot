import { apiRequest } from './client'
import type { LoginResponse } from '../types'

export function login(email: string, password: string) {
  return apiRequest<LoginResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: { email, password },
  })
}
