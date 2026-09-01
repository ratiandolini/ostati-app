import { marketplaceDemo } from "./marketplaceDemoService";

describe("marketplace demo storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("keeps a published request locally and removes it from the open list on cancellation", () => {
    const post = marketplaceDemo.createJobPost({
      title: "აბაზანის შეკეთება",
      profession_name: "სანტექნიკოსი",
      city: "თბილისი",
      description: "საჭიროა ონკანისა და მილების შეკეთება.",
      photo_urls: [],
    });

    expect(marketplaceDemo.loadOpenJobPosts()).toHaveLength(1);
    marketplaceDemo.cancelJobPost(post.id);
    expect(marketplaceDemo.loadOpenJobPosts()).toHaveLength(0);
    expect(marketplaceDemo.loadMyJobPosts()[0].status).toBe("cancelled");
  });

  it("creates a referral code and prevents using the same code", () => {
    const code = marketplaceDemo.getReferralCode();
    expect(code).toHaveLength(8);
    let message = "";
    try {
      marketplaceDemo.applyReferralCode(code);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain("საკუთარი მოწვევის კოდის");
  });
});
