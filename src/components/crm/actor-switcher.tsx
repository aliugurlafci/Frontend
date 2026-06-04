"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/input";

const ACTORS = [
  { value: "admin", label: "Avery — Admin" },
  { value: "manager", label: "Morgan — Manager" },
  { value: "rep", label: "Riley — Sales Rep" },
  { value: "accountant", label: "Casey — Accountant" },
];

/** Demo persona switcher — sets the `aula_actor` cookie and refreshes so both
 *  server and client see the new role (illustrates RBAC/ABAC differences). */
export function ActorSwitcher({ current }: { current: string }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-xs text-muted">
      <span className="hidden sm:inline">Viewing as</span>
      <Select
        aria-label="Switch demo persona"
        value={current}
        className="h-8 w-40"
        onChange={(e) => {
          document.cookie = `aula_actor=${e.target.value}; path=/; max-age=31536000`;
          router.refresh();
        }}
      >
        {ACTORS.map((a) => (
          <option key={a.value} value={a.value}>
            {a.label}
          </option>
        ))}
      </Select>
    </label>
  );
}
