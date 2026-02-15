"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CommentumApi, Comment, Reply, Post } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Loader2,
  MessageSquare,
  ThumbsDown,
  ThumbsUp,
  Edit2,
  Flag,
  RefreshCw,
  Send,
  Trash2,
  CornerDownRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

type UiReply = Reply & { children?: UiReply[]; hasLoadedChildren?: boolean; isPending?: boolean };
type UiComment = Comment & { replies?: UiReply[]; expanded?: boolean; isPending?: boolean };

function byParent(replies: UiReply[], parentId: string) {
  return replies.filter((item) => item.parent_id === parentId);
}

function PostAvatar({ username, avatar }: { username: string; avatar: string | null | undefined }) {
  return (
    <Avatar className="h-8 w-8 border">
      <AvatarImage src={avatar ?? undefined} className="object-cover" />
      <AvatarFallback>{username[0]?.toUpperCase() ?? '?'}</AvatarFallback>
    </Avatar>
  );
}

function NestedReply({
  reply,
  depth,
  onReply,
  onVote,
  onEdit,
  onDelete,
  onReport,
  onExpand,
}: {
  reply: UiReply;
  depth: number;
  onReply: (reply: UiReply) => void;
  onVote: (id: string, vote: 1 | -1) => void;
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onReport: (id: string) => void;
  onExpand: (id: string) => void;
}) {
  return (
    <div className="space-y-2" style={{ marginLeft: Math.min(depth, 6) * 16 }}>
      <div className="flex gap-3 rounded-md border p-3">
        <PostAvatar username={reply.user.username} avatar={reply.user.avatar_url} />
        <div className="w-full space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold">{reply.user.username}</span>
            <span className="text-muted-foreground">{new Date(reply.created_at).toLocaleString()}</span>
          </div>
          <p className="text-sm">{reply.content}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Button variant="ghost" size="sm" className="h-7" onClick={() => onVote(reply.id, 1)}>
              <ThumbsUp className={cn('h-3 w-3', reply.user_vote === 1 && 'text-primary')} /> {reply.score}
            </Button>
            <Button variant="ghost" size="sm" className="h-7" onClick={() => onVote(reply.id, -1)}>
              <ThumbsDown className={cn('h-3 w-3', reply.user_vote === -1 && 'text-destructive')} />
            </Button>
            <Button variant="ghost" size="sm" className="h-7" onClick={() => onReply(reply)}>
              <CornerDownRight className="h-3 w-3" /> Reply
            </Button>
            <Button variant="ghost" size="sm" className="h-7" onClick={() => onEdit(reply.id, reply.content)}>
              <Edit2 className="h-3 w-3" /> Edit
            </Button>
            <Button variant="ghost" size="sm" className="h-7" onClick={() => onDelete(reply.id)}>
              <Trash2 className="h-3 w-3" /> Delete
            </Button>
            <Button variant="ghost" size="sm" className="h-7" onClick={() => onReport(reply.id)}>
              <Flag className="h-3 w-3" /> Report
            </Button>
            <Button variant="ghost" size="sm" className="h-7" onClick={() => onExpand(reply.id)}>
              <ChevronDown className="h-3 w-3" /> Load children
            </Button>
          </div>
        </div>
      </div>
      {reply.children?.map((child) => (
        <NestedReply
          key={child.id}
          reply={child}
          depth={depth + 1}
          onReply={onReply}
          onVote={onVote}
          onEdit={onEdit}
          onDelete={onDelete}
          onReport={onReport}
          onExpand={onExpand}
        />
      ))}
    </div>
  );
}

