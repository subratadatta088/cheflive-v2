import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle, X, XCircle } from 'lucide-react'

/** @typedef {'success' | 'warning' | 'failure'} ToastTheme */

/**
 * @typedef {{
 *   text: string,
 *   theme?: ToastTheme,
 *   duration?: number,
 * }} ShowToastOptions
 */

/** @type {Record<ToastTheme, { Icon: typeof CheckCircle, box: string, icon: string }>} */
const THEME_STYLES = {
  success: {
    Icon: CheckCircle,
    box: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    icon: 'text-emerald-600',
  },
  warning: {
    Icon: AlertTriangle,
    box: 'border-amber-200 bg-amber-50 text-amber-950',
    icon: 'text-amber-600',
  },
  failure: {
    Icon: XCircle,
    box: 'border-red-200 bg-red-50 text-red-950',
    icon: 'text-red-600',
  },
}

/** @type {import('react').Context<{ showToast: (opts: ShowToastOptions) => string, dismiss: (id: string) => void } | null>} */
const ToastContext = createContext(null)

/**
 * @param {{ toast: { id: string, text: string, theme: ToastTheme, duration: number }, onDismiss: (id: string) => void }} props
 */
function ToastItem({ toast, onDismiss }) {
  const cfg = THEME_STYLES[toast.theme] ?? THEME_STYLES.success
  const { Icon } = cfg
  const showProgress = toast.duration > 0

  return (
    <div
      role="status"
      className={`pointer-events-auto relative flex min-w-[280px] max-w-md flex-col overflow-hidden rounded-xl border shadow-xl ring-1 ring-black/5 ${cfg.box}`}
    >
      <div className="relative flex items-start gap-3 px-4 py-3 pr-11">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${cfg.icon}`} aria-hidden="true" />
        <p className="flex-1 text-sm leading-snug">{toast.text}</p>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="absolute right-2 top-2 rounded-lg p-1 text-current/60 hover:bg-black/5 hover:text-current"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {showProgress ? (
        <div className="h-[3px] w-full shrink-0 bg-black/10 motion-reduce:hidden" aria-hidden="true">
          <div
            className="h-full w-full origin-left bg-current/40"
            style={{
              animationName: 'cheflive-toast-progress',
              animationDuration: `${toast.duration}ms`,
              animationTimingFunction: 'linear',
              animationFillMode: 'forwards',
            }}
          />
        </div>
      ) : null}
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState(
    () => /** @type {{ id: string, text: string, theme: ToastTheme, duration: number }[]} */ ([]),
  )
  /** @type {React.MutableRefObject<Map<string, ReturnType<typeof setTimeout>>>} */
  const timersRef = useRef(new Map())

  const dismiss = useCallback((id) => {
    const m = timersRef.current
    const t = m.get(id)
    if (t) clearTimeout(t)
    m.delete(id)
    setToasts((prev) => prev.filter((x) => x.id !== id))
  }, [])

  const showToast = useCallback(
    /** @param {ShowToastOptions} opts */
    (opts) => {
      const text = String(opts?.text ?? '')
      const theme = opts?.theme === 'warning' || opts?.theme === 'failure' ? opts.theme : 'success'
      const duration = opts?.duration !== undefined ? Number(opts.duration) : 5000

      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      setToasts((prev) => [...prev, { id, text, theme, duration }])

      if (duration > 0) {
        const tid = setTimeout(() => dismiss(id), duration)
        timersRef.current.set(id, tid)
      }
      return id
    },
    [dismiss],
  )

  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout)
      timersRef.current.clear()
    }
  }, [])

  const value = useMemo(() => ({ showToast, dismiss }), [dismiss, showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-0 z-[9999] flex flex-col items-end gap-2 p-4 pt-[max(1rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))]"
        aria-live="polite"
        aria-relevant="additions removals"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
