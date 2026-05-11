import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { listOrigins } from '../apis/origin.js'
import { useAuth } from './AuthContext.jsx'

/**
 * @typedef {{
 *   id: number,
 *   name: string,
 *   type?: string,
 *   is_default: boolean,
 *   is_active?: number|boolean|string,
 *   deleted_at?: string|null,
 * }} Origin
 *
 * @typedef {{
 *   origins: Origin[],
 *   options: { value: string, label: string }[],
 *   defaultOrigin: Origin | null,
 *   defaultOriginId: number | null,
 *   loading: boolean,
 *   error: string,
 *   refresh: () => Promise<void>,
 *   addOrigin: (origin: unknown) => void,
 * }} OriginsContextValue
 */

/** @type {import('react').Context<OriginsContextValue | null>} */
const OriginsContext = createContext(null)

/** @param {unknown} raw */
function normalizeOrigin(raw) {
  const id = Number(raw?.id)
  if (!Number.isFinite(id) || id <= 0) return null
  const nameRaw = raw?.name != null ? String(raw.name).trim() : ''
  return {
    id,
    name: nameRaw || `Origin #${id}`,
    type: raw?.type ? String(raw.type) : undefined,
    is_default: Number(raw?.is_default ?? 0) === 1,
    is_active: raw?.is_active,
    deleted_at: raw?.deleted_at ?? null,
  }
}

function sortByName(list) {
  return [...list].sort((a, b) => a.name.localeCompare(b.name))
}

export function OriginsProvider({ children }) {
  const { isAuthenticated } = useAuth()

  const [origins, setOrigins] = useState(() => /** @type {Origin[]} */ ([]))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return
    setError('')
    setLoading(true)
    try {
      const { items } = await listOrigins({ limit: 100, is_active: true })
      const list = Array.isArray(items) ? items : []
      const normalized = list.map(normalizeOrigin).filter(Boolean)
      setOrigins(sortByName(normalized))
    } catch (e) {
      setOrigins([])
      setError(e?.response?.data?.message || e?.message || 'Failed to load origins')
      console.error('[OriginsContext] Failed to load origins', e?.message)
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) {
      setOrigins([])
      setError('')
      setLoading(false)
      return
    }
    refresh()
  }, [isAuthenticated, refresh])

  const addOrigin = useCallback((raw) => {
    const o = normalizeOrigin(raw)
    if (!o) return
    setOrigins((prev) => {
      const withoutDup = prev.filter((x) => x.id !== o.id)
      // Only one origin can be default at a time; demote others when adding a default.
      const demoted = o.is_default ? withoutDup.map((x) => ({ ...x, is_default: false })) : withoutDup
      return sortByName([...demoted, o])
    })
  }, [])

  const options = useMemo(
    () =>
      origins
        .filter((o) => !o?.deleted_at)
        .map((o) => ({ value: String(o.id), label: o.name })),
    [origins],
  )

  const defaultOrigin = useMemo(
    () => origins.find((o) => o.is_default && o.id) ?? null,
    [origins],
  )
  const defaultOriginId = defaultOrigin?.id ?? null

  const value = useMemo(
    () => ({
      origins,
      options,
      defaultOrigin,
      defaultOriginId,
      loading,
      error,
      refresh,
      addOrigin,
    }),
    [addOrigin, defaultOrigin, defaultOriginId, error, loading, options, origins, refresh],
  )

  return <OriginsContext.Provider value={value}>{children}</OriginsContext.Provider>
}

export function useOrigins() {
  const ctx = useContext(OriginsContext)
  if (ctx) return ctx
  // Fallback keeps the app resilient during HMR / partial trees.
  return {
    origins: [],
    options: [],
    defaultOrigin: null,
    defaultOriginId: null,
    loading: false,
    error: '',
    refresh: async () => {},
    addOrigin: () => {},
  }
}
