import {
  categoryGroups,
  getSearchSuggestions,
  makeServiceSelection,
  workerMatchesService,
} from "./workers";

describe("service catalogue", () => {
  it("keeps the agreed 14 main categories", () => {
    expect(categoryGroups).toHaveLength(14);
    expect(categoryGroups.find((category) => category.id === "construction")?.subcategories.map((item) => item.label)).toContain(
      "სამუშაოთა ხელმძღვანელი (პრარაბი / ბრიგადირი)"
    );
    expect(categoryGroups.map((category) => category.label)).toContain(
      "ეზო და გარე სამუშაოები"
    );
  });

  it("offers both plumbing and roofing options for a leak", () => {
    const matches = getSearchSuggestions("გაჟონვა");
    const labels = matches.map((item) => `${item.categoryId}:${item.subcategory}`);
    expect(labels).toContain("plumbing:გაჟონვის შეკეთება");
    expect(labels).toContain("roof-insulation:სახურავის გაჟონვა");
  });

  it("keeps legacy broad professions compatible with new requests", () => {
    expect(workerMatchesService(["სანტექნიკოსი"], makeServiceSelection("plumbing", "ონკანი"))).toBe(true);
  });
});
