import type { BookingStatus } from "../../types";
import type { AdminBookingAction } from "../../services/adminApiService";
import type { Booking } from "../../screens/BookingsScreen";

export type AdminBookingPaymentStatus = NonNullable<Booking["paymentStatus"]>;
export type AdminBookingResolutionPaymentStatus =
  | "released"
  | "refunded"
  | "disputed";

export const isRefundBookingAction = (
  status: BookingStatus,
  paymentStatus?: AdminBookingResolutionPaymentStatus
) => paymentStatus === "refunded" || status === "cancelled";

export const getBookingAdminConfirmMessage = (isRefund: boolean) =>
  isRefund
    ? "დარწმუნებული ხარ, რომ ჯავშანი უნდა გაუქმდეს და თანხა დაბრუნდეს?"
    : "დარწმუნებული ხარ, რომ ჯავშანი უნდა დაიხუროს?";

export const bookingActionFromState = (
  status: BookingStatus,
  paymentStatus?: AdminBookingResolutionPaymentStatus
): AdminBookingAction => {
  if (paymentStatus === "refunded" || status === "cancelled") {
    return "cancel_refund";
  }
  if (paymentStatus === "disputed" || status === "disputed") {
    return "mark_disputed";
  }
  return "close_release";
};

export const bookingActionFromPaymentStatus = (
  paymentStatus: AdminBookingPaymentStatus
): AdminBookingAction => {
  if (paymentStatus === "held") return "hold_authorized";
  if (paymentStatus === "refunded") return "cancel_refund";
  if (paymentStatus === "disputed") return "mark_disputed";
  return "close_release";
};

export const bookingStatusFromPaymentStatus = (
  paymentStatus: AdminBookingPaymentStatus
): BookingStatus | undefined => {
  if (paymentStatus === "refunded") return "cancelled";
  if (paymentStatus === "released") return "closed";
  if (paymentStatus === "disputed") return "disputed";
  return undefined;
};

export const requiresPaymentStatusNote = (
  paymentStatus: AdminBookingPaymentStatus
) => paymentStatus !== "held";

export const getPaymentStatusConfirmMessage = (paymentStatusLabel: string) =>
  `Admin ჩარევა დადასტურდეს: ${paymentStatusLabel}?`;

export const getPaymentStatusAuditSummary = (
  paymentStatusLabel: string,
  note: string
) => `${paymentStatusLabel}${note ? ` · ${note}` : ""}`;
