import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "glass glass-sheen rounded-2xl shadow-[var(--shadow-glass)] transition-shadow duration-300",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, action }: { title: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3.5">
      <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      {action}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("p-5", className)}>{children}</div>;
}
