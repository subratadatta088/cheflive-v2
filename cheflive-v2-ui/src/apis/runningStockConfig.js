import { api } from './api.js'

/**
 * GET /running-stock/configuration
 * @param {{ ingredient_id: number|string, origin_id: number|string }} params
 */
export async function getRunningStockConfig(params) {
  const res = await api.get('running-stock/configuration', { params })
  return res.data ?? {}
}

/**
 * POST /running-stock/configuration (upsert)
 * @param {{
 *   ingredient_id: number,
 *   origin_id: number,
 *   opening_stock_qty?: number|null,
 *   reorder_threshold_qty?: number|null,
 *   minimum_reorder_qty?: number|null,
 * }} payload
 */
export async function upsertRunningStockConfig(payload) {
  const res = await api.post('running-stock/configuration', payload)
  return res.data ?? {}
}
