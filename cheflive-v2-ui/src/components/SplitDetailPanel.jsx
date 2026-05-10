import { useEffect } from 'react'
import { X } from 'lucide-react'

/**
 * Right-hand detail pane that shares horizontal space with main content (no overlay).
 * Parent should be a flex row: main column (`flex-1 min-w-0`) + this panel when `open`.
 *
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   title?: import('react').ReactNode,
 *   children?: import('react').ReactNode,
 *   className?: string,
 * }} props
 */
export function SplitDetailPanel({ open, onClose, title, children, className = '' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <aside
      className={
        'flex h-[100dvh] w-full shrink-0 flex-col bg-gray-50 lg:w-1/2 lg:min-w-[50%] lg:max-w-[840px] lg:border-l lg:border-t-0 lg:border-slate-200 px-4' +
        className
      }
      aria-label="Detail panel"
    >
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="min-w-0 flex-1 text-base font-semibold leading-snug text-slate-900">{title}</div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          aria-label="Close panel"
        >
          <X className="h-5 w-5" strokeWidth={2} />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">{children}</div>
    </aside>
  )
}
