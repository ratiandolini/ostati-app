import {
  categoryGroups,
  getSearchSuggestions,
  makeServiceSelection,
  sanitizeWorkerProfessions,
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

  it("removes stale legacy professions when current selections exist", () => {
    const electricalServices = [
      makeServiceSelection("electric", "ელექტრო გაყვანილობა"),
      makeServiceSelection("electric", "ელექტრო ფარი"),
      makeServiceSelection("electric", "როზეტი და ჩამრთველი"),
      makeServiceSelection("electric", "ჭაღი და განათება"),
    ];
    expect(JSON.stringify(sanitizeWorkerProfessions(["მალიარი", ...electricalServices]))).toBe(JSON.stringify(electricalServices));
  });

  it("migrates an old standalone profession to its all-services selection", () => {
    expect(JSON.stringify(sanitizeWorkerProfessions(["მალიარი"]))).toBe(JSON.stringify(["ყველაფერს - შეღებვა და კედლები"]));
  });

  it("does not let a stale legacy value match a different category", () => {
    const electricalServices = [makeServiceSelection("electric", "ელექტრო გაყვანილობა")];
    expect(workerMatchesService(["მალიარი", ...electricalServices], makeServiceSelection("painting-walls", "შპალერი"))).toBe(false);
    expect(workerMatchesService(["მალიარი", ...electricalServices], makeServiceSelection("electric", "ელექტრო გაყვანილობა"))).toBe(true);
  });
});
