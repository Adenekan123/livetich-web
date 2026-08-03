import { NextResponse } from 'next/server';
import { getToken } from '@/lib/auth';

/**
 * The session cookie is httpOnly, so browser JS can't read it. The realtime
 * clients (Socket.IO, LiveKit) still need a bearer token, so they fetch it from
 * this same-origin route, which reads the httpOnly cookie server-side.
 *
 * Follow-up hardening: mint a short-lived, realtime-scoped token here (via the
 * API) instead of echoing the full session token.
 */
export async function GET() {
  const token = await getToken();
  if (!token) {
    return NextResponse.json({ token: null }, { status: 401 });
  }
  return NextResponse.json(
    { token },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
