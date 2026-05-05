import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'cheflive:username'

/**
 * @typedef {{ username: string | null, isAuthenticated: boolean, login: (username: string) => void, logout: () => void }} AuthContextValue
 */

/** @type {import('react').Context<AuthContextValue | null>} */
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [username, setUserName] = useState(() => localStorage.getItem(STORAGE_KEY))

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) setUserName(e.newValue)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const login = useCallback((nextUserName) => {
    const v = String(nextUserName ?? '').trim()
    if (!v) return
    localStorage.setItem(STORAGE_KEY, v)
    setUserName(v)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setUserName(null)
  }, [])

  const value = useMemo(
    () => ({
      username,
      isAuthenticated: Boolean(username),
      login,
      logout,
    }),
    [login, logout, username],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

