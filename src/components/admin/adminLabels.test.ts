import { disputeInitiatorLabel } from "./adminLabels";

describe("dispute initiator labels", () => {
  it("identifies the actual stored client and craftsman roles", () => {
    expect(disputeInitiatorLabel("client")).toBe("კლიენტი");
    expect(disputeInitiatorLabel("craftsman")).toBe("ხელოსანი");
  });
});
