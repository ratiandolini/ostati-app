import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { assertIsolatedFrontendTarget } from "./e2e-frontend-target.mjs";
import { TEST_PROJECT_REF } from "./e2e-test-db-installer.mjs";
import { getVercelBypassHeaders } from "./e2e-vercel-protection.mjs";

const productionProjectRefs = new Set(["ucyglqpzpszeyejifobh"]);
const stateDirectory = join(process.cwd(), ".e2e");
const statePath = join(stateDirectory, "fixture-state.json");
const fixtureKinds = ["client", "craftsman", "admin"];
export const E2E_ADMIN_MEMBER_ID = "e2e-test-owner";

export const createAdminMemberPayload = (userId) => ({
  id: E2E_ADMIN_MEMBER_ID,
  user_id: userId,
  name: "E2E Admin",
  role: "owner",
  permissions: ["verification", "disputes", "bookings", "finance", "users", "settings", "audit"],
  active: true,
});

export const createFixtureFrontendTargetFetch = (appUrl, fetchImpl = fetch) => {
  const protectedOrigin = new URL(appUrl).origin;
  const bypassHeaders = getVercelBypassHeaders(appUrl);

  return (url, options = {}) => {
    const requestUrl = new URL(url, appUrl);
    const headers =
      requestUrl.origin === protectedOrigin
        ? { ...(options.headers || {}), ...bypassHeaders }
        : options.headers;

    return fetchImpl(url, { ...options, headers });
  };
};

const fail = (message) => {
  throw new Error(`E2E fixture safety check failed: ${message}`);
};

export const validateFixtureEnvironment = (environment) => {
  const names = [
    "E2E_BASE_URL",
    "E2E_TEST_PROJECT_REF",
    "E2E_TEST_SUPABASE_URL",
    "E2E_TEST_SERVICE_ROLE_KEY",
    "E2E_CLIENT_EMAIL",
    "E2E_CLIENT_PASSWORD",
    "E2E_CRAFTSMAN_EMAIL",
    "E2E_CRAFTSMAN_PASSWORD",
    "E2E_ADMIN_EMAIL",
    "E2E_ADMIN_PASSWORD",
  ];
  for (const name of names) if (!environment[name]) fail(`missing ${name}`);
  if (environment.E2E_ALLOW_TEST_FIXTURES !== "isolated-project-only") {
    fail("E2E_ALLOW_TEST_FIXTURES must be isolated-project-only");
  }

  const projectRef = environment.E2E_TEST_PROJECT_REF;
  const url = new URL(environment.E2E_TEST_SUPABASE_URL);
  if (productionProjectRefs.has(projectRef)) fail("the production project is forbidden");
  if (projectRef !== TEST_PROJECT_REF) fail(`expected the dedicated test project ${TEST_PROJECT_REF}`);
  if (url.hostname !== `${projectRef}.supabase.co`) fail("URL does not match the declared test project ref");
  return { projectRef, baseUrl: url.origin, key: environment.E2E_TEST_SERVICE_ROLE_KEY };
};

const requireEnvironment = () => validateFixtureEnvironment(process.env);

const request = async ({ baseUrl, key }, path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation,resolution=merge-duplicates",
      ...(options.headers || {}),
    },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`${options.method || "GET"} ${path} failed: ${response.status} ${body}`);
  return body ? JSON.parse(body) : null;
};

const rpc = (config, name, payload) =>
  request(config, `/rest/v1/rpc/${name}`, { method: "POST", body: JSON.stringify(payload) });

const getOne = async (config, table, query) => {
  const rows = await request(config, `/rest/v1/${table}?${query}`);
  return rows[0] || null;
};

const createOrUpdateAuthUser = async (config, email, password, metadata) => {
  try {
    return await request(config, "/auth/v1/admin/users", {
      method: "POST",
      body: JSON.stringify({ email, password, email_confirm: true, user_metadata: metadata }),
    });
  } catch (error) {
    const users = await request(config, "/auth/v1/admin/users?page=1&per_page=1000");
    const existing = (users.users || users).find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (!existing?.id) throw error;
    return request(config, `/auth/v1/admin/users/${existing.id}`, {
      method: "PUT",
      body: JSON.stringify({ password, email_confirm: true, user_metadata: metadata }),
    });
  }
};

