"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Mail } from "lucide-react";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n/context";
import { AuthLayout, AUTH_FIELD, AUTH_BUTTON } from "@/components/ui/auth-layout";

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
  const [twoFactor, setTwoFactor] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await apiFetch<{ twoFactorRequired?: boolean }>("/auth/login", {
        method: "POST",
        body: { email, password, code: twoFactor ? code : undefined },
      });
      if (res?.twoFactorRequired) {
        // Password OK — prompt for the authenticator code and re-submit.
        setTwoFactor(true);
        setBusy(false);
        return;
      }
      router.push(next.startsWith("/") ? next : "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t("login.failed"));
      setBusy(false);
    }
  }

  return (
    <AuthLayout title={t("login.title")} subtitle={t("login.subtitle")}>
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
              className={`${AUTH_FIELD} pr-10`}
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
              className={`${AUTH_FIELD} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-2 hover:text-foreground"
            >
              {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {twoFactor && (
          <div>
            <label htmlFor="code" className="mb-1.5 block text-sm font-semibold">
              {t("login.twoFactorCode")}
            </label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              autoFocus
              placeholder="123456"
              className={`${AUTH_FIELD} tracking-[0.3em]`}
            />
            <p className="mt-1.5 text-xs text-muted-2">{t("login.twoFactorHint")}</p>
          </div>
        )}

        {error && (
          <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger backdrop-blur-sm">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy} className={AUTH_BUTTON}>
          {busy ? t("login.signingIn") : twoFactor ? t("login.verify") : t("login.signIn")}
        </button>
      </form>

      {/* Demo accounts — fill credentials for the seeded users (password: Passw0rd!) */}
      <div className="mt-8 rounded-2xl border border-border bg-surface-2/40 p-3 backdrop-blur-sm">
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
                "rounded-xl border px-3 py-2 text-left text-xs transition-all " +
                (email === p.email
                  ? "border-primary bg-primary/10 text-primary shadow-sm"
                  : "border-border bg-surface/50 hover:bg-surface-2 hover:border-border-strong")
              }
            >
              <span className="block font-semibold">{p.name}</span>
              <span className="block text-muted">{p.role}</span>
            </button>
          ))}
        </div>
      </div>
    </AuthLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
