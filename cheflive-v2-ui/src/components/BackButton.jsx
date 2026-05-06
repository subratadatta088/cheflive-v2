import React from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

/**
 * @param {{
 *  to?: string | number,
 *  label?: string,
 *  className?: string,
 * } & React.ButtonHTMLAttributes<HTMLButtonElement>} props
 */
export function BackButton({ to = -1, label = 'Back', className = '', type = 'button', ...props }) {
  const navigate = useNavigate()
  return (
    <button
      type={type}
      onClick={(e) => {
        props.onClick?.(e)
        if (e.defaultPrevented) return
        navigate(to)
      }}
      className={
        'inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-slate-700 ' +
        'hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ' +
        className
      }
      {...props}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  )
}

