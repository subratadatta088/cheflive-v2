import { api } from './api.js'

/**
 * POST /ingredients
 * @param {{ category_id: number|string, name: string, unit: string, base_price?: number, tags?: string[], is_active?: boolean }} payload
 */
export async function createIngredient(payload) {
  const res = await api.post('ingredients', payload)
  return res.data
}

/**
 * POST /ingredients/bulk
 * @param {Array<{ category_id: number|string, name: string, unit: string, base_price?: number, tags?: string[], is_active?: boolean, __row?: number }>|{ items: any[] }} payload
 */
export async function bulkCreateIngredients(payload) {
  const res = await api.post('ingredients/bulk', payload)
  return res.data
}

/**
 * GET /ingredients
 * Fetch many ingredients by ids (query param).
 * @param {number[]} ids
 */
export async function getIngredientsBulkByIds(ids) {
  const list = Array.isArray(ids) ? ids : []
  const res = await api.get('ingredients', { params: { ids: list.join(',') } })
  return res.data
}

/**
 * PUT /ingredients/bulk
 * Bulk update ingredients.
 * NOTE: Backend endpoint will be defined next.
 * @param {{ items: Array<{ id: number, category_id?: number, name?: string, unit?: string, base_price?: number|null, tags?: string[]|null, is_active?: boolean, __row?: number }> }} payload
 */
export async function bulkUpdateIngredients(payload) {
  const res = await api.put('ingredients/bulk', payload)
  return res.data
}

/**
 * GET /ingredients
 * @param {{ q?: string, page?: number, limit?: number, is_active?: 0|1|boolean|'0'|'1', ids?: number[]|string, category_ids?: number[]|string }} [query]
 */
export async function listIngredients(query = {}) {
  const res = await api.get('ingredients', { params: query })
  const data = res.data ?? {}
  const items = Array.isArray(data?.items) ? data.items : []
  const pagination =
    data && typeof data === 'object' && data.pagination && typeof data.pagination === 'object'
      ? data.pagination
      : null

  return { items, pagination, raw: data }
}

/** GET /ingredients/:id @param {number|string} id */
export async function getIngredientById(id) {
  const res = await api.get(`ingredients/${id}`)
  return res.data
}

/** PATCH /ingredients/:id @param {number|string} id @param {{ category_id?: number, name?: string, unit?: string, base_price?: number|null, tags?: string[]|null, is_active?: boolean }} payload */
export async function updateIngredientById(id, payload) {
  const res = await api.patch(`ingredients/${id}`, payload)
  return res.data
}

/** DELETE /ingredients/:id @param {number|string} id */
export async function deleteIngredientById(id) {
  const res = await api.delete(`ingredients/${id}`)
  return res.data
}

/**
 * POST /ingredients/bulk-upload (multipart file)
 * @param {File} file
 */
export async function bulkUploadIngredients(file) {
  const fd = new FormData()
  fd.append('file', file)
  const res = await api.post('ingredients/bulk-upload', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

