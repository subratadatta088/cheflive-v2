import { api } from './api.js'

/**
 * GET /transfers
 * @param {{ q?: string, page?: number, limit?: number, from_origin_id?: number, to_origin_id?: number, include_system_entry?: boolean }} [query]
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
 *  note?: string|null,
 *  items?: Array<{ ingredient_id: number, qty: number, unit: string }>
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

function normalizeTransferAggregateResponse(data, ids) {
  return {
    transfer_ids: Array.isArray(data?.transfer_ids) ? data.transfer_ids.map((v) => Number(v)).filter(Number.isFinite) : ids,
    found_transfer_ids: Array.isArray(data?.found_transfer_ids)
      ? data.found_transfer_ids.map((v) => Number(v)).filter(Number.isFinite)
      : [],
    missing_ids: Array.isArray(data?.missing_ids)
      ? data.missing_ids.map((v) => Number(v)).filter(Number.isFinite)
      : [],
    items: Array.isArray(data?.items) ? data.items : [],
    subtotal: Number.isFinite(Number(data?.subtotal)) ? Number(data.subtotal) : 0,
  }
}

function transferAggregateBody(payload) {
  const idsRaw = Array.isArray(payload?.ids) ? payload.ids : []
  const ids = [...new Set(idsRaw.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0))]
  const body = { ids }
  const orgId = payload?.organization_id != null ? Number(payload.organization_id) : NaN
  if (Number.isFinite(orgId) && orgId > 0) body.organization_id = orgId
  return { ids, body }
}

/** POST /transfers/grouped-items */
export async function getGroupedTransferItems(payload) {
  const { ids, body } = transferAggregateBody(payload)
  const res = await api.post('transfers/grouped-items', body)
  return normalizeTransferAggregateResponse(res.data ?? {}, ids)
}

/** POST /transfers/all-items */
export async function getAllTransferItems(payload) {
  const { ids, body } = transferAggregateBody(payload)
  const res = await api.post('transfers/all-items', body)
  return normalizeTransferAggregateResponse(res.data ?? {}, ids)
}

