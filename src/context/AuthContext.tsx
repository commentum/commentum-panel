"use client"

import { AppError, CommentumApi, User } from '@/lib/api'
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'

interface AuthContextType {
  user: User | null
  role: User['role'] | null
  isLoading: boolean
  isAuthenticated: boolean
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  login: (provider: 'anilist' | 'mal' | 'simkl', token: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchUser = useCallback(async () => {
    try {
      // Use the service layer to get profile data
      const data = await CommentumApi.getMe()
      setUser(data.user)
    } catch (error) {
      // If 401 Unauthorized, clear the user
      if (error instanceof AppError && error.status === 401) {
        setUser(null)
      }
      console.error('Auth sync failed:', error instanceof AppError ? error.message : error)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
  (async () => {
    const token = document.cookie
      .split('; ')
      .find((row) => row.startsWith('auth_token='))
      ?.split('=')[1] ?? localStorage.getItem("auth_token");

    if (token) {
      CommentumApi.setToken(token);
    }

    await fetchUser();
  })();
}, [fetchUser]);

  const login = useCallback(async (provider: 'anilist' | 'mal' | 'simkl', token: string) => {
    setIsLoading(true)
    try {
      const data = await CommentumApi.login(provider, token)
      setUser(data.user)
    } catch (error) {
      console.error('Login failed:', error instanceof AppError ? error.message : error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    setIsLoading(true)
    try {
      await CommentumApi.logout()
    } catch (error) {
      console.error('Logout error:', error instanceof AppError ? error.message : error)
    } finally {
      // Always clear local state even if server-side logout fails
      setUser(null)
      setIsLoading(false)
      window.location.href = '/login'
    }
  }, [])

  const value = useMemo(() => ({
    user,
    role: user?.role || null,
    isLoading,
    isAuthenticated: !!user,
    logout,
    refreshUser: fetchUser,
    login,
  }), [user, isLoading, logout, fetchUser, login])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}