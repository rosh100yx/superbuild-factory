const TOKEN_KEY = "factory_token";

let cached: string | null = null;

export function initToken(): string {
  if (cached !== null) return cached;

  const fromUrl = new URLSearchParams(window.location.search).get("token");
  if (fromUrl) {
    localStorage.setItem(TOKEN_KEY, fromUrl);
    cached = fromUrl;
    return fromUrl;
  }

  cached = localStorage.getItem(TOKEN_KEY) ?? "";
  return cached;
}

export function getToken(): string {
  return initToken();
}

export function setToken(token: string): void {
  cached = token;
  localStorage.setItem(TOKEN_KEY, token);
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...authHeaders(),
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${response.status}: ${text.slice(0, 200)}`);
  }

  if (response.status === 401) {
    throw new Error(
      "unauthorized — this page has no token. Open it as ?token=<FACTORY_TOKEN> " +
        "(or paste your token in the header and press Enter).",
    );
  }

  if (!response.ok) throw new Error(data?.error ?? `${response.status} ${response.statusText}`);
  return data as T;
}

export async function artifact(key: string): Promise<string> {
  const response = await fetch(`/api/artifact?key=${encodeURIComponent(key)}`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(`artifact fetch failed (${response.status})`);
  return response.text();
}
