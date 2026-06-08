"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { AuthLayout, AUTH_BUTTON } from "@/components/ui/auth-layout";

const CODE_LENGTH = 6;

const OTP_FIELD =
  "h-12 w-12 rounded-xl border border-border-strong bg-surface/60 text-center text-lg font-semibold text-foreground backdrop-blur-sm transition-[border-color,box-shadow,background-color] focus:outline-none focus-visible:border-ring focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-ring/30";

export default function TwoStepVerificationPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  function handleChange(index: number, value: string) {
    const char = value.replace(/[^0-9a-zA-Z]/g, "").slice(-1);
    setCode((prev) => {
      const next = [...prev];
      next[index] = char;
      return next;
    });
    if (char && index < CODE_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  }

  return (
    <AuthLayout center title={t("auth.twoStep.title")} subtitle={t("auth.twoStep.subtitle")}>
      <form
        className="mt-7 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          router.push("/");
        }}
      >
        <div className="flex justify-center gap-2 sm:gap-3">
          {code.map((value, index) => (
            <input
              key={index}
              ref={(el) => {
                inputs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={value}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              aria-label={t("auth.digit", { n: String(index + 1) })}
              className={OTP_FIELD}
            />
          ))}
        </div>

        <button type="submit" className={AUTH_BUTTON}>
          {t("auth.verify")}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-muted">
        {t("auth.twoStep.trouble")}{" "}
        <button type="button" className="font-semibold text-secondary hover:underline">
          {t("auth.resend")}
        </button>
      </p>
    </AuthLayout>
  );
}
