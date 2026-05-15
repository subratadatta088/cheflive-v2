import { createPortal } from 'react-dom'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/**
 * Row actions trigger + dropdown rendered in a portal so menus are not clipped by table overflow.
 *
 * @param {{
 *   open: boolean,
 *   onOpenChange: (open: boolean) => void,
 *   ariaLabel?: string,
 *   menuClassName?: string,
 *   children: React.ReactNode,
 * }} props
 */
export function TableRowActionsMenu({
  open,
  onOpenChange,
  ariaLabel = 'Row actions',
  menuClassName = 'w-36',
  children,
}) {
  const triggerRef = useRef(null)
  const panelRef = useRef(null)
  const [menuPos, setMenuPos] = useState(() => ({ top: 0, right: 0 }))

  const syncMenuPosition = () => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setMenuPos({
      top: r.bottom + 4,
      right: Math.max(8, window.innerWidth - r.right),
    })
  }

  useLayoutEffect(() => {
    if (!open) return
    syncMenuPosition()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onScrollOrResize = () => syncMenuPosition()
    window.addEventListener('resize', onScrollOrResize)
    window.addEventListener('scroll', onScrollOrResize, true)
    return () => {
      window.removeEventListener('resize', onScrollOrResize)
      window.removeEventListener('scroll', onScrollOrResize, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function handlePointerDown(e) {
      const target = /** @type {Node | null} */ (e.target)
      if (!target) return
      if (triggerRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      onOpenChange(false)
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown, { passive: true })
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onOpenChange])

  const menuPanel =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={panelRef}
            className={`fixed z-[500] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg ${menuClassName}`}
            style={{ top: menuPos.top, right: menuPos.right }}
            role="menu"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {children}
          </div>,
          document.body,
        )
      : null

  return (
    <div className="relative inline-block text-left">
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        onClick={(e) => {
          e.stopPropagation()
          onOpenChange(!open)
        }}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        ⋮
      </button>
      {menuPanel}
    </div>
  )
}
