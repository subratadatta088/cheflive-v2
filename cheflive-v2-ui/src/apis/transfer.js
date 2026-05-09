import { api } from './api.js'

/**
 * GET /transfers
 * @param {{ q?: string, page?: number, limit?: number, from_origin_id?: number, to_origin_id?: number }} [query]
 */
export async function listTransfers(query = {}) {
  const res = await api.get('transfers', { params: query })
  const data = res.data ?? {}
  const items = Array.isArray(data?.items) ? data.items : []
  return { items, raw: data }
}

/**
 * POST /transfers
 * @param {{
 *  from_origin_id?: number|null,
 *  to_origin_id?: number|null,
 *  from_purchase_id?: number|null,
 *  to_utilisation_id?: number|null,
 *  transfer_date: string,
 *  note?: string,
 *  items?: Array<{ ingredient_id: number, qty: number, unit: string }>
 * }} payload
 */
export async function createTransfer(payload) {
  const res = await api.post('transfers', payload)
  return res.data
}

/** GET /transfers/:id @param {number|string} id */
export async function getTransferById(id) {
  const res = await api.get(`transfers/${id}`)
  return res.data
}

/**
 * PATCH /transfers/:id
 * @param {number|string} id
 * @param {{
 *  from_origin_id?: number|null,
 *  to_origin_id?: number|null,
 *  from_purchase_id?: number|null,
 *  to_utilisation_id?: number|null,
 *  transfer_date?: string,
 *  note?: string|null
 * }} payload
 */
export async function updateTransferById(id, payload) {
  const res = await api.patch(`transfers/${id}`, payload)
  return res.data
}

/** DELETE /transfers/:id @param {number|string} id */
export async function deleteTransferById(id) {
  const res = await api.delete(`transfers/${id}`)
  return res.data
}

