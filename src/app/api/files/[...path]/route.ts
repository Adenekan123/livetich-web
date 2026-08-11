import { API_URL } from '@/lib/api';
import { getToken } from '@/lib/auth';

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
  const token = await getToken();
  if (!token) return new Response('Unauthorized', { status: 401 });

  const upstream = await fetch(`${API_URL}/files/${path.join('/')}`, {
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
