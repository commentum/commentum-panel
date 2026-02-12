"use client"

import { useEffect, useState, useCallback } from 'react'
import { CommentumApi, Comment } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { 
  ThumbsUp, ThumbsDown, MessageSquare, Send, 
  Loader2, Trash2, Flag} from 'lucide-react'
import { toast } from 'sonner'

export default function CommentHub() {
  const { isAuthenticated, user, role } = useAuth()
  const [mediaId, setMediaId] = useState('shonenx-movie-1')
  const [comments, setComments] = useState<Comment[]>([])
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
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
    } finally {
      setLoading(false)
    }
  }, [mediaId])

  useEffect(() => { loadComments() }, [loadComments])

  const handlePostComment = async () => {
    if (!content.trim() || isCooldown) return
    setSubmitting(true)
    startCooldown()
    try {
      await CommentumApi.createComment(mediaId, content)
      setContent('')
      toast.success("Comment posted")
      loadComments()
    } finally {
      setSubmitting(false)
    }
  }

  const handlePostReply = async (commentId: string) => {
    if (!replyContent.trim() || isCooldown) return
    startCooldown()
    try {
      await CommentumApi.createReply(commentId, replyContent)
      setReplyContent('')
      setReplyingTo(null)
      toast.success("Reply posted")
      loadComments()
    } catch {
      toast.error("Failed to post reply")
    }
  }

  const handleVote = async (id: string, type: 1 | -1) => {
    if (!isAuthenticated || isCooldown) return
    startCooldown()
    try {
      const res = await CommentumApi.voteComment(id, type)
      setComments(prev => prev.map(c => c.id === id ? { ...c, score: res.score } : c))
    } catch {
      toast.error("Vote failed")
    }
  }

  const handleReport = async (commentId: string) => {
    const reason = window.prompt("Enter reason for reporting:")
    if (!reason) return
    try {
      await CommentumApi.reportComment(commentId, reason)
      toast.success("Reported successfully")
    } catch {
      toast.error("Report failed")
    }
  }

  const handleDelete = async (commentId: string) => {
    if (!confirm("Delete this comment?")) return
    try {
      await CommentumApi.setCommentStatus(commentId, 'removed')
      toast.success("Comment deleted")
      loadComments()
    } catch {
      toast.error("Failed to delete comment")
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        {/* Header */}
        <div className="mb-8 space-y-4">
          <h1 className="text-3xl font-bold">Discussions</h1>
          <p className="text-sm text-muted-foreground">Join the conversation about your favorite anime</p>
          
          {/* Media Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Media ID:</span>
            <div className="flex gap-2 flex-1 sm:flex-initial">
              <Input 
                value={mediaId} 
                onChange={(e) => setMediaId(e.target.value)} 
                className="h-9 text-sm"
                placeholder="Enter media ID"
              />
              <Button onClick={loadComments} size="sm" variant="outline" className="px-4">
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Comment Input */}
        {isAuthenticated ? (
          <div className="mb-8 space-y-4">
            <div className="flex gap-4">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarFallback className="bg-primary/10 text-sm font-semibold">
                  {user?.username?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-3">
                <Textarea 
                  placeholder="Share your thoughts..." 
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  disabled={submitting}
                  className="min-h-25 resize-none"
                />
                <div className="flex items-center justify-between">
                  {isCooldown && (
                    <span className="text-xs text-muted-foreground">
                      Please wait before posting again...
                    </span>
                  )}
                  <div className="ml-auto">
                    <Button 
                      onClick={handlePostComment} 
                      disabled={submitting || !content.trim() || isCooldown}
                      size="sm"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Posting...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Post
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-8 rounded-lg border border-border/50 bg-muted/30 px-4 py-4 text-center text-sm text-muted-foreground">
            Sign in to join the discussion
          </div>
        )}

        {/* Comments */}
        <div className="space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading comments...</p>
            </div>
          ) : comments.length === 0 ? (
            <div className="rounded-lg border border-border/50 bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
              No comments yet. Be the first to share your thoughts.
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="group space-y-3 rounded-lg border border-border/50 bg-card/30 p-4">
                {/* Comment Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="text-xs font-semibold bg-primary/10">
                        {comment.username[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold">@{comment.username}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(comment.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0"
                      onClick={() => handleReport(comment.id)}
                      title="Report"
                    >
                      <Flag className="h-4 w-4" />
                    </Button>
                    {isAdmin && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(comment.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Comment Content */}
                <p className="text-sm leading-relaxed text-foreground/90">{comment.content}</p>

                {/* Comment Actions */}
                <div className="flex items-center gap-4 pt-2">
                  <div className="flex items-center gap-1 rounded-full bg-muted/50 p-1">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 w-7 p-0"
                      onClick={() => handleVote(comment.id, 1)}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                    </Button>
                    <span className={cn(
                      "text-xs font-semibold min-w-4 text-center",
                      comment.score > 0 ? "text-primary" : comment.score < 0 ? "text-destructive" : "text-muted-foreground"
                    )}>
                      {comment.score}
                    </span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 w-7 p-0"
                      onClick={() => handleVote(comment.id, -1)}
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 gap-2 text-xs font-medium"
                    onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                  >
                    <MessageSquare className="h-4 w-4" />
                    {comment.replies_count || 0}
                  </Button>
                </div>

                {/* Reply Input */}
                {replyingTo === comment.id && (
                  <div className="mt-4 space-y-3 rounded-lg bg-muted/30 p-4 border border-border/30">
                    <Textarea 
                      placeholder="Write a reply..."
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      className="min-h-20 resize-none text-sm"
                    />
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setReplyingTo(null)}
                      >
                        Cancel
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={() => handlePostReply(comment.id)} 
                        disabled={!replyContent.trim() || isCooldown}
                      >
                        Reply
                      </Button>
                    </div>
                  </div>
                )}

                {/* Replies */}
                {comment.replies && comment.replies.length > 0 && (
                  <div className="mt-4 space-y-3 border-l-2 border-border/30 pl-4">
                    {comment.replies.map((reply) => (
                      <div key={reply.id} className="group/reply rounded-lg bg-muted/20 p-3">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex gap-2">
                            <Avatar className="h-8 w-8 shrink-0">
                              <AvatarFallback className="text-[10px] font-bold bg-primary/5">
                                {reply.username[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-xs font-semibold">@{reply.username}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {new Date(reply.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <Flag 
                            className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover/reply:opacity-100 cursor-pointer" 
                            onClick={() => handleReport(reply.id)}
                          />
                        </div>
                        <p className="text-sm text-foreground/80 leading-relaxed">{reply.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
