/**
 * Centralized API client (fetch-based).
 *
 * - Prefixes NEXT_PUBLIC_API_BASE_URL
 * - Injects `Authorization: Bearer <access>` on every request
 * - On 401: transparently calls /auth/refresh once (shared in-flight promise so
 *   concurrent 401s don't stampede), stores the new pair, retries the request.
 *   On refresh failure: clears tokens and redirects to /login.
 * - Normalizes every error to { message, detail, status }
 * - Logs requests/responses in development
 */
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "./auth-store";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api";

const isDev = process.env.NODE_ENV !== "production";

export class ApiError extends Error {
  status: number;
  detail: unknown;
  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export interface RequestOptions {
  params?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  headers?: Record<string, string>;
  /** Endpoints that must NOT carry/refresh auth (login, signup, refresh, forgot). */
  skipAuth?: boolean;
  /** Return the raw Response (for file/blob downloads). */
  raw?: boolean;
  signal?: AbortSignal;
}

function buildUrl(path: string, params?: RequestOptions["params"]): string {
  const url = new URL(
    API_BASE_URL.replace(/\/$/, "") + "/" + path.replace(/^\//, ""),
  );
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    }
  }
  return url.toString();
}

/** Extract a human message from a FastAPI error body. */
function messageFromBody(body: unknown, status: number): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (detail && typeof detail === "object" && "message" in detail) {
      return String((detail as { message: unknown }).message);
    }
    if (Array.isArray(detail) && detail.length && detail[0]?.msg) {
      return detail.map((e: { msg: string }) => e.msg).join(", ");
    }
  }
  return `Request failed (${status})`;
}

let refreshPromise: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  const refresh_token = getRefreshToken();
  if (!refresh_token) return false;
  try {
    const res = await fetch(buildUrl("/auth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

async function refreshOnce(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

function redirectToLogin() {
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    window.location.href = "/login";
  }
}

async function request<T>(
  method: string,
  path: string,
  opts: RequestOptions = {},
  isRetry = false,
): Promise<T> {
  const url = buildUrl(path, opts.params);
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };

  const hasBody = opts.body !== undefined && !(opts.body instanceof FormData);
  if (hasBody) headers["Content-Type"] = "application/json";

  if (!opts.skipAuth) {
    const token = getAccessToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  if (isDev) console.debug(`→ ${method} ${url}`, opts.params ?? "");

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body:
        opts.body instanceof FormData
          ? opts.body
          : hasBody
            ? JSON.stringify(opts.body)
            : undefined,
      signal: opts.signal,
    });
  } catch (e) {
    throw new ApiError("Connection failed — please retry.", 0, e);
  }

  if (isDev) console.debug(`← ${res.status} ${method} ${url}`);

  // Transparent refresh on 401.
  if (res.status === 401 && !opts.skipAuth && !isRetry) {
    const ok = await refreshOnce();
    if (ok) return request<T>(method, path, opts, true);
    clearTokens();
    redirectToLogin();
    throw new ApiError("Session expired. Please log in again.", 401);
  }

  if (opts.raw) return res as unknown as T;

  if (res.status === 204) return undefined as T;

  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    throw new ApiError(messageFromBody(body, res.status), res.status, (body as { detail?: unknown })?.detail);
  }

  return body as T;
}

export const apiClient = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>("GET", path, opts),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>("POST", path, { ...opts, body }),
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>("PUT", path, { ...opts, body }),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>("PATCH", path, { ...opts, body }),
  delete: <T>(path: string, opts?: RequestOptions) => request<T>("DELETE", path, opts),
  /** Download a file (returns a Blob). */
  download: async (path: string, opts?: RequestOptions): Promise<Blob> => {
    const res = await request<Response>("GET", path, { ...opts, raw: true });
    if (!res.ok) throw new ApiError("Download failed.", res.status);
    return res.blob();
  },
};
