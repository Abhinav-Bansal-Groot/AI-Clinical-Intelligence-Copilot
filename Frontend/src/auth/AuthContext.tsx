import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { login as loginRequest } from '../api/auth'

type AuthState = {
  token: string | null
}

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
}

const STORAGE_KEY = 'cic_auth'

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function loadStoredAuth(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { token: null }
    const parsed = JSON.parse(raw) as AuthState
    return { token: parsed.token ?? null }
  } catch {
    return { token: null }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(() => loadStoredAuth())

  const login = useCallback(async (email: string, password: string) => {
    const data = await loginRequest(email, password)
    const next = { token: data.access_token }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setAuth(next)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setAuth({ token: null })
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
