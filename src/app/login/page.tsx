"use client"

import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

const ANILIST_CLIENT_ID = process.env.NEXT_PUBLIC_ANILIST_CLIENT_ID || 'DEMO_CLIENT_ID'

export default function LoginPage() {
  useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAniListLogin = () => {
    setIsLoading(true)
    setError(null)

    // Redirect to AniList OAuth
    const anilistUrl = new URL('https://anilist.co/api/v2/oauth/authorize')
    anilistUrl.searchParams.append('client_id', ANILIST_CLIENT_ID)
    anilistUrl.searchParams.append('response_type', 'code')

    window.location.href = anilistUrl.toString()
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-sm border-none shadow-none sm:border sm:shadow-sm">
        <CardHeader className="text-center space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight">
            Anime Comments
          </CardTitle>
          <CardDescription className="text-balance">
            Sign in with AniList to get started
          </CardDescription>
        </CardHeader>
        
        <CardContent className="grid gap-4">
          {/* Error Message */}
          {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-xs font-medium text-destructive">
              {error}
            </div>
          )}

          {/* AniList Button */}
          <Button
            onClick={handleAniListLogin}
            disabled={isLoading}
            className="w-full bg-[#3dbbee] hover:bg-[#3dbbee]/90 text-white font-semibold"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Redirecting...
              </>
            ) : (
              "Continue with AniList"
            )}
          </Button>

          {/* Info Box */}
          <div className="rounded-lg bg-muted p-4 text-xs text-muted-foreground">
            <p className="font-bold text-foreground mb-2">How it works:</p>
            <ul className="grid gap-1.5 list-disc list-inside">
              <li>You&apos;ll be redirected to AniList to sign in</li>
              <li>Approve the permissions request</li>
              <li>You&apos;ll be redirected back with access granted</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
