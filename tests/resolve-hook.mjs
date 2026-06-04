// Phase 12 — dependency-free ESM resolve hook so `node --test` can load the
// Next.js TypeScript source, which uses the `@/` path alias and extensionless
// relative imports. Type stripping (`--experimental-strip-types`) handles the
// TS syntax; this hook only fixes module resolution.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const SRC = new URL("../src/", import.meta.url);

function tryExtensions(baseURL) {
  const base = fileURLToPath(baseURL);
  for (const ext of [".ts", ".tsx", ".js", "/index.ts", "/index.tsx"]) {
    const candidate = base + ext;
    if (existsSync(candidate)) return pathToFileURL(candidate).href;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  // `@/x` alias -> src/x
  if (specifier.startsWith("@/")) {
    const resolved = tryExtensions(new URL(specifier.slice(2), SRC));
    if (resolved) return { url: resolved, shortCircuit: true };
  }
  // extensionless relative imports
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !path.extname(specifier) &&
    context.parentURL
  ) {
    const resolved = tryExtensions(new URL(specifier, context.parentURL));
    if (resolved) return { url: resolved, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
