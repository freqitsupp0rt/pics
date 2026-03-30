"use client";

import {
  useState,
  useEffect,
  createContext,
  useContext,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";

/* ===============================
   Context
================================ */
const AuthContext = createContext(null);

/* ===============================
   Helpers
================================ */
const decodeJwtPayload = (token) => {
  try {
    const base64 = token.split(".")[1];
    if (!base64) return null;

    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );

    return JSON.parse(json);
  } catch {
    return null;
  }
};

/* ===============================
   Provider
================================ */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  /* ===============================
     Centralized cleanup
  ================================ */
  const clearAuth = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    setUser(null);
  }, []);

  /* ===============================
     Token helpers
  ================================ */
  const getToken = () =>
    typeof window === "undefined" ? null : localStorage.getItem("token");

  const getRefreshToken = () =>
    typeof window === "undefined"
      ? null
      : localStorage.getItem("refreshToken");

  const checkTokenStatus = useCallback((token) => {
    if (!token) return { isValid: false };

    const payload = decodeJwtPayload(token);
    if (!payload?.exp) return { isValid: false };

    const expiresAt = payload.exp * 1000;
    const now = Date.now();
    const timeLeft = expiresAt - now;

    return {
      isValid: timeLeft > 0,
      expiresAt,
      timeLeft,
      isAboutToExpire: timeLeft < 30 * 60 * 1000, // 30 mins
      isExpired: timeLeft <= 0,
    };
  }, []);

  /* ===============================
     Refresh session
  ================================ */
  const refreshSession = useCallback(async (refreshToken) => {
    try {
      const res = await fetch("/api/auth/extend-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await res.json();

      if (!data?.success) {
        clearAuth();
        return { success: false };
      }

      localStorage.setItem("token", data.data.token);
      localStorage.setItem("refreshToken", data.data.refreshToken);
      setUser(data.data.user);

      return {
        success: true,
        token: data.data.token,
        refreshToken: data.data.refreshToken,
        user: data.data.user,
      };
    } catch {
      clearAuth();
      return { success: false };
    }
  }, [clearAuth]);

  /* ===============================
     Fetch user
  ================================ */
  const fetchUserData = async (token) => {
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (!res.ok) throw new Error("Unauthorized");

      const data = await res.json();
      if (!data.success) throw new Error("Invalid session");

      setUser(data.data.user);
    } catch {
      clearAuth();
    }
  };

  /* ===============================
     Auth check on load
  ================================ */
  const checkAuth = useCallback(async () => {
    try {
      const token = getToken();
      const refreshToken = getRefreshToken();

      if (!token || !refreshToken) {
        clearAuth();
        return;
      }

      const status = checkTokenStatus(token);

      if (status.isExpired || status.isAboutToExpire) {
        const refreshed = await refreshSession(refreshToken);
        if (!refreshed.success) return;

        await fetchUserData(refreshed.token);
      } else {
        await fetchUserData(token);
      }
    } finally {
      setLoading(false);
    }
  }, [checkTokenStatus, refreshSession, clearAuth]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  /* ===============================
     Auto refresh (5 min)
  ================================ */
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      const token = getToken();
      const refreshToken = getRefreshToken();
      if (!token || !refreshToken) return;

      const status = checkTokenStatus(token);
      if (status.isValid && status.isAboutToExpire) {
        refreshSession(refreshToken);
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user, checkTokenStatus, refreshSession]);

  /* ===============================
     Actions
  ================================ */
  const login = async (username, password) => {
    try {
      setLoading(true);

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!data.success) {
        return { success: false, message: data.message };
      }

      localStorage.setItem("token", data.data.token);
      localStorage.setItem("refreshToken", data.data.refreshToken);
      setUser(data.data.user);

      return { success: true, user: data.data.user };
    } catch {
      return { success: false, message: "Login failed" };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    clearAuth();
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
  };

  /* ===============================
     Context value
  ================================ */
  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    logout,
    getToken,
    checkTokenExpiry: () => checkTokenStatus(getToken()),
    extendSession: () => refreshSession(getRefreshToken()),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/* ===============================
   Hook
================================ */
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
};
