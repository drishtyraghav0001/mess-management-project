const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export { MONTHS }

export function formatDate(value, withTime = false) {
  if (!value) return '—'
  const s = String(value)
  const d = new Date(s.length === 10 ? `${s}T00:00:00` : s.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return s
  const opts = { day: '2-digit', month: 'short', year: 'numeric' }
  if (withTime && s.length > 10) Object.assign(opts, { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleString('en-IN', opts)
}

export function formatDateTime(value) {
  return formatDate(value, true)
}

export function weekday(value) {
  if (!value) return ''
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { weekday: 'long' })
}

export function money(value) {
  const n = Number(value || 0)
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

export function num(value, digits = 1) {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  return Number.isInteger(n) ? n.toLocaleString('en-IN') : n.toLocaleString('en-IN', { maximumFractionDigits: digits })
}

// "2026-11" (from <input type="month">) -> "November 2026", the format used in PAYMENT_MONTH
export function monthInputToLabel(value) {
  if (!value) return ''
  const [y, m] = value.split('-')
  return `${MONTHS[Number(m) - 1]} ${y}`
}

export function currentMonthInput() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function todayInput() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
}

export function titleCase(s = '') {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function unique(rows, key) {
  return [...new Set((rows || []).map((r) => r[key]).filter((v) => v !== null && v !== undefined && v !== ''))].sort()
}

export function toCSV(rows, columns) {
  const cols = columns || Object.keys(rows[0] || {}).map((k) => ({ key: k, label: k }))
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [cols.map((c) => esc(c.label)).join(','), ...rows.map((r) => cols.map((c) => esc(r[c.key])).join(','))].join('\n')
}

export function downloadCSV(filename, rows, columns) {
  const blob = new Blob([toCSV(rows, columns)], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}
