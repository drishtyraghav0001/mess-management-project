// Tiny validation helpers used by the forms. Each rule returns an error
// message or undefined. The backend validates again - this is for fast feedback.
export const rules = {
  required: (label) => (v) => (v === undefined || v === null || String(v).trim() === '' ? `${label} is required` : undefined),
  minLen: (n, label) => (v) => (v && String(v).trim().length < n ? `${label} must be at least ${n} characters` : undefined),
  maxLen: (n, label) => (v) => (v && String(v).length > n ? `${label} can be at most ${n} characters` : undefined),
  email: (v) => (v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? 'Enter a valid email address' : undefined),
  phone: (v) => (v && !/^[0-9+\-() ]{6,15}$/.test(v) ? 'Phone must be 6–15 digits' : undefined),
  number: (label) => (v) => (v !== '' && v !== null && v !== undefined && Number.isNaN(Number(v)) ? `${label} must be a number` : undefined),
  min: (n, label) => (v) => (v !== '' && v !== null && v !== undefined && Number(v) < n ? `${label} must be at least ${n}` : undefined),
  positive: (label) => (v) => (v !== '' && v !== null && v !== undefined && Number(v) <= 0 ? `${label} must be greater than 0` : undefined),
}

export function validate(values, schema) {
  const errors = {}
  for (const [field, fieldRules] of Object.entries(schema)) {
    for (const rule of fieldRules) {
      const msg = rule(values[field], values)
      if (msg) {
        errors[field] = msg
        break
      }
    }
  }
  return errors
}

// Map backend 422 errors ({field, message}) onto form fields
export function serverFieldErrors(err) {
  const out = {}
  for (const e of err?.errors || []) if (e.field) out[e.field] = e.message
  return out
}
