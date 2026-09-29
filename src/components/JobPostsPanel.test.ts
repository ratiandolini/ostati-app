import { getJobPostErrorMessage } from "./JobPostsPanel";

describe("job post error messages", () => {
  it("keeps known business-rule feedback", () => {
    expect(
      getJobPostErrorMessage(new Error("This request is no longer open"))
    ).toBe("ეს მოთხოვნა უკვე დაიხურა ან კლიენტმა გააუქმა. სია განახლდა.");
  });

  it("does not expose an unknown Supabase response", () => {
    expect(
      getJobPostErrorMessage(
        new Error('Supabase request failed with 400: {"code":"P0001"}')
      )
    ).toBe("მოთხოვნის შესრულება ვერ მოხერხდა. სცადე ხელახლა.");
  });
});
