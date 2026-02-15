import { NextRequest, NextResponse } from 'next/server';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

async function handler(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  return proxy(req, path);
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;

async function proxy(req: NextRequest, pathSegments: string[] | undefined) {
  if (!BASE_URL) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_API_URL is not configured' }, { status: 500 });
  }

  const path = pathSegments?.join('/') || '';
  const url = `${BASE_URL}/${path}${req.nextUrl.search}`;

  const cookieToken = req.cookies.get('auth_token')?.value;
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '') || cookieToken;

  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  headers.set('Accept', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const body = req.method === 'GET' ? undefined : await req.text();

    const response = await fetch(url, {
      method: req.method,
      headers,
      body,
      cache: 'no-store',
    });

    const text = await response.text();
    const json = text ? JSON.parse(text) : {};
    return NextResponse.json(json, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Proxy failed to reach backend' }, { status: 500 });
  }
}
