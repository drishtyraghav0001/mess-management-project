import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BarChart3, CreditCard, Eye, EyeOff, LogIn, ShieldCheck, Trash2, UtensilsCrossed } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Input } from '../components/Form'
import { Alert, Spinner } from '../components/ui'

const FEATURES = [
  { icon: CreditCard, title: 'Payments via stored procedure', text: 'ADD_MESS_PAYMENT, TOTAL_PAID and an audit trigger on every status change.' },
  { icon: Trash2, title: 'Trigger-validated wastage', text: 'CHECK_FOOD_WASTAGE blocks wastage above the planned quantity.' },
  { icon: BarChart3, title: 'Reports & dashboards', text: 'Attendance, payments, complaints and wastage analytics.' },
  { icon: ShieldCheck, title: 'Role-based access', text: 'Admin, staff and student roles enforced by the API.' },
]

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ username: '', password: '' })
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [show, setShow] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!form.username.trim()) errs.username = 'Username is required'
    if (!form.password) errs.password = 'Password is required'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    setError('')
    try {
      await login(form.username.trim(), form.password)
      navigate(location.state?.from || '/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-side">
        <div className="row" style={{ gap: 10 }}>
          <div className="brand-mark"><UtensilsCrossed size={18} /></div>
          <div>
            <div className="brand-name">Mess Manager</div>
            <div className="brand-sub">Hostel Mess Management System</div>
          </div>
        </div>
        <div>
          <h2>Run your hostel mess on a real Oracle database.</h2>
          <p>Students, menus, attendance, payments, complaints and food wastage in one place.</p>
          <div className="login-feats">
            {FEATURES.map((f) => (
              <div className="login-feat" key={f.title}>
                <div className="ico"><f.icon /></div>
                <div>
                  <b>{f.title}</b>
                  <span>{f.text}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="small" style={{ color: '#818cf8' }}>FastAPI · python-oracledb · React</div>
      </div>
      <div className="login-main">
        <form className="login-card stack" onSubmit={submit} noValidate>
          <div>
            <h1>Welcome back</h1>
            <p className="muted" style={{ marginTop: 4 }}>Sign in with your mess account.</p>
          </div>
          {error && <Alert type="error">{error}</Alert>}
          <Input label="Username" autoFocus autoComplete="username" value={form.username} error={errors.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="e.g. admin" />
          <div style={{ position: 'relative' }}>
            <Input label="Password" type={show ? 'text' : 'password'} autoComplete="current-password" value={form.password}
              error={errors.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
            <button type="button" className="icon-btn" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}
              style={{ position: 'absolute', right: 4, top: 26, border: 0 }}>
              {show ? <EyeOff /> : <Eye />}
            </button>
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%', height: 42 }}>
            {busy ? <Spinner small /> : <LogIn />} Sign in
          </button>
          <p className="small muted">
            Accounts are created by the admin with <code>python create_user.py</code> in the backend folder.
          </p>
        </form>
      </div>
    </div>
  )
}