const waitForAppUser = async (config, authUserId) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const user = await getOne(config, "users", `select=id,auth_user_id&auth_user_id=eq.${authUserId}`);
    if (user) return user;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Auth trigger did not create public.users for ${authUserId}`);
};

const deleteWhere = async (config, table, query) =>
  request(config, `/rest/v1/${table}?${query}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });

const asInFilter = (ids) => `in.(${ids.join(",")})`;

const cleanupFixtureData = async (config, state) => {
  if (!state?.client?.userId || !state?.craftsman?.workerId || !state.runMarker) return;
  const clientId = state.client.userId;
  const runMarker = state.runMarker;
  const posts = await request(
    config,
    `/rest/v1/job_posts?select=id&client_id=eq.${clientId}&description=ilike.${encodeURIComponent(`${runMarker}%`)}`
  );
  const postIds = posts.map((post) => post.id);
  const bookings = postIds.length
    ? await request(config, `/rest/v1/bookings?select=id&job_post_id=${asInFilter(postIds)}`)
    : [];
  const bookingIds = bookings.map((booking) => booking.id);
  if (bookingIds.length) {
    const bookingFilter = `booking_id=${asInFilter(bookingIds)}`;
    for (const table of ["messages", "reviews", "disputes", "payments", "booking_details", "notifications"]) {
      await deleteWhere(config, table, bookingFilter);
    }
    await deleteWhere(config, "bookings", `id=${asInFilter(bookingIds)}`);
  }

  await deleteWhere(
    config,
    "worker_support_messages",
    `text=ilike.${encodeURIComponent(`${runMarker}%`)}`
  );
  if (postIds.length) await deleteWhere(config, "job_posts", `id=${asInFilter(postIds)}`);
};

const cleanupProvisioning = async (config, state) => {
  if (state?.provisioning?.adminMemberCreated) {
    await deleteWhere(config, "admin_members", `id=eq.${E2E_ADMIN_MEMBER_ID}`);
  }
  if (state?.provisioning?.adminAllowlistCreated && state?.admin?.email) {
    await deleteWhere(config, "admin_allowlist", `email=eq.${encodeURIComponent(state.admin.email.toLowerCase())}`);
  }
};

const loadFixtureState = () => {
  try {
    return JSON.parse(readFileSync(statePath, "utf8"));
  } catch {
    return null;
  }
};

