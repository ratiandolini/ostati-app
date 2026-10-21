const productionProjectRefs = new Set(["ucyglqpzpszeyejifobh"]);
const productionDomains = new Set(["shenage.ge"]);

const fail = (message) => {
  throw new Error(`E2E frontend target safety check failed: ${message}`);
};

const normalizedOrigin = (value) => new URL(value).origin.replace(/\/$/, "");

const isProductionAppHost = (hostname) => {
  const host = hostname.toLowerCase();
  return [...productionDomains].some((domain) => host === domain || host.endsWith(`.${domain}`));
};

const loadText = async (fetchImpl, url, headers) => {
  let response;
  try {
    response = await fetchImpl(url, { redirect: "error", headers });
  } catch {
    fail(`could not load ${new URL(url).pathname} with the configured Preview access`);
  }
  if (!response.ok) fail(`could not load ${new URL(url).pathname} (${response.status})`);
  return response.text();
};

const scriptUrls = (html, appUrl) => {
  const sources = [...html.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);
  if (!sources.length) fail("the frontend HTML did not contain a JavaScript bundle");
  return [...new Set(sources.map((source) => new URL(source, appUrl).href))];
};

export const assertIsolatedFrontendTarget = async ({ appUrl, testSupabaseUrl, fetchImpl = fetch, requestHeaders = {} }) => {
  const app = new URL(appUrl);
  const testSupabaseOrigin = normalizedOrigin(testSupabaseUrl);
  const testProjectRef = new URL(testSupabaseOrigin).hostname.split(".")[0];

  if (isProductionAppHost(app.hostname)) fail("the production Shenage domain is forbidden");
  if (productionProjectRefs.has(testProjectRef)) fail("the production Supabase project is forbidden");
  if (new URL(testSupabaseOrigin).hostname !== `${testProjectRef}.supabase.co`) {
    fail("the test Supabase URL does not match its project reference");
  }

  const html = await loadText(fetchImpl, app.href, requestHeaders);
  const bundles = await Promise.all(scriptUrls(html, app.href).map((url) => loadText(fetchImpl, url, requestHeaders)));
  const deployedSource = [html, ...bundles].join("\n");
  const productionTargets = [...productionProjectRefs].flatMap((ref) => [ref, `https://${ref}.supabase.co`]);

  if (productionTargets.some((target) => deployedSource.includes(target))) {
    fail("the frontend bundle references the production Supabase project");
  }
  if (!deployedSource.includes(testSupabaseOrigin) && !deployedSource.includes(testProjectRef)) {
    fail("the frontend bundle does not reference the configured isolated Supabase project");
  }
};
