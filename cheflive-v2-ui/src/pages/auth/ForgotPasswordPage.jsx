import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/Button.jsx'

const INPUT =
  'h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 ' +
  'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300'

export function ForgotPasswordPage() {
  const [username, setUserName] = useState('')
  const [sent, setSent] = useState(false)
  const canSubmit = useMemo(() => username.trim().length > 0, [username])

  return (
    <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center justify-center">
      <form
        className="w-full space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!canSubmit) return
          // TODO: call API to send reset link/OTP
          setSent(true)
        }}
      >
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Forgot password</h1>
          <p className="text-sm text-slate-600">We’ll send instructions to reset your password.</p>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Username</span>
          <input value={username} onChange={(e) => setUserName(e.target.value)} className={INPUT} autoComplete="username" />
        </label>

        {sent ? (
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
            If an account exists, reset instructions were sent.
          </div>
        ) : null}

        <Button type="submit" variant="danger" disabled={!canSubmit} className="h-11 w-full">
          Send reset instructions
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