const setup = async () => {
  const config = requireEnvironment();
  const appUrl = process.env.E2E_BASE_URL;
  await assertIsolatedFrontendTarget({
    appUrl,
    testSupabaseUrl: process.env.E2E_TEST_SUPABASE_URL,
    fetchImpl: createFixtureFrontendTargetFetch(appUrl),
  });
  await rpc(config, "e2e_assert_isolated_test_environment", { p_project_ref: config.projectRef });

  const staleState = loadFixtureState();
  if (staleState?.projectRef === config.projectRef) {
    await cleanupFixtureData(config, staleState);
    await cleanupProvisioning(config, staleState);
    rmSync(statePath, { force: true });
  }

  const accountConfig = {
    client: {
      email: process.env.E2E_CLIENT_EMAIL,
      password: process.env.E2E_CLIENT_PASSWORD,
      metadata: { role: "client", first_name: "E2E", last_name: "Client", phone: "+995599000001" },
    },
    craftsman: {
      email: process.env.E2E_CRAFTSMAN_EMAIL,
      password: process.env.E2E_CRAFTSMAN_PASSWORD,
      metadata: { role: "craftsman", first_name: "E2E", last_name: "Craftsman", phone: "+995599000002" },
    },
    admin: {
      email: process.env.E2E_ADMIN_EMAIL,
      password: process.env.E2E_ADMIN_PASSWORD,
      metadata: { role: "client", first_name: "E2E", last_name: "Admin", phone: "+995599000003" },
    },
  };

  const identities = { projectRef: config.projectRef, runMarker: `E2E:${randomUUID()}` };
  for (const kind of fixtureKinds) {
    const account = accountConfig[kind];
    const authUser = await createOrUpdateAuthUser(config, account.email, account.password, account.metadata);
    const appUser = await waitForAppUser(config, authUser.id);
    identities[kind] = { authUserId: authUser.id, userId: appUser.id };
  }

  await request(config, `/rest/v1/users?id=eq.${identities.client.userId}`, {
    method: "PATCH",
    body: JSON.stringify({ role: "client", status: "active", phone: "+995599000001", first_name: "E2E", last_name: "Client" }),
  });
  await request(config, `/rest/v1/users?id=eq.${identities.craftsman.userId}`, {
    method: "PATCH",
    body: JSON.stringify({ role: "craftsman", status: "active", phone: "+995599000002", first_name: "E2E", last_name: "Craftsman" }),
  });
  await request(config, `/rest/v1/users?id=eq.${identities.admin.userId}`, {
    method: "PATCH",
    body: JSON.stringify({ role: "admin", status: "active", phone: "+995599000003", first_name: "E2E", last_name: "Admin" }),
  });

  const worker = await getOne(config, "workers", `select=id,user_id&user_id=eq.${identities.craftsman.userId}`);
  if (!worker?.id) throw new Error("Fixture craftsman has no worker profile");
  identities.craftsman.workerId = worker.id;
  await request(config, `/rest/v1/workers?id=eq.${worker.id}`, {
    method: "PATCH",
    body: JSON.stringify({ display_name: "E2E Craftsman", is_active: true, verification_status: "verified", price_type: "from", price_min: 50 }),
  });

  const profession = await getOne(config, "professions", "select=id&name=eq.%E1%83%94%E1%83%9A%E1%83%94%E1%83%A5%E1%83%A2%E1%83%A0%E1%83%98%E1%83%99%E1%83%9D%E1%83%A1%E1%83%98");
  if (!profession?.id) throw new Error("The seeded electrician profession is required for E2E fixtures");
  await request(config, "/rest/v1/worker_professions", {
    method: "POST",
    body: JSON.stringify({ worker_id: worker.id, profession_id: profession.id }),
  });

  const adminEmail = accountConfig.admin.email.toLowerCase();
  const existingAdminMember = await getOne(
    config,
    "admin_members",
    `select=id,user_id&id=eq.${E2E_ADMIN_MEMBER_ID}`
  );
  const existingMemberForUser = await getOne(
    config,
    "admin_members",
    `select=id,user_id&user_id=eq.${identities.admin.userId}`
  );
  if (existingAdminMember?.user_id && existingAdminMember.user_id !== identities.admin.userId) {
    fail("the E2E Admin member id is already linked to a different user");
  }
  if (existingMemberForUser && existingMemberForUser.id !== E2E_ADMIN_MEMBER_ID) {
    fail("the disposable Admin already has a non-E2E admin_members record");
  }
  const existingAdminAllowlist = await getOne(
    config,
    "admin_allowlist",
    `select=email&email=eq.${encodeURIComponent(adminEmail)}`
  );

  await request(config, "/rest/v1/admin_allowlist?on_conflict=email", {
    method: "POST",
    body: JSON.stringify({ email: adminEmail }),
  });
  await request(config, "/rest/v1/admin_members?on_conflict=id", {
    method: "POST",
    body: JSON.stringify(createAdminMemberPayload(identities.admin.userId)),
  });

  identities.admin.email = adminEmail;
  identities.provisioning = {
    adminMemberCreated: !existingAdminMember,
    adminAllowlistCreated: !existingAdminAllowlist,
  };
  mkdirSync(stateDirectory, { recursive: true });
  writeFileSync(statePath, JSON.stringify(identities, null, 2));
};

const cleanup = async () => {
  const config = requireEnvironment();
  await rpc(config, "e2e_assert_isolated_test_environment", { p_project_ref: config.projectRef });
  const state = loadFixtureState();
  if (!state || state.projectRef !== config.projectRef) return;
  await cleanupFixtureData(config, state);
  await cleanupProvisioning(config, state);
  rmSync(statePath, { force: true });
};

const command = process.argv[2];
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (command === "setup") await setup();
  else if (command === "cleanup") await cleanup();
  else throw new Error("Usage: node scripts/e2e-api-fixtures.mjs <setup|cleanup>");
}
