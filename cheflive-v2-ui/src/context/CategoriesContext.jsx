import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { listCategories } from '../apis/category.js'
import { useAuth } from './AuthContext.jsx'

/**
 * @typedef {{ id: number, name: string, is_active?: number|boolean|string, deleted_at?: string|null }} Category
 * @typedef {{
 *   categories: Category[],
 *   options: { value: string, label: string }[],
 *   loading: boolean,
 *   error: string,
 *   refresh: () => Promise<void>,
 *   addCategory: (cat: Category) => void,
 * }} CategoriesContextValue
 */

/** @type {import('react').Context<CategoriesContextValue | null>} */
const CategoriesContext = createContext(null)

export function CategoriesProvider({ children }) {
  const { isAuthenticated } = useAuth()

  const [categories, setCategories] = useState(() => /** @type {Category[]} */ ([]))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return
    setError('')
    setLoading(true)
    try {
      const data = await listCategories({ limit: 100 })
      const items = Array.isArray(data?.items) ? data.items : []
      setCategories(items)
    } catch (e) {
      setCategories([])
      setError(e?.response?.data?.message || e?.message || 'Failed to load categories')
      console.error('[CategoriesContext] Failed to load categories', e.message)
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) {
      setCategories([])
      setError('')
      setLoading(false)
      return
    }
    refresh()
  }, [isAuthenticated, refresh])

  const addCategory = useCallback((cat) => {
    if (!cat?.id) return
    setCategories((prev) => {
      const next = [cat, ...prev.filter((c) => c.id !== cat.id)]
      return next
    })
  }, [])

  const options = useMemo(() => {
    return (Array.isArray(categories) ? categories : [])
      .filter((c) => !c?.deleted_at)
      .map((c) => ({ value: String(c.id), label: c.name }))
  }, [categories])

  const value = useMemo(
    () => ({ categories, options, loading, error, refresh, addCategory }),
    [addCategory, categories, error, loading, options, refresh],
  )

  return <CategoriesContext.Provider value={value}>{children}</CategoriesContext.Provider>
}

export function useCategories() {
  const ctx = useContext(CategoriesContext)
  if (ctx) return ctx
  // Fallback makes the app resilient during HMR / partial trees.
  return {
    categories: [],
    options: [],
    loading: false,
    error: '',
    refresh: async () => {},
    addCategory: () => {},
  }
}

