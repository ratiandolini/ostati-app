import { shouldRefreshForRole } from "./appDataEvents";

const eventWithTarget = (target?: string) =>
  new CustomEvent("booking-status-updated", {
    detail: target ? { target } : undefined,
  });

describe("shouldRefreshForRole", () => {
  // Regression test: a client used to also react to a craftsman-targeted
  // "booking-status-updated" event (fired mid-way through the client's own
  // booking-creation flow, before the new booking was persisted), reading
  // stale localStorage and discarding the booking it had just created.
  it("ignores a craftsman-targeted event for a client listener", () => {
    expect(shouldRefreshForRole(eventWithTarget("craftsman"), "client")).toBe(
      false
    );
  });

  it("ignores a client-targeted event for a craftsman listener", () => {
    expect(
      shouldRefreshForRole(eventWithTarget("client"), "craftsman")
    ).toBe(false);
  });

  it("accepts an event targeted at the matching role", () => {
    expect(shouldRefreshForRole(eventWithTarget("client"), "client")).toBe(
      true
    );
    expect(
      shouldRefreshForRole(eventWithTarget("craftsman"), "craftsman")
    ).toBe(true);
  });

  it("accepts an untargeted event for either role", () => {
    expect(shouldRefreshForRole(eventWithTarget(undefined), "client")).toBe(
      true
    );
    expect(
      shouldRefreshForRole(eventWithTarget(undefined), "craftsman")
    ).toBe(true);
  });
});
