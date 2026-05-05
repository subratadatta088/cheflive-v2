import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../../components/Button.jsx'

const INPUT =
  'h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 ' +
  'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [done, setDone] = useState(false)

  const mismatch = useMemo(() => confirmPassword.length > 0 && password !== confirmPassword, [confirmPassword, password])
  const canSubmit = useMemo(
    () => password.length >= 6 && confirmPassword.length >= 6 && !mismatch,
    [confirmPassword.length, mismatch, password.length],
  )

  return (
    <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center justify-center">
      <form
        className="w-full space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!canSubmit) return
          // TODO: call API to reset password (use token)
          setDone(true)
          setTimeout(() => navigate('/login'), 800)
        }}
      >
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Reset password</h1>
          <p className="text-sm text-slate-600">
            {token ? 'Set a new password for your account.' : 'Missing reset token. Request a new reset link.'}
          </p>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">New password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={INPUT}
            autoComplete="new-password"
          />
          <div className="text-xs text-slate-500">Minimum 6 characters.</div>
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Confirm new password</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={INPUT + (mismatch ? ' ring-2 ring-inset ring-red-300' : '')}
            autoComplete="new-password"
          />
          {mismatch ? <div className="text-xs font-medium text-red-700">Passwords do not match.</div> : null}
        </label>

        {done ? (
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
            Password reset (mock). Redirecting to login…
          </div>
        ) : null}

        <Button type="submit" variant="danger" disabled={!token || !canSubmit} className="h-11 w-full">
          Reset password
        </Button>

        <div className="text-center text-sm text-slate-600">
          <Link to="/login" className="font-medium text-blue-700 hover:text-blue-800">
            Back to login
          </Link>
        </div>
      </form>
    </section>
  )
}

