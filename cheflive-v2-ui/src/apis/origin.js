import { api } from './api.js'

/**
 * GET /origins
 * @param {{ q?: string, page?: number, limit?: number, type?: string, is_active?: 0|1|boolean|'0'|'1' }} [query]
 */
export async function listOrigins(query = {}) {
  const res = await api.get('origins', { params: query })
  const data = res.data ?? {}
  const items = Array.isArray(data?.items) ? data.items : []
  return { items, raw: data }
}

/**
 * POST /origins
 * @param {{ name: string, type: string, is_active?: boolean, is_default?: boolean }} payload
 */
export async function createOrigin(payload) {
  const res = await api.post('origins', payload)
  return res.data
}

/** GET /origins/:id @param {number|string} id */
export async function getOriginById(id) {
  const res = await api.get(`origins/${id}`)
  return res.data
}

/**
 * PATCH /origins/:id
 * @param {number|string} id
 * @param {{ name?: string, type?: string, is_active?: boolean, is_default?: boolean }} payload
 */
export async function updateOriginById(id, payload) {
  const res = await api.patch(`origins/${id}`, payload)
  return res.data
}

/** DELETE /origins/:id @param {number|string} id */
export async function deleteOriginById(id) {
  const res = await api.delete(`origins/${id}`)
  return res.data
}

