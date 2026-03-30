import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { apiFetch, setToken, clearToken, getToken, getApiKeyExpires, ApiError } from "@/lib/api-client";

export type AppRole = "viewer" | "operator" | "admin";

export interface AuthUser {
  actor: string;
  role: AppRole;
  roles: AppRole[];
  apiKeyLabel?: string;
  apiKeyVersion?: string;
  apiKeyExpiresAt?: string;
  requestId?: string;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  apiKeyExpires: string | null;
  login: (token: string) => Promise<void>;
  testConnection: (token: string) => Promise<AuthUser>;
  logout: () => void;
  hasRole: (role: AppRole) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyExpires, setApiKeyExpires] = useState<string | null>(null);

  const fetchMe = useCallback(async () => {
    try {
      const data = await apiFetch<AuthUser>("/api/auth/me");
      setUser(data);
      setError(null);
      const expires = data.apiKeyExpiresAt ?? getApiKeyExpires();
      setApiKeyExpires(expires);
      return data;
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
        if (e.status === 401) {
          clearToken();
          setUser(null);
        }
      } else {
        setError("Cannot reach server");
      }
      return null;
    }
  }, []);

  const login = useCallback(async (token: string) => {
    setIsLoading(true);
    setError(null);
    setToken(token);
    const data = await fetchMe();
    if (!data) {
      clearToken();
    }
    setIsLoading(false);
  }, [fetchMe]);

  const testConnection = useCallback(async (token: string): Promise<AuthUser> => {
    setToken(token);
    try {
      const data = await apiFetch<AuthUser>("/api/auth/me");
      const expires = data.apiKeyExpiresAt ?? getApiKeyExpires();
      setApiKeyExpires(expires);
      clearToken(); // Don't persist until explicit login
      return data;
    } catch (e) {
      clearToken();
      throw e;
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    setError(null);
    setApiKeyExpires(null);
  }, []);

  const hasRole = useCallback((role: AppRole): boolean => {
    if (!user) return false;
    if (user.roles?.includes(role)) return true;
    if (role === "viewer") return true;
    if (role === "operator" && (user.role === "operator" || user.role === "admin")) return true;
    if (role === "admin" && user.role === "admin") return true;
    return false;
  }, [user]);

  // Restore session if token exists in memory (e.g. after HMR)
  useEffect(() => {
    if (getToken() && !user) {
      setIsLoading(true);
      fetchMe().finally(() => setIsLoading(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      error,
      apiKeyExpires,
      login,
      testConnection,
      logout,
      hasRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
