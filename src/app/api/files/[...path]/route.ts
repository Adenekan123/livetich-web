import { cookies } from 'next/headers';
import { baseUrl } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { RECORDER_COOKIE } from '@/lib/recorder-cookie';

/**
 * Authenticated proxy for uploaded submission blobs (recitation audio, images,
 * PDFs). A `<audio>`/`<img>` element can't send an Authorization header, so we
 * store the file URL as a same-origin path (`/api/files/…`) and this handler
 * reads the httpOnly session cookie, calls the API with a bearer token, and
 * streams the bytes straight back to the browser.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  // The recording browser has no session cookie — it holds one recorder token,
  // and an <img> or <embed> cannot send a header. The recorder page therefore
  // parks that token in a cookie of its own, which is the only thing this
  // proxy will accept in place of a session. The API still decides what a
  // recorder token may read.
  const token =
    (await getToken()) ??
    (await cookies()).get(RECORDER_COOKIE)?.value ??
    null;
  if (!token) return new Response('Unauthorized', { status: 401 });

  // Use the server-side base URL (internal Docker network when set) — reaching
  // the public API URL from inside the web container hairpins out and back
  // through the proxy and fails, so shared images/PDFs render broken.
  const upstream = await fetch(`${baseUrl()}/files/${path.join('/')}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!upstream.ok || !upstream.body) {
    return new Response('Not found', { status: upstream.status || 404 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type':
        upstream.headers.get('content-type') ?? 'application/octet-stream',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
