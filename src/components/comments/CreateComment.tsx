'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Send } from 'lucide-react'

interface CreateCommentProps {
  mediaId: string
  onSubmit: (content: string) => Promise<void>
  isLoading?: boolean
  maxLength?: number
}

export function CreateComment({
  mediaId,
  onSubmit,
  isLoading = false,
  maxLength = 500,
}: CreateCommentProps) {
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!content.trim()) {
      setError('Comment cannot be empty')
      return
    }

    if (content.length > maxLength) {
      setError(`Comment cannot exceed ${maxLength} characters`)
      return
    }

    try {
      await onSubmit(content.trim())
      setContent('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create comment')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
        Add a Comment
      </h3>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Share your thoughts about this anime..."
        maxLength={maxLength}
        disabled={isLoading}
        className="w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-900 placeholder-gray-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
        rows={4}
      />

      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {content.length} / {maxLength}
        </p>
        <Button
          type="submit"
          disabled={isLoading || !content.trim()}
          className="gap-2"
        >
          <Send className="h-4 w-4" />
          {isLoading ? 'Posting...' : 'Post Comment'}
        </Button>
      </div>
    </form>
  )
}
