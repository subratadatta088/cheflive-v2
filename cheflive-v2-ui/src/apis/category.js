import { api } from './api.js'

/**
 * @param {{ q?: string, page?: number, limit?: number, is_active?: 0|1|boolean|'0'|'1' }} [query]
 */
export async function listCategories(query = {}) {
  const res = await api.get('categories', { params: query })
  return res.data
}

/**
 * @param {{ name: string, is_active?: boolean }} payload
 */
export async function createCategory(payload) {
  const res = await api.post('categories', payload)
  return res.data
}

/** @param {number|string} id */
export async function getCategoryById(id) {
  const res = await api.get(`categories/${id}`)
  return res.data
}

/** @param {number|string} id @param {{ name?: string, is_active?: boolean }} payload */
export async function updateCategoryById(id, payload) {
  const res = await api.patch(`categories/${id}`, payload)
  return res.data
}

/** @param {number|string} id */
export async function deleteCategoryById(id) {
  const res = await api.delete(`categories/${id}`)
  return res.data
}

