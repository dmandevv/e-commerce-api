// Empty string = same origin; Vercel rewrites proxy /api/* to k3s backend
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

// Paths that should NOT trigger a silent refresh on 401.
// /refresh itself 401'ing means the refresh token is gone → real logout.
// /login and /register 401'ing means bad credentials, not an expired token.
const NO_REFRESH_PATHS = ["/api/users/refresh", "/api/users/login", "/api/users/register"];

// Shared in-flight refresh promise. When several requests 401 at the same
// time, we only want ONE /refresh call — they all await the same promise.
let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/api/users/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        // Allow the next 401 (far in the future) to trigger another refresh
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const doFetch = () =>
    fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

  let res = await doFetch();

  // Silent refresh: if 401 and this isn't an auth endpoint itself,
  // try to refresh and retry once.
  if (res.status === 401 && !NO_REFRESH_PATHS.includes(path)) {
    const refreshed = await refreshSession();
    if (refreshed) {
      res = await doFetch();
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || `API error: ${res.status}`);
  }

  return res.json();
}
