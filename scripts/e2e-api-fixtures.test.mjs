import assert from "node:assert/strict";
import test from "node:test";
import { E2E_ADMIN_MEMBER_ID, createAdminMemberPayload } from "./e2e-api-fixtures.mjs";

test("creates an idempotent text-keyed E2E Admin member payload", () => {
  const payload = createAdminMemberPayload("11111111-1111-1111-1111-111111111111");

  assert.equal(payload.id, E2E_ADMIN_MEMBER_ID);
  assert.equal(typeof payload.id, "string");
  assert.equal(payload.user_id, "11111111-1111-1111-1111-111111111111");
  assert.equal(payload.role, "owner");
  assert.equal(payload.active, true);
  assert.deepEqual(payload.permissions, ["verification", "disputes", "bookings", "finance", "users", "settings", "audit"]);
});
