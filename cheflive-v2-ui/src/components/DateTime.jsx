import { useEffect, useMemo, useState } from 'react'

function toDate(value) {
  if (value instanceof Date) return value
  if (typeof value === 'number') return new Date(value)
  if (typeof value === 'string') return new Date(value)
  return null
}

function formatAbsolute(d) {
  const date = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit' }).format(d)
  const time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(d)
  return `${date} • ${time}`
}

function formatAge(from, now) {
  const diffMs = now.getTime() - from.getTime()
  if (!Number.isFinite(diffMs)) return '—'

  const abs = Math.abs(diffMs)
  const isPast = diffMs >= 0

  const mins = Math.floor(abs / 60000)
  const hrs = Math.floor(abs / 3600000)
  const days = Math.floor(abs / 86400000)

  let value
  let unit

  if (mins < 1) {
    value = 0
    unit = 'minute'
  } else if (hrs < 1) {
    value = mins
    unit = 'minute'
  } else if (days < 1) {
    value = hrs
    unit = 'hour'
  } else {
    value = days
    unit = 'day'
  }

  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  const rel = rtf.format(isPast ? -value : value, unit)

  // Make it more compact: "in 2 hours" -> "2h", "2 hours ago" -> "2h ago"
  if (unit === 'minute') return `${value}m${isPast ? ' ago' : ''}`
  if (unit === 'hour') return `${value}h${isPast ? ' ago' : ''}`
  if (unit === 'day') return `${value}d${isPast ? ' ago' : ''}`
  return rel
}

/**
 * @param {{
 *   value: string | number | Date | null | undefined,
 *   age?: boolean,
 *   className?: string,
 *   title?: string,
 * }} props
 */
export function DateTime({ value, age = false, className = '', title }) {
  const date = useMemo(() => toDate(value), [value])
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    if (!age) return
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [age])

  const text = useMemo(() => {
    if (!date || Number.isNaN(date.getTime())) return '—'
    return age ? formatAge(date, now) : formatAbsolute(date)
  }, [age, date, now])

  const absoluteTitle = useMemo(() => {
    if (!date || Number.isNaN(date.getTime())) return undefined
    return formatAbsolute(date)
  }, [date])

  return (
    <span
      className={
        'inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-medium tabular-nums text-slate-700 ' +
        className
      }
      title={title ?? absoluteTitle}
    >
      {text}
    </span>
  )
}

