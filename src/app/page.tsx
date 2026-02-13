"use client"

import { useEffect, useState, useCallback } from 'react'
import { CommentumApi, Comment, Reply } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  ThumbsUp, ThumbsDown, MessageSquare, Send, 
  Loader2, Trash2, Flag, Edit2, X, Check, Clock, AlertCircle 
} from 'lucide-react'
import { toast } from 'sonner'

// --- Extended Types for Optimistic UI ---
interface OptimisticReply extends Reply {
  isPending?: boolean;
  avatar_url?: string;
}

interface OptimisticComment extends Comment {
  replies?: OptimisticReply[];
  isPending?: boolean;
}

export default function ShonenXCommentHub() {
  const { isAuthenticated, user, role } = useAuth()
  const [mediaId, setMediaId] = useState('shonenx-movie-1')
  const [comments, setComments] = useState<OptimisticComment[]>([])
  
  // UI States
  const [loading, setLoading] = useState(false)
  const [content, setContent] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  
  // Cooldown Logic
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

  // --- Optimistic Voting ---
  const handleVote = async (id: string, type: 1 | -1, isReply: boolean) => {
    if (!isAuthenticated || isCooldown) return
    
    const originalState = [...comments];
    startCooldown();

    // Optimistic Update
    setComments(prev => prev.map(c => {
      if (!isReply && c.id === id) {
        const currentVote = c.user_vote || 0;
        return { ...c, score: c.score - currentVote + type, user_vote: type };
      }
      if (isReply && c.replies) {
        return {
          ...c,
          replies: c.replies.map(r => r.id === id ? { ...r, score: r.score - (r.user_vote || 0) + type, user_vote: type } : r)
        };
      }
      return c;
    }));

    try {
      isReply ? await CommentumApi.voteReply(id, type) : await CommentumApi.voteComment(id, type);
    } catch {
      setComments(originalState);
      toast.error("Sync failed: Vote reverted");
    }
  }

  // --- Optimistic Reply ---
  const handlePostReply = async (commentId: string) => {
    if (!replyContent.trim() || isCooldown || !user) return
    
    const tempId = `temp-${Date.now()}`;
    const originalState = [...comments];
    const newReply: OptimisticReply = {
      id: tempId,
      content: replyContent,
      score: 0,
      username: user.username,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      isPending: true
    };

    startCooldown();
    setComments(prev => prev.map(c => 
      c.id === commentId ? { ...c, replies: [...(c.replies || []), newReply], replies_count: c.replies_count + 1 } : c
    ));
    setReplyContent('');
    setReplyingTo(null);

    try {
      const res = await CommentumApi.createReply(commentId, newReply.content);
      setComments(prev => prev.map(c => 
        c.id === commentId ? { ...c, replies: c.replies?.map(r => r.id === tempId ? res.reply : r) } : c
      ));
    } catch {
      setComments(originalState);
      toast.error("Connection lost: Reply failed");
    }
  }

  // --- Modification Logic ---
  const handleUpdate = async (id: string, isReply: boolean) => {
    if (!editContent.trim()) return
    try {
      isReply ? await CommentumApi.updateReply(id, editContent) : await CommentumApi.updateComment(id, editContent);
      setEditingId(null);
      toast.success("Entry modified");
      loadComments();
    } catch {
      toast.error("Modification failed");
    }
  }

  const handleDelete = async (id: string, isReply: boolean) => {
    if (!confirm("Confirm deletion protocol?")) return
    try {
      isReply ? await CommentumApi.deleteReply(id) : await CommentumApi.setCommentStatus(id, 'removed');
      toast.success("Entry purged");
      loadComments();
    } catch {
      toast.error("Purge failed");
    }
  }

  return (
    <div className="container mx-auto max-w-4xl p-6 md:p-10 space-y-8 bg-background">
      
      {/* 1. Header & Context Selector */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Discussions</h1>
          <p className="text-xs text-muted-foreground uppercase font-semibold tracking-widest flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            Commentum is live baby
          </p>
        </div>
        <div className="flex gap-2 items-center bg-muted/40 p-1.5 rounded-lg border">
          <Badge variant="outline" className="h-5 text-[9px] border-none bg-background/50 uppercase">Ref</Badge>
          <Input 
            value={mediaId} 
            onChange={(e) => setMediaId(e.target.value)} 
            className="h-7 w-28 bg-transparent border-none font-mono text-xs focus-visible:ring-0 uppercase" 
          />
          <Button onClick={loadComments} size="sm" variant="ghost" className="h-7 text-[10px] font-bold">RELOAD</Button>
        </div>
      </div>

      {/* 2. Global Input */}
      <div className="flex gap-4">
        <Avatar className="h-10 w-10 border shrink-0">
          {user?.avatar_url && <img src={user.avatar_url} alt={user.username} className="h-full w-full object-cover" />}
          <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold uppercase">
            {user?.username?.[0] || '?'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-3">
          <Textarea 
            placeholder={isAuthenticated ? "Transmit a thought..." : "Auth required for transmission"} 
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={!isAuthenticated || loading}
            className="min-h-[100px] bg-muted/10 border-none focus-visible:ring-1 resize-none rounded-xl text-sm"
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1.5">
              {isCooldown ? <AlertCircle className="h-3 w-3 text-destructive animate-pulse" /> : <Check className="h-3 w-3" />}
              {isCooldown ? "COOLDOWN ACTIVE" : "SYSTEM READY"}
            </span>
            <Button 
              onClick={async () => {
                if (!content.trim() || isCooldown) return;
                setLoading(true);
                startCooldown();
                try {
                  await CommentumApi.createComment(mediaId, content);
                  setContent('');
                  loadComments();
                } finally { setLoading(false); }
              }} 
              disabled={loading || !content.trim() || !isAuthenticated || isCooldown} 
              size="sm"
              className="rounded-full px-8"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              POST
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      {/* 3. Threaded Discussion */}
      <div className="space-y-10">
        {comments.map((comment) => (
          <div key={comment.id} className="group space-y-3">
            <div className="flex gap-4">
              <Avatar className="h-9 w-9 border">
                {comment.avatar_url && <img src={comment.avatar_url} alt={comment.username} className="h-full w-full object-cover" />}
                <AvatarFallback className="text-[10px] font-bold uppercase">{comment.username[0]}</AvatarFallback>
              </Avatar>
              
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">@{comment.username}</span>
                    <span className="text-[10px] text-muted-foreground">{new Date(comment.created_at).toLocaleDateString()}</span>
                  </div>
                  
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {comment.username === user?.username && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingId(comment.id); setEditContent(comment.content); }}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {(comment.username === user?.username || isAdmin) && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(comment.id, false)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { const r = window.prompt("Reason:"); r && CommentumApi.reportComment(comment.id, r); }}>
                      <Flag className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {editingId === comment.id ? (
                  <div className="space-y-2">
                    <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="min-h-[80px] text-sm" />
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                      <Button size="sm" onClick={() => handleUpdate(comment.id, false)}>Save</Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-foreground/90">{comment.content}</p>
                )}

                <div className="flex items-center gap-4 pt-1">
                  <div className="flex items-center gap-1 bg-muted/40 rounded-full px-1 border border-border/50 shadow-sm">
                    <Button variant="ghost" size="icon" className={cn("h-6 w-6 rounded-full", comment.user_vote === 1 && "text-primary")} onClick={() => handleVote(comment.id, 1, false)}>
                      <ThumbsUp className="h-3 w-3" />
                    </Button>
                    <span className="text-[10px] font-bold min-w-[14px] text-center tabular-nums">{comment.score}</span>
                    <Button variant="ghost" size="icon" className={cn("h-6 w-6 rounded-full", comment.user_vote === -1 && "text-destructive")} onClick={() => handleVote(comment.id, -1, false)}>
                      <ThumbsDown className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-primary gap-2" onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}>
                    <MessageSquare className="h-3.5 w-3.5" />
                    {comment.replies_count}
                  </Button>
                </div>

                {replyingTo === comment.id && (
                  <div className="mt-4 pl-4 border-l-2 space-y-3 animate-in slide-in-from-top-2">
                    <Textarea placeholder="Transmit reply..." value={replyContent} onChange={(e) => setReplyContent(e.target.value)} className="min-h-[70px] text-sm bg-muted/10 border-none" />
                    <div className="flex justify-end gap-2">
                       <Button variant="ghost" size="sm" onClick={() => setReplyingTo(null)} className="text-xs">Discard</Button>
                       <Button size="sm" onClick={() => handlePostReply(comment.id)} disabled={!replyContent.trim() || isCooldown} className="text-xs px-5">Submit</Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Nested Optimistic Replies */}
            {comment.replies && comment.replies.length > 0 && (
              <div className="ml-10 space-y-5 border-l-2 pl-6 pt-2">
                {comment.replies.map((reply) => (
                  <div key={reply.id} className={cn("group/reply flex gap-3 relative transition-opacity", reply.isPending && "opacity-60")}>
                    <Avatar className="h-7 w-7 border shrink-0">
                      {reply.avatar_url && <img src={reply.avatar_url} alt={reply.username} className="h-full w-full object-cover" />}
                      <AvatarFallback className="text-[9px] font-bold uppercase">{reply.username[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-bold">@{reply.username}</span>
                          {reply.isPending && <Clock className="h-2.5 w-2.5 animate-pulse text-primary" />}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover/reply:opacity-100 transition-opacity">
                          {reply.username === user?.username && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingId(reply.id); setEditContent(reply.content); }}>
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          )}
                          {(reply.username === user?.username || isAdmin) && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDelete(reply.id, true)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {editingId === reply.id ? (
                        <div className="space-y-2">
                          <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="min-h-[60px] text-xs" />
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                            <Button size="icon" className="h-6 w-6" onClick={() => handleUpdate(reply.id, true)}><Check className="h-3 w-3" /></Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-foreground/80 leading-relaxed">{reply.content}</p>
                      )}

                      <div className="flex items-center gap-3 pt-0.5">
                        <div className="flex items-center gap-1.5">
                          <ThumbsUp className={cn("h-3 w-3 cursor-pointer hover:text-primary transition-colors", reply.user_vote === 1 && "text-primary")} onClick={() => handleVote(reply.id, 1, true)} />
                          <span className="text-[10px] font-bold tabular-nums">{reply.score}</span>
                          <ThumbsDown className={cn("h-3 w-3 cursor-pointer hover:text-destructive transition-colors", reply.user_vote === -1 && "text-destructive")} onClick={() => handleVote(reply.id, -1, true)} />
                        </div>
                        {reply.isPending && <span className="text-[8px] font-black uppercase tracking-tighter text-primary">Syncing...</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}