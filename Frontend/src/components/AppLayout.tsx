import { useEffect, useRef, useState } from 'react'
import {
  Bell,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  PanelLeft,
  Settings,
  Users,
  BarChart3,
} from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/patients', label: 'Patients', icon: Users },
  { to: '/copilot', label: 'Patient Copilot', icon: MessageSquareText },
  { to: '/knowledge', label: 'Knowledge Assistant', icon: BookOpen },
  { to: '/insights', label: 'Insights', icon: BarChart3 },
]

const SIDEBAR_KEY = 'cic_sidebar_collapsed'

function getInitials(name: string | undefined, email: string | undefined) {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/)
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'DR'
  }
  if (email) return email.slice(0, 2).toUpperCase()
  return 'DR'
}

export function AppLayout() {
  const { logout, user } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_KEY)
      if (stored === null) return true
      return stored === '1'
    } catch {
      return true
    }
  })
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const userCollapsedRef = useRef(collapsed)

  useEffect(() => {
    userCollapsedRef.current = collapsed
    localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)')
    const syncToViewport = () => {
      if (media.matches) {
        setCollapsed(true)
      } else {
        setCollapsed(userCollapsedRef.current)
      }
    }
    syncToViewport()
    media.addEventListener('change', syncToViewport)
    return () => media.removeEventListener('change', syncToViewport)
  }, [])

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const displayName = user?.full_name || 'Doctor'
  const initials = getInitials(user?.full_name, user?.email)

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      userCollapsedRef.current = next
      return next
    })
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside
        className={[
          'sticky top-0 flex h-screen shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200',
          collapsed ? 'w-[72px]' : 'w-60',
        ].join(' ')}
      >
        <div
          className={[
            'flex items-center border-b border-slate-200 px-3',
            collapsed ? 'h-14 justify-center' : 'h-20 justify-between gap-2',
          ].join(' ')}
        >
          {collapsed ? (
            <img src="/InsightMD-logo/icon.svg" alt="InsightMD" className="h-8 w-8" />
          ) : (
            <img
              src="/InsightMD-logo/logo_full.svg"
              alt="InsightMD"
              className="h-16 w-auto max-w-[170px]"
            />
          )}
          {!collapsed ? (
            <button
              type="button"
              onClick={() => {
                userCollapsedRef.current = true
                setCollapsed(true)
              }}
              className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  [
                    'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                    collapsed ? 'justify-center px-2' : '',
                    isActive
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-teal-50 hover:text-teal-800',
                  ].join(' ')
                }
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed ? <span className="truncate">{item.label}</span> : null}
              </NavLink>
            )
          })}
        </nav>

        <div className="border-t border-slate-200 p-2">
          <button
            type="button"
            onClick={toggleCollapsed}
            className={[
              'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100',
              collapsed ? 'justify-center px-2' : '',
            ].join(' ')}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <>
                <PanelLeft className="h-5 w-5" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-end gap-1 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:gap-2 sm:px-5">
          <button
            type="button"
            className="relative cursor-pointer rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            aria-label="Notifications"
            title="Notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-teal-500" />
          </button>

          <div className="relative ml-1" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-teal-600 text-xs font-semibold text-white transition hover:bg-teal-700"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="Account menu"
            >
              {initials}
            </button>

            {menuOpen ? (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
              >
                <div className="border-b border-slate-100 px-3 py-2.5">
                  <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
                  <p className="truncate text-xs text-slate-500">{user?.email || 'Signed in'}</p>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                  onClick={() => {
                    setMenuOpen(false)
                  }}
                >
                  <Settings className="h-4 w-4 text-slate-400" />
                  Settings
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </header>

        <main className="flex-1 px-4 py-4 sm:px-5">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
