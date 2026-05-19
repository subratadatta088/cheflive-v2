import { api } from './api.js'

/**
 * @param {{ from_date: string, to_date: string, organization_id?: number }} body
 */
export async function postPurchaseAnalytics(body) {
  const res = await api.post('reports/purchase-analytics', body)
  return res.data?.data ?? null
}

/**
 * @param {{ from_date: string, to_date: string, organization_id?: number }} body
 */
export async function postPurchaseTimeline(body) {
  const res = await api.post('reports/purchase-timeline', body)
  return res.data?.data ?? null
}
