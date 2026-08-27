import type { BookingStatus } from "../../types";
import type { Booking } from "../../screens/BookingsScreen";
import { formatGeorgianDate, formatGeorgianTime } from "../../utils/georgianDate";
import type {
  BookingDispute,
  CraftsmanProfile,
  PlatformSettings,
} from "../../services/dataService";

export const deriveVerificationStatus = (profile: CraftsmanProfile) => {
  if (profile.verificationStatus) return profile.verificationStatus;
  const verification = profile.verification;
  if (!verification) return "not_submitted" as const;
  return Object.values(verification).every(Boolean)
    ? ("pending" as const)
    : ("not_submitted" as const);
};

export const formatDate = (value?: string) => {
  if (!value) return "";
  return `${formatGeorgianDate(value, { shortMonth: true })} · ${formatGeorgianTime(value)}`;
};

export const money = (value: number) =>
  `${value.toFixed(value % 1 ? 2 : 0)} ლარი`;

export const parseFirstAmount = (value?: string) => {
  const match = value?.replace(",", ".").match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : 0;
};

export const penaltyAmountForBooking = (
  booking: Booking,
  settings: PlatformSettings
) =>
  booking.cancellationPenaltyAmount ||
  Math.round(
    ((booking.bookingFee || settings.bookingFee) *
      settings.lateCancellationFeePercent) /
      100
  );

export const matchesQuery = (
  query: string,
  parts: Array<string | number | undefined>
) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return parts.join(" ").toLowerCase().includes(normalized);
};

export const isClosedStatus = (status?: BookingStatus) =>
  ["closed", "completed", "client_confirmed", "cancelled", "declined"].includes(
    status || ""
  );

export const isActiveStatus = (status?: BookingStatus) =>
  ["pending", "confirmed", "en_route", "started", "worker_completed"].includes(
    status || "pending"
  );

export const disputeStatusUi = (status: BookingDispute["status"]) => {
  if (status === "resolved") {
    return { label: "დახურული", color: "#047857", bg: "#dcfce7" };
  }
  if (status === "reviewing") {
    return { label: "განხილვაში", color: "#c2410c", bg: "#fff7ed" };
  }
  return { label: "ღია", color: "#b91c1c", bg: "#fef2f2" };
};

export const hoursSince = (value?: string) => {
  if (!value) return 0;
  const created = new Date(value).getTime();
  if (Number.isNaN(created)) return 0;
  return Math.max(0, Math.floor((Date.now() - created) / 36e5));
};

export const disputePriorityScore = (dispute: BookingDispute) => {
  if (dispute.status === "resolved") return 0;
  const age = hoursSince(dispute.createdAt);
  if (age >= 24) return 3;
  if (dispute.status === "reviewing") return 2;
  return 1;
};
