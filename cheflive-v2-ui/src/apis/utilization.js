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

function normalizeUtilizationAggregateResponse(data, ids) {
  return {
    utilization_ids: Array.isArray(data?.utilization_ids)
      ? data.utilization_ids.map((v) => Number(v)).filter(Number.isFinite)
      : ids,
    found_utilization_ids: Array.isArray(data?.found_utilization_ids)
      ? data.found_utilization_ids.map((v) => Number(v)).filter(Number.isFinite)
      : [],
    missing_ids: Array.isArray(data?.missing_ids)
      ? data.missing_ids.map((v) => Number(v)).filter(Number.isFinite)
      : [],
    items: Array.isArray(data?.items) ? data.items : [],
    subtotal: Number.isFinite(Number(data?.subtotal)) ? Number(data.subtotal) : 0,
  }
}

function utilizationAggregateBody(payload) {
  const idsRaw = Array.isArray(payload?.ids) ? payload.ids : []
  const ids = [...new Set(idsRaw.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0))]
  const body = { ids }
  const orgId = payload?.organization_id != null ? Number(payload.organization_id) : NaN
  if (Number.isFinite(orgId) && orgId > 0) body.organization_id = orgId
  return { ids, body }
}

/** POST /utilizations/grouped-items */
export async function getGroupedUtilizationItems(payload) {
  const { ids, body } = utilizationAggregateBody(payload)
  const res = await api.post('utilizations/grouped-items', body)
  return normalizeUtilizationAggregateResponse(res.data ?? {}, ids)
}

/** POST /utilizations/all-items */
export async function getAllUtilizationItems(payload) {
  const { ids, body } = utilizationAggregateBody(payload)
  const res = await api.post('utilizations/all-items', body)
  return normalizeUtilizationAggregateResponse(res.data ?? {}, ids)
}
