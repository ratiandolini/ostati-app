import { createSupabaseRestClient } from "./supabaseRest";
import type { ClientPoints } from "./appStorage";

export type RevieweeRole = "client" | "craftsman";

interface SubmitBookingReviewPayload {
  bookingId: string;
  revieweeRole: RevieweeRole;
  criteria: Record<string, number>;
  comment?: string;
}

const averageScore = (criteria: Record<string, number>) => {
  const scores = Object.values(criteria).filter((score) => score > 0);
  if (!scores.length) return 0;
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
};

export const submitBookingReview = ({
  bookingId,
  revieweeRole,
  criteria,
  comment,
}: SubmitBookingReviewPayload) => {
  const overallRating = averageScore(criteria);
  if (!overallRating) {
    throw new Error("Review scores are required before submitting.");
  }

  const client = createSupabaseRestClient();

  return client.rpc<{
    booking_id: string;
    reviewee_role: RevieweeRole;
    overall_rating: number;
  }>("create_booking_review", {
    p_booking_id: bookingId,
    p_reviewee_role: revieweeRole,
    p_overall_rating: overallRating,
    p_criteria_json: criteria,
    p_comment: comment || null,
  });
};

export const loadReviewedBookingIds = async (
  revieweeRole: RevieweeRole
): Promise<string[]> => {
  const client = createSupabaseRestClient();
  return client.rpc<string[]>("list_my_reviewed_booking_ids", {
    p_reviewee_role: revieweeRole,
  });
};

export const loadMyClientPoints = async (): Promise<ClientPoints> => {
  const client = createSupabaseRestClient();
  return client.rpc<ClientPoints>("get_my_client_points", {});
};
