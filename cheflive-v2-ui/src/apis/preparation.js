import { api } from './api.js'

/**
 * GET /preparations
 * @param {{
 *   q?: string,
 *   page?: number,
 *   limit?: number,
 *   type?: string,
 *   is_active?: boolean,
 *   from_date?: string,
 *   to_date?: string,
 *   has_ingredients?: boolean,
 * }} [query]
 */
export async function listPreparations(query = {}) {
  const res = await api.get('preparations', { params: query })
  const data = res.data ?? {}
  const items = Array.isArray(data?.items) ? data.items : []
  return { items, page: data.page, limit: data.limit, raw: data }
}

/** GET /preparations/:id @param {number|string} id */
export async function getPreparationById(id) {
  const res = await api.get(`preparations/${id}`)
  return res.data
}

/**
 * POST /preparations
 * @param {{ preparation: Record<string, unknown>, items?: unknown[] }} payload
 */
export async function createPreparation(payload) {
  const res = await api.post('preparations', payload)
  return res.data
}

/**
 * PATCH /preparations/:id
 * @param {number|string} id
 * @param {{ preparation: Record<string, unknown>, items?: unknown[] }} payload
 */
export async function updatePreparation(id, payload) {
  const res = await api.patch(`preparations/${id}`, payload)
  return res.data
}

/** DELETE /preparations/:id @param {number|string} id */
export async function deletePreparationById(id) {
  const res = await api.delete(`preparations/${id}`)
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
