import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";
import { Spinner } from "./spinner";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "xs" | "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-gradient-to-b from-primary to-primary-hover text-primary-foreground shadow-[0_6px_18px_-6px_var(--primary)] hover:brightness-110 hover:shadow-[0_8px_22px_-6px_var(--primary)]",
  secondary:
    "glass text-foreground shadow-sm hover:bg-glass-strong hover:text-foreground",
  outline:
    "border border-border-strong bg-surface/40 text-foreground backdrop-blur-sm hover:bg-surface-2 hover:border-border-strong",
  ghost: "text-muted hover:bg-surface-2 hover:text-foreground",
  danger:
    "bg-gradient-to-b from-danger to-danger text-white shadow-[0_6px_18px_-6px_var(--danger)] hover:brightness-110",
};

const SIZES: Record<Size, string> = {
  xs: "h-7 px-2.5 text-xs gap-1",
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 active:translate-y-px",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 focus-visible:ring-offset-surface",
        "disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}
