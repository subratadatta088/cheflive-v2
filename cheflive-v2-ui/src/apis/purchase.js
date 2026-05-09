import { api } from './api.js'

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
