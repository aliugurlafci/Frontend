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

  // UI must not reach into the data/workflow internals directly; it goes through
  // domain services (server) or the REST API (client).
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
                "@/lib/workflow/*",
              ],
              message:
                "UI cannot import data/workflow internals directly — use a domain service or the API.",
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
