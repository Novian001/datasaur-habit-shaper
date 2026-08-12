import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiRequest, ApiClientError } from "../api/client";

// Auth session (architecture.md §2/§3): JWT in localStorage (approved
// tradeoff — same-origin SPA proxied through nginx, bearer-in-header, no
// CSRF surface of consequence; see architecture.md §3 ED + Security §8).
// No Redux — a small context is enough. Tokens are never logged.

const TOKEN_KEY = "habit-shaper-token";

export type User = { id: number; email: string; createdAt: string };

type AuthContextValue = {
  user: User | null;
  token: string | null;
  bootstrapping: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, password: string) => Promise<User>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Reads the stored token (or null) without touching React state.
export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [bootstrapping, setBootstrapping] = useState<boolean>(() => getStoredToken() !== null);

  // App startup: stored token → GET /api/auth/me. Valid → authenticated;
  // invalid/expired → clear token and become logged out (STEP 4/5).
  useEffect(() => {
    const stored = getStoredToken();
    if (!stored) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest<{ user: User }>("/api/auth/me", { token: stored });
        if (cancelled) return;
        setUser(data.user);
        setToken(stored);
      } catch (err) {
        if (cancelled) return;
        // Invalid/expired token: clear and become unauthenticated.
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
        setToken(null);
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const finishAuth = useCallback((data: { user: User; token: string }) => {
    localStorage.setItem(TOKEN_KEY, data.token);
    setUser(data.user);
    setToken(data.token);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await apiRequest<{ user: User; token: string }>("/api/auth/login", { body: { email, password } });
      finishAuth(data);
      return data.user;
    },
    [finishAuth],
  );

  const register = useCallback(
    async (email: string, password: string) => {
      const data = await apiRequest<{ user: User; token: string }>("/api/auth/register", { body: { email, password } });
      finishAuth(data);
      return data.user;
    },
    [finishAuth],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setToken(null);
  }, []);

  const value = useMemo(
    () => ({ user, token, bootstrapping, login, register, logout }),
    [user, token, bootstrapping, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// Small helper for pages: pull the safe message out of a client error.
export function errorMessage(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  return "Something went wrong. Please try again.";
}
