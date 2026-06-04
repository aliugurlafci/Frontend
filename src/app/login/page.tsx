"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Mail } from "lucide-react";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n/context";

const DEMO_ACCOUNTS = [
  { email: "avery@acme.test", name: "Avery Admin", role: "Administrator" },
  { email: "morgan@acme.test", name: "Morgan Manager", role: "Sales Manager" },
  { email: "riley@acme.test", name: "Riley Rep", role: "Sales Rep" },
  { email: "casey@acme.test", name: "Casey Accountant", role: "Accountant" },
];
const DEMO_PASSWORD = "Passw0rd!";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useI18n();
  const next = params.get("next") || "/";

  const [email, setEmail] = useState("avery@acme.test");
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiFetch("/auth/login", { method: "POST", body: { email, password } });
      router.push(next.startsWith("/") ? next : "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Sign in failed");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-xl font-bold text-primary-foreground">
            A
          </div>
          <span className="text-2xl font-bold tracking-tight">Aula CRM</span>
        </div>

        <h1 className="text-2xl font-bold">{t("login.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("login.subtitle")}</p>

        <form className="mt-7 space-y-5" onSubmit={signIn}>
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-semibold">
              {t("login.email")}
            </label>
            <div className="relative">
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                className="h-11 w-full rounded-md border border-border bg-surface px-3 pr-10 text-sm text-foreground placeholder:text-muted-2 focus:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              />
              <Mail className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-semibold">
              {t("login.password")}
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="h-11 w-full rounded-md border border-border bg-surface px-3 pr-10 text-sm text-foreground placeholder:text-muted-2 focus:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-2 hover:text-foreground"
              >
                {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="h-11 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
          >
            {busy ? t("login.signingIn") : t("login.signIn")}
          </button>
        </form>

        {/* Demo accounts — fill credentials for the seeded users (password: Passw0rd!) */}
        <div className="mt-8 rounded-md border border-border bg-surface-2/50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-2">
            {t("login.demoAccounts")} <code>{DEMO_PASSWORD}</code>
          </p>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map((p) => (
              <button
                key={p.email}
                type="button"
                onClick={() => {
                  setEmail(p.email);
                  setPassword(DEMO_PASSWORD);
                  setError(null);
                }}
                className={
                  "rounded-md border px-3 py-2 text-left text-xs transition-colors " +
                  (email === p.email
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-surface hover:bg-surface-2")
                }
              >
                <span className="block font-semibold">{p.name}</span>
                <span className="block text-muted">{p.role}</span>
              </button>
            ))}
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-muted">Copyright © 2026 — Aula CRM</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
