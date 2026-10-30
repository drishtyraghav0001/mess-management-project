import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api/client'

// Loads data from a GET endpoint and keeps loading / error state.
// Call reload() after a create/update/delete to refresh the data.
export function useApi(path, params, { skip = false } = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(!skip)
  const [error, setError] = useState(null)
  const key = JSON.stringify(params || {})
  const seq = useRef(0)

  const load = useCallback(async () => {
    if (!path) return
    const mine = ++seq.current
    setLoading(true)
    setError(null)
    try {
      const res = await api.get(path, JSON.parse(key))
      if (mine === seq.current) setData(res)
    } catch (e) {
      if (mine === seq.current) setError(e)
    } finally {
      if (mine === seq.current) setLoading(false)
    }
  }, [path, key])

  useEffect(() => {
    if (!skip) load()
  }, [load, skip])

  return { data, loading, error, reload: load, setData }
}
