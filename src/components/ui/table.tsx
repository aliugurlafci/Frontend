import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-border bg-surface-2/60 text-left text-xs font-medium uppercase tracking-wide text-muted backdrop-blur-sm">
      {children}
    </thead>
  );
}

export function TH({ children, style, className }: { children: ReactNode; style?: React.CSSProperties; className?: string }) {
  return (
    <th scope="col" className={cn("px-4 py-2.5 font-medium", className)} style={style}>
      {children}
    </th>
  );
}

export function TR({ children, onClick, className }: { children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "border-b border-border transition-colors last:border-0",
        onClick && "cursor-pointer hover:bg-surface-2/70",
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function TD({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("px-4 py-2.5 align-middle", className)}>{children}</td>;
}
