import { api } from './api.js'

/**
 * GET /stocks
 * @param {{
 *   q?: string,
 *   page?: number,
 *   limit?: number,
 *   origin_ids?: number[]|string,
 *   ingredient_ids?: number[]|string,
 * }} [query]
 */
export async function listStocks(query = {}) {
  const params = { ...query }
  if (Array.isArray(params.origin_ids) && params.origin_ids.length) {
    params.origin_ids = params.origin_ids.join(',')
  }
  if (Array.isArray(params.ingredient_ids) && params.ingredient_ids.length) {
    params.ingredient_ids = params.ingredient_ids.join(',')
  }
  const res = await api.get('stocks', { params })
  const data = res.data ?? {}
  const items = Array.isArray(data?.items) ? data.items : []
  const pagination =
    data && typeof data === 'object' && data.pagination && typeof data.pagination === 'object'
      ? data.pagination
      : null
  return { items, pagination, raw: data }
}
