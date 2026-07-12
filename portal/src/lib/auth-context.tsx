"use client";

/**
 * Auth context — the single source of truth for the logged-in user on the client.
 *
 * Wraps the app (see app/providers.tsx). Holds the current employee, exposes
 * login / signup / logout, and hydrates the user from storage on reload.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { apiClient } from "./api-client";
import {
  clearTokens,
  decodeClaims,
  getAccessToken,
  getRefreshToken,
  isAuthenticated,
  setTokens,
} from "./auth-store";

export interface CurrentUser {
  employee_id: string;
  user_id: string;
  employee_code: string;
  name: string;
  email: string;
  role_code: RoleCode;
  department_id: string | null;
  phone?: string | null;
}

export type RoleCode = "ADMIN" | "ASSET_MANAGER" | "DEPT_HEAD" | "EMPLOYEE";

export const ROLE_LABEL: Record<RoleCode, string> = {
  ADMIN: "Admin",
  ASSET_MANAGER: "Asset Manager",
  DEPT_HEAD: "Dept Head",
  EMPLOYEE: "Employee",
};

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  employee: CurrentUser;
}

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: SignupData) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: RoleCode[]) => boolean;
}

export interface SignupData {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

const USER_KEY = "af.user";
const AuthContext = createContext<AuthContextValue | null>(null);

function cacheUser(user: CurrentUser | null) {
  if (typeof window === "undefined") return;
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

function readCachedUser(): CurrentUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as CurrentUser) : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Hydrate on mount.
  useEffect(() => {
    async function hydrate() {
      if (!isAuthenticated()) {
        clearTokens();
        cacheUser(null);
        setLoading(false);
        return;
      }
      const cached = readCachedUser();
      if (cached) {
        setUser(cached);
        setLoading(false);
        return;
      }
      // Token present but no cached profile — fetch it from the claims.
      const claims = decodeClaims(getAccessToken());
      if (claims?.employee_id) {
        try {
          const emp = await apiClient.get<CurrentUser>(
            `/employees/${claims.employee_id}`,
          );
          setUser(emp);
          cacheUser(emp);
        } catch {
          /* leave unauthenticated */
        }
      }
      setLoading(false);
    }
    hydrate();
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiClient.post<TokenResponse>(
        "/auth/login",
        { email, password },
        { skipAuth: true },
      );
      setTokens(res.access_token, res.refresh_token);
      setUser(res.employee);
      cacheUser(res.employee);
      router.push("/dashboard");
    },
    [router],
  );

  const signup = useCallback(
    async (data: SignupData) => {
      const res = await apiClient.post<TokenResponse>(
        "/auth/signup",
        data,
        { skipAuth: true },
      );
      setTokens(res.access_token, res.refresh_token);
      setUser(res.employee);
      cacheUser(res.employee);
      router.push("/dashboard");
    },
    [router],
  );

  const logout = useCallback(async () => {
    const refresh_token = getRefreshToken();
    try {
      if (refresh_token) {
        await apiClient.post("/auth/logout", { refresh_token }, { skipAuth: true });
      }
    } catch {
      /* ignore network errors on logout */
    }
    clearTokens();
    cacheUser(null);
    setUser(null);
    router.push("/login");
  }, [router]);

  const hasRole = useCallback(
    (...roles: RoleCode[]) => (user ? roles.includes(user.role_code) : false),
    [user],
  );

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
