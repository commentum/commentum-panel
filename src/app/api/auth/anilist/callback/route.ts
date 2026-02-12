import { NextRequest, NextResponse } from 'next/server';

// Configuration constants
const CONFIG = {
  ANILIST_ID: process.env.NEXT_PUBLIC_ANILIST_CLIENT_ID || '',
  ANILIST_SECRET: process.env.ANILIST_CLIENT_SECRET || '',
  BACKEND_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:54321/functions/v1',
  IS_PROD: process.env.NODE_ENV === 'production',
};

/**
 * Utility to generate redirect responses with error params
 */
const errorRedirect = (req: NextRequest, errorType: string) => {
  return NextResponse.redirect(new URL(`/login?error=${errorType}`, req.url));
};

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) return errorRedirect(request, error || 'missing_code');

  try {
    const tokenResponse = await fetch('https://anilist.co/api/v2/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: CONFIG.ANILIST_ID,
        client_secret: CONFIG.ANILIST_SECRET,
        code,
        redirect_uri: CONFIG.REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      console.error('AniList token exchange failed:', await tokenResponse.text());
      return errorRedirect(request, 'token_exchange_failed');
    }

    const { access_token } = await tokenResponse.json();
    if (!access_token) return errorRedirect(request, 'no_access_token');

    const loginResponse = await fetch(`${CONFIG.BACKEND_URL}/auth-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'anilist', access_token }),
    });

    if (!loginResponse.ok) {
      console.error('Backend login failed:', await loginResponse.text());
      return errorRedirect(request, 'backend_login_failed');
    }

    const { token: jwtToken, user, role: directRole } = await loginResponse.json();
    const role = user?.role || directRole || '';

    const successUrl = new URL('/', request.url);
    const response = NextResponse.redirect(successUrl);

    const cookieConfig = {
      httpOnly: true,
      secure: CONFIG.IS_PROD,
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 24 * 30,
    };

    response.cookies.set('auth_token', jwtToken, cookieConfig);

    if (role) {
      response.cookies.set('auth_role', role, { 
        ...cookieConfig, 
        httpOnly: false
      });
    }

    return response;

  } catch (err) {
    console.error('OAuth callback critical error:', err);
    return errorRedirect(request, 'callback_error');
  }
}