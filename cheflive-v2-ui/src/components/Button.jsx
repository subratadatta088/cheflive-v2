import React from 'react'

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-1 text-sm font-medium transition ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ' +
  'disabled:opacity-50 disabled:pointer-events-none cursor-pointer'

const VARIANTS = {
  primary: 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700 hover:border-blue-700',
  secondary: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
  dark: 'border-slate-800 bg-slate-900 text-white hover:bg-slate-800 hover:border-slate-700 shadow-sm',
  warning: 'border-amber-500 bg-amber-500 text-white hover:bg-amber-600 hover:border-amber-600',
  danger: 'border-red-600 bg-red-900 text-white hover:bg-red-700 hover:border-red-700',
}

/**
 * @param {{
 *   variant?: 'primary'|'secondary'|'dark'|'warning'|'danger',
 *   className?: string,
 *   type?: 'button'|'submit'|'reset',
 * } & React.ButtonHTMLAttributes<HTMLButtonElement>} props
 */
export function Button({ variant = 'primary', className = '', type = 'button', ...props }) {
  const variantClasses = VARIANTS[variant] ?? VARIANTS.secondary
  return <button type={type} className={`${BASE} ${variantClasses} ${className}`} {...props} />
}

