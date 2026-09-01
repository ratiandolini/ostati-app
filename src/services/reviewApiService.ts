import { createSupabaseRestClient } from "./supabaseRest";
import type { ClientPoints } from "./appStorage";

export type RevieweeRole = "client" | "craftsman";

interface SubmitBookingReviewPayload {
  bookingId: string;
  revieweeRole: RevieweeRole;
  criteria: Record<string, number>;
  comment?: string;
}

export interface PublicWorkerReview {
  id: string;
  overall: number;
  criteria: {
    quality: number;
    punctuality: number;
    cleanliness: number;
    deadline: number;
  };
  comment?: string;
  createdAt: string;
}

type PublicWorkerReviewRow = {
  id?: string;
  overall?: number | string;
  criteria?: Record<string, unknown>;
  comment?: string | null;
  createdAt?: string;
};

const score = (criteria: Record<string, unknown>, key: string) => {
  const value = Number(criteria[key]);
  return Number.isFinite(value) && value >= 1 && value <= 5 ? value : 0;
};

const toPublicWorkerReview = (row: PublicWorkerReviewRow): PublicWorkerReview | null => {
  if (!row.id || !row.createdAt) return null;
  const criteria = row.criteria || {};

  return {
    id: row.id,
    overall: Number(row.overall || 0),
    criteria: {
      quality: score(criteria, "quality"),
      punctuality: score(criteria, "punctuality"),
      cleanliness: score(criteria, "cleanliness"),
      deadline: score(criteria, "deadline"),
    },
    comment: row.comment || undefined,
    createdAt: row.createdAt,
  };
};

const averageScore = (criteria: Record<string, number>) => {
  const scores = Object.values(criteria).filter((score) => score > 0);
  if (!scores.length) return 0;
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
};

export const submitBookingReview = async ({
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

export const loadWorkerPublicReviews = async (
  workerId: string,
  signal?: AbortSignal
): Promise<PublicWorkerReview[]> => {
  const client = createSupabaseRestClient();
  const rows = await client.rpc<PublicWorkerReviewRow[]>(
    "get_worker_public_reviews",
    { p_worker_id: workerId },
    { signal }
  );

  return Array.isArray(rows)
    ? rows.map(toPublicWorkerReview).filter((review): review is PublicWorkerReview => Boolean(review))
    : [];
};
