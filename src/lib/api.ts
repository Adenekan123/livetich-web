export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

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
}

/** Thin fetch wrapper for the NestJS API. Works on server and client. */
export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token && { Authorization: `Bearer ${opts.token}` }),
    },
    ...(opts.body !== undefined && { body: JSON.stringify(opts.body) }),
    cache: 'no-store',
  });
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
