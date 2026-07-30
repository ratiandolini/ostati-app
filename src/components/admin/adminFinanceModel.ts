import {
  parseFirstAmount,
  penaltyAmountForBooking,
} from "./adminUtils";
import type { PlatformSettings } from "../../services/dataService";
import type { Booking } from "../../screens/BookingsScreen";

export interface AdminFinancialSummary {
  held: number;
  released: number;
  refunded: number;
  disputed: number;
}

export const getAdminFinancialSummary = (
  bookings: Booking[],
  platformSettings: PlatformSettings
): AdminFinancialSummary =>
  bookings.reduce<AdminFinancialSummary>(
    (summary, booking) => {
      const amount = booking.bookingFee || platformSettings.bookingFee;
      const status = booking.paymentStatus || "held";
      if (status === "held") summary.held += amount;
      if (status === "released") summary.released += amount;
      if (status === "refunded") summary.refunded += amount;
      if (status === "disputed") summary.disputed += amount;
      return summary;
    },
    { held: 0, released: 0, refunded: 0, disputed: 0 }
  );

interface AdminFinanceQueueInput {
  filteredClientBookings: Booking[];
  platformSettings: PlatformSettings;
}

export const getAdminFinanceQueueState = ({
  filteredClientBookings,
  platformSettings,
}: AdminFinanceQueueInput) => {
  const filteredFinancialSummary = getAdminFinancialSummary(
    filteredClientBookings,
    platformSettings
  );
  const financeReviewBookings = filteredClientBookings.filter(
    (booking) =>
      booking.paymentStatus === "disputed" ||
      booking.status === "disputed" ||
      booking.cancellationPolicy === "late_review"
  );
  const financeRefundQueue = filteredClientBookings.filter(
    (booking) =>
      booking.status === "cancelled" &&
      booking.cancellationPolicy !== "late_review" &&
      (booking.paymentStatus || "held") !== "refunded"
  );
  const financeReleaseQueue = filteredClientBookings.filter(
    (booking) =>
      ["client_confirmed", "closed", "completed"].includes(booking.status || "") &&
      (booking.paymentStatus || "held") === "held"
  );
  const lateCancellationPenaltyTotal = financeReviewBookings.reduce(
    (sum, booking) =>
      sum +
      (booking.cancellationPolicy === "late_review"
        ? penaltyAmountForBooking(booking, platformSettings)
        : 0),
    0
  );
  const estimatedServiceTotal = filteredClientBookings.reduce(
    (sum, booking) => sum + parseFirstAmount(booking.worker.price),
    0
  );
  const estimatedCommission = Math.round(
    (estimatedServiceTotal * platformSettings.commissionPercent) / 100
  );

  return {
    filteredFinancialSummary,
    financeReviewBookings,
    financeRefundQueue,
    financeReleaseQueue,
    lateCancellationPenaltyTotal,
    estimatedServiceTotal,
    estimatedCommission,
  };
};
