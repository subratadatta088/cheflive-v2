import { api } from './api.js'

/**
 * GET /utilizations
 * @param {{ q?: string, page?: number, limit?: number, origin_id?: number }} [query]
 */
export async function listUtilizations(query = {}) {
  const res = await api.get('utilizations', { params: query })
  const data = res.data ?? {}
  const items = Array.isArray(data?.items) ? data.items : []
  return { items, raw: data }
}

/**
 * POST /utilizations
 * @param {{
 *  origin_id: number,
 *  date: string,
 *  preparation_id?: number,
 *  type?: string,
 *  qty?: number,
 *  unit?: string,
 *  note?: string,
 *  items?: Array<{ ingredient_id: number, qty: number, unit: string }>
 * }} payload
 */
export async function createUtilization(payload) {
  const res = await api.post('utilizations', payload)
  return res.data
}

/** GET /utilizations/:id @param {number|string} id */
export async function getUtilizationById(id) {
  const res = await api.get(`utilizations/${id}`)
  return res.data
}

/**
 * PATCH /utilizations/:id
 * @param {number|string} id
 * @param {{
 *  origin_id?: number,
 *  date?: string,
 *  preparation_id?: number|null,
 *  type?: string|null,
 *  qty?: number|null,
 *  unit?: string|null,
 *  note?: string|null,
 * }} payload
 */
export async function updateUtilizationById(id, payload) {
  const res = await api.patch(`utilizations/${id}`, payload)
  return res.data
}

/** DELETE /utilizations/:id @param {number|string} id */
export async function deleteUtilizationById(id) {
  const res = await api.delete(`utilizations/${id}`)
  return res.data
}
