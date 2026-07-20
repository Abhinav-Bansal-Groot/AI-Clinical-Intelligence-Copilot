import { apiRequest } from './client'
import type { AuthUser, LoginResponse } from '../types'

export function login(email: string, password: string) {
  return apiRequest<LoginResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: { email, password },
  })
}

export function getCurrentUser(token: string) {
  return apiRequest<AuthUser>('/api/v1/auth/me', {
    method: 'GET',
    token,
  })
}
