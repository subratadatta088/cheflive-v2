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

/**
 * POST /purchases/grouped-items
 *
 * Aggregate line items across multiple purchases, grouped by ingredient. Quantities
 * are normalized to each ingredient's default unit; `unit_price` is intentionally
 * omitted because the same ingredient can have different prices across purchases.
 * Use the per-row `subtotal` (money spent on that ingredient) instead.
 *
 * @param {{ ids: Array<number|string>, organization_id?: number }} payload
 * @returns {Promise<{
 *   purchase_ids: number[],
 *   found_purchase_ids: number[],
 *   missing_ids: number[],
 *   items: Array<{
 *     ingredient_id: number,
 *     ingredient_name: string|null,
 *     qty: number,
 *     unit: string,
 *     subtotal: number,
 *   }>,
 *   subtotal: number,
 * }>}
 */
export async function getGroupedPurchaseItems(payload) {
  const idsRaw = Array.isArray(payload?.ids) ? payload.ids : []
  const ids = [...new Set(idsRaw.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0))]
  const body = { ids }
  const orgId = payload?.organization_id != null ? Number(payload.organization_id) : NaN
  if (Number.isFinite(orgId) && orgId > 0) body.organization_id = orgId
  const res = await api.post('purchases/grouped-items', body)
  const data = res.data ?? {}
  return {
    purchase_ids: Array.isArray(data?.purchase_ids) ? data.purchase_ids.map((v) => Number(v)).filter(Number.isFinite) : ids,
    found_purchase_ids: Array.isArray(data?.found_purchase_ids)
      ? data.found_purchase_ids.map((v) => Number(v)).filter(Number.isFinite)
      : [],
    missing_ids: Array.isArray(data?.missing_ids)
      ? data.missing_ids.map((v) => Number(v)).filter(Number.isFinite)
      : [],
    items: Array.isArray(data?.items) ? data.items : [],
    subtotal: Number.isFinite(Number(data?.subtotal)) ? Number(data.subtotal) : 0,
  }
}
