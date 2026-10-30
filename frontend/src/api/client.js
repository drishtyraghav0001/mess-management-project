// Small fetch wrapper: adds the JWT token, sends/receives JSON and turns
// backend error responses ({detail, oracle_code}) into ApiError objects.
const BASE = import.meta.env.VITE_API_URL || '' // empty = use the Vite proxy (/api -> :8000)
const TOKEN_KEY = 'mess_token'

export class ApiError extends Error {
  constructor(message, status, oracleCode, errors) {
    super(message)
    this.status = status
    this.oracleCode = oracleCode
    this.errors = errors || []
  }
}

let token = localStorage.getItem(TOKEN_KEY)
let unauthorizedHandler = null

export const getToken = () => token
export function setToken(value) {
  token = value
  if (value) localStorage.setItem(TOKEN_KEY, value)
  else localStorage.removeItem(TOKEN_KEY)
}
export function onUnauthorized(fn) {
  unauthorizedHandler = fn
}

function buildUrl(path, params) {
  const url = new URL(BASE + path, window.location.origin)
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
  })
  return url.toString()
}

async function request(method, path, { body, params } = {}) {
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  let res
  try {
    res = await fetch(buildUrl(path, params), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('Cannot reach the backend. Is the FastAPI server running on http://localhost:8000?', 0)
  }
  let data = null
  const text = await res.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { detail: text }
    }
  }
  if (!res.ok) {
    if (res.status === 401 && token && path !== '/api/auth/login') unauthorizedHandler?.()
    let message = data?.detail
    if (Array.isArray(message)) message = message.map((d) => d.msg).join('; ')
    if (res.status === 502 || res.status === 504) message = 'The backend is not responding. Start it with: uvicorn app.main:app --reload'
    throw new ApiError(message || `Request failed (${res.status})`, res.status, data?.oracle_code, data?.errors)
  }
  return data
}

export const api = {
  get: (path, params) => request('GET', path, { params }),
  post: (path, body) => request('POST', path, { body: body ?? {} }),
  put: (path, body) => request('PUT', path, { body }),
  patch: (path, body) => request('PATCH', path, { body }),
  del: (path) => request('DELETE', path),
}
