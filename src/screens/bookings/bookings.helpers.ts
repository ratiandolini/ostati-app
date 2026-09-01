import { BookingStatus, Worker } from "../../types";
import { BookingDetails } from "../ProfileScreen";
import type { BookingPaymentSummary } from "../../services/bookingApiService";
import {
  formatGeorgianDate,
  formatGeorgianTime,
  normalizeGeorgianDateLabel,
} from "../../utils/georgianDate";

export const keepEqualSnapshot = <T,>(current: T[], next: T[]) =>
  JSON.stringify(current) === JSON.stringify(next) ? current : next;

export interface Booking {
  worker: Worker;
  day: number;
  time: string;
  dateLabel: string;
  details: BookingDetails;
  id: string;
  status?: BookingStatus;
  bookingFee?: number;
  paymentStatus?: "held" | "released" | "refunded" | "disputed";
  paymentProvider?: string;
  paymentCurrency?: string;
  paymentTransactionId?: string;
  cancellationPolicy?: "free" | "late_review";
  cancellationPenaltyAmount?: number;
  cancellationReason?: string;
  disputeReason?: string;
  disputeDetails?: string;
  disputeStatus?: "open" | "reviewing" | "resolved";
  disputeResolution?: "refund_client" | "release_worker" | "warning" | "none";
  disputeEvidence?: Array<{
    name: string;
    url: string;
    type?: "image" | "file";
  }>;
  adminNote?: string;
}

export const trackingSteps: Array<{ status: BookingStatus; label: string }> = [
  { status: "pending", label: "მოლოდინი" },
  { status: "confirmed", label: "დადასტ." },
  { status: "en_route", label: "გზაში" },
  { status: "started", label: "დაიწყო" },
  { status: "worker_completed", label: "დასრულდა" },
  { status: "client_confirmed", label: "დასრულებული" },
];

export const statusIndex = (status?: BookingStatus) => {
  if (!status || status === "declined" || status === "cancelled" || status === "disputed") {
    return -1;
  }
  if (status === "closed" || status === "completed") return trackingSteps.length - 1;
  return trackingSteps.findIndex((step) => step.status === status);
};

export const canCancelBooking = (status?: BookingStatus) =>
  status === "pending" ||
  status === "confirmed" ||
  status === "en_route" ||
  status === "started";

export const canChangeAssignedWorker = (status?: BookingStatus) =>
  status === "pending" || status === "declined";

export const paymentMessage = (
  booking: Booking,
  isDisputed: boolean,
  paymentStatus: BookingPaymentSummary["status"] | Booking["paymentStatus"] | undefined,
  fallbackBookingFee: number
) => {
  const fee = booking.bookingFee || fallbackBookingFee;
  if (isDisputed || paymentStatus === "failed" || paymentStatus === "disputed") {
    return "პრობლემა გახსნილია. ჯავშნის თანხა დროებით შეჩერებულია.";
  }
  if (
    paymentStatus === "refunded" ||
    booking.status === "declined"
  ) {
    return `დაჯავშნის საფასური ${fee} ლარი დაბრუნებულია.`;
  }
  if (booking.status === "cancelled") {
    if (booking.cancellationPolicy === "late_review") {
      return `ჯავშანი გაუქმებულია. დაჯავშნის საფასური ${fee} ლარი Admin-ის გადამოწმებაშია.`;
    }
    return `ჯავშანი გაუქმებულია. დაჯავშნის საფასური ${fee} ლარი დაბრუნების პროცესშია.`;
  }
  if (paymentStatus === "captured" || paymentStatus === "released") {
    return `დაჯავშნის საფასური ${fee} ლარი დადასტურდა და დაიხურა.`;
  }
  if (
    booking.status === "client_confirmed" ||
    booking.status === "closed" ||
    booking.status === "completed"
  ) {
    return `სამუშაო დადასტურებულია, მაგრამ დაჯავშნის საფასური ${fee} ლარი ჯერ გადამოწმებაშია.`;
  }
  return `დაჯავშნის საფასური ${fee} ლარი დროებით გაყინულია.`;
};

export const formatNotificationDate = (value?: string) => {
  if (!value) return "";
  return formatGeorgianDate(value, { shortMonth: true, year: false });
};

