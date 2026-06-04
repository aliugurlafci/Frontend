/**
 * Phase 13 — encryption readiness (AES-256-GCM).
 *
 * Authenticated encryption for data at rest (e.g. encrypting PII columns). The
 * key derives from a secret resolved via env (Phase 14 secret management); a
 * dev fallback keeps local runs working but must be overridden in production.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

function secret(): string {
  return process.env.AULA_ENCRYPTION_KEY ?? "dev-insecure-key-change-me";
}

function deriveKey(pass: string): Buffer {
  return scryptSync(pass, "aula-crm-static-salt", 32);
}

/** Returns `iv.tag.ciphertext`, all base64. */
export function encrypt(plaintext: string, pass = secret()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(pass), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString("base64")).join(".");
}

export function decrypt(payload: string, pass = secret()): string {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(pass), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}
