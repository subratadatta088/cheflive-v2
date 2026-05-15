import { api } from './api.js'

/**
 * GET /preparations
 * @param {{ q?: string, page?: number, limit?: number, is_active?: boolean }} [query]
 */
export async function listPreparations(query = {}) {
  const res = await api.get('preparations', { params: query })
  const data = res.data ?? {}
  const items = Array.isArray(data?.items) ? data.items : []
  return { items, raw: data }
}

/** GET /preparations/:id @param {number|string} id */
export async function getPreparationById(id) {
  const res = await api.get(`preparations/${id}`)
  return res.data
}

/**
 * GET /preparation-items
 * @param {{ preparation_id: number, page?: number, limit?: number }} query
 */
export async function listPreparationItems(query = {}) {
  const res = await api.get('preparation-items', { params: query })
  const data = res.data ?? {}
  const items = Array.isArray(data?.items) ? data.items : []
  return { items, raw: data }
}
