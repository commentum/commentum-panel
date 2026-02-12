import { NextRequest, NextResponse } from 'next/server';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export async function GET(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  return proxy(req, path);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  return proxy(req, path);
}

async function proxy(req: NextRequest, pathSegments: string[] | undefined) {
  const path = pathSegments?.join('/') || '';
  const url = `${BASE_URL}/${path}${req.nextUrl.search}`;

  const token = req.cookies.get('auth_token')?.value;

  const headers = new Headers();
  headers.set('Content-Type', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const body = req.method === 'POST' ? await req.text() : undefined;
    
    const response = await fetch(url, {
      method: req.method,
      headers: headers,
      body,
      cache: 'no-store',
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: 'Proxy failed to reach backend' }, { status: 500 });
  }
}