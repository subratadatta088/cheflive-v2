/**
 * A simple accessible switch (no label by default).
 *
 * @param {{
 *   checked: boolean,
 *   onChange: (checked: boolean) => void,
 *   disabled?: boolean,
 *   className?: string,
 *   'aria-label'?: string,
 * }} props
 */
export function Switch({ checked, onChange, disabled = false, className = '', ...rest }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => {
        if (disabled) return
        onChange(!checked)
      }}
      className={
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ' +
        (checked ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 bg-slate-200') +
        (disabled ? ' opacity-50' : ' cursor-pointer') +
        ' focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ' +
        className
      }
      {...rest}
    >
      <span
        aria-hidden="true"
        className={
          'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ' +
          (checked ? 'translate-x-5' : 'translate-x-1')
        }
      />
    </button>
  )
}

