// Small reusable UI building blocks used on every page.
import { AlertCircle, AlertTriangle, CheckCircle2, FilterX, Inbox, Info, RefreshCw, SearchX } from 'lucide-react'

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="row wrap">{actions}</div>}
    </div>
  )
}

export function Card({ title, subtitle, actions, children, className = '', bodyClass = 'card-body', style }) {
  return (
    <section className={`card ${className}`} style={style}>
      {(title || actions) && (
        <div className="card-head">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  )
}

export function StatCard({ icon: Icon, label, value, sub, tone = 'primary', loading }) {
  return (
    <div className="card stat">
      <div className={`stat-icon tone-${tone}`}>
        <Icon />
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="stat-label">{label}</div>
        {loading ? (
          <div className="skeleton" style={{ height: 28, width: 80, marginTop: 4 }} />
        ) : (
          <div className="stat-value">{value}</div>
        )}
        {sub && !loading && <div className="stat-sub">{sub}</div>}
      </div>
    </div>
  )
}

const TONES = {
  Paid: 'success', Pending: 'warning', Failed: 'danger',
  Open: 'danger', 'In Progress': 'warning', Resolved: 'success',
  Present: 'success', Absent: 'danger',
  High: 'danger', Medium: 'warning', Low: 'info',
  Active: 'success', Inactive: 'neutral',
  Available: 'success', Unavailable: 'neutral',
  admin: 'violet', staff: 'info', student: 'primary',
  Breakfast: 'warning', Lunch: 'success', Dinner: 'primary', Snack: 'violet',
}

export function Badge({ children, tone, plain }) {
  const t = tone || TONES[children] || 'neutral'
  return <span className={`badge ${t}${plain ? ' plain' : ''}`}>{children ?? '—'}</span>
}

export function Spinner({ small }) {
  return <div className={`spinner${small ? ' sm' : ''}`} aria-label="Loading" />
}

export function Loading({ label = 'Loading data from Oracle…' }) {
  return (
    <div className="state">
      <Spinner />
      <span>{label}</span>
    </div>
  )
}

export function EmptyState({ title = 'Nothing here yet', message, icon: Icon = Inbox, action }) {
  return (
    <div className="state">
      <div className="state-icon">
        <Icon size={22} />
      </div>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action}
    </div>
  )
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="state">
      <div className="state-icon" style={{ background: 'var(--danger-50)', color: 'var(--danger)' }}>
        <AlertCircle size={22} />
      </div>
      <h3>Could not load data</h3>
      <p style={{ maxWidth: 480 }}>{error?.message || String(error)}</p>
      {onRetry && (
        <button className="btn btn-secondary btn-sm" onClick={onRetry}>
          <RefreshCw /> Try again
        </button>
      )}
    </div>
  )
}

export function Alert({ type = 'info', title, children }) {
  const Icon = { error: AlertCircle, success: CheckCircle2, warning: AlertTriangle, info: Info }[type]
  return (
    <div className={`alert ${type}`} role={type === 'error' ? 'alert' : undefined}>
      <Icon />
      <div>
        {title && <b>{title}</b>}
        {children}
      </div>
    </div>
  )
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.value} role="tab" aria-selected={value === t.value}
          className={`tab${value === t.value ? ' active' : ''}`} onClick={() => onChange(t.value)}>
          {t.icon && <t.icon />}
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function Progress({ value, max = 100 }) {
  const pct = Math.max(0, Math.min(100, max ? (Number(value) / max) * 100 : 0))
  const cls = pct >= 10 ? ' bad' : pct >= 5 ? ' warn' : ''
  return (
    <div className={`progress${cls}`} title={`${pct.toFixed(1)}%`}>
      <span style={{ width: `${Math.max(pct, 2)}%` }} />
    </div>
  )
}

export function KeyValue({ items }) {
  return (
    <dl className="kv">
      {items.map(([k, v]) => (
        <div key={k} style={{ display: 'contents' }}>
          <dt>{k}</dt>
          <dd>{v === null || v === undefined || v === '' ? '—' : v}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Empty state for filtered lists. Says exactly which search text / filters hide the rows,
 * e.g. No food item matches "rice" in category "Snack", and offers one-click "Clear filters".
 * filters: [{ name, value }]
 */
export function FilteredEmpty({ query, filters = [], noun = 'record', onClear, emptyTitle = 'No records found', emptyMessage }) {
  const q = (query || '').trim()
  if (!q && !filters.length) return <EmptyState title={emptyTitle} message={emptyMessage} />
  const parts = filters.map((f, i) => (
    <span key={f.name + i}>{i === 0 ? (q ? ' in ' : ' with ') : i === filters.length - 1 ? ' and ' : ', '}{f.name} <b>“{f.value}”</b></span>
  ))
  return (
    <div className="state filtered-empty">
      <div className="state-icon tone-warning">{q ? <SearchX size={22} /> : <FilterX size={22} />}</div>
      <h3>No {noun} matches your {q && filters.length ? 'search and filters' : q ? 'search' : filters.length > 1 ? 'filters' : 'filter'}</h3>
      <p style={{ maxWidth: 520 }}>
        No {noun} matches{q && <> <b>“{q}”</b></>}{parts}.
        {filters.length > 0 && ' Try removing a filter, or clear them all.'}
      </p>
      {onClear && <button className="btn btn-secondary btn-sm" onClick={onClear}><FilterX /> Clear {filters.length ? 'filters' : 'search'}</button>}
    </div>
  )
}
