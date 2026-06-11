import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Phase 1 — architecture boundaries (enforcement-first, layered dependencies).
  // The core layer is the bottom of the stack and must not depend on higher layers.
  {
    files: ["src/lib/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/*/*", "@/app/*", "@/components/*"],
              message:
                "core is the lowest layer and cannot import higher layers.",
            },
          ],
        },
      ],
    },
  },

  // UI must not reach into the server/data internals directly; it goes through
  // the REST API (client) or server components. These `@/lib/*` modules are a
  // dead in-app mirror of the backend (query engine, domain/finance services,
  // search/workflow/integrations/jobs) kept for parity but NOT used by the UI —
  // quarantined here so they can't silently come back to life or mislead. The UI
  // may still import the genuine shared leaves: `data/query` + `domain/audit`
  // (types) and `finance/money` + `finance/totals` (pure formatting helpers).
  {
    files: ["src/components/**/*.{ts,tsx}", "src/app/**/page.tsx", "src/app/**/layout.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/lib/data/memory-repository",
                "@/lib/data/store",
                "@/lib/data/query-engine",
                "@/lib/data/repository",
                "@/lib/data/seed",
                "@/lib/domain/service",
                "@/lib/domain/state-machine",
                "@/lib/domain/invariants",
                "@/lib/finance/service",
                "@/lib/finance/number-sequence",
                "@/lib/search/*",
                "@/lib/workflow/*",
                "@/lib/jobs/*",
                "@/lib/integrations/import-export",
                "@/lib/bootstrap",
              ],
              message:
                "This is a dead backend-mirror module — the UI must use the REST API (client) or a server component, not the in-app data/domain/service layer.",
            },
          ],
        },
      ],
    },
  },

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
  ]),
]);

export default eslintConfig;
