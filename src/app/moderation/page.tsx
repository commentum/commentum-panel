"use client"

import { useEffect, useState, useMemo } from 'react'
import { CommentumApi } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import {
  ShieldAlert, Trash2, UserMinus,
  CheckCircle2, Search, RefreshCw, AlertCircle,
  MoreHorizontal, MessageSquare} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Report {
  id: string
  comment_id: string
  comment_content: string
  comment_author: string
  comment_author_avatar?: string
  parent_content?: string
  parent_author?: string
  reporter: string
  reason: string
  created_at: string
}

export default function Admin() {
  const { role } = useAuth()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchQueue = async () => {
    setLoading(true)
    try {
      const data = await CommentumApi.listReports(100, 0)
      setReports(data.reports || [])
    } catch (err) {
      toast.error("Failed to load reports")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (role === 'admin' || role === 'moderator') fetchQueue()
  }, [role])

  const filteredReports = useMemo(() => {
    if (!search) return reports
    const lowerSearch = search.toLowerCase()
    return reports.filter(r =>
      r.comment_content.toLowerCase().includes(lowerSearch) ||
      r.comment_author.toLowerCase().includes(lowerSearch) ||
      r.reporter.toLowerCase().includes(lowerSearch) ||
      r.reason.toLowerCase().includes(lowerSearch)
    )
  }, [reports, search])

  const handleAction = async (id: string, action: 'hidden' | 'removed' | 'active') => {
    try {
      await CommentumApi.setCommentStatus(id, action)
      const actionText = action === 'active' ? 'approved' : action === 'hidden' ? 'hidden' : 'removed'
      toast.success(`Comment ${actionText}`)
      setReports(prev => prev.filter(r => r.comment_id !== id))
    } catch (err) {
      toast.error("Action failed")
    }
  }

  const handleBanUser = async () => {
    toast.error("Ban functionality requires user ID (pending update)")
  }

  if (role !== 'admin' && role !== 'moderator') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
          <div>
            <h1 className="text-2xl font-bold">Access Denied</h1>
            <p className="text-sm text-muted-foreground">You don't have permission to view this page.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/40 pb-20">
      <div className="sticky top-0 z-30 w-full bg-background/80 backdrop-blur-md border-b">
        <div className="container mx-auto max-w-5xl px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <span className="font-bold text-lg">Moderation Queue</span>
            <Badge variant="secondary" className="ml-2 rounded-full px-2.5">{reports.length}</Badge>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-64 hidden sm:block">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search reports..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 bg-muted/50 border-none"
              />
            </div>
            <Button variant="ghost" size="icon" onClick={fetchQueue} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </div>

      <main className="container mx-auto max-w-5xl p-4 space-y-6 mt-6">
        {loading && reports.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <h3 className="text-lg font-medium">All Caught Up</h3>
            <p className="text-muted-foreground text-sm">No pending reports found.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-1">
            {filteredReports.map((report) => (
              <Card key={report.id} className="overflow-hidden border-border/50 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="bg-muted/30 p-4 pb-3 flex flex-row items-start justify-between space-y-0 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <AlertCircle className="h-4 w-4 text-orange-500" />
                      Reported for <span className="text-orange-600 font-bold capitalize">{report.reason}</span>
                    </span>
                    <span>•</span>
                    <span>by @{report.reporter}</span>
                    <span>•</span>
                    <span suppressHydrationWarning>{new Date(report.created_at).toLocaleDateString()}</span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleBanUser(report.comment_author)} disabled>
                        <UserMinus className="mr-2 h-4 w-4" /> Ban User (Pending)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>

                <CardContent className="p-4 space-y-4">
                  {/* Parent Context */}
                  {report.parent_content && (
                    <div className="relative pl-4 border-l-2 border-primary/20 bg-primary/5 rounded-r-md p-3 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2 mb-1 text-xs font-semibold text-primary">
                        <MessageSquare className="h-3 w-3" />
                        Replying to @{report.parent_author}:
                      </div>
                      <p className="line-clamp-2 italic">"{report.parent_content}"</p>
                    </div>
                  )}

                  {/* Reported Content */}
                  <div className="flex gap-4">
                    <Avatar className="h-10 w-10 border mt-1">
                      <AvatarImage src={report.comment_author_avatar} className="object-cover" />
                      <AvatarFallback>{report.comment_author[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">@{report.comment_author}</span>
                      </div>
                      <p className="text-sm leading-relaxed text-foreground/90">{report.comment_content}</p>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="bg-muted/10 p-2 px-4 flex justify-end gap-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => handleAction(report.comment_id, 'active')}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
                    Keep
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive border-destructive/20 hover:border-destructive/50 bg-destructive/5"
                    onClick={() => handleAction(report.comment_id, 'removed')}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
