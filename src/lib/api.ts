// --- Types & Interfaces ---
// deno-lint-ignore-file no-explicit-any require-await

export type UserRole = 'user' | 'moderator' | 'admin';
export type CommentStatus = 'active' | 'hidden' | 'removed' | 'deleted';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  provider: string;
  avatar_url?: string;
  created_at: string;
}

export interface Reply {
  id: string;
  content: string;
  score: number;
  username: string;
  avatar_url?: string;
  parent_id?: string;
  created_at: string;
  updated_at: string;
  user_vote?: number | null;
}

export interface Comment {
  id: string;
  content: string;
  score: number;
  status: CommentStatus;
  username: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
  replies?: Reply[];
  has_more_replies: boolean;
  replies_count: number;
  user_vote?: number | null;
}

export class AppError extends Error {
  constructor(public message: string, public status: number) {
    super(message);
    this.name = 'AppError';
  }
}

// --- Main API Class ---

export class CommentumApi {
  private static BASE_URL = '/api/proxy';
  private static jwtToken: string | null = null;

  static setToken(token: string | null) {
    this.jwtToken = token;
  }

  static getTokenFromCookie(): string | null {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; auth_token=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
  }

  private static async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
    body?: any,
    params?: Record<string, string | number | undefined>
  ): Promise<T> {
    let url = `${this.BASE_URL}${endpoint}`;

    if (params) {
      // Filter out undefined params
      const cleanParams = Object.entries(params).reduce((acc, [key, value]) => {
        if (value !== undefined) acc[key] = String(value);
        return acc;
      }, {} as Record<string, string>);

      if (Object.keys(cleanParams).length > 0) {
        url += `?${new URLSearchParams(cleanParams).toString()}`;
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    const activeToken = this.jwtToken || this.getTokenFromCookie();
    if (activeToken) {
      headers['Authorization'] = `Bearer ${activeToken}`;
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new AppError(data.error || 'Server Error', response.status);
      }

      return data as T;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to communicate with proxy', 500);
    }
  }

  // --- Authentication ---

  static async login(provider: 'anilist' | 'mal' | 'simkl', accessToken: string) {
    const data = await this.request<{ token: string; user: User }>(
      '/auth',
      'POST',
      { provider, access_token: accessToken }
    );

    this.setToken(data.token);

    if (typeof document !== 'undefined') {
      document.cookie = `auth_token=${data.token}; path=/; max-age=604800; SameSite=Lax; Secure`;
    }

    return data;
  }

  static async logout() {
    const res = await this.request<{ message: string }>('/auth', 'DELETE');
    this.setToken(null);
    if (typeof document !== 'undefined') {
      document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
    return res;
  }

  static async getMe() {
    return this.request<{ user: User }>('/me');
  }

  // --- Comments ---

  static async createComment(media_id: string, content: string) {
    return this.request<{ post: Comment }>('/posts', 'POST', { media_id, content });
  }

  static async listComments(media_id: string, limit = 20, cursor?: string) {
    const params: any = { media_id, limit };
    if (cursor) params.cursor = cursor;
    return this.request<{ comments: Comment[]; next_cursor: string | null }>('/posts', 'GET', undefined, params);
  }

  static async voteComment(comment_id: string, voteType: 1 | -1) {
    return this.request<{ post_id: string; score: number }>(
      '/votes',
      'POST',
      { post_id: comment_id, vote_type: voteType }
    );
  }

  static async reportComment(comment_id: string, reason: string) {
    return this.request<{ message: string }>(
      '/reports',
      'POST',
      { post_id: comment_id, reason }
    );
  }

  static async updateComment(comment_id: string, content: string) {
    return this.request<{ post: Comment }>(
      '/posts',
      'PATCH',
      { id: comment_id, content }
    );
  }

  static async deleteComment(comment_id: string) {
    return this.request<{ post: Partial<Comment> }>(
      '/posts',
      'DELETE',
      { id: comment_id }
    );
  }

  // --- Replies ---

  /**
   * Create a reply. 
   * @param parentId - Can be a Root Post ID (for top-level reply) or a Reply ID (for nested reply).
   */
  static async createReply(parentId: string, content: string) {
    // Doc: { "parent_id": "uuid", "content": "..." }
    return this.request<{ post: Reply }>(
      '/posts',
      'POST',
      { parent_id: parentId, content }
    );
  }

  /**
   * List replies.
   * @param rootId - The ID of the root comment (Required).
   * @param parentId - The ID of the specific reply to fetch children for (Optional).
   */
  static async listReplies(rootId: string, limit = 20, cursor?: string, parentId?: string) {
    const params: any = { root_id: rootId, limit };
    if (parentId) params.parent_id = parentId;
    if (cursor) params.cursor = cursor;

    return this.request<{ replies: Reply[]; next_cursor: string | null }>(
      '/posts',
      'GET',
      undefined,
      params
    );
  }

  static async voteReply(replyId: string, voteType: 1 | -1) {
    return this.request<{ post_id: string; score: number }>(
      '/votes',
      'POST',
      { post_id: replyId, vote_type: voteType }
    );
  }

  static async updateReply(replyId: string, content: string) {
    return this.request<{ post: Reply }>(
      '/posts',
      'PATCH',
      { id: replyId, content }
    );
  }

  static async deleteReply(replyId: string) {
    // Doc: { "reply_id": "uuid" }
    return this.request<{ message: string }>(
      '/posts',
      'DELETE',
      { id: replyId }
    );
  }

  // --- Moderation ---

  static async listReports(limit = 20, offset = 0) {
    return this.request<{ reports: any[] }>(
      '/moderation-reports',
      'GET',
      undefined,
      { limit, offset }
    );
  }

  static async setCommentStatus(comment_id: string, status: CommentStatus) {
    // Doc: { "comment_id": "uuid", "status": "..." }
    return this.request<{ comment: Partial<Comment> }>(
      '/moderation-comment-status',
      'POST',
      { comment_id: comment_id, status }
    );
  }

  static async banUser(userId: string) {
    // Doc: { "user_id": "uuid" }
    return this.request<{ message: string; user: any }>(
      '/moderation-ban-user',
      'POST',
      { user_id: userId }
    );
  }
}