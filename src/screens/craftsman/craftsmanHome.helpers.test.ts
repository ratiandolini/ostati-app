import { uploadErrorMessage } from "./craftsmanHome.helpers";

describe("craftsman upload errors", () => {
  it("does not expose a raw Supabase storage response", () => {
    const message = uploadErrorMessage(
      new Error('Supabase storage upload failed with 400: {"code":"PGRST301"}')
    );

    expect(message).toBe("ფოტოს ატვირთვა ვერ მოხერხდა. სცადე თავიდან.");
  });

  it("keeps the friendly oversized-file guidance", () => {
    expect(uploadErrorMessage(new Error("EntityTooLarge"))).toContain("ძალიან დიდია");
  });
});
