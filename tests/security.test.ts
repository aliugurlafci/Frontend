import { test } from "node:test";
import assert from "node:assert/strict";
import { signJwt, verifyJwt } from "@/lib/security/auth";
import { encrypt, decrypt } from "@/lib/security/crypto";
import { verifyCsrf } from "@/lib/security/csrf";
import { rateLimit, resetRateLimits } from "@/lib/security/rate-limit";

test("security: JWT round-trips and rejects tampering", () => {
  const token = signJwt({ sub: "u1", roles: ["admin"], tenantId: "t", orgId: "o" }, "secret");
  const claims = verifyJwt(token, "secret");
  assert.equal(claims.sub, "u1");
  assert.throws(() => verifyJwt(token + "x", "secret"));
  assert.throws(() => verifyJwt(token, "wrong-secret"));
});

test("security: AES-GCM encrypt/decrypt round-trips", () => {
  const plain = "sensitive-value";
  const enc = encrypt(plain, "key");
  assert.notEqual(enc, plain);
  assert.equal(decrypt(enc, "key"), plain);
});

test("security: CSRF double-submit comparison", () => {
  assert.equal(verifyCsrf("abc", "abc"), true);
  assert.equal(verifyCsrf("abc", "xyz"), false);
  assert.equal(verifyCsrf(null, "abc"), false);
});

test("security: rate limiter blocks past the limit", () => {
  resetRateLimits();
  const key = "test-key";
  assert.equal(rateLimit(key, 2, 1000).allowed, true);
  assert.equal(rateLimit(key, 2, 1000).allowed, true);
  assert.equal(rateLimit(key, 2, 1000).allowed, false);
});
