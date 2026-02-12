import { NextRequest, NextResponse } from 'next/server'

const BACKEND_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:54321/functions/v1'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cookieToken = request.cookies.get('auth_token')?.value
    const token = authHeader?.replace(/^Bearer\s+/i, '') || cookieToken

    if (!token) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }

    const resp = await fetch(`${BACKEND_API_URL}/auth-me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await resp.json()
    return NextResponse.json(data, { status: resp.status })
  } catch (err) {
    console.error('Proxy /api/auth/me error:', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
