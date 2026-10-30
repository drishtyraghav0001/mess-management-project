import { createContext, useCallback, useContext, useState } from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'

const ToastContext = createContext(null)
let nextId = 1

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const remove = (id) => setToasts((t) => t.filter((x) => x.id !== id))
  const push = useCallback((type, message, title) => {
    const id = nextId++
    setToasts((t) => [...t, { id, type, message, title }])
    setTimeout(() => remove(id), type === 'error' ? 7000 : 4500)
  }, [])
  const toast = {
    success: (m, t) => push('success', m, t),
    error: (m, t) => push('error', m, t),
    info: (m, t) => push('info', m, t),
  }
  const icons = { success: CheckCircle2, error: AlertCircle, info: Info }
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => {
          const Icon = icons[t.type]
          return (
            <div key={t.id} className={`toast ${t.type}`}>
              <Icon />
              <div className="grow">
                {t.title && <b style={{ display: 'block' }}>{t.title}</b>}
                {t.message}
              </div>
              <button className="icon-btn" style={{ width: 22, height: 22 }} onClick={() => remove(t.id)} aria-label="Close">
                <X />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
