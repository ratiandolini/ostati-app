import {
  bookingStatusTransitionError,
  canChangeBookingStatus,
} from "./bookingWorkflow";

describe("booking workflow", () => {
  it("allows the craftsman to move active work forward", () => {
    expect(canChangeBookingStatus("craftsman", "pending", "confirmed")).toBe(true);
    expect(canChangeBookingStatus("craftsman", "confirmed", "en_route")).toBe(true);
    expect(canChangeBookingStatus("craftsman", "en_route", "started")).toBe(true);
    expect(canChangeBookingStatus("craftsman", "started", "worker_completed")).toBe(true);
  });

  it("keeps client completion confirmation in the right stage", () => {
    expect(canChangeBookingStatus("client", "worker_completed", "client_confirmed")).toBe(true);
    expect(canChangeBookingStatus("client", "started", "client_confirmed")).toBe(false);
  });

  it("blocks stale or wrong-role transitions", () => {
    expect(canChangeBookingStatus("client", "confirmed", "en_route")).toBe(false);
    expect(canChangeBookingStatus("craftsman", "client_confirmed", "worker_completed")).toBe(false);
    expect(canChangeBookingStatus("craftsman", undefined, "confirmed")).toBe(false);
  });

  it("returns user-facing transition errors", () => {
    expect(bookingStatusTransitionError("client")).toContain("კლიენტისთვის");
    expect(bookingStatusTransitionError("craftsman")).toContain("საქმეების სია");
  });
});
