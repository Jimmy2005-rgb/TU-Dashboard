"use client";

import { GraduationCap, Loader2, Lock } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Sign-in failed.");
      return;
    }
    const next = params.get("next");
    router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card w-full max-w-sm p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-tu-600 text-gold-500">
          <GraduationCap className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold">TU BBA Hub</h1>
          <p className="text-sm text-slate-500">Enter your hub password</p>
        </div>
      </div>
      <label className="label" htmlFor="password">
        Password
      </label>
      <input
        id="password"
        type="password"
        autoFocus
        autoComplete="current-password"
        className="input"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button type="submit" className="btn-primary mt-4 w-full" disabled={loading || !password}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
        Sign in
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-tu-50 via-white to-gold-300/20 p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
