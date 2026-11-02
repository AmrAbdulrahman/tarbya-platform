import axios, { type AxiosResponse } from 'axios';

/** A tiny browser stand-in: keeps cookies by name and sends the CSRF header. */
export class Session {
  readonly cookies = new Map<string, string>();

  async post(
    url: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) {
    return this.track(
      await axios.post(url, body, {
        headers: {
          'X-Requested-With': 'e2e',
          Cookie: this.cookieHeader(),
          ...headers,
        },
        validateStatus: () => true,
      }),
    );
  }

  async put(url: string, body?: unknown) {
    return this.send('put', url, body);
  }

  async patch(url: string, body?: unknown) {
    return this.send('patch', url, body);
  }

  private async send(method: 'put' | 'patch', url: string, body: unknown) {
    return this.track(
      await axios.request({
        method,
        url,
        data: body,
        headers: { 'X-Requested-With': 'e2e', Cookie: this.cookieHeader() },
        validateStatus: () => true,
      }),
    );
  }

  async get(url: string) {
    return this.track(
      await axios.get(url, {
        headers: { Cookie: this.cookieHeader() },
        validateStatus: () => true,
      }),
    );
  }

  private cookieHeader(): string {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  private track(res: AxiosResponse) {
    for (const raw of res.headers['set-cookie'] ?? []) {
      const [pair] = raw.split(';');
      const [name, value] = pair.split('=');
      if (value) this.cookies.set(name, value);
      else this.cookies.delete(name);
    }
    return res;
  }
}

export function setCookies(res: AxiosResponse): string[] {
  return res.headers['set-cookie'] ?? [];
}
