import assert from "node:assert/strict";
import test from "node:test";
import { assertIsolatedFrontendTarget } from "./e2e-frontend-target.mjs";

const appUrl = "https://shenage-e2e.example";
const testUrl = "https://ivquranttkxhxsdspqk.supabase.co";

const response = (body) => ({ ok: true, status: 200, text: async () => body });

test("accepts a frontend bundle compiled for the exact isolated project", async () => {
  const fetchImpl = async (url) =>
    url === `${appUrl}/`
      ? response('<script src="/static/js/main.js"></script>')
      : response(`const supabaseUrl = "${testUrl}";`);

  await assert.doesNotReject(() => assertIsolatedFrontendTarget({ appUrl, testSupabaseUrl: testUrl, fetchImpl }));
});

test("rejects a bundle that references production Supabase", async () => {
  const fetchImpl = async (url) =>
    url === `${appUrl}/`
      ? response('<script src="/static/js/main.js"></script>')
      : response('const supabaseUrl = "https://ucyglqpzpszeyejifobh.supabase.co";');

  await assert.rejects(
    () => assertIsolatedFrontendTarget({ appUrl, testSupabaseUrl: testUrl, fetchImpl }),
    /references the production Supabase project/
  );
});

test("rejects the production Shenage frontend before loading a bundle", async () => {
  await assert.rejects(
    () => assertIsolatedFrontendTarget({ appUrl: "https://shenage.ge", testSupabaseUrl: testUrl }),
    /production Shenage domain is forbidden/
  );
});

test("rejects a bundle with no isolated Supabase target", async () => {
  const fetchImpl = async (url) =>
    url === `${appUrl}/`
      ? response('<script src="/static/js/main.js"></script>')
      : response("console.log('missing runtime configuration');");

  await assert.rejects(
    () => assertIsolatedFrontendTarget({ appUrl, testSupabaseUrl: testUrl, fetchImpl }),
    /does not reference the configured isolated Supabase project/
  );
});
