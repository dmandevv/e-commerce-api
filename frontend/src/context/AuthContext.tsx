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
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (jwt: string) => {
    try {
      const res = await apiFetch<{ success: boolean; data: User }>(
        "/api/users/profile",
        { headers: { Authorization: `Bearer ${jwt}` } }
      );
      setUser(res.data);
    } catch {
      localStorage.removeItem("token");
      setToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("token");
    if (saved) {
      setToken(saved);
      fetchProfile(saved).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [fetchProfile]);

  async function login(email: string, password: string) {
    const res = await apiFetch<{
      success: boolean;
      data: { token: string; user: User };
    }>("/api/users/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem("token", res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
  }

  async function register(name: string, email: string, password: string) {
    const res = await apiFetch<{
      success: boolean;
      data: { token: string };
    }>("/api/users/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    localStorage.setItem("token", res.data.token);
    setToken(res.data.token);
    await fetchProfile(res.data.token);
  }

  function logout() {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
