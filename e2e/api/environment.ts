const productionProjectRefs = new Set(["ucyglqpzpszeyejifobh"]);
const testProjectRef = "ivguranttkxhxsdsppqk";

const required = [
  "E2E_BASE_URL",
  "E2E_TEST_PROJECT_REF",
  "E2E_TEST_SUPABASE_URL",
  "E2E_TEST_SUPABASE_ANON_KEY",
  "E2E_TEST_SERVICE_ROLE_KEY",
  "E2E_CLIENT_EMAIL",
  "E2E_CLIENT_PASSWORD",
  "E2E_CRAFTSMAN_EMAIL",
  "E2E_CRAFTSMAN_PASSWORD",
  "E2E_ADMIN_EMAIL",
  "E2E_ADMIN_PASSWORD",
  "E2E_ALLOW_TEST_FIXTURES",
] as const;

export const apiE2EConfigurationError = () => {
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) return `Missing isolated API E2E variables: ${missing.join(", ")}`;
  if (process.env.E2E_ALLOW_TEST_FIXTURES !== "isolated-project-only") {
    return "E2E_ALLOW_TEST_FIXTURES must explicitly equal isolated-project-only";
  }

  const projectRef = process.env.E2E_TEST_PROJECT_REF!;
  const supabaseUrl = new URL(process.env.E2E_TEST_SUPABASE_URL!);
  const appUrl = new URL(process.env.E2E_BASE_URL!);
  if (productionProjectRefs.has(projectRef)) return "The production Supabase project is forbidden for E2E";
  if (projectRef !== testProjectRef) return `E2E must use the dedicated test project ${testProjectRef}`;
  if (appUrl.hostname === "shenage.ge" || appUrl.hostname.endsWith(".shenage.ge")) {
    return "The production Shenage domain is forbidden for API E2E";
  }
  if (supabaseUrl.hostname !== `${projectRef}.supabase.co`) {
    return "E2E_TEST_SUPABASE_URL must match E2E_TEST_PROJECT_REF";
  }

  return null;
};

export const assertApiE2EEnvironment = () => {
  const error = apiE2EConfigurationError();
  if (error) throw new Error(error);
};
