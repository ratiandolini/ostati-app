import {
  canReleaseBookingPayment,
  releasedPaymentStatusError,
} from "./adminBookingActions";

describe("admin payment actions", () => {
  it("does not release a cancelled or declined booking", () => {
    expect(canReleaseBookingPayment("cancelled")).toBe(false);
    expect(canReleaseBookingPayment("declined")).toBe(false);
    expect(releasedPaymentStatusError).toContain("გაუქმებულ");
  });

  it("allows payment release after a completed booking", () => {
    expect(canReleaseBookingPayment("client_confirmed")).toBe(true);
    expect(canReleaseBookingPayment("closed")).toBe(true);
  });
});
