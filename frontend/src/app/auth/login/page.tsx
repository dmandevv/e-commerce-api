"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";

function ResetSuccessBanner() {
  const searchParams = useSearchParams();
  if (searchParams.get("reset") !== "success") return null;
  return (
    <div className="bg-green-50 border border-green-200 rounded-md p-3 text-sm text-green-700">
      Password reset successfully. Please sign in with your new password.
    </div>
  );
}


export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      router.push("/");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Invalid email or password";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-medium text-[#0f1111] text-center mb-6">
          Sign in
        </h1>

        <div className="bg-white rounded-lg border p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Suspense>
              <ResetSuccessBanner />
            </Suspense>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-[#0f1111] mb-1">
                Email
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-[#0f1111] mb-1">
                Password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-white"
              />
            </div>

            <div className="text-right">
              <Link
                href="/auth/forgot-password"
                className="text-xs text-[#007185] hover:text-[#c45500] hover:underline"
              >
                Forgot your password?
              </Link>
            </div>


            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#ffd814] hover:bg-[#f7ca00] text-[#0f1111] font-medium rounded-lg border border-[#fcd200]"
            >
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="text-xs text-[#555] mt-4 text-center">
            By signing in, you agree to our terms of use.
          </p>
        </div>

        <div className="mt-6 text-center">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#e7e7e7]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-[#eaeded] px-2 text-[#767676]">
                New here?
              </span>
            </div>
          </div>

          <Link href="/auth/register">
            <Button
              variant="outline"
              className="w-full mt-4 rounded-lg text-sm"
            >
              Create your account
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
