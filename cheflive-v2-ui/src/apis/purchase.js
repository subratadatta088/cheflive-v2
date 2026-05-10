import { api } from './api.js'

/**
 * GET /purchases
 *
 * @param {{ page?: number, limit?: number, q?: string, origin_id?: number }} [query]
 * @returns {Promise<{ page?: number, limit?: number, items?: unknown[] }>}
 * Each purchase item may include `origin_name` and `origin_type` from a server-side join.
 */
export async function listPurchases(query = {}) {
  const res = await api.get('purchases', { params: query })
  return res.data ?? {}
}

/**
 * POST /purchases
 *
 * Server schema (PurchaseCreateSchema): organization_id is set server-side
 * from the auth token, so it is not part of this payload for non-superadmins.
 *
 * @param {{
 *  origin_id: number,
 *  transfer_to?: number,
 *  date: string,
 *  note?: string,
 *  items?: Array<{
 *    ingredient_id: number,
 *    qty: number,
 *    unit?: string,
 *    unit_price?: number,
 *  }>,
 * }} payload
 */
export async function createPurchase(payload) {
  const res = await api.post('purchases', payload)
  return res.data
}

/** GET /purchases/:id */
export async function getPurchaseById(id) {
  const res = await api.get(`purchases/${id}`)
  return res.data ?? {}
}

/**
 * PATCH /purchases/:id
 * @param {{ origin_id?: number, date?: string, note?: string|null }} payload
 */
export async function updatePurchaseById(id, payload) {
  const res = await api.patch(`purchases/${id}`, payload)
  return res.data ?? {}
}

/** DELETE /purchases/:id */
export async function deletePurchaseById(id) {
  const res = await api.delete(`purchases/${id}`)
  return res.data ?? {}
}
