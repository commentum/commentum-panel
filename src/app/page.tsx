"use client"

import React, { useEffect, useState, useCallback } from 'react'
import { CommentumApi, Comment, Reply } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  ThumbsUp, ThumbsDown, MessageSquare, Send,
  Loader2, Trash2, Flag, Edit2, X, Check, MoreHorizontal, ShieldAlert
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from 'sonner'

// --- Extended Types ---
// Ensure your backend actually returns 'avatar_url' in the JSON response for comments/replies
interface OptimisticReply extends Reply {
  isPending?: boolean;
  avatar_url?: string;
}
interface OptimisticComment extends Comment {
  replies?: OptimisticReply[];
  isPending?: boolean;
  avatar_url?: string;
}

export default function ShonenXCommentHub() {
  const { isAuthenticated, user, role } = useAuth()
  const [mediaId, setMediaId] = useState('shonenx-movie-1')

  const [comments, setComments] = useState<OptimisticComment[]>([])
  const [loading, setLoading] = useState(false)

  const [mainContent, setMainContent] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  const [isCooldown, setIsCooldown] = useState(false)
  const isAdmin = role === 'admin' || role === 'moderator'

  const startCooldown = () => {
    setIsCooldown(true)
    setTimeout(() => setIsCooldown(false), 2000)
  }

  const loadComments = useCallback(async () => {
    setLoading(true)
    try {
      const data = await CommentumApi.listComments(mediaId)
      setComments(data.comments)
    } catch {
      toast.error("Failed to sync comments")
    } finally {
      setLoading(false)
    }
  }, [mediaId])

  useEffect(() => { loadComments() }, [loadComments])

  // --- Voting ---
  const handleVote = async (id: string, type: 1 | -1, isReply: boolean) => {
    if (!isAuthenticated) return toast.error("Login to vote")
    const originalState = JSON.parse(JSON.stringify(comments));

    setComments(prev => prev.map(c => {
      if (!isReply && c.id === id) return { ...c, score: c.score - (c.user_vote || 0) + type, user_vote: type }
      if (c.replies) return { ...c, replies: c.replies.map(r => r.id === id ? { ...r, score: r.score - (r.user_vote || 0) + type, user_vote: type } : r) }
      return c
    }))

    try {
      isReply ? await CommentumApi.voteReply(id, type) : await CommentumApi.voteComment(id, type)
    } catch {
      setComments(originalState)
      toast.error("Vote failed")
    }
  }

  // --- Create Root Comment ---
  const handlePostMain = async () => {
    if (!mainContent.trim() || isCooldown) return
    startCooldown()

    const tempId = `temp-${Date.now()}`
    const newComment: OptimisticComment = {
      id: tempId, content: mainContent, score: 0, username: user?.username || 'You',
      avatar_url: user?.avatar_url, // Use local user avatar immediately
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      status: 'active', replies: [], has_more_replies: false, replies_count: 0, isPending: true
    }

    setComments(prev => [...prev, newComment])
    setMainContent('')

    try {
      const { post: comment } = await CommentumApi.createComment(mediaId, newComment.content)
      setComments(prev => prev.map(c => c.id === tempId ? { ...comment, replies: [] } : c))
    } catch {
      setComments(prev => prev.filter(c => c.id !== tempId))
      toast.error("Failed to post")
    }
  }

  // --- Create Reply ---
  const handlePostReply = async (parentId: string) => {
    if (!replyContent.trim() || isCooldown) return
    startCooldown()

    const tempId = `temp-${Date.now()}`
    const newReply: OptimisticReply = {
      id: tempId, content: replyContent, score: 0, username: user?.username || 'You',
      avatar_url: user?.avatar_url, // Use local user avatar immediately
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), isPending: true
    }

    setComments(prev => prev.map(c =>
      c.id === parentId ? { ...c, replies: [...(c.replies || []), newReply], replies_count: c.replies_count + 1 } : c
    ))
    setReplyContent('')
    setReplyingTo(null)

    try {
      const { post: reply } = await CommentumApi.createReply(parentId, newReply.content)
      setComments(prev => prev.map(c =>
        c.id === parentId ? { ...c, replies: c.replies?.map(r => r.id === tempId ? reply : r) } : c
      ))
    } catch {
      toast.error("Failed to post reply")
      loadComments()
    }
  }

  // --- Edit & Delete ---
  const startEditing = (id: string, currentContent: string) => {
    setEditingId(id)
    setEditContent(currentContent)
  }

  const handleSaveEdit = async (id: string, isReply: boolean) => {
    if (!editContent.trim()) return
    const originalState = [...comments]

    setComments(prev => prev.map(c => {
      if (!isReply && c.id === id) return { ...c, content: editContent }
      if (c.replies) return { ...c, replies: c.replies.map(r => r.id === id ? { ...r, content: editContent } : r) }
      return c
    }))
    setEditingId(null)

    try {
      isReply ? await CommentumApi.updateReply(id, editContent) : await CommentumApi.updateComment(id, editContent)
      toast.success("Updated")
    } catch {
      setComments(originalState)
      toast.error("Update failed")
    }
  }

  const handleDelete = async (id: string, isReply: boolean) => {
    if (!confirm("Are you sure you want to delete this?")) return
    try {
      setComments(prev => {
        if (!isReply) return prev.filter(c => c.id !== id)
        return prev.map(c => ({ ...c, replies: c.replies?.filter(r => r.id !== id) }))
      })
      isReply ? await CommentumApi.deleteReply(id) : await CommentumApi.setCommentStatus(id, 'removed')
      toast.success("Deleted")
    } catch {
      toast.error("Delete failed")
      loadComments()
    }
  }

  const handleReport = async (id: string) => {
    const reason = window.prompt("Reason for reporting:")
    if (reason) {
      try {
        await CommentumApi.reportComment(id, reason)
        toast.success("Report submitted")
      } catch (err: any) {
        toast.error(err.message || "Failed to submit report")
      }
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-background relative pb-28">

      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto max-w-3xl flex h-14 items-center justify-between px-4">
          <h1 className="font-bold text-lg tracking-tight">Discussion Hub</h1>
          <div className="flex items-center gap-2">
            <Input
              value={mediaId} onChange={(e) => setMediaId(e.target.value)}
              className="h-8 w-32 text-xs bg-muted/50"
            />
            <Button variant="ghost" size="icon" onClick={loadComments} className="h-8 w-8">
              <span className={cn("text-xs font-bold", loading && "animate-spin")}>↻</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl p-4 space-y-8">
        {comments.length === 0 && !loading && (
          <div className="py-20 text-center text-muted-foreground text-sm">No comments yet. Start the conversation below.</div>
        )}

        {comments.map((comment) => (
          <div key={comment.id} className={cn("group animate-in fade-in slide-in-from-bottom-2", comment.isPending && "opacity-70")}>
            <div className="flex gap-4">
              <Avatar className="h-10 w-10 border shrink-0">
                <AvatarImage src={comment.avatar_url} className="object-cover" />
                <AvatarFallback className="bg-primary/10 text-primary font-bold">{comment.username[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>

              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{comment.username}</span>
                    <span className="text-xs text-muted-foreground">{new Date(comment.created_at).toLocaleDateString()}</span>
                    {comment.username === user?.username && <Badge variant="secondary" className="text-[10px] h-4 px-1">YOU</Badge>}
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {isAuthenticated && <DropdownMenuItem onClick={() => setReplyingTo(comment.id)}><MessageSquare className="mr-2 h-3.5 w-3.5" /> Reply</DropdownMenuItem>}
                      {comment.username === user?.username && <DropdownMenuItem onClick={() => startEditing(comment.id, comment.content)}><Edit2 className="mr-2 h-3.5 w-3.5" /> Edit</DropdownMenuItem>}
                      {(comment.username === user?.username || isAdmin) && <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(comment.id, false)}><Trash2 className="mr-2 h-3.5 w-3.5" /> Delete</DropdownMenuItem>}
                      <DropdownMenuItem onClick={() => handleReport(comment.id)}><Flag className="mr-2 h-3.5 w-3.5" /> Report</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {editingId === comment.id ? (
                  <div className="space-y-2">
                    <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="min-h-[80px]" />
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                      <Button size="sm" onClick={() => handleSaveEdit(comment.id, false)}>Save</Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-foreground/90 leading-relaxed">{comment.content}</p>
                )}

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 bg-muted/40 rounded-full px-2 py-0.5 border">
                    <ThumbsUp className={cn("h-4 w-4 cursor-pointer hover:text-primary transition-colors", comment.user_vote === 1 && "text-primary")} onClick={() => handleVote(comment.id, 1, false)} />
                    <span className="text-xs font-bold w-4 text-center">{comment.score}</span>
                    <ThumbsDown className={cn("h-4 w-4 cursor-pointer hover:text-destructive transition-colors", comment.user_vote === -1 && "text-destructive")} onClick={() => handleVote(comment.id, -1, false)} />
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-primary" onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}>
                    <MessageSquare className="mr-2 h-3.5 w-3.5" /> {comment.replies_count} Replies
                  </Button>
                </div>

                {replyingTo === comment.id && (
                  <div className="mt-4 pl-4 border-l-2 border-primary/20 space-y-2 animate-in slide-in-from-top-2">
                    <Textarea placeholder={`Replying to @${comment.username}...`} value={replyContent} onChange={(e) => setReplyContent(e.target.value)} className="min-h-[60px] text-sm" />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setReplyingTo(null)}>Cancel</Button>
                      <Button size="sm" onClick={() => handlePostReply(comment.id)}>Reply</Button>
                    </div>
                  </div>
                )}

                {/* Replies */}
                {comment.replies && comment.replies.length > 0 && (
                  <div className="mt-4 space-y-4 pl-6 border-l-2 border-border/50">
                    {comment.replies.map(reply => (
                      <div key={reply.id} className={cn("group/reply relative", reply.isPending && "opacity-60")}>
                        <div className="flex gap-3">
                          <Avatar className="h-8 w-8 border">
                            <AvatarImage src={reply.avatar_url} className="object-cover" />
                            <AvatarFallback className="text-[10px] font-bold">{reply.username[0]?.toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold">{reply.username}</span>
                                <span className="text-[10px] text-muted-foreground">{new Date(reply.created_at).toLocaleDateString()}</span>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover/reply:opacity-100 transition-opacity">
                                    <MoreHorizontal className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {reply.username === user?.username && <DropdownMenuItem onClick={() => startEditing(reply.id, reply.content)}><Edit2 className="mr-2 h-3 w-3" /> Edit</DropdownMenuItem>}
                                  {(reply.username === user?.username || isAdmin) && <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(reply.id, true)}><Trash2 className="mr-2 h-3 w-3" /> Delete</DropdownMenuItem>}
                                  <DropdownMenuItem onClick={() => handleReport(reply.id)}><Flag className="mr-2 h-3 w-3" /> Report</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>

                            {editingId === reply.id ? (
                              <div className="space-y-2">
                                <Input value={editContent} onChange={(e) => setEditContent(e.target.value)} className="h-8 text-xs" />
                                <div className="flex gap-2">
                                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                                  <Button size="icon" className="h-6 w-6" onClick={() => handleSaveEdit(reply.id, true)}><Check className="h-3 w-3" /></Button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-foreground/90 leading-relaxed">{reply.content}</p>
                            )}

                            <div className="flex items-center gap-3 pt-1">
                              <ThumbsUp className={cn("h-3 w-3 cursor-pointer hover:text-primary transition-colors", reply.user_vote === 1 && "text-primary")} onClick={() => handleVote(reply.id, 1, true)} />
                              <span className="text-[10px] font-bold">{reply.score}</span>
                              <ThumbsDown className={cn("h-3 w-3 cursor-pointer hover:text-destructive", reply.user_vote === -1 && "text-destructive")} onClick={() => handleVote(reply.id, -1, true)} />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </main>

      {/* Bottom Input */}
      <div className="fixed bottom-0 left-0 w-full p-4 z-50 bg-gradient-to-t from-background via-background/95 to-transparent pb-6 pt-10">
        <div className="container mx-auto max-w-3xl">
          <div className={cn("flex items-center gap-3 p-2 bg-background/80 backdrop-blur-xl border shadow-2xl rounded-2xl transition-all", isCooldown && "border-destructive/50 ring-1 ring-destructive/20")}>
            <Avatar className="h-9 w-9 border-2 border-primary/10 shrink-0">
              <AvatarImage src={user?.avatar_url} className="object-cover" />
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{user?.username?.[0]?.toUpperCase() || '?'}</AvatarFallback>
            </Avatar>
            <Input
              placeholder={isAuthenticated ? "Write a comment..." : "Sign in to discuss"}
              value={mainContent}
              onChange={(e) => setMainContent(e.target.value)}
              disabled={!isAuthenticated || loading}
              onKeyDown={(e) => e.key === 'Enter' && handlePostMain()}
              className="flex-1 h-10 bg-transparent border-none focus-visible:ring-0 text-sm"
            />
            {mainContent.trim().length > 0 && (
              <Button onClick={handlePostMain} disabled={loading || !isAuthenticated || isCooldown} size="icon" className="h-9 w-9 rounded-xl shadow-md transition-all active:scale-95">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            )}
          </div>
          {isCooldown && <p className="text-[10px] text-destructive text-center mt-2 font-bold animate-pulse">Cooldown Active</p>}
        </div>
      </div>
    </div>
  )
}