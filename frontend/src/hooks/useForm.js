import { useState } from 'react'
import { serverFieldErrors, validate } from '../utils/validate'

/**
 * Form state helper: values, field errors, a general error and a submit
 * wrapper that validates, calls the API and maps server errors to fields.
 */
export function useForm(initial, schema = {}) {
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const set = (field) => (e) => {
    const v = e && e.target ? e.target.value : e
    setValues((s) => ({ ...s, [field]: v }))
    if (errors[field]) setErrors((x) => ({ ...x, [field]: undefined }))
  }

  const reset = (next = initial) => {
    setValues(next)
    setErrors({})
    setError(null)
  }

  const submit = (fn) => async (e) => {
    e?.preventDefault()
    const errs = validate(values, schema)
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    setError(null)
    try {
      await fn(values)
    } catch (err) {
      setErrors(serverFieldErrors(err))
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return { values, setValues, set, errors, error, setError, busy, reset, submit }
}

// Remove empty strings so optional columns are sent as NULL / omitted.
export function clean(values, { keepEmpty = false } = {}) {
  const out = {}
  for (const [k, v] of Object.entries(values)) {
    if (v === '' || v === undefined) {
      if (keepEmpty) out[k] = null
      continue
    }
    out[k] = v
  }
  return out
}
