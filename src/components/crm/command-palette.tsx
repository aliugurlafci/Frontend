"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";
import { hrefOf, type NavItem } from "./sidebar";
import { useI18n } from "@/lib/i18n/context";

interface Hit {
  entity: string;
  id: string;
  title: string;
}
interface Command {
  label: string;
  sub?: string;
  href: string;
}

export function CommandPalette({
  open,
  onClose,
  entities,
}: {
  open: boolean;
  onClose: () => void;
  entities: NavItem[];
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Debounced record search (state only set inside the timer, never synchronously).
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      if (q.trim().length < 2) {
        setHits([]);
        return;
      }
      try {
        const r = await apiFetch<{ hits: Hit[] }>(`/search?q=${encodeURIComponent(q)}`);
        setHits(r.hits);
      } catch {
        setHits([]);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [q, open]);

  const navCommands: Command[] = entities
    .filter((e) => !q.trim() || e.pluralLabel.toLowerCase().includes(q.toLowerCase()))
    .map((e) => ({ label: t("cmd.goto", { target: e.pluralLabel }), href: hrefOf(e) }));
  const recordCommands: Command[] = hits.map((h) => ({
    label: h.title,
    sub: h.entity,
    href: `/${h.entity}?focus=${h.id}`,
  }));
  const commands = [...navCommands, ...recordCommands];

  function go(href: string) {
    onClose();
    setQ("");
    router.push(href);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, commands.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === "Enter") {
        const cmd = commands[active];
        if (cmd) go(cmd.href);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, commands, active]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative w-full max-w-lg overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Icon name="search" className="h-4 w-4 text-muted-2" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            placeholder={t("cmd.placeholder")}
            className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-2"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted">ESC</kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto p-1">
          {commands.length === 0 && (
            <li className="px-3 py-6 text-center text-xs text-muted">{t("common.noResults")}</li>
          )}
          {commands.map((cmd, i) => (
            <li key={`${cmd.href}-${i}`}>
              <button
                onMouseDown={() => go(cmd.href)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm",
                  i === active ? "bg-surface-2" : "hover:bg-surface-2",
                )}
              >
                <span>{cmd.label}</span>
                {cmd.sub && <span className="text-xs text-muted-2">{cmd.sub}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
