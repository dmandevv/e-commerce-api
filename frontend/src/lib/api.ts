// Empty string = same origin; Vercel rewrites proxy /api/* to k3s backend
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

// Paths that should NOT trigger a silent refresh on 401.
// /refresh itself 401'ing means the refresh token is gone → real logout.
// /login and /register 401'ing means bad credentials, not an expired token.
const NO_REFRESH_PATHS = ["/api/users/refresh", "/api/users/login", "/api/users/register"];

// Shared in-flight refresh promise. When several requests 401 at the same
// time, we only want ONE /refresh call — they all await the same promise.
let refreshPromise: Promise<boolean> | null = null;

// Read the csrfToken cookie set by the backend (not httpOnly).
// Returns null if the cookie is absent or expired.
function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null; // SSR guard
  const match = document.cookie.match(/(?:^|;\s*)csrfToken=([^;]+)/);
  return match ? match[1] : null;
}

// Shared in-flight bootstrap promise — prevents duplicate /csrf calls when
// several requests fire before the first bootstrap completes.
let csrfBootstrap: Promise<string | null> | null = null;

async function ensureCsrfToken(): Promise<string | null> {
  // Fast path: cookie already present
  const existing = getCsrfToken();
  if (existing) return existing;

  // Slow path: bootstrap once
  if (!csrfBootstrap) {
    csrfBootstrap = fetch(`${API_BASE}/api/users/csrf`, {
      credentials: "include",
    })
      .then(() => getCsrfToken())
      .catch(() => null)
      .finally(() => {
        csrfBootstrap = null;
      });
  }
  return csrfBootstrap;
}

async function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const csrfToken = await ensureCsrfToken();
      const res = await fetch(`${API_BASE}/api/users/refresh`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
      });
      return res.ok;
    })()
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  // csrfProtection middleware skips these — no token needed.
  const method = (options?.method ?? "GET").toUpperCase();
  const mutating = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";

  // Skip /csrf itself to avoid recursion (bootstrap calling bootstrap).
  const csrfToken = mutating && path !== "/api/users/csrf"
    ? await ensureCsrfToken()
    : null;

  const doFetch = () =>
    fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        ...options?.headers,
      },
    });

  let res = await doFetch();

  // Silent refresh: if 401 and this isn't an auth endpoint itself
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

