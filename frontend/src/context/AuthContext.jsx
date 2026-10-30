import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, getToken, onUnauthorized, setToken } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  useEffect(() => {
    onUnauthorized(logout)
    if (!getToken()) {
      setReady(true)
      return
    }
    api
      .get('/api/auth/me')
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setReady(true))
  }, [logout])

  const login = useCallback(async (username, password) => {
    const res = await api.post('/api/auth/login', { username, password })
    setToken(res.access_token)
    const me = await api.get('/api/auth/me')
    setUser(me)
    return me
  }, [])

  const value = useMemo(
    () => ({
      user,
      ready,
      login,
      logout,
      isAdmin: user?.role === 'admin',
      isStaff: user?.role === 'staff',
      isStudent: user?.role === 'student',
      can: (...roles) => !!user && roles.includes(user.role),
    }),
    [user, ready, login, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
