/** Problem details returned by the API (RFC 9457). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body:
      { code?: string; title?: string; detail?: string } | undefined,
  ) {
    super(body?.title ?? `Request failed with ${status}`);
  }
}

/**
 * Every generated call goes through here: same-origin cookies, the CSRF header
 * the API requires on mutations, and JSON in and out.
 */
export async function apiFetch<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('X-Requested-With', 'tarbya');
  if (init.body && !headers.has('Content-Type'))
    headers.set('Content-Type', 'application/json');

  const res = await fetch(url, { ...init, headers, credentials: 'include' });
  const text = await res.text();
  const body = text ? JSON.parse(text) : undefined;
  if (!res.ok) throw new ApiError(res.status, body);
  return { data: body, status: res.status, headers: res.headers } as T;
}
