import assert from "node:assert/strict";
import test from "node:test";
import { getVercelBypassHeaders } from "./e2e-vercel-protection.mjs";

test("does not require a bypass secret for a non-Vercel test deployment", () => {
  assert.deepEqual(getVercelBypassHeaders("https://shenage-e2e.example", ""), {});
});

test("requires a local-only bypass secret for a protected Vercel Preview", () => {
  assert.throws(
    () => getVercelBypassHeaders("https://shenage-e2e.vercel.app", ""),
    /VERCEL_AUTOMATION_BYPASS_SECRET/
  );
});

test("creates a bypass header without placing the secret in a URL", () => {
  assert.deepEqual(getVercelBypassHeaders("https://shenage-e2e.vercel.app", "test-only"), {
    "x-vercel-protection-bypass": "test-only",
  });
});
