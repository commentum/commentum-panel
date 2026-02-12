import { NextRequest, NextResponse } from 'next/server'

const BACKEND_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:54321/functions/v1'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const resp = await fetch(`${BACKEND_API_URL}/auth-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await resp.json()

    // If backend returned a token, set secure httpOnly cookie and readable role
    const response = NextResponse.json(data, { status: resp.status })

    if (data.token) {
      response.cookies.set({
        name: 'auth_token',
        value: data.token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
      })
    }

    const role = (data.user && data.user.role) || data.role
    if (role) {
      response.cookies.set({
        name: 'auth_role',
        value: role,
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
      })
    }

    return response
  } catch (err) {
    console.error('Proxy /api/auth/login error:', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
