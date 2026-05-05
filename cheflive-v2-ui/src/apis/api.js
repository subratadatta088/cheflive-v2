import axios from 'axios'

const TOKEN_STORAGE_KEY = 'cheflive:token'

function joinUrl(a, b) {
  const left = String(a ?? '').replace(/\/+$/, '')
  const right = String(b ?? '').replace(/^\/+/, '')
  if (!left) return `/${right}`.replace(/\/+$/, '')
  if (!right) return left
  return `${left}/${right}`
}

function getBaseURL() {
  const base = import.meta.env.VITE_API_BASE_URL
  const version = import.meta.env.VITE_API_VERSION
  return version ? joinUrl(base, version) : String(base ?? '')
}

export const api = axios.create({
  baseURL: getBaseURL(),
  timeout: Number(import.meta.env.VITE_API_TIMEOUT_MS ?? 30000),
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY)
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export function setAuthToken(token) {
  const v = String(token ?? '').trim()
  if (!v) {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    return
  }
  localStorage.setItem(TOKEN_STORAGE_KEY, v)
}

