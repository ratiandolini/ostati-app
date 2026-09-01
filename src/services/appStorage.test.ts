import { appStorage } from "./appStorage";

describe("appStorage.getRealCraftsmanRequests", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("keeps a booking from a client with no profile name (fallback display name)", () => {
    // Regression test: getRealCraftsmanRequests() used to filter out any
    // request whose clientName started with "კლიენტი" (the app-wide fallback
    // display name for a client with no profile first/last name), which
    // silently deleted real bookings from brand-new clients on every
    // craftsman-side read (see CraftsmanHomeScreen's pruneDemoCraftsmanRequests).
    appStorage.prependCraftsmanRequest({
      id: "booking-1",
      clientName: "კლიენტი",
      clientPhone: "599000000",
      date: "1 სექტემბერი",
      time: "10:00",
      address: "თბილისი",
      status: "pending",
      service: "ელექტრიკოსი",
    });

    const realRequests = appStorage.getRealCraftsmanRequests();
    expect(realRequests).toHaveLength(1);
    expect(realRequests[0].id).toBe("booking-1");
  });

  it("keeps a booking from a client with a real name too", () => {
    appStorage.prependCraftsmanRequest({
      id: "booking-2",
      clientName: "ნინო ბ.",
      clientPhone: "599111111",
      date: "1 სექტემბერი",
      time: "11:00",
      address: "თბილისი",
      status: "pending",
      service: "სანტექნიკოსი",
    });

    const realRequests = appStorage.getRealCraftsmanRequests();
    expect(realRequests).toHaveLength(1);
    expect(realRequests[0].id).toBe("booking-2");
  });

  it("still drops requests with no id", () => {
    appStorage.saveCraftsmanRequests([
      {
        id: "",
        clientName: "ნინო ბ.",
        clientPhone: "599111111",
        date: "1 სექტემბერი",
        time: "11:00",
        address: "თბილისი",
        status: "pending",
        service: "სანტექნიკოსი",
      },
    ]);

    expect(appStorage.getRealCraftsmanRequests()).toHaveLength(0);
  });
});
