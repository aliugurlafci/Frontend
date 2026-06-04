/**
 * Phase 14 — Environment configuration.
 *
 * Validates and types process.env at startup. Secrets are read here
 * (secret management) and surfaced as a typed object; missing required secrets
 * in production fail fast rather than silently using dev defaults.
 */
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  AULA_JWT_SECRET: z.string().optional(),
  AULA_ENCRYPTION_KEY: z.string().optional(),
  AULA_DATABASE_URL: z.string().optional(),
  AULA_REDIS_URL: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
    throw new Error(`Invalid environment: ${issues}`);
  }
  const env = parsed.data;
  // Production with *real* backends must supply secrets — fail fast. With the
  // default in-memory backends (or during `next build`) we only warn, so the
  // demo runs out of the box.
  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
  if (env.NODE_ENV === "production" && !isBuildPhase) {
    const missing = (["AULA_JWT_SECRET", "AULA_ENCRYPTION_KEY"] as const).filter((k) => !env[k]);
    if (missing.length) {
      const message = `Missing production secrets: ${missing.join(", ")}`;
      if (env.AULA_DATABASE_URL) throw new Error(message);
      console.warn(`[aula-crm] ${message} — using insecure dev defaults (in-memory mode).`);
    }
  }
  return env;
}

export const env = load();

export const isProduction = env.NODE_ENV === "production";
export const usingInMemoryBackends = !env.AULA_DATABASE_URL;
