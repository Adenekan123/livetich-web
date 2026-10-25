import { NextResponse } from 'next/server';
import { api, ApiError } from '@/lib/api';
import { getToken } from '@/lib/auth';

export async function POST(request: Request) {
  const sessionToken = await getToken();
  if (!sessionToken) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body: { sessionId?: unknown; port?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (
    typeof body.sessionId !== 'string' ||
    !body.sessionId.trim() ||
    typeof body.port !== 'number' ||
    !Number.isInteger(body.port) ||
    body.port < 1 ||
    body.port > 65535
  ) {
    return NextResponse.json({ error: 'A valid session and port are required' }, { status: 400 });
  }

  try {
    const result = await api<{ token: string }>('/auth/preview-token', {
      method: 'POST',
      token: sessionToken,
      body: { sessionId: body.sessionId, port: body.port },
    });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const status = error instanceof ApiError && error.status ? error.status : 502;
    return NextResponse.json({ error: 'Could not authorize this preview' }, { status });
  }
}
