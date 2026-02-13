'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { LogOut, ShieldCheck, ChevronDown, MessageSquare } from 'lucide-react'

export const Header: React.FC = () => {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isAuthenticated, logout, role } = useAuth()

  const isActive = (href: string) => pathname === href

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-sm">
      <div className="flex h-14 items-center justify-between px-4 md:px-6 max-w-6xl mx-auto w-full">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 hover:opacity-75 transition-opacity">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            C
          </div>
          <span className="font-semibold text-sm hidden sm:inline">Commentum</span>
        </Link>

        {/* Navigation */}
        <div className="hidden md:flex items-center gap-8">
          <NavLink href="/" active={isActive('/')}>
            <MessageSquare className="h-4 w-4 mr-2" />
            Feed
          </NavLink>
          
          {(role === 'admin' || role === 'moderator') && (
            <NavLink href="/moderation" active={isActive('/moderation')}>
              <ShieldCheck className="h-4 w-4 mr-2" />
              Moderation
            </NavLink>
          )}
        </div>

        {/* User Section */}
        <div className="flex items-center gap-2">
          {isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold">
                      {user.username?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline text-sm font-medium">{user.username}</span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal py-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">{user.username}</p>
                    <div className="flex items-center gap-2 pt-1">
                      <Badge variant="secondary" className="text-[11px] capitalize">
                        {user.role}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        Joined {new Date(user.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </DropdownMenuLabel>

                {(role === 'admin' || role === 'moderator') && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link href="/moderation" className="flex items-center">
                        <ShieldCheck className="h-4 w-4 mr-2" />
                        <span className="text-sm">Moderation Panel</span>
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem 
                  onClick={handleLogout} 
                  className="text-destructive cursor-pointer"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  <span className="text-sm">Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/login">
              <Button size="sm">Sign In</Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link 
      href={href} 
      className={cn(
        "flex items-center gap-2 text-sm font-medium transition-colors",
        active 
          ? "text-foreground" 
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </Link>
  )
}
