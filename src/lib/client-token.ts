'use client';

/**
 * The session cookie is httpOnly, so JS can't read it directly. Realtime
 * handshakes (Socket.IO, LiveKit) fetch the bearer token from a same-origin
 * route that reads the cookie server-side.
 */
export async function getRealtimeToken(): Promise<string | null> {
  try {
    const res = await fetch('/api/realtime-token', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as { token: string | null };
    return data.token;
  } catch {
    return null;
  }
}
