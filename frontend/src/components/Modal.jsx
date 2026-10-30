import { useEffect } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { Spinner } from './ui'

export function Modal({ open, title, subtitle, onClose, children, footer, size = '' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

// Confirmation dialog for destructive or important actions.
export function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', tone = 'danger', busy, onConfirm, onCancel, children }) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={busy ? undefined : onCancel}
      size="sm"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button className={`btn btn-${tone}`} onClick={onConfirm} disabled={busy}>
            {busy && <Spinner small />} {confirmLabel}
          </button>
        </>
      }
    >
      <div className={`confirm-icon tone-${tone === 'primary' ? 'primary' : tone === 'success' ? 'success' : 'danger'}`}>
        <AlertTriangle size={22} />
      </div>
      <p style={{ color: 'var(--text-2)' }}>{message}</p>
      {children}
    </Modal>
  )
}

// Standard Save / Cancel footer for form modals
export function FormFooter({ onCancel, busy, label = 'Save', formId }) {
  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
        Cancel
      </button>
      <button type="submit" form={formId} className="btn btn-primary" disabled={busy}>
        {busy && <Spinner small />} {label}
      </button>
    </>
  )
}
