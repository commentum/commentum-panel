'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ThumbsUp, ThumbsDown, MessageCircle, Flag } from 'lucide-react'

interface Comment {
  id: string
  content: string
  score: number
  username: string
  created_at: string
  status: 'active' | 'hidden' | 'removed'
  replies?: Reply[]
  replies_count?: number
  has_more_replies?: boolean
}

interface Reply {
  id: string
  content: string
  score: number
  username: string
  created_at: string
}

interface CommentsListProps {
  mediaId: string
  comments: Comment[]
  onVote: (commentId: string, voteType: 1 | -1) => void
  onReport: (commentId: string) => void
}

export function CommentsList({
  mediaId,
  comments,
  onVote,
  onReport,
}: CommentsListProps) {
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set())

  const toggleReplies = (commentId: string) => {
    const newSet = new Set(expandedReplies)
    if (newSet.has(commentId)) {
      newSet.delete(commentId)
    } else {
      newSet.add(commentId)
    }
    setExpandedReplies(newSet)
  }

  if (comments.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
        <p className="text-gray-600 dark:text-gray-400">
          No comments yet. Be the first to comment!
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {comments.map((comment) => (
        <div
          key={comment.id}
          className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
        >
          {/* Comment Header */}
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">
                {comment.username}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {new Date(comment.created_at).toLocaleDateString()} at{' '}
                {new Date(comment.created_at).toLocaleTimeString()}
              </p>
            </div>
            {comment.status !== 'active' && (
              <span className="inline-block text-xs px-2 py-1 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                {comment.status}
              </span>
            )}
          </div>

          {/* Comment Content */}
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            {comment.content}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-4 text-sm">
            <button
              onClick={() => onVote(comment.id, 1)}
              className="flex items-center gap-1 text-gray-600 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400 transition-colors"
            >
              <ThumbsUp className="h-4 w-4" />
              <span>{comment.score > 0 ? comment.score : ''}</span>
            </button>

            <button
              onClick={() => onVote(comment.id, -1)}
              className="flex items-center gap-1 text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
            >
              <ThumbsDown className="h-4 w-4" />
            </button>

            {comment.replies_count !== undefined && (
              <button
                onClick={() => toggleReplies(comment.id)}
                className="flex items-center gap-1 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
              >
                <MessageCircle className="h-4 w-4" />
                <span>{comment.replies_count}</span>
              </button>
            )}

            <button
              onClick={() => onReport(comment.id)}
              className="ml-auto flex items-center gap-1 text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
            >
              <Flag className="h-4 w-4" />
            </button>
          </div>

          {/* Replies */}
          {expandedReplies.has(comment.id) && comment.replies && (
            <div className="mt-4 space-y-3 border-t border-gray-200 pt-4 dark:border-gray-700">
              {comment.replies.map((reply) => (
                <div
                  key={reply.id}
                  className="rounded bg-gray-50 p-3 dark:bg-gray-700/50"
                >
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-semibold text-sm text-gray-900 dark:text-white">
                      {reply.username}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(reply.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {reply.content}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-xs">
                    <button className="text-gray-600 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400">
                      <ThumbsUp className="h-3 w-3" />
                    </button>
                    <button className="text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400">
                      <ThumbsDown className="h-3 w-3" />
                    </button>
                    <span className="text-gray-500 dark:text-gray-400">
                      {reply.score > 0 ? `+${reply.score}` : reply.score}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