export default function CommentHub() {
  const { isAuthenticated, role } = useAuth();
  const [mediaId, setMediaId] = useState('anime-123');
  const [comments, setComments] = useState<UiComment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [commentCount, setCommentCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [mainContent, setMainContent] = useState('');
  const [replyTarget, setReplyTarget] = useState<{ id: string; rootId: string; username: string } | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [editTarget, setEditTarget] = useState<{ id: string; value: string } | null>(null);

  const isModerator = role === 'admin' || role === 'moderator';

  const loadComments = useCallback(async (reset = true) => {
    setLoading(true);
    try {
      const data = await CommentumApi.listComments(mediaId, 20, reset ? undefined : cursor ?? undefined);
      setCommentCount(data.comment_count ?? 0);
      setCursor(data.next_cursor);
      setComments((prev) => (reset ? data.comments.map((c) => ({ ...c, expanded: false })) : [...prev, ...data.comments]));
    } catch {
      toast.error('Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, [cursor, mediaId]);

  useEffect(() => {
    loadComments(true);
  }, [loadComments]);

  const handleVote = async (postId: string, voteType: 1 | -1) => {
    if (!isAuthenticated) return toast.error('Please log in to vote');
    const apply = (post: Post) => ({ ...post, score: post.score - (post.user_vote || 0) + voteType, user_vote: voteType as 1 | -1 });

    setComments((prev) => prev.map((comment) => {
      if (comment.id === postId) return apply(comment);
      return {
        ...comment,
        replies: comment.replies?.map((reply) => reply.id === postId ? apply(reply) : reply),
      };
    }));

    try {
      await CommentumApi.votePost(postId, voteType);
    } catch {
      toast.error('Vote failed. Refreshing comments.');
      loadComments(true);
    }
  };

  const postMain = async () => {
    if (!mainContent.trim()) return;
    try {
      await CommentumApi.createPost({ media_id: mediaId, content: mainContent.trim(), client: 'commentum-panel' });
      setMainContent('');
      await loadComments(true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to publish comment';
      toast.error(message);
    }
  };

  const postReply = async () => {
    if (!replyTarget || !replyContent.trim()) return;
    try {
      await CommentumApi.createPost({ parent_id: replyTarget.id, content: replyContent.trim(), client: 'commentum-panel' });
      toast.success('Reply posted');
      setReplyContent('');
      setReplyTarget(null);
      await expandReplies(replyTarget.rootId, true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to publish reply';
      toast.error(message);
    }
  };

  const expandReplies = async (commentId: string, forceReload = false) => {
    const target = comments.find((item) => item.id === commentId);
    if (!target) return;
    if (target.expanded && target.replies && !forceReload) {
      setComments((prev) => prev.map((item) => item.id === commentId ? { ...item, expanded: false } : item));
      return;
    }

    try {
      const data = await CommentumApi.listReplies({ root_id: commentId, limit: 100 });
      setComments((prev) => prev.map((item) => {
        if (item.id !== commentId) return item;
        const top = byParent(data.replies as UiReply[], commentId).map((reply) => ({ ...reply, children: [] }));
        return { ...item, expanded: true, replies: top, replies_count: data.reply_count ?? top.length };
      }));
    } catch {
      toast.error('Failed to load replies');
    }
  };

  const expandNestedReplies = async (parentReplyId: string) => {
    try {
      const data = await CommentumApi.listReplies({ parent_id: parentReplyId, limit: 50 });
      setComments((prev) => prev.map((comment) => ({
        ...comment,
        replies: comment.replies?.map((reply) => {
          if (reply.id !== parentReplyId) return reply;
          return { ...reply, children: data.replies as UiReply[], hasLoadedChildren: true };
        }),
      })));
    } catch {
      toast.error('Failed to load nested replies');
    }
  };

  const askReport = async (id: string) => {
    const reason = window.prompt('Reason for report:');
    if (!reason) return;
    try {
      await CommentumApi.reportPost(id, reason);
      toast.success('Report submitted');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Report failed';
      toast.error(message);
    }
  };

  const startEdit = (id: string, current: string) => setEditTarget({ id, value: current });

  const saveEdit = async () => {
    if (!editTarget?.value.trim()) return;
    try {
      await CommentumApi.updatePost(editTarget.id, editTarget.value.trim());
      setEditTarget(null);
      toast.success('Post updated');
      await loadComments(true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Update failed';
      toast.error(message);
    }
  };

  const removePost = async (id: string) => {
    try {
      if (isModerator) {
        await CommentumApi.setCommentStatus(id, 'removed');
      } else {
        await CommentumApi.deletePost(id);
      }
      toast.success('Post removed');
      await loadComments(true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Delete failed';
      toast.error(message);
    }
  };

  const summary = useMemo(() => `${commentCount} comments`, [commentCount]);

  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-4 pb-20">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
        <Input value={mediaId} onChange={(e) => setMediaId(e.target.value)} placeholder="media id" className="max-w-[220px]" />
        <Button onClick={() => loadComments(true)} disabled={loading}>
          <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} /> Refresh
        </Button>
        <Badge variant="outline">{summary}</Badge>
        {isModerator && <Badge>Moderator mode</Badge>}
      </div>

      <div className="rounded-lg border bg-card p-3">
        <Textarea value={mainContent} onChange={(e) => setMainContent(e.target.value)} placeholder={isAuthenticated ? 'Share your thoughts...' : 'Login required'} maxLength={500} disabled={!isAuthenticated} />
        <div className="mt-2 flex justify-end">
          <Button onClick={postMain} disabled={!isAuthenticated || loading || !mainContent.trim()}>
            <Send className="mr-2 h-4 w-4" /> Post
          </Button>
        </div>
      </div>

      {replyTarget && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="text-xs text-muted-foreground">Replying to @{replyTarget.username}</p>
          <Textarea className="mt-2" value={replyContent} onChange={(e) => setReplyContent(e.target.value)} maxLength={500} />
          <div className="mt-2 flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setReplyTarget(null)}>Cancel</Button>
            <Button onClick={postReply}>Reply</Button>
          </div>
        </div>
      )}

      {editTarget && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
          <p className="text-xs">Editing post</p>
          <Textarea value={editTarget.value} onChange={(e) => setEditTarget({ ...editTarget, value: e.target.value })} maxLength={500} />
          <div className="mt-2 flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save</Button>
          </div>
        </div>
      )}

      {loading && comments.length === 0 ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : comments.map((comment) => (
        <div key={comment.id} className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex gap-3">
            <PostAvatar username={comment.user.username} avatar={comment.user.avatar_url} />
            <div className="w-full space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">{comment.user.username}</p>
                <p className="text-xs text-muted-foreground">{new Date(comment.created_at).toLocaleString()}</p>
              </div>
              <p>{comment.content}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => handleVote(comment.id, 1)}><ThumbsUp className={cn('h-4 w-4', comment.user_vote === 1 && 'text-primary')} />{comment.score}</Button>
                <Button variant="ghost" size="sm" onClick={() => handleVote(comment.id, -1)}><ThumbsDown className={cn('h-4 w-4', comment.user_vote === -1 && 'text-destructive')} /></Button>
                <Button variant="ghost" size="sm" onClick={() => setReplyTarget({ id: comment.id, rootId: comment.id, username: comment.user.username })}><MessageSquare className="h-4 w-4" />Reply</Button>
                <Button variant="ghost" size="sm" onClick={() => startEdit(comment.id, comment.content)}><Edit2 className="h-4 w-4" />Edit</Button>
                <Button variant="ghost" size="sm" onClick={() => removePost(comment.id)}><Trash2 className="h-4 w-4" />Delete</Button>
                <Button variant="ghost" size="sm" onClick={() => askReport(comment.id)}><Flag className="h-4 w-4" />Report</Button>
                <Button variant="ghost" size="sm" onClick={() => expandReplies(comment.id)}>
                  {comment.expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {comment.replies_count} Replies
                </Button>
              </div>
            </div>
          </div>

          {comment.expanded && (
            <div className="space-y-2 border-l pl-3">
              {comment.replies?.length ? comment.replies.map((reply) => (
                <NestedReply
                  key={reply.id}
                  reply={reply}
                  depth={1}
                  onReply={(target) => setReplyTarget({ id: target.id, rootId: comment.id, username: target.user.username })}
                  onVote={handleVote}
                  onEdit={startEdit}
                  onDelete={removePost}
                  onReport={askReport}
                  onExpand={expandNestedReplies}
                />
              )) : <p className="text-xs text-muted-foreground">No replies yet.</p>}
            </div>
          )}
        </div>
      ))}

      {cursor && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => loadComments(false)} disabled={loading}>Load more comments</Button>
        </div>
      )}
    </div>
  );
}
