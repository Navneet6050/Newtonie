"use client"

import * as React from "react"
import {
  type AuthUser,
  getAuthToken,
  getCurrentUser,
  login as apiLogin,
  register as apiRegister,
  setAuthToken,
} from "./api"

interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string, rememberDevice?: boolean) => Promise<void>
  register: (name: string, email: string, password: string, rememberDevice?: boolean) => Promise<void>
  logout: () => void
  showLoginModal: boolean
  setShowLoginModal: (show: boolean) => void
  refreshUser: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [showLoginModal, setShowLoginModal] = React.useState(false)

  const refreshUser = React.useCallback(async () => {
    const token = getAuthToken()
    if (!token) {
      setUser(null)
      return
    }

    try {
      setIsLoading(true)
      const currentUser = await getCurrentUser()
      setUser(currentUser)
    } catch {
      setAuthToken(null)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    let ignore = false
    const handleUnauthorized = () => {
      setUser(null)
      setShowLoginModal(true)
    }
    window.addEventListener("newtonite:unauthorized", handleUnauthorized)

    Promise.resolve(getAuthToken() ? getCurrentUser() : null)
      .then((currentUser) => {
        if (!ignore) setUser(currentUser)
      })
      .catch(() => {
        if (!ignore) {
          setAuthToken(null)
          setUser(null)
        }
      })
      .finally(() => {
        if (!ignore) setIsLoading(false)
      })

    return () => {
      ignore = true
      window.removeEventListener("newtonite:unauthorized", handleUnauthorized)
    }
  }, [])

  const login = async (email: string, password: string, rememberDevice = true) => {
    setIsLoading(true)
    try {
      const resp = await apiLogin(email, password, rememberDevice)
      setUser(resp.user)
      setShowLoginModal(false)
    } finally {
      setIsLoading(false)
    }
  }

  const register = async (name: string, email: string, password: string, rememberDevice = true) => {
    setIsLoading(true)
    try {
      const resp = await apiRegister(name, email, password, rememberDevice)
      setUser(resp.user)
      setShowLoginModal(false)
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    setAuthToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        showLoginModal,
        setShowLoginModal,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
