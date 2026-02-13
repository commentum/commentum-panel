import { NextRequest, NextResponse } from 'next/server'

const BACKEND_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:54321/functions/v1'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cookieToken = request.cookies.get('auth_token')?.value
    const token = authHeader?.replace(/^Bearer\s+/i, '') || cookieToken

    if (!token) {
      // clear cookies anyway
      const res = NextResponse.json({ ok: true })
      res.cookies.delete('auth_token')
      res.cookies.delete('auth_role')
      return res
    }

    const resp = await fetch(`${BACKEND_API_URL}/auth`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })

    const data = await resp.text()
    const response = NextResponse.json({ ok: resp.ok, data }, { status: resp.status })
    response.cookies.delete('auth_token')
    response.cookies.delete('auth_role')
    return response
  } catch (err) {
    console.error('Proxy /api/auth/logout error:', err)
    const response = NextResponse.json({ error: 'internal_error' }, { status: 500 })
    response.cookies.delete('auth_token')
    response.cookies.delete('auth_role')
    return response
  }
}
