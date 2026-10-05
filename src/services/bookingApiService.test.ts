import { partyDisputeState } from "./bookingApiService";

describe("party dispute state", () => {
  it("keeps only the neutral dispute status for a booking party", () => {
    const state = partyDisputeState({
      status: "reviewing",
      reason: "private reason",
      details: "private details",
      evidence: [{ url: "private-file" }],
      admin_note: "private Admin note",
    } as never);

    expect(state.disputeStatus).toBe("reviewing");
    expect(Object.keys(state)).toHaveLength(1);
  });
});
