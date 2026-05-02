"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await apiFetch<{ success: boolean; data: User }>(
        "/api/users/profile"
      );
      setUser(res.data);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    fetchProfile().finally(() => setLoading(false));
  }, [fetchProfile]);

  async function login(email: string, password: string) {
    const res = await apiFetch<{
      success: boolean;
      data: { user: User };
    }>("/api/users/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setUser(res.data.user);
  }

  async function register(name: string, email: string, password: string) {
    const res = await apiFetch<{
      success: boolean;
      data: { user: User };
    }>("/api/users/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    setUser(res.data.user);
  }

  async function logout() {
    try {
      await apiFetch("/api/users/logout", { method: "POST" });
    } catch {
      // Even if the request fails, clear local state
    }
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        loading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
