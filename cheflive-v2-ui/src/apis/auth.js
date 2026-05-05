import { api, setAuthToken } from './api.js'

/**
 * @param {{ username: string, password: string }} payload
 * @returns {Promise<any>}
 */
export async function login(payload) {
  const res = await api.post('auth/login', payload)

  const data = res?.data
  const token = data?.token ?? data?.accessToken ?? data?.access_token
  if (token) setAuthToken(token)

  return data
}

