'use client'

import React from 'react'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: 'user' | 'moderator' | 'admin'
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
}) => {
  const { isAuthenticated, user, isLoading, role } = useAuth()
  const router = useRouter()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading...</div>
      </div>
    )
  }

  // If there's no token/user and no saved role, redirect to login
  if (!isAuthenticated && !role) {
    router.replace('/login')
    return null
  }

  if (requiredRole) {
    const roleHierarchy = { user: 0, moderator: 1, admin: 2 }
    const userRole = user ? user.role : role || 'user'
    const userLevel = roleHierarchy[userRole]
    const requiredLevel = roleHierarchy[requiredRole]

    if (userLevel < requiredLevel) {
      router.replace('/')
      return null
    }
  }

  return <>{children}</>
}

interface RoleGuardProps {
  children: React.ReactNode
  requiredRole?: 'user' | 'moderator' | 'admin'
  fallback?: React.ReactNode
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  children,
  requiredRole,
  fallback = null,
}) => {
  const { user, role } = useAuth()

  if (!user && !role) {
    return <>{fallback}</>
  }

  if (requiredRole) {
    const roleHierarchy = { user: 0, moderator: 1, admin: 2 }
    const userRole = user ? user.role : role || 'user'
    const userLevel = roleHierarchy[userRole]
    const requiredLevel = roleHierarchy[requiredRole]

    if (userLevel < requiredLevel) {
      return <>{fallback}</>
    }
  }

  return <>{children}</>
}
