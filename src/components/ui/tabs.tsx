"use client";

import { cn } from "@/lib/utils/cn";

export interface TabItem {
  value: string;
  label: string;
}

/** Accessible controlled tab strip — glass segmented control (panels rendered by the parent). */
export function Tabs({
  items,
  value,
  onChange,
}: {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div role="tablist" className="glass inline-flex flex-wrap items-center gap-1 rounded-xl p-1">
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all",
              active
                ? "bg-surface-solid text-foreground shadow-sm ring-1 ring-border-strong"
                : "text-muted hover:bg-surface-2 hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
