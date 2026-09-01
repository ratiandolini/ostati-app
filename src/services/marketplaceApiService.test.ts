import {
  getReferralCode,
  loadOpenJobPosts,
} from "./marketplaceApiService";

describe("marketplace API service without Supabase configuration", () => {
  const originalUrl = process.env.REACT_APP_SUPABASE_URL;
  const originalKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

  beforeEach(() => {
    delete process.env.REACT_APP_SUPABASE_URL;
    delete process.env.REACT_APP_SUPABASE_ANON_KEY;
  });

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.REACT_APP_SUPABASE_URL;
    else process.env.REACT_APP_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.REACT_APP_SUPABASE_ANON_KEY;
    else process.env.REACT_APP_SUPABASE_ANON_KEY = originalKey;
  });

  it("returns a rejected promise instead of throwing synchronously for job posts", async () => {
    let message = "";
    try {
      await loadOpenJobPosts();
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain("Supabase is not configured");
  });

  it("returns a rejected promise instead of throwing synchronously for referrals", async () => {
    let message = "";
    try {
      await getReferralCode();
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain("Supabase is not configured");
  });
});
