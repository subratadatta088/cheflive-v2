import { useEffect, useMemo, useState } from 'react'
import { Clock, LogOut, UserRound } from 'lucide-react'
import { Button } from './Button.jsx'
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

export function AppHeader({ userName = 'User', onLogout }) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const dt = useMemo(() => formatDateTime(now), [now])

  return (
    <header className="sticky top-0 z-10  backdrop-blur">
      <div className="mx-auto flex max-w-8xl items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <img src={chefliveLogo} alt="Cheflive" className="h-6 w-auto select-none" draggable={false} />
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-700">
            <UserRound className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="text-sm text-slate-600">
            Hi, <span className="font-semibold text-slate-900">{userName}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5">
            <Clock className="h-4 w-4 text-slate-500" aria-hidden="true" />
            <div className="text-sm font-medium tabular-nums text-slate-900">
              {dt.date} • {dt.time}
            </div>
          </div>
          <Button variant="danger" onClick={onLogout}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Logout
          </Button>
        </div>
      </div>
    </header>
  )
}

