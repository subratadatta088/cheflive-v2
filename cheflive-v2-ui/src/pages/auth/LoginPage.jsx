import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useFormik } from 'formik'
import { z } from 'zod'
import { AlertCircle, KeyRound, LogIn, Lock, User } from 'lucide-react'
import { Button } from '../../components/Button.jsx'
import { useToast } from '../../components/Toaster.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import chefliveLogo from '../../assets/cheflive.png'
import { login as loginApi } from '../../apis/auth.js'

const INPUT_BASE =
  'h-12 w-full rounded-xl border border-slate-200/90 bg-white text-sm text-slate-900 ' +
  'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-200'

const INPUT_ICON = `${INPUT_BASE} pl-11 pr-3.5`

const LABEL =
  'text-xs font-bold uppercase tracking-[0.12em] text-slate-600'

const LoginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

function zodToFormikErrors(zodError) {
  /** @type {Record<string, string>} */
  const out = {}
  for (const issue of zodError.issues ?? []) {
    const key = issue.path?.[0]
    if (!key) continue
    if (out[key]) continue
    out[key] = issue.message
  }
  return out
}

export function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const formik = useFormik({
    initialValues: { username: '', password: '' },
    validateOnBlur: true,
    validateOnChange: true,
    validateOnMount: true,
    validate: (values) => {
      const res = LoginSchema.safeParse(values)
      if (res.success) return {}
      return zodToFormikErrors(res.error)
    },
    onSubmit: async (values, helpers) => {
      helpers.setStatus(undefined)
      try {
        await loginApi({ username: values.username.trim(), password: values.password })
        login(values.username)
        showToast({
          text: 'Logged in successfully.',
          theme: 'success',
          duration: 3000,
        })
        navigate('/home')
      } catch (err) {
        const data = err?.response?.data
        const msg =
          (typeof data?.message === 'string' && data.message) ||
          (typeof data?.error === 'string' && data.error) ||
          (err?.response?.status === 401 ? 'Invalid username or password.' : null) ||
          err?.message ||
          'Login failed'
        helpers.setStatus(msg)
        showToast({ text: msg, theme: 'failure', duration: 6000 })
      }
    },
  })

  useEffect(() => {
    if (isAuthenticated) navigate('/home', { replace: true })
  }, [isAuthenticated, navigate])

  return (
    <div><div className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute inset-0 bg-gradient-to-br from-rose-50 via-white to-rose-100/60" />
      <div className="absolute -inset-24 rotate-[-18deg] opacity-20 [background:repeating-linear-gradient(110deg,rgba(244,63,94,0.10)_0px,rgba(244,63,94,0.10)_10px,transparent_10px,transparent_34px,rgba(244,63,94,0.06)_34px,rgba(244,63,94,0.06)_42px,transparent_42px,transparent_68px)]" />
      <div className="absolute -inset-24 rotate-[-18deg] opacity-15 [background:repeating-linear-gradient(110deg,rgba(244,63,94,0.08)_0px,rgba(244,63,94,0.08)_6px,transparent_6px,transparent_18px)]" />
      <div className="absolute inset-0 bg-gradient-to-t from-white/85 via-white/40 to-white/0" />
    </div>
      <section className="relative mx-auto flex min-h-[calc(100vh-2rem)] max-w-xl items-center justify-center overflow-hidden px-4 py-12 sm:px-6">
        <form
          className="w-full space-y-10 rounded-2xl border border-slate-200/70 bg-white/75 p-8 shadow-sm backdrop-blur-md sm:p-10"
          onSubmit={formik.handleSubmit}
        >
          <div className="flex flex-col items-center gap-3 p-6">
            <img src={chefliveLogo} alt="Cheflive" className="h-25 w-auto select-none" draggable={false} />
          </div>

          {formik.status ? (
            <div
              className="flex gap-3 rounded-xl border border-red-200/80 bg-red-50/90 px-4 py-3 text-sm text-red-900"
              role="alert"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
              <span className="leading-snug">{formik.status}</span>
            </div>
          ) : null}

          <div className="space-y-8">
            <label className="block space-y-2.5">
              <span className={LABEL}>Username</span>
              <div className="relative">
                <User
                  className="pointer-events-none absolute left-3.5 top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  name="username"
                  value={formik.values.username}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  className={INPUT_ICON}
                  autoComplete="username"
                  disabled={formik.isSubmitting}
                  placeholder="Enter your username"
                />
              </div>
              {formik.touched.username && formik.errors.username ? (
                <div className="text-xs font-medium text-red-700">{formik.errors.username}</div>
              ) : null}
            </label>

            <label className="block space-y-2.5">
              <span className={LABEL}>Password</span>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3.5 top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  type="password"
                  name="password"
                  value={formik.values.password}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  className={INPUT_ICON}
                  autoComplete="current-password"
                  disabled={formik.isSubmitting}
                  placeholder="Enter your password"
                />
              </div>
              {formik.touched.password && formik.errors.password ? (
                <div className="text-xs font-medium text-red-700">{formik.errors.password}</div>
              ) : null}
            </label>
          </div>

          <div className="flex items-center justify-between pt-1">
            <Link
              to="/forgot-password"
              className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800"
            >
              <KeyRound className="h-4 w-4 shrink-0 opacity-80" aria-hidden="true" />
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            variant="danger"
            disabled={!formik.isValid || formik.isSubmitting}
            className="h-12 w-full text-base"
          >
            <LogIn className="h-4 w-4" aria-hidden="true" />
            {formik.isSubmitting ? 'Logging in…' : 'Login'}
          </Button>
        </form>
      </section>
    </div>
  )
}

