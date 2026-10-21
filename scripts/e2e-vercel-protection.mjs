const bypassHeaderName = "x-vercel-protection-bypass";

export const isVercelPreview = (appUrl) => new URL(appUrl).hostname.toLowerCase().endsWith(".vercel.app");

export const getVercelBypassHeaders = (appUrl, secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET) => {
  if (!isVercelPreview(appUrl)) return {};

  if (!secret?.trim()) {
    throw new Error("Protected Vercel Preview requires VERCEL_AUTOMATION_BYPASS_SECRET in the local process environment.");
  }

  return { [bypassHeaderName]: secret.trim() };
};

export const installVercelPreviewBypass = async (page, appUrl) => {
  const headers = getVercelBypassHeaders(appUrl);
  if (!Object.keys(headers).length) return;

  const previewOrigin = new URL(appUrl).origin;
  await page.route(`${previewOrigin}/**`, async (route) => {
    await route.continue({ headers: { ...route.request().headers(), ...headers } });
  });
};
