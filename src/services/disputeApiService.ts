import { createSupabaseRestClient } from "./supabaseRest";

export const openBookingDispute = (
  bookingId: string,
  reason: string,
  details?: string,
  evidence?: Array<{ name: string; url: string; type?: "image" | "file" }>
) => {
  const client = createSupabaseRestClient();
  return client.rpc<{
    booking_id: string;
    dispute_id: string;
    status: "open";
  }>("open_booking_dispute", {
    p_booking_id: bookingId,
    p_reason: reason,
    p_details: details || null,
    p_evidence: evidence?.length ? evidence : null,
  });
};
