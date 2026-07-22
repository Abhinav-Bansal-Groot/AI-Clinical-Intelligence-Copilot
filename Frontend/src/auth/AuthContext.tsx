import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getCurrentUser, login as loginRequest } from '../api/auth'
import { ApiError, AUTH_STORAGE_KEY, setUnauthorizedHandler } from '../api/client'
import type { AuthUser } from '../types'

type AuthState = {
  token: string | null
  user: AuthUser | null
}

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function loadStoredAuth(): AuthState {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return { token: null, user: null }
    const parsed = JSON.parse(raw) as Partial<AuthState>
    return {
      token: parsed.token ?? null,
      user: parsed.user ?? null,
    }
  } catch {
    return { token: null, user: null }
  }
}

function persistAuth(next: AuthState) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next))
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(() => loadStoredAuth())
  const [profileLoaded, setProfileLoaded] = useState(Boolean(auth.user) || !auth.token)

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    setAuth({ token: null, user: null })
    setProfileLoaded(true)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setAuth({ token: null, user: null })
      setProfileLoaded(true)
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  useEffect(() => {
    if (!auth.token || profileLoaded) return

    let cancelled = false

    const loadUser = async () => {
      try {
        const user = await getCurrentUser(auth.token!)
        if (cancelled) return
        const next = { token: auth.token, user }
        persistAuth(next)
        setAuth(next)
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 401) {
          logout()
          return
        }
        // Keep session for non-auth failures; avatar falls back to initials.
      } finally {
        if (!cancelled) setProfileLoaded(true)
      }
    }

    void loadUser()
    return () => {
      cancelled = true
    }
  }, [auth.token, profileLoaded, logout])

  const login = useCallback(async (email: string, password: string) => {
    const data = await loginRequest(email, password)
    let user: AuthUser | null = null
    try {
      user = await getCurrentUser(data.access_token)
    } catch {
      user = null
    }
    const next = { token: data.access_token, user }
    persistAuth(next)
    setAuth(next)
    setProfileLoaded(true)
  }, [])

  const value = useMemo(
    () => ({
      ...auth,
      login,
      logout,
      isAuthenticated: Boolean(auth.token),
    }),
    [auth, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
