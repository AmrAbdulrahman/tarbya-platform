/** Problem details returned by the API (RFC 9457). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body:
      | {
          code?: string;
          title?: string;
          detail?: string;
          errors?: Record<string, string[]>;
        }
      | undefined,
  ) {
    super(body?.title ?? `Request failed with ${status}`);
  }

  get code(): string | undefined {
    return this.body?.code;
  }
}

const HEADERS = { 'X-Requested-With': 'tarbya' };

// Endpoints whose 401 means "wrong credentials" or "no session", not "access token expired".
const NO_REFRESH = [
  '/api/auth/sign-in',
  '/api/auth/refresh',
  '/api/auth/sign-out',
];

let refreshing: Promise<boolean> | undefined;

/** One refresh at a time; concurrent 401s wait for the same one (US-1.3). */
function refreshSession(): Promise<boolean> {
  refreshing ??= fetch('/api/auth/refresh', {
    method: 'POST',
    headers: HEADERS,
    credentials: 'include',
  })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = undefined;
    });
  return refreshing;
}

/**
 * Every generated call goes through here: same-origin cookies, the CSRF header
 * the API requires on mutations, JSON in and out, and one silent refresh when
 * the access token has expired.
 */
export async function apiFetch<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  for (const [name, value] of Object.entries(HEADERS)) headers.set(name, value);
  if (init.body && !headers.has('Content-Type'))
    headers.set('Content-Type', 'application/json');

  const send = () => fetch(url, { ...init, headers, credentials: 'include' });

  let res = await send();
  if (
    res.status === 401 &&
    !NO_REFRESH.some((prefix) => url.startsWith(prefix)) &&
    (await refreshSession())
  ) {
    res = await send();
  }

  const text = await res.text();
  const body = text ? JSON.parse(text) : undefined;
  if (!res.ok) throw new ApiError(res.status, body);
  return { data: body, status: res.status, headers: res.headers } as T;
}
