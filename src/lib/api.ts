// deno-lint-ignore-file no-explicit-any

export type UserRole = 'user' | 'moderator' | 'admin';
export type PostStatus = 'active' | 'hidden' | 'removed' | 'deleted';

export interface UserSummary {
  username: string;
  avatar_url: string | null;
}

export interface User {
  id: string;
  username: string;
  role: UserRole;
  provider: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Post {
  id: string;
  content: string;
  score: number;
  status: PostStatus;
  parent_id: string | null;
  root_id: string;
  media_id: string | null;
  user: UserSummary;
  client?: string | null;
  created_at: string;
  updated_at: string;
  user_vote?: 1 | -1 | null;
}

export interface Comment extends Post {
  replies?: Reply[];
  has_more_replies: boolean;
  replies_count: number;
}

export type Reply = Post;

export interface ModerationReport {
  id: string;
  reason: string;
  comment_id: string;
  comment_content: string;
  comment_status: PostStatus;
  comment_author: string;
  reporter: string;
  created_at: string;
}

export class AppError extends Error {
  constructor(public message: string, public status: number) {
    super(message);
    this.name = 'AppError';
  }
}

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
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
    body?: unknown,
    params?: Record<string, string | number | undefined>
  ): Promise<T> {
    let url = `${this.BASE_URL}${endpoint}`;

    if (params) {
      const cleanParams = Object.entries(params).reduce((acc, [key, value]) => {
        if (value !== undefined && value !== null) acc[key] = String(value);
        return acc;
      }, {} as Record<string, string>);

      if (Object.keys(cleanParams).length > 0) {
        url += `?${new URLSearchParams(cleanParams).toString()}`;
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    const activeToken = this.jwtToken || this.getTokenFromCookie();
    if (activeToken) {
      headers.Authorization = `Bearer ${activeToken}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new AppError(data.error || data.message || 'Server Error', response.status);
    }

    return data as T;
  }

  static async login(provider: 'anilist' | 'mal' | 'simkl', accessToken: string) {
    const data = await this.request<{ token: string; user: User }>('/auth', 'POST', {
      provider,
      access_token: accessToken,
    });
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

  static async createPost(payload: { media_id?: string; parent_id?: string; content: string; client?: string }) {
    return this.request<{ post: Post }>('/posts', 'POST', payload);
  }

  static async updatePost(id: string, content: string) {
    return this.request<{ post: Post }>('/posts', 'PATCH', { id, content });
  }

  static async deletePost(id: string) {
    return this.request<{ post: Partial<Post> }>('/posts', 'DELETE', { id });
  }

  static async listComments(mediaId: string, limit = 20, cursor?: string) {
    return this.request<{ comments: Comment[]; comment_count: number; next_cursor: string | null }>(
      '/posts',
      'GET',
      undefined,
      { media_id: mediaId, limit, cursor }
    );
  }

  static async listReplies(options: { root_id?: string; parent_id?: string; limit?: number; cursor?: string }) {
    return this.request<{ replies: Reply[]; reply_count: number; next_cursor: string | null }>(
      '/posts',
      'GET',
      undefined,
      {
        root_id: options.root_id,
        parent_id: options.parent_id,
        limit: options.limit ?? 20,
        cursor: options.cursor,
      }
    );
  }

  static async votePost(postId: string, voteType: 1 | -1) {
    return this.request<{ post_id: string; score: number }>('/votes', 'POST', {
      post_id: postId,
      vote_type: voteType,
    });
  }

  static async reportPost(postId: string, reason: string) {
    return this.request<{ message: string }>('/reports', 'POST', { post_id: postId, reason });
  }

  static async listReports(limit = 20, offset = 0) {
    return this.request<{ reports: ModerationReport[] }>('/moderation-reports', 'GET', undefined, {
      limit,
      offset,
    });
  }

  static async setCommentStatus(commentId: string, status: 'active' | 'hidden' | 'removed') {
    return this.request<{ comment: Partial<Post> }>('/moderation-comment-status', 'POST', {
      comment_id: commentId,
      status,
    });
  }

  static async banUser(userId: string) {
    return this.request<{ message: string; user: { id: string; username: string; is_banned: boolean } }>(
      '/moderation-ban-user',
      'POST',
      { user_id: userId }
    );
  }
}
