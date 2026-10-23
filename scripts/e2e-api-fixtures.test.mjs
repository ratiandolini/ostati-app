import assert from "node:assert/strict";
import test from "node:test";
import {
  E2E_ADMIN_MEMBER_ID,
  createAdminMemberPayload,
  createFixtureFrontendTargetFetch,
  validateFixtureEnvironment,
} from "./e2e-api-fixtures.mjs";

test("creates an idempotent text-keyed E2E Admin member payload", () => {
  const payload = createAdminMemberPayload("11111111-1111-1111-1111-111111111111");

  assert.equal(payload.id, E2E_ADMIN_MEMBER_ID);
  assert.equal(typeof payload.id, "string");
  assert.equal(payload.user_id, "11111111-1111-1111-1111-111111111111");
  assert.equal(payload.role, "owner");
  assert.equal(payload.active, true);
  assert.deepEqual(payload.permissions, ["verification", "disputes", "bookings", "finance", "users", "settings", "audit"]);
});

test("forwards the Preview bypass header only to the protected Preview origin", async () => {
  const previousSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  process.env.VERCEL_AUTOMATION_BYPASS_SECRET = "test-only";
  const previewUrl = "https://shenage-e2e.vercel.app";
  const requests = [];

  try {
    const fetchWithBypass = createFixtureFrontendTargetFetch(previewUrl, async (url, options) => {
      requests.push({ url, options });
      return { ok: true, status: 200, text: async () => "" };
    });

    await fetchWithBypass(`${previewUrl}/static/js/main.js`, { headers: { Accept: "text/javascript" } });
    await fetchWithBypass("https://cdn.example/main.js", { headers: { Accept: "text/javascript" } });

    assert.deepEqual(requests[0].options.headers, {
      Accept: "text/javascript",
      "x-vercel-protection-bypass": "test-only",
    });
    assert.deepEqual(requests[1].options.headers, { Accept: "text/javascript" });
  } finally {
    if (previousSecret === undefined) delete process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    else process.env.VERCEL_AUTOMATION_BYPASS_SECRET = previousSecret;
  }
});

test("fixture provisioning rejects the superseded and production project refs before any write", () => {
  const environment = Object.fromEntries([
    "E2E_BASE_URL", "E2E_TEST_PROJECT_REF", "E2E_TEST_SUPABASE_URL",
    "E2E_TEST_SERVICE_ROLE_KEY", "E2E_CLIENT_EMAIL", "E2E_CLIENT_PASSWORD",
    "E2E_CRAFTSMAN_EMAIL", "E2E_CRAFTSMAN_PASSWORD", "E2E_ADMIN_EMAIL",
    "E2E_ADMIN_PASSWORD",
  ].map((name) => [name, "test-only"]));
  environment.E2E_ALLOW_TEST_FIXTURES = "isolated-project-only";
  environment.E2E_TEST_PROJECT_REF = "ivguranttkxhxsdsppqk";
  environment.E2E_TEST_SUPABASE_URL = "https://ivguranttkxhxsdsppqk.supabase.co";

  assert.equal(validateFixtureEnvironment(environment).projectRef, environment.E2E_TEST_PROJECT_REF);
  assert.throws(
    () => validateFixtureEnvironment({ ...environment, E2E_TEST_PROJECT_REF: "ivquranttkxhxsdspqk" }),
    /expected the dedicated test project/
  );
  assert.throws(
    () => validateFixtureEnvironment({ ...environment, E2E_TEST_PROJECT_REF: "ucyglqpzpszeyejifobh" }),
    /production project is forbidden/
  );
});
