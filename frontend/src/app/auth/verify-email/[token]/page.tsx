"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

type Status = "loading" | "success" | "error";

export default function VerifyEmailPage() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    apiFetch(`/api/users/verify-email/${token}`)
      .then(() => setStatus("success"))
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Verification failed.";
        setMessage(msg);
        setStatus("error");
      });
  }, [token]);

  if (status === "loading") {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <p className="text-[#555]">Verifying your email...</p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="bg-white rounded-lg border p-8">
            <div className="text-4xl mb-4">✅</div>
            <h1 className="text-xl font-medium text-[#0f1111] mb-2">Email verified!</h1>
            <p className="text-sm text-[#555] mb-4">
              Your account is now active. You can sign in.
            </p>
            <Link
              href="/auth/login"
              className="text-sm text-[#007185] hover:text-[#c45500] hover:underline"
            >
              Go to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="bg-white rounded-lg border p-8">
          <div className="text-4xl mb-4">❌</div>
          <h1 className="text-xl font-medium text-[#0f1111] mb-2">Verification failed</h1>
          <p className="text-sm text-red-600 mb-4">{message}</p>
          <Link
            href="/auth/login"
            className="text-sm text-[#007185] hover:text-[#c45500] hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
