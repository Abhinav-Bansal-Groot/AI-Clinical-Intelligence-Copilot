import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/patients', label: 'Patients', disabled: false },
  { to: '/copilot', label: 'Patient Copilot', disabled: false },
  { to: '/knowledge', label: 'Knowledge Assistant', disabled: false },
  { to: '/insights', label: 'Insights', disabled: false },
]

export function AppLayout() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <img
            src="/InsightMD-logo/logo_full.svg"
            alt="InsightMD"
            className="h-16 w-auto"
          />

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-900"
            >
              Logout
            </button>
          </div>
        </div>

        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-3 sm:px-6">
          {navItems.map((item) =>
            item.disabled ? (
              <span
                key={item.label}
                className="cursor-not-allowed rounded-lg px-3 py-2 text-sm text-slate-400"
                title="Coming next"
              >
                {item.label}
              </span>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  [
                    'rounded-lg px-3 py-2 text-sm font-medium transition',
                    isActive
                      ? 'bg-teal-50 text-teal-800'
                      : 'text-slate-600 hover:bg-teal-50 hover:text-teal-800',
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            ),
          )}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
