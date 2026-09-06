// @ts-nocheck -- the app's production tsconfig intentionally has no Jest types.

jest.mock("./dataService", () => ({ isDemoDataMode: false }));
jest.mock("./profileApiService", () => ({ loadCurrentUserProfile: jest.fn() }));
jest.mock("./supabaseRest", () => ({ createSupabaseRestClient: jest.fn() }));

import { loadMyJobPosts } from "./marketplaceApiService";
import { loadCurrentUserProfile } from "./profileApiService";
import { createSupabaseRestClient } from "./supabaseRest";

describe("loadMyJobPosts", () => {
  it("filters by the current app user ID rather than the Supabase Auth ID", async () => {
    const select = jest.fn().mockResolvedValue([]);
    (loadCurrentUserProfile as any).mockResolvedValue({
      id: "app-user-id",
    });
    (createSupabaseRestClient as any).mockReturnValue({ select });

    await loadMyJobPosts();

    (expect as any)(select).toHaveBeenCalledWith(
      "job_posts",
      (expect as any).objectContaining({ client_id: "eq.app-user-id" }),
      (expect as any).any(Object)
    );
  });
});
