"use client"

import React, { useEffect, useState, useMemo } from 'react'
import { CommentumApi } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { 
  ShieldAlert, Trash2, UserMinus, 
  CheckCircle2, Search, RefreshCw, AlertCircle, 
  MoreHorizontal
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow 
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Report {
  id: string
  comment_id: string
  comment_content: string
  comment_author: string
  reporter: string
  reason: string
  user_id: string
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
    return reports.filter(r => 
      r.comment_content.toLowerCase().includes(search.toLowerCase()) ||
      r.comment_author.toLowerCase().includes(search.toLowerCase())
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
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        {/* Header */}
        <div className="mb-8 space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-6 w-6" />
                <h1 className="text-3xl font-bold">Moderation Panel</h1>
              </div>
              <p className="text-sm text-muted-foreground">Review and manage reported comments</p>
            </div>
            <Button 
              onClick={fetchQueue} 
              disabled={loading}
              variant="outline" 
              size="sm"
              className="gap-2"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by user or content..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Stats - Minimal */}
        <div className="mb-6 flex items-center justify-between text-sm">
          <div>
            <span className="text-muted-foreground">Pending: </span>
            <span className="font-semibold text-lg">{reports.length}</span>
          </div>
          <Badge variant="outline" className="capitalize">{role}</Badge>
        </div>

        {/* Reports Table */}
        <Card className="border">
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-base">Reports</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center space-y-2">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">Loading reports...</p>
                </div>
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <p className="text-sm">No reports match your search.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-semibold text-xs">Content</TableHead>
                      <TableHead className="font-semibold text-xs">Author</TableHead>
                      <TableHead className="font-semibold text-xs">Reason</TableHead>
                      <TableHead className="text-right w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReports.map((report) => (
                      <TableRow key={report.id} className="hover:bg-muted/30">
                        <TableCell className="max-w-sm">
                          <p className="text-xs line-clamp-1 text-foreground">
                            {report.comment_content}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p className="text-xs font-medium">@{report.comment_author}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">
                            {report.reason}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="h-8 w-8"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem 
                                onClick={() => handleAction(report.comment_id, 'active')}
                                className="text-green-600 cursor-pointer"
                              >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Approve
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleAction(report.comment_id, 'removed')}
                                className="text-destructive cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remove
                              </DropdownMenuItem>
                              {role === 'admin' && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => CommentumApi.banUser(report.user_id)}
                                    className="text-destructive cursor-pointer"
                                  >
                                    <UserMinus className="h-4 w-4 mr-2" />
                                    Ban User
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
