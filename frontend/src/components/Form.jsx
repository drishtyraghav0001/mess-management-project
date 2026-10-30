import { createContext, useContext, useEffect, useId, useRef } from 'react'

// Form controls with label, required marker, hint and error message.

// DataTable provides this so every FilterSelect inside its toolbar reports when it is
// active. The table can then explain *which* filters hide the rows and clear them all.
export const FilterRegistry = createContext(null)

// "All categories" -> "category", "Any status" -> "status"
export function filterName(label = '') {
  const s = String(label).replace(/^(all|any)\s+/i, '').trim().toLowerCase()
  if (/ies$/.test(s)) return s.replace(/ies$/, 'y')
  if (/(ses|xes)$/.test(s)) return s.replace(/es$/, '')
  if (/s$/.test(s) && !/(ss|us)$/.test(s)) return s.replace(/s$/, '')
  return s
}
export function Field({ label, required, error, hint, children, full }) {
  return (
    <div className={`field${error ? ' has-error' : ''}${full ? ' full' : ''}`}>
      {label && (
        <label>
          {label}
          {required && <span className="req">*</span>}
        </label>
      )}
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  )
}

export function Input({ label, required, error, hint, full, ...props }) {
  return (
    <Field label={label} required={required} error={error} hint={hint} full={full}>
      <input className="input" aria-invalid={!!error} {...props} />
    </Field>
  )
}

export function Select({ label, required, error, hint, full, options = [], placeholder, ...props }) {
  return (
    <Field label={label} required={required} error={error} hint={hint} full={full}>
      <select className="select" aria-invalid={!!error} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => {
          const opt = typeof o === 'object' ? o : { value: o, label: o }
          return (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          )
        })}
      </select>
    </Field>
  )
}

export function Textarea({ label, required, error, hint, full, ...props }) {
  return (
    <Field label={label} required={required} error={error} hint={hint} full={full}>
      <textarea className="textarea" aria-invalid={!!error} {...props} />
    </Field>
  )
}

export function FilterSelect({ value, onChange, options, placeholder, label }) {
  const registry = useContext(FilterRegistry)
  const id = useId()
  const changeRef = useRef(onChange)
  changeRef.current = onChange
  const opts = options.map((o) => (typeof o === 'object' ? o : { value: o, label: o }))
  const active = value !== '' && value !== null && value !== undefined
  const valueLabel = active ? (opts.find((o) => String(o.value) === String(value))?.label ?? String(value)) : ''
  const name = filterName(label || placeholder)
  useEffect(() => {
    if (!registry) return undefined
    registry.set(id, active ? { name, value: valueLabel, clear: () => changeRef.current('') } : null)
    return () => registry.set(id, null)
  }, [registry, id, active, name, valueLabel])
  return (
    <select className={`select${active ? ' is-active' : ''}`} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label || placeholder}>
      <option value="">{placeholder}</option>
      {opts.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}
