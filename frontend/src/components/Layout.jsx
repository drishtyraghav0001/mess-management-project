import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BarChart3, CalendarDays, ChevronDown, ClipboardCheck, CreditCard, KeyRound, LayoutDashboard, LogOut,
  Menu as MenuIcon, MessageSquareWarning, Salad, Trash2, User, Users, UtensilsCrossed,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/client'
import { initials } from '../utils/format'
import ChangePasswordModal from './ChangePasswordModal'
import ErrorBoundary from './ErrorBoundary'

// Navigation is role aware. The backend ALSO enforces every role check,
// hiding a link here is only for convenience.
export const NAV = [
  { section: 'Overview' },
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'staff', 'student'], end: true, title: 'Dashboard' },
  { section: 'Mess' },
  { to: '/students', label: 'Students', icon: Users, roles: ['admin', 'staff'] },
  { to: '/menus', label: 'Menus', icon: CalendarDays, roles: ['admin', 'staff', 'student'], studentLabel: 'Mess Menu' },
  { to: '/food-items', label: 'Food Items', icon: Salad, roles: ['admin', 'staff', 'student'] },
  { to: '/attendance', label: 'Attendance', icon: ClipboardCheck, roles: ['admin', 'staff', 'student'], studentLabel: 'My Attendance' },
  { to: '/payments', label: 'Payments', icon: CreditCard, roles: ['admin', 'student'], studentLabel: 'My Payments' },
  { to: '/complaints', label: 'Complaints', icon: MessageSquareWarning, roles: ['admin', 'staff', 'student'], studentLabel: 'My Complaints' },
  { to: '/wastage', label: 'Food Wastage', icon: Trash2, roles: ['admin', 'staff'] },
  { section: 'Insights', roles: ['admin', 'staff'] },
  { to: '/reports', label: 'Reports', icon: BarChart3, roles: ['admin', 'staff'] },
]

const SUBTITLES = {
  '/': 'Overview of the hostel mess',
  '/students': 'STUDENT table',
  '/menus': 'MENU and MENU_ITEM tables',
  '/food-items': 'FOOD_ITEM table',
  '/attendance': 'ATTENDANCE table · MEALS_ATTENDED function',
  '/payments': 'PAYMENT table · ADD_MESS_PAYMENT procedure · PAYMENT_STATUS_AUDIT_TRG',
  '/complaints': 'COMPLAINT table · RESOLVE_COMPLAINT procedure',
  '/wastage': 'WASTAGE table · CHECK_FOOD_WASTAGE trigger',
  '/reports': 'Printable reports with CSV export',
}

function useHealth() {
  const [health, setHealth] = useState(null)
  useEffect(() => {
    let alive = true
    const check = () =>
      api.get('/api/health').then((h) => alive && setHealth(h)).catch((e) => alive && setHealth({ database: 'error', error: e.message }))
    check()
    const id = setInterval(check, 60000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])
  return health
}

function UserMenu({ onChangePassword }) {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])
  const name = user.student_name || user.username
  return (
    <div className="user-menu" ref={ref}>
      <button className="user-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <span className="avatar">{initials(name)}</span>
        <span className="user-meta">
          <b>{name}</b>
          <span>{user.role}</span>
        </span>
        <ChevronDown size={15} className="muted" />
      </button>
      {open && (
        <div className="dropdown" role="menu">
          <div className="dropdown-head">
            <b>{user.username}</b>
            <div className="small muted" style={{ textTransform: 'capitalize' }}>
              {user.role}
              {user.student_id ? ` · Student #${user.student_id}` : ''}
            </div>
          </div>
          <button role="menuitem" onClick={() => { setOpen(false); onChangePassword() }}>
            <KeyRound size={16} /> Change password
          </button>
          <button role="menuitem" className="danger" onClick={logout}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}

export default function Layout() {
  const { user } = useAuth()
  const [navOpen, setNavOpen] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)
  const health = useHealth()
  const location = useLocation()
  useEffect(() => setNavOpen(false), [location.pathname])

  const student = user.role === 'student'
  const items = NAV.filter((n) => !n.roles || n.roles.includes(user.role))
  const current = NAV.find((n) => n.to && (n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to)))
  const title = current ? (student && current.studentLabel) || current.title || current.label : 'Mess Management'
  const dbOk = health?.database === 'connected'

  return (
    <div className="app">
      <aside className={`sidebar${navOpen ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-mark">
            <UtensilsCrossed size={18} />
          </div>
          <div>
            <div className="brand-name">Mess Manager</div>
            <div className="brand-sub">Hostel Mess Management</div>
          </div>
        </div>
        <nav className="nav">
          {items.map((n, i) =>
            n.section ? (
              <div key={i} className="nav-section">{n.section}</div>
            ) : (
              <NavLink key={n.to} to={n.to} end={n.end}>
                <n.icon />
                {(student && n.studentLabel) || n.label}
              </NavLink>
            ),
          )}
        </nav>
        <div className="sidebar-foot">
          <span className="db-pill" title={health?.error || health?.dsn || ''}>
            <span className={`dot ${health ? (dbOk ? 'ok' : 'bad') : ''}`} />
            {health ? (dbOk ? `Oracle connected` : 'Database offline') : 'Checking database…'}
          </span>
          {dbOk && health.oracle_version && <div style={{ marginTop: 4, color: '#6b7280' }}>Oracle {health.oracle_version}</div>}
        </div>
      </aside>
      <div className={`backdrop${navOpen ? ' open' : ''}`} onClick={() => setNavOpen(false)} />
      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setNavOpen(true)} aria-label="Open menu">
            <MenuIcon />
          </button>
          <div className="topbar-title grow">
            <h1>{title}</h1>
            <p>{student && location.pathname === '/' ? 'Your mess summary' : SUBTITLES[current?.to] || ''}</p>
          </div>
          <UserMenu onChangePassword={() => setPwOpen(true)} />
        </header>
        <main className="content">
          {health && !dbOk && (
            <div className="alert error" style={{ marginBottom: 16 }}>
              <User size={18} />
              <div>
                <b>Database not reachable.</b> {health.error || 'Check DB_USER / DB_PASSWORD / DB_DSN in backend/.env and that Oracle is running.'}
              </div>
            </div>
          )}
          <ErrorBoundary resetKey={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  )
}
