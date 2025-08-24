'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import Cookies from 'js-cookie'

interface User {
  id: number
  name: string
  email: string
  emailVerifiedAt: string | null
  isAdmin: boolean
  createdAt: string
  updatedAt: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<boolean>
  register: (name: string, email: string, password: string) => Promise<boolean>
  logout: () => void
  refreshToken: () => Promise<boolean>
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const API_URL = process.env.NEXT_PUBLIC_API_URL

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const token = Cookies.get('accessToken')
      if (!token) {
        setLoading(false)
        return
      }

      const response = await fetch(`${API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        setUser(data.data.user)
      } else if (response.status === 401) {
        // Token expired, try to refresh
        const refreshed = await refreshToken()
        if (!refreshed) {
          Cookies.remove('accessToken')
          Cookies.remove('refreshToken')
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (response.ok) {
        const { user, tokens } = data.data
        setUser(user)
        
        // Store tokens in cookies
        Cookies.set('accessToken', tokens.accessToken, { expires: 1 }) // 1 day
        Cookies.set('refreshToken', tokens.refreshToken, { expires: 7 }) // 7 days
        
        toast.success('Login successful!')
        return true
      } else {
        toast.error(data.message || 'Login failed')
        return false
      }
    } catch (error) {
      console.error('Login error:', error)
      toast.error('Login failed. Please try again.')
      return false
    }
  }

  const register = async (name: string, email: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      })

      const data = await response.json()

      if (response.ok) {
        const { user, tokens } = data.data
        setUser(user)
        
        // Store tokens in cookies
        Cookies.set('accessToken', tokens.accessToken, { expires: 1 })
        Cookies.set('refreshToken', tokens.refreshToken, { expires: 7 })
        
        toast.success('Registration successful! Please check your email to verify your account.')
        return true
      } else {
        toast.error(data.message || 'Registration failed')
        return false
      }
    } catch (error) {
      console.error('Registration error:', error)
      toast.error('Registration failed. Please try again.')
      return false
    }
  }

  const logout = async () => {
    try {
      const refreshToken = Cookies.get('refreshToken')
      if (refreshToken) {
        await fetch(`${API_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Cookies.get('accessToken')}`,
          },
          body: JSON.stringify({ refreshToken }),
        })
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setUser(null)
      Cookies.remove('accessToken')
      Cookies.remove('refreshToken')
      toast.success('Logged out successfully')
      router.push('/')
    }
  }

  const refreshToken = async (): Promise<boolean> => {
    try {
      const refreshTokenValue = Cookies.get('refreshToken')
      if (!refreshTokenValue) {
        return false
      }

      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: refreshTokenValue }),
      })

      if (response.ok) {
        const data = await response.json()
        const { user, tokens } = data.data
        
        setUser(user)
        Cookies.set('accessToken', tokens.accessToken, { expires: 1 })
        Cookies.set('refreshToken', tokens.refreshToken, { expires: 7 })
        
        return true
      } else {
        return false
      }
    } catch (error) {
      console.error('Token refresh error:', error)
      return false
    }
  }

  const value: AuthContextType = {
    user,
    loading,
    login,
    register,
    logout,
    refreshToken,
    isAuthenticated: !!user,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Higher-order component for protected routes
export function withAuth<P extends object>(Component: React.ComponentType<P>) {
  return function AuthenticatedComponent(props: P) {
    const { user, loading } = useAuth()
    const router = useRouter()

    useEffect(() => {
      if (!loading && !user) {
        router.push('/auth/login')
      }
    }, [user, loading, router])

    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
        </div>
      )
    }

    if (!user) {
      return null
    }

    return <Component {...props} />
  }
}

// Higher-order component for admin-only routes
export function withAdminAuth<P extends object>(Component: React.ComponentType<P>) {
  return function AdminAuthenticatedComponent(props: P) {
    const { user, loading } = useAuth()
    const router = useRouter()

    useEffect(() => {
      if (!loading) {
        if (!user) {
          router.push('/auth/login')
        } else if (!user.isAdmin) {
          router.push('/dashboard')
          toast.error('Admin access required')
        }
      }
    }, [user, loading, router])

    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
        </div>
      )
    }

    if (!user || !user.isAdmin) {
      return null
    }

    return <Component {...props} />
  }
}