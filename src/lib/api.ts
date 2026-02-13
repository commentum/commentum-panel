// --- Types & Interfaces ---
// deno-lint-ignore-file no-explicit-any require-await
export type UserRole = 'user' | 'moderator' | 'admin';
export type CommentStatus = 'active' | 'hidden' | 'removed';

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
  created_at: string;
  updated_at: string;
  user_vote?: number | null;
  avatar_url?: string;
}

export interface Comment {
  id: string;
  content: string;
  score: number;
  status: CommentStatus;
  username: string;
  created_at: string;
  updated_at: string;
  replies?: Reply[];
  has_more_replies: boolean;
  replies_count: number;
  user_vote?: number | null;
  avatar_url?: string;
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

  /**
   * Set the JWT token globally. 
   * On the client, this should be called during app initialization.
   */
  static setToken(token: string | null) {
    this.jwtToken = token;
  }

  /**
   * Client-side helper to read the auth_token cookie
   */
  static getTokenFromCookie(): string | null {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; auth_token=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
  }

  private static async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any,
    params?: Record<string, string | number>
  ): Promise<T> {
    // 1. Resolve relative or absolute URL
    // In Next.js client-side, relative works. In SSR, you'd need the full domain.
    let url = `${this.BASE_URL}${endpoint}`;
    
    if (params) {
      const query = new URLSearchParams(params as any).toString();
      url += `?${query}`;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // 2. Prioritize explicitly set token, fallback to cookie
    const activeToken = this.jwtToken || this.getTokenFromCookie();

    if (activeToken) {
      headers['Authorization'] = `Bearer ${activeToken}`;
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        // Ensure we don't cache auth-dependent requests
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
      '/auth-login',
      'POST',
      { provider, access_token: accessToken }
    );
    
    this.setToken(data.token);

    // Persist via Cookie instead of LocalStorage for SSR support
    if (typeof document !== 'undefined') {
      document.cookie = `auth_token=${data.token}; path=/; max-age=604800; SameSite=Lax; Secure`;
    }
    
    return data;
  }

  static async logout() {
    const res = await this.request<{ message: string }>('/auth-logout', 'POST');
    this.setToken(null);
    
    // Clear the cookie
    if (typeof document !== 'undefined') {
      document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
    
    return res;
  }

  static async getMe() {
    return this.request<{ user: User }>('/auth-me');
  }

  // --- Comments ---
  static async createComment(mediaId: string, content: string) {
    return this.request<{ comment: Comment }>('/comments-create', 'POST', { mediaId, content });
  }

  static async listComments(mediaId: string, limit = 20, cursor?: string) {
    const params: any = { mediaId, limit };
    if (cursor) params.cursor = cursor;
    return this.request<{ comments: Comment[]; next_cursor: string | null }>('/comments-list', 'GET', undefined, params);
  }

  static async voteComment(commentId: string, voteType: 1 | -1) {
    return this.request<{ comment_id: string; score: number }>('/comments-vote', 'POST', { comment_id: commentId, vote_type: voteType });
  }

  static async reportComment(commentId: string, reason: string) {
    return this.request<{ message: string }>('/comments-report', 'POST', { comment_id: commentId, reason });
  }

  static async updateComment(commentId: string, content: string) {
    return this.request<{ comment: Comment }>('/comments-update', 'POST', { comment_id: commentId, content });
  }

  static async deleteComment(commentId: string) {
    return this.request<{ comment: Partial<Comment> }>('/comments-delete', 'POST', { comment_id: commentId });
  }

  // --- Replies ---
  static async createReply(commentId: string, content: string) {
    return this.request<{ reply: Reply }>('/replies-create', 'POST', { comment_id: commentId, content });
  }

  static async listReplies(commentId: string, limit = 20, cursor?: string) {
    const params: any = { comment_id: commentId, limit };
    if (cursor) params.cursor = cursor;
    return this.request<{ replies: Reply[]; next_cursor: string | null }>('/replies-list', 'GET', undefined, params);
  }

  static async voteReply(replyId: string, voteType: 1 | -1) {
    return this.request<{ reply_id: string; score: number }>('/replies-vote', 'POST', { reply_id: replyId, vote_type: voteType });
  }

  static async updateReply(replyId: string, content: string) {
    return this.request<{ reply: Reply }>('/replies-update', 'POST', { reply_id: replyId, content });
  }

  static async deleteReply(replyId: string) {
    return this.request<{ message: string }>('/replies-delete', 'POST', { reply_id: replyId });
  }

  // --- Moderation ---
  static async listReports(limit = 20, offset = 0) {
    return this.request<{ reports: any[] }>('/moderation-reports', 'GET', undefined, { limit, offset });
  }

  static async setCommentStatus(commentId: string, status: CommentStatus) {
    return this.request<{ comment: Partial<Comment> }>('/moderation-comment-status', 'POST', { comment_id: commentId, status });
  }

  static async banUser(userId: string) {
    return this.request<{ message: string; user: any }>('/moderation-ban-user', 'POST', { user_id: userId });
  }
}