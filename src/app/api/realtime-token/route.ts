import { NextResponse } from 'next/server';
import { api, ApiError } from '@/lib/api';
import { getToken } from '@/lib/auth';

/**
 * The session cookie is httpOnly, so browser JS can't read it. Realtime clients
 * (Socket.IO, LiveKit) still need a bearer token, so they fetch it here. Rather
 * than echo the long-lived session token, we exchange it (server-side, using the
 * httpOnly cookie) for a short-lived realtime token from the API — so if this
 * value is ever exposed to a script, it expires in minutes, not days. Sockets
 * re-fetch on every (re)connect, so the short TTL is transparent.
 */
export async function GET() {
  const sessionToken = await getToken();
  if (!sessionToken) {
    return NextResponse.json({ token: null }, { status: 401 });
  }
  try {
    const { token } = await api<{ token: string }>('/auth/realtime-token', {
      method: 'POST',
      token: sessionToken,
    });
    return NextResponse.json(
      { token },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    const status = e instanceof ApiError && e.status ? e.status : 500;
    return NextResponse.json({ token: null }, { status });
  }
}
