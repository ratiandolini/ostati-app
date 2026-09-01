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

  it("does not let an admin send an already cancelled booking to closed", () => {
    expect(canChangeBookingStatus("admin", "cancelled", "closed")).toBe(false);
    expect(canChangeBookingStatus("admin", "disputed", "closed")).toBe(true);
  });

  it("keeps completed, declined, and cancelled bookings terminal", () => {
    expect(canChangeBookingStatus("client", "closed", "disputed")).toBe(false);
    expect(canChangeBookingStatus("admin", "closed", "cancelled")).toBe(false);
    expect(canChangeBookingStatus("craftsman", "declined", "confirmed")).toBe(false);
    expect(canChangeBookingStatus("client", "cancelled", "disputed")).toBe(false);
  });

  it("allows a dispute to be resolved but not reopened through a status action", () => {
    expect(canChangeBookingStatus("admin", "disputed", "closed")).toBe(true);
    expect(canChangeBookingStatus("admin", "disputed", "cancelled")).toBe(true);
    expect(canChangeBookingStatus("client", "disputed", "disputed")).toBe(false);
    expect(canChangeBookingStatus("craftsman", "disputed", "started")).toBe(false);
  });

  it("prevents a party from skipping work stages", () => {
    expect(canChangeBookingStatus("craftsman", "pending", "started")).toBe(false);
    expect(canChangeBookingStatus("craftsman", "confirmed", "worker_completed")).toBe(false);
    expect(canChangeBookingStatus("client", "pending", "client_confirmed")).toBe(false);
    expect(canChangeBookingStatus("admin", "pending", "closed")).toBe(false);
  });

  it("returns user-facing transition errors", () => {
    expect(bookingStatusTransitionError("client")).toContain("კლიენტისთვის");
    expect(bookingStatusTransitionError("craftsman")).toContain("საქმეების სია");
  });
});
