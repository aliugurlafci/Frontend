import type { ReactNode } from "react";
import { Icon } from "./icon";

export function EmptyState({
  icon = "search",
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface-2/70 text-muted shadow-sm backdrop-blur-sm">
        <Icon name={icon} className="h-6 w-6" />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="max-w-xs text-xs text-muted">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
