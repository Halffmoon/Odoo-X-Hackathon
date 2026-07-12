/**
 * Token storage + JWT claim helpers.
 *
 * Tokens live in localStorage (survives refresh). The backend issues JWTs whose
 * payload carries { sub (user_id), employee_id, role, exp, ... }; we decode the
 * payload client-side purely for UI (role gating, expiry checks) — never for
 * trust decisions, which the backend always re-verifies.
 */

const ACCESS_KEY = "af.access_token";
const REFRESH_KEY = "af.refresh_token";

export interface TokenClaims {
  sub: string; // user_id
  employee_id: string;
  role: string; // role_code
  exp: number; // seconds since epoch
  iat?: number;
  type?: string;
}

const isBrowser = () => typeof window !== "undefined";

export function setTokens(accessToken: string, refreshToken: string): void {
  if (!isBrowser()) return;
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function getAccessToken(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function clearTokens(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function decodeClaims(token: string | null): TokenClaims | null {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as TokenClaims;
  } catch {
    return null;
  }
}

/** True if a stored access token exists and is not expired. */
export function isAuthenticated(): boolean {
  const claims = decodeClaims(getAccessToken());
  if (!claims) return false;
  return claims.exp * 1000 > Date.now();
}

export function getCurrentClaims(): TokenClaims | null {
  return decodeClaims(getAccessToken());
}
