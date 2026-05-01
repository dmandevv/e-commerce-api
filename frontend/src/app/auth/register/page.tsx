"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [registered, setRegistered] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      await register(name, email, password);
      setRegistered(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Registration failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (registered) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="bg-white rounded-lg border p-8">
            <div className="text-4xl mb-4">📬</div>
            <h1 className="text-xl font-medium text-[#0f1111] mb-2">Check your email</h1>
            <p className="text-sm text-[#555]">
              We sent a verification link to <strong>{email}</strong>.
              Click it to activate your account before signing in.
            </p>
            <p className="text-xs text-[#767676] mt-4">
              Didn&apos;t get it?{" "}
              <Link href="/auth/login" className="text-[#007185] hover:underline">
                Sign in to resend
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }
  else {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-medium text-[#0f1111] text-center mb-6">
            Create account
          </h1>

          <div className="bg-white rounded-lg border p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-[#0f1111] mb-1">
                  Your name
                </label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="bg-white"
                />
              </div>

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
                  placeholder="At least 6 characters"
                  className="bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-[#0f1111] mb-1">
                  Re-enter password
                </label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="bg-white"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#ffd814] hover:bg-[#f7ca00] text-[#0f1111] font-medium rounded-lg border border-[#fcd200]"
              >
                {loading ? "Creating account..." : "Create account"}
              </Button>
            </form>

            <p className="text-xs text-[#555] mt-4">
              By creating an account, you agree to our terms of use.
            </p>

            <hr className="my-4" />

            <p className="text-sm">
              Already have an account?{" "}
              <Link
                href="/auth/login"
                className="text-[#007185] hover:text-[#c45500] hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }
}