export const formatBookingDateTime = (booking: Booking) => {
  const scheduledAt = booking.details?.scheduledAt;
  if (!scheduledAt) return `${normalizeGeorgianDateLabel(booking.dateLabel)} · ${booking.time}`;
  const date = new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) {
    return `${normalizeGeorgianDateLabel(booking.dateLabel)} · ${booking.time}`;
  }
  const dateLabel = formatGeorgianDate(date);
  const timeLabel = formatGeorgianTime(date);
  return `${dateLabel} · ${timeLabel}`;
};

export const money = (value: number | string | undefined, currency = "GEL") => {
  const amount = Number(value || 0);
  return `${amount.toFixed(amount % 1 ? 2 : 0)} ${currency}`;
};

export const notificationText = (notification: { type: string; text: string }) => {
  if (notification.type === "review") {
    if (notification.text.startsWith("ხელოსანმა სამუშაო დასრულებულად მონიშნა")) {
      return "დაადასტურეთ შესრულება და შეაფასეთ.";
    }
    return notification.text.includes("დაადასტურეთ")
      ? notification.text
      : "დაადასტურეთ შესრულება და შეაფასეთ.";
  }
  return notification.text;
};

export const paymentStepIndex = (
  booking: Booking,
  isDisputed: boolean,
  paymentStatus: BookingPaymentSummary["status"] | Booking["paymentStatus"] | undefined
) => {
  if (isDisputed || paymentStatus === "failed" || paymentStatus === "disputed") return 1;
  if (paymentStatus === "refunded" || booking.status === "declined") {
    return 2;
  }
  if (booking.status === "cancelled") {
    return booking.cancellationPolicy === "late_review" ? 1 : 2;
  }
  if (paymentStatus === "captured" || paymentStatus === "released") return 2;
  if (
    booking.status === "client_confirmed" ||
    booking.status === "closed" ||
    booking.status === "completed"
  ) {
    return 1;
  }
  return 0;
};

export const disputeMeta = (
  status?: Booking["disputeStatus"],
  resolution?: Booking["disputeResolution"]
) => {
  if (status === "resolved") {
    if (resolution === "refund_client") {
      return {
        label: "დავა დახურულია",
        detail: "Admin-ის გადაწყვეტილებით თანხა დაბრუნდა.",
        step: 2,
        color: "#047857",
        bg: "#ecfdf5",
        border: "#bbf7d0",
      };
    }
    if (resolution === "release_worker") {
      return {
        label: "დავა დახურულია",
        detail: "Admin-ის გადაწყვეტილებით თანხა ხელოსნის მხარეს დადასტურდა.",
        step: 2,
        color: "#047857",
        bg: "#ecfdf5",
        border: "#bbf7d0",
      };
    }
    return {
      label: "დავა დახურულია",
      detail: "Admin-მა საკითხი გაფრთხილებით დახურა.",
      step: 2,
      color: "#047857",
      bg: "#ecfdf5",
      border: "#bbf7d0",
    };
  }
  if (status === "reviewing") {
    return {
      label: "დავა განხილვაშია",
      detail: "Admin ამოწმებს დეტალებს, ფოტოებს და ჩატის ისტორიას. პირველ პასუხს მაქსიმუმ 48 საათში მიიღებ.",
      step: 1,
      color: "#c2410c",
      bg: "#fff7ed",
      border: "#fed7aa",
    };
  }
  return {
    label: "დავა გახსნილია",
    detail: "დავა მიღებულია. Admin მას 48 საათში გადაიყვანს განხილვაში ან მოგწერს დამატებით დეტალებს.",
    step: 0,
    color: "#b45309",
    bg: "#fffbeb",
    border: "#fde68a",
  };
};

export const hoursUntilBooking = (booking?: Booking | null) => {
  const scheduledAt = booking?.details.scheduledAt;
  if (!scheduledAt) return Number.POSITIVE_INFINITY;
  const value = new Date(scheduledAt).getTime();
  if (Number.isNaN(value)) return Number.POSITIVE_INFINITY;
  return (value - Date.now()) / 36e5;
};
