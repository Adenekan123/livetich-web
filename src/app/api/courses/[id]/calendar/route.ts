import { NextResponse } from 'next/server';
import { baseUrl } from '@/lib/api';
import { getToken } from '@/lib/auth';

/**
 * Serves the class .ics to the browser. The session cookie is httpOnly, so this
 * same-origin route reads it server-side and proxies the API's calendar endpoint
 * with a bearer token — the "Add to calendar" button links here.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = await getToken();
  if (!token) return new NextResponse('Unauthorized', { status: 401 });

  // Server-side base URL (internal Docker network when set) — the public URL
  // hairpins from inside the web container and fails.
  const res = await fetch(`${baseUrl()}/courses/${id}/calendar.ics`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    return new NextResponse('Could not build the calendar file', {
      status: res.status,
    });
  }
  const ics = await res.text();
  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="livetich-class.ics"',
      'Cache-Control': 'no-store',
    },
  });
}
