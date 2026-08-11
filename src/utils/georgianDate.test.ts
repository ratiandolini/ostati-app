import {
  formatGeorgianDate,
  formatGeorgianTime,
  normalizeGeorgianDateLabel,
} from "./georgianDate";

describe("georgianDate utilities", () => {
  it("normalizes English month labels to Georgian", () => {
    expect(normalizeGeorgianDateLabel("July 30")).toBe("ივლისი 30");
    expect(normalizeGeorgianDateLabel("Jul 30")).toBe("ივლ 30");
  });

  it("formats dates with Georgian month names", () => {
    expect(formatGeorgianDate(new Date(2026, 6, 30))).toBe("30 ივლისი 2026");
    expect(formatGeorgianDate(new Date(2026, 6, 30), { shortMonth: true })).toBe(
      "30 ივლ 2026"
    );
  });

  it("formats time in 24-hour format", () => {
    expect(formatGeorgianTime(new Date(2026, 6, 30, 9, 5))).toBe("09:05");
    expect(formatGeorgianTime(new Date(2026, 6, 30, 18, 30))).toBe("18:30");
  });
});
