/**
 * Where the browser reaches the API.
 *
 * Reassignable, and deliberately so. NEXT_PUBLIC_API_URL is baked in for the
 * app's own users, but the recorder page is opened by a browser on LiveKit's
 * infrastructure, where a localhost (or private-network) API URL resolves to
 * nothing at all. Every client-side call then fails, and the recording is a
 * full-screen error frame — a black video with the lesson nowhere in it.
 *
 * So the API hands the recorder its own public URL and the page installs it
 * here, before any socket or fetch runs. The alternative — threading a base URL
 * through the board, the mushaf and every component under them — would leave
 * one forgotten call site to produce exactly the same black recording.
 *
 * Reads go through the live binding, so a caller that reads API_URL inside an
 * effect or a function sees the override; only code that copies it at module
 * scope would miss it, and nothing does.
 */
export let API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

/**
 * Point every client-side call at a different API for the rest of this page's
 * life. Only the recorder uses this, and only from a URL the API itself minted
 * — which is also the only way to get the recorder token that makes the page
 * do anything.
 */
export function setApiBase(url: string) {
  // Browser only. This module is shared with server code, and there the module
  // object is per-process and outlives the request — mutating it on the server
  // would repoint every other request's API calls at whatever URL the last
  // recorder happened to be handed. The recorder calls this from a render body,
  // which runs on the server too, so the guard is load-bearing.
  if (typeof window === 'undefined') return;
  API_URL = url.replace(/\/+$/, '');
}

/**
 * Base URL to use for a request. The browser must use the public URL. On the
 * server (RSC / server actions run inside the web container) we prefer the
 * internal Docker network URL when set — reaching the public URL from inside
 * the container hairpins out to the host and back through the proxy, which can
 * hang. Falls back to the public URL (local dev, or when not containerised).
 */
const INTERNAL_API_URL = process.env.API_INTERNAL_URL;
export function baseUrl(): string {
  if (typeof window === 'undefined' && INTERNAL_API_URL) return INTERNAL_API_URL;
  return API_URL;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  token?: string | null;
  body?: unknown;
  /** Extra request headers (e.g. the admin step-up token). */
  headers?: Record<string, string>;
  /** Abort after this many ms so a down/misconfigured API fails fast. */
  timeoutMs?: number;
}

/** Thin fetch wrapper for the NestJS API. Works on server and client. */
export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const base = baseUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 10_000);
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: opts.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(opts.token && { Authorization: `Bearer ${opts.token}` }),
        ...opts.headers,
      },
      ...(opts.body !== undefined && { body: JSON.stringify(opts.body) }),
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(
      0,
      controller.signal.aborted
        ? `Request to ${path} timed out — is the API running at ${base}?`
        : `Could not reach the API at ${base}.`,
    );
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let message = res.statusText;
    try {
      const data: { message?: string | string[] } = await res.json();
      if (data.message) {
        message = Array.isArray(data.message)
          ? data.message.join(', ')
          : data.message;
      }
    } catch {
      // Non-JSON error body — keep the status text.
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}
