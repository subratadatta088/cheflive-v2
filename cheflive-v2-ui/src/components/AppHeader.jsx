import { createPortal } from 'react-dom'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Clock, LogOut, Settings, UserRound } from 'lucide-react'
import chefliveLogo from '../assets/cheflive.png'

function formatDateTime(d) {
  const date = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(d)

  const time = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)

  return { date, time }
}

export function AppHeader({ username = 'User', onLogout }) {
  const [now, setNow] = useState(() => new Date())
  const [menuOpen, setMenuOpen] = useState(false)
  /** @type {React.MutableRefObject<HTMLDivElement | null>} */
  const menuRef = useRef(null)
  /** @type {React.MutableRefObject<HTMLDivElement | null>} */
  const menuPanelRef = useRef(null)
  const [menuPos, setMenuPos] = useState(() => ({ top: 0, right: 0 }))

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const syncMenuPosition = () => {
    const el = menuRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setMenuPos({
      top: r.bottom + 4,
      right: Math.max(8, window.innerWidth - r.right),
    })
  }

  useLayoutEffect(() => {
    if (!menuOpen) return
    syncMenuPosition()
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    const onScrollOrResize = () => syncMenuPosition()
    window.addEventListener('resize', onScrollOrResize)
    window.addEventListener('scroll', onScrollOrResize, true)
    return () => {
      window.removeEventListener('resize', onScrollOrResize)
      window.removeEventListener('scroll', onScrollOrResize, true)
    }
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    function handlePointerDown(e) {
      const target = /** @type {Node | null} */ (e.target)
      if (!target) return
      if (menuRef.current?.contains(target)) return
      if (menuPanelRef.current?.contains(target)) return
      setMenuOpen(false)
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown, { passive: true })
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  const dt = useMemo(() => formatDateTime(now), [now])
  /** Toggles each second so the clock reads “live” (aligned with the 1s interval). */
  const clockBlinkOn = now.getSeconds() % 2 === 0

  function handleLogout() {
    setMenuOpen(false)
    onLogout?.()
  }

  function toggleMenu() {
    setMenuOpen((o) => !o)
  }

  const menuPanel =
    menuOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuPanelRef}
            id="app-header-user-menu"
            className="fixed z-[500] w-56 min-w-[12rem] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
            style={{ top: menuPos.top, right: menuPos.right }}
            role="menu"
            aria-labelledby="app-header-user-menu-button"
          >
            <button
              type="button"
              role="menuitem"
              disabled
              className="flex w-full cursor-not-allowed items-center justify-between gap-2 px-3 py-2.5 text-left text-sm text-slate-400"
            >
              <span>Profile</span>
              <UserRound className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            </button>
            <button
              type="button"
              role="menuitem"
              disabled
              className="flex w-full cursor-not-allowed items-center justify-between gap-2 px-3 py-2.5 text-left text-sm text-slate-400"
            >
              <span>Settings</span>
              <Settings className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            </button>
            <div className="my-1 h-px bg-slate-100" role="separator" />
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-50"
              onClick={handleLogout}
            >
              <span>Logout</span>
              <LogOut className="h-4 w-4 shrink-0 text-slate-600" aria-hidden="true" />
            </button>
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <header className="sticky top-0 z-40 overflow-visible border-b border-slate-100/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto grid max-w-8xl grid-cols-3 items-center gap-4 overflow-visible px-4 py-2">
          <div className="flex min-w-0 items-center justify-self-start">
            <img src={chefliveLogo} alt="Cheflive" className="h-6 w-auto select-none" draggable={false} />
          </div>

          <div className="flex min-w-0 justify-center justify-self-center">
            <div className="inline-flex items-center gap-2 px-2.5 py-1.5">
              <Clock
                className={`h-4 w-4`}
                aria-hidden="true"
              />
              <div className="text-sm font-medium tabular-nums text-slate-900">
                <span>{dt.date}</span>
                <span
                  className={`inline text-red-700 transition-opacity duration-150 ${clockBlinkOn ? 'opacity-100 ' : 'opacity-25'}`}
                  aria-hidden="true"
                >
                  {' '}
                  •{' '}
                </span>
                <span>{dt.time}</span>
              </div>
            </div>
          </div>

          <div className="flex min-w-0 justify-end justify-self-end">
            <div ref={menuRef} className="relative overflow-visible">
              <button
                type="button"
                className="inline-flex max-w-[min(100vw-12rem,260px)] items-center gap-1.5 rounded-lg border-0 bg-transparent px-2 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-controls="app-header-user-menu"
                id="app-header-user-menu-button"
                onClick={toggleMenu}
              >
                <UserRound className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                <span className="min-w-0 truncate">
                  Hi, <span className="font-semibold text-slate-900">{username}</span>
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>
        </div>
      </header>
      {menuPanel}
    </>
  )
}
