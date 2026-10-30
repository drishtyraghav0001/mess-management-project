import { useState } from 'react'
import { api } from '../api/client'
import { useToast } from '../context/ToastContext'
import { Input } from './Form'
import { FormFooter, Modal } from './Modal'
import { Alert } from './ui'

export default function ChangePasswordModal({ open, onClose }) {
  const toast = useToast()
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const close = () => {
    setForm({ current_password: '', new_password: '', confirm: '' })
    setErrors({})
    setError('')
    onClose()
  }

  const submit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!form.current_password) errs.current_password = 'Current password is required'
    if (form.new_password.length < 6) errs.new_password = 'New password must be at least 6 characters'
    if (form.confirm !== form.new_password) errs.confirm = 'Passwords do not match'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    setError('')
    try {
      await api.post('/api/auth/change-password', { current_password: form.current_password, new_password: form.new_password })
      toast.success('Your password has been changed.')
      close()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} title="Change password" subtitle="Passwords are stored as bcrypt hashes in APP_USERS" onClose={close} size="sm"
      footer={<FormFooter onCancel={close} busy={busy} label="Update password" formId="pw-form" />}>
      <form id="pw-form" className="stack" onSubmit={submit} noValidate>
        {error && <Alert type="error">{error}</Alert>}
        <Input label="Current password" type="password" required value={form.current_password} onChange={set('current_password')} error={errors.current_password} autoComplete="current-password" />
        <Input label="New password" type="password" required value={form.new_password} onChange={set('new_password')} error={errors.new_password} autoComplete="new-password" hint="At least 6 characters" />
        <Input label="Confirm new password" type="password" required value={form.confirm} onChange={set('confirm')} error={errors.confirm} autoComplete="new-password" />
      </form>
    </Modal>
  )
}
