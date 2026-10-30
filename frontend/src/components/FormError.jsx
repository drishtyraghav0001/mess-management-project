import { Alert } from './ui'

// Shows a backend error above a form. Oracle trigger / constraint errors are
// displayed with their ORA- code so it is easy to explain in a viva.
export default function FormError({ error, hint }) {
  if (!error) return null
  return (
    <Alert type="error" title={error.oracleCode ? `Oracle rejected this (${error.oracleCode})` : undefined}>
      <div>{error.message}</div>
      {hint && <div className="small" style={{ marginTop: 4 }}>{hint}</div>}
    </Alert>
  )
}
