import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useFormik } from 'formik'
import { z } from 'zod'
import { Button } from '../../components/Button.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import chefliveLogo from '../../assets/cheflive.png'
import { login as loginApi } from '../../apis/auth.js'

const INPUT =
  'h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 ' +
  'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300'

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
        navigate('/home')
      } catch (err) {
        helpers.setStatus(err?.response?.data?.message || err?.message || 'Login failed')
      }
    },
  })

  useEffect(() => {
    if (isAuthenticated) navigate('/home', { replace: true })
  }, [isAuthenticated, navigate])

  return (
    <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center justify-center">
      <form
        className="w-full space-y-4"
        onSubmit={formik.handleSubmit}
      >
        <div className="flex items-center justify-center">
          <img src={chefliveLogo} alt="Cheflive" className="h-30 w-auto select-none" draggable={false} />
        </div>

        {formik.status ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{formik.status}</div>
        ) : null}

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Username</span>
          <input
            name="username"
            value={formik.values.username}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            className={INPUT}
            autoComplete="username"
            disabled={formik.isSubmitting}
          />
          {formik.touched.username && formik.errors.username ? (
            <div className="text-xs font-medium text-red-700">{formik.errors.username}</div>
          ) : null}
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Password</span>
          <input
            type="password"
            name="password"
            value={formik.values.password}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            className={INPUT}
            autoComplete="current-password"
            disabled={formik.isSubmitting}
          />
          {formik.touched.password && formik.errors.password ? (
            <div className="text-xs font-medium text-red-700">{formik.errors.password}</div>
          ) : null}
        </label>

        <div className="flex items-center justify-between">
          <Link to="/forgot-password" className="text-sm font-medium text-blue-700 hover:text-blue-800">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" variant="danger" disabled={!formik.isValid || formik.isSubmitting} className="h-11 w-full">
          {formik.isSubmitting ? 'Logging in…' : 'Login'}
        </Button>
      </form>
    </section>
  )
}

