import React, { useMemo, useState } from "react";
import { BookingStatus, Worker } from "../types";
import { EmptyState } from "../components/EmptyState";
import { Stars } from "../components/Stars";
import { BookingDetails } from "./ProfileScreen";
import { dataService, isDemoDataMode } from "../services/dataService";
import {
  BookingPaymentSummary,
  loadBookingPaymentSummary,
  uploadBookingSitePhoto,
} from "../services/bookingApiService";
import { openBookingDispute } from "../services/disputeApiService";
import {
  loadReviewedBookingIds,
  submitBookingReview,
} from "../services/reviewApiService";
import {
  AppNotification,
  loadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notificationApiService";
import {
  cancellationSchema,
  craftsmanReviewSchema,
  disputeSchema,
  getValidationMessage,
} from "../services/validation";
import {
  formatGeorgianDate,
  formatGeorgianTime,
  normalizeGeorgianDateLabel,
} from "../utils/georgianDate";

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

interface BookingsScreenProps {
  bookings: Booking[];
  onCancelBooking: (id: string, reason: string) => Promise<void> | void;
  onReviewBooking: (id: string) => Promise<void> | void;
  onWorkerSelect: (w: Worker) => void;
  onProblemOpened?: (
    id: string,
    reason: string,
    details: string,
    evidence?: Booking["disputeEvidence"]
  ) => Promise<void> | void;
}

const trackingSteps: Array<{ status: BookingStatus; label: string }> = [
  { status: "pending", label: "მოლოდინი" },
  { status: "confirmed", label: "დადასტ." },
  { status: "en_route", label: "გზაში" },
  { status: "started", label: "დაიწყო" },
  { status: "worker_completed", label: "დასრულდა" },
  { status: "client_confirmed", label: "დასრულებული" },
];

const statusIndex = (status?: BookingStatus) => {
  if (!status || status === "declined" || status === "cancelled" || status === "disputed") {
    return -1;
  }
  if (status === "closed" || status === "completed") return trackingSteps.length - 1;
  return trackingSteps.findIndex((step) => step.status === status);
};

const paymentMessage = (
  booking: Booking,
  isDisputed: boolean,
  paymentStatus: BookingPaymentSummary["status"] | Booking["paymentStatus"] | undefined
) => {
  const fee = booking.bookingFee || dataService.getPlatformSettings().bookingFee;
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

const formatNotificationDate = (value?: string) => {
  if (!value) return "";
  return formatGeorgianDate(value, { shortMonth: true, year: false });
};

const formatBookingDateTime = (booking: Booking) => {
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

const money = (value: number | string | undefined, currency = "GEL") => {
  const amount = Number(value || 0);
  return `${amount.toFixed(amount % 1 ? 2 : 0)} ${currency}`;
};

const notificationText = (notification: { type: string; text: string }) => {
  if (notification.type === "review") {
    return "ხელოსანმა სამუშაო დასრულებულად მონიშნა. დაადასტურეთ შესრულება და შეაფასეთ.";
  }
  return notification.text;
};

const paymentStepIndex = (
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

const disputeMeta = (
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
      detail: "Admin ამოწმებს დეტალებს, ფოტოებს და ჩატის ისტორიას.",
      step: 1,
      color: "#c2410c",
      bg: "#fff7ed",
      border: "#fed7aa",
    };
  }
  return {
    label: "დავა გახსნილია",
    detail: "დავა მიღებულია და ელოდება Admin-ის გადამოწმებას.",
    step: 0,
    color: "#b45309",
    bg: "#fffbeb",
    border: "#fde68a",
  };
};

const hoursUntilBooking = (booking?: Booking | null) => {
  const scheduledAt = booking?.details.scheduledAt;
  if (!scheduledAt) return Number.POSITIVE_INFINITY;
  const value = new Date(scheduledAt).getTime();
  if (Number.isNaN(value)) return Number.POSITIVE_INFINITY;
  return (value - Date.now()) / 36e5;
};

export const BookingsScreen: React.FC<BookingsScreenProps> = ({
  bookings,
  onCancelBooking,
  onReviewBooking,
  onWorkerSelect,
  onProblemOpened,
}) => {
  const [cancelBooking, setCancelBooking] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [problemBooking, setProblemBooking] = useState<Booking | null>(null);
  const [problemReason, setProblemReason] = useState("");
  const [problemDetails, setProblemDetails] = useState("");
  const [problemEvidence, setProblemEvidence] = useState<
    NonNullable<Booking["disputeEvidence"]>
  >([]);
  const [problemError, setProblemError] = useState("");
  const [paymentSummaries, setPaymentSummaries] = useState<
    Record<string, BookingPaymentSummary>
  >({});
  const [disputedIds, setDisputedIds] = useState<string[]>(() => {
    return isDemoDataMode
      ? dataService.getBookingDisputes().map((dispute) => dispute.bookingId)
      : [];
  });
  const disputesByBooking = useMemo(() => {
    if (!isDemoDataMode) return {};
    return dataService.getBookingDisputes().reduce<
      Record<
        string,
        {
          reason: string;
          details: string;
          evidence?: NonNullable<Booking["disputeEvidence"]>;
          status?: NonNullable<Booking["disputeStatus"]>;
          resolution?: Booking["disputeResolution"];
        }
      >
    >((next, dispute) => {
      next[dispute.bookingId] = {
        reason: dispute.reason,
        details: dispute.details,
        evidence: dispute.evidence,
        status: dispute.status,
        resolution: dispute.resolution,
      };
      return next;
    }, {});
  }, [disputedIds]);
  const [reviewBooking, setReviewBooking] = useState<Booking | null>(null);
  const [reviewScores, setReviewScores] = useState({
    quality: 0,
    punctuality: 0,
    cleanliness: 0,
    deadline: 0,
  });
  const [reviewedIds, setReviewedIds] = useState<string[]>(() => {
    return isDemoDataMode ? dataService.getReviewedBookingIds() : [];
  });
  const [reviewError, setReviewError] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [bookingView, setBookingView] = useState<"active" | "archive">("active");
  const bookingIds = useMemo(() => new Set(bookings.map((booking) => booking.id)), [bookings]);
  const reviewedBookingIds = useMemo(() => new Set(reviewedIds), [reviewedIds]);
  const archivedBookings = useMemo(
    () =>
      bookings.filter(
        (booking) =>
          booking.status === "cancelled" ||
          booking.status === "declined" ||
          booking.status === "client_confirmed" ||
          booking.status === "closed" ||
          booking.status === "completed" ||
          reviewedBookingIds.has(booking.id)
      ),
    [bookings, reviewedBookingIds]
  );
  const activeBookings = useMemo(
    () =>
      bookings.filter(
        (booking) =>
          !archivedBookings.some((archived) => archived.id === booking.id)
      ),
    [bookings, archivedBookings]
  );
  const visibleBookings =
    bookingView === "active" ? activeBookings : archivedBookings;
  const closedReviewBookingIds = useMemo(() => {
    const ids = new Set(reviewedIds);
    bookings.forEach((booking) => {
      if (
        booking.status === "client_confirmed" ||
        booking.status === "closed" ||
        booking.status === "completed"
      ) {
        ids.add(booking.id);
      }
    });
    return ids;
  }, [bookings, reviewedIds]);
  const [notifications, setNotifications] = useState(() => {
    return isDemoDataMode
      ? dataService.getClientNotifications().filter((notification) =>
          notification.bookingId ? bookingIds.has(notification.bookingId) : false
        )
      : [];
  });
  const visibleNotifications = useMemo(
    () =>
      notifications.filter(
        (notification) =>
          !(
            notification.type === "review" &&
            notification.bookingId &&
            closedReviewBookingIds.has(notification.bookingId)
          )
      ),
    [notifications, closedReviewBookingIds]
  );
  const [notificationError, setNotificationError] = useState("");
  const legalSettings = useMemo(() => dataService.getLegalSettings(), []);

  const refreshNotifications = () => {
    if (isDemoDataMode) {
      setNotifications(
        dataService.getClientNotifications().filter((notification) =>
          notification.bookingId ? bookingIds.has(notification.bookingId) : false
        )
      );
      setNotificationError("");
      return;
    }

    loadNotifications()
      .then((nextNotifications) => {
        setNotificationError("");
        setNotifications(
          nextNotifications.filter((notification) =>
            notification.bookingId ? bookingIds.has(notification.bookingId) : true
          )
        );
      })
      .catch((error) => {
        setNotificationError(
          error instanceof Error
            ? error.message
            : "ნოტიფიკაციების ჩატვირთვა ვერ მოხერხდა"
        );
      });
  };

  React.useEffect(() => {
    let cancelled = false;
    let activeController: AbortController | null = null;
    const refresh = () => {
      if (cancelled) return;
      if (isDemoDataMode) {
        refreshNotifications();
        return;
      }

      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;
      loadNotifications(undefined, controller.signal)
        .then((nextNotifications) => {
          if (cancelled) return;
          setNotificationError("");
          setNotifications(
            nextNotifications.filter((notification) =>
              notification.bookingId ? bookingIds.has(notification.bookingId) : true
            )
          );
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          if (cancelled) return;
          setNotificationError(
            error instanceof Error
              ? error.message
              : "ნოტიფიკაციების ჩატვირთვა ვერ მოხერხდა"
          );
        });
    };
    const refreshOnFocus = () => {
      if (document.visibilityState === "visible") refresh();
    };

    refresh();
    const intervalId = window.setInterval(refresh, isDemoDataMode ? 8000 : 10000);
    window.addEventListener("client-notifications-updated", refresh);
    window.addEventListener("booking-status-updated", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshOnFocus);

    return () => {
      cancelled = true;
      activeController?.abort();
      window.clearInterval(intervalId);
      window.removeEventListener("client-notifications-updated", refresh);
      window.removeEventListener("booking-status-updated", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, [bookingIds]);

  React.useEffect(() => {
    if (isDemoDataMode) return;

    let cancelled = false;
    loadReviewedBookingIds("craftsman")
      .then((ids) => {
        if (!cancelled) {
          setReviewedIds(ids);
          setReviewError("");
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setReviewError(
            error instanceof Error
              ? error.message
              : "შეფასებების ჩატვირთვა ვერ მოხერხდა"
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [bookings]);

  React.useEffect(() => {
    if (isDemoDataMode || bookings.length === 0) return;

    let cancelled = false;
    Promise.all(
      bookings.map((booking) =>
        loadBookingPaymentSummary(booking.id).then((summary) => [
          booking.id,
          summary,
        ] as const)
      )
    )
      .then((entries) => {
        if (!cancelled) {
          setPaymentSummaries(
            entries.reduce<Record<string, BookingPaymentSummary>>(
              (next, [bookingId, summary]) => ({
                ...next,
                [bookingId]: summary,
              }),
              {}
            )
          );
        }
      })
      .catch((error) => {
        console.error(error);
      });

    return () => {
      cancelled = true;
    };
  }, [bookings]);
  const cancelReasons = [
    "დრო აღარ მაწყობს",
    "ხელოსანს ვერ დავუკავშირდი",
    "სხვა ხელოსანი ავარჩიე",
    "საქმე აღარ მჭირდება",
  ];
  const problemReasons = [
    "ხელოსანი არ მოვიდა",
    "ხელოსანი აგვიანებს",
    "ფასი შეცვალა",
    "ხარისხი არ მომწონს",
    "კომუნიკაციის პრობლემა",
  ];

  const submitCancel = async () => {
    if (!cancelBooking) return;
    const validation = cancellationSchema.safeParse({ reason: cancelReason });
    if (!validation.success) {
      setCancelError(getValidationMessage(validation.error, "გაუქმების მიზეზი აირჩიეთ"));
      return;
    }
    try {
      setCancelError("");
      await onCancelBooking(cancelBooking.id, cancelReason);
      setCancelBooking(null);
      setCancelReason("");
    } catch (error) {
      setCancelError(
        error instanceof Error ? error.message : "გაუქმება ვერ მოხერხდა"
      );
    }
  };

  const addProblemEvidence = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setProblemError("ამ ეტაპზე დავაზე მხოლოდ ფოტოს დამატებაა შესაძლებელი");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      if (!result) return;
      setProblemEvidence((current) =>
        [
          ...current,
          {
            name: file.name || "evidence.jpg",
            url: result,
            type: "image" as const,
          },
        ].slice(0, 4)
      );
      setProblemError("");
    };
    reader.onerror = () => setProblemError("ფოტოს წაკითხვა ვერ მოხერხდა");
    reader.readAsDataURL(file);
  };

  const removeProblemEvidence = (index: number) => {
    setProblemEvidence((current) => current.filter((_, i) => i !== index));
  };

  const submitProblem = async () => {
    if (!problemBooking) return;
    const validation = disputeSchema.safeParse({
      reason: problemReason,
      details: problemDetails,
    });
    if (!validation.success) {
      setProblemError(
        getValidationMessage(validation.error, "პრობლემის დეტალები გადაამოწმეთ")
      );
      return;
    }
    setProblemError("");
    let evidence = problemEvidence;

    if (!isDemoDataMode) {
      try {
        evidence = await Promise.all(
          problemEvidence.map(async (item, index) => ({
            ...item,
            url: await uploadBookingSitePhoto(
              item.url,
              `${problemBooking.worker.id}-dispute-${problemBooking.id}-${index + 1}`
            ),
          }))
        );
        await openBookingDispute(
          problemBooking.id,
          problemReason,
          problemDetails,
          evidence
        );
      } catch (error) {
        setProblemError(
          error instanceof Error ? error.message : "პრობლემის გაგზავნა ვერ მოხერხდა"
        );
        return;
      }
    } else {
      dataService.prependBookingDispute({
        id: `${problemBooking.id}-${Date.now()}`,
        bookingId: problemBooking.id,
        reason: problemReason,
        details: problemDetails,
        workerName: problemBooking.worker.name,
        service: problemBooking.worker.role,
        dateLabel: problemBooking.dateLabel,
        time: problemBooking.time,
        amount:
          problemBooking.bookingFee || dataService.getPlatformSettings().bookingFee,
        paymentStatus: "disputed",
        evidence,
        createdAt: new Date().toISOString(),
        status: "open",
      });
      dataService.updateClientBooking(problemBooking.id, (booking) => ({
        ...booking,
        status: "disputed",
        paymentStatus: "disputed",
        disputeReason: problemReason,
        disputeDetails: problemDetails,
        disputeEvidence: evidence,
      }));
    }

    await onProblemOpened?.(problemBooking.id, problemReason, problemDetails, evidence);
    setDisputedIds((prev) => Array.from(new Set([...prev, problemBooking.id])));
    setProblemBooking(null);
    setProblemReason("");
    setProblemDetails("");
    setProblemEvidence([]);
  };

  const submitReview = async () => {
    if (!reviewBooking) return;
    const validation = craftsmanReviewSchema.safeParse(reviewScores);
    if (!validation.success) {
      setReviewError(getValidationMessage(validation.error, "შეფასება სრულად შეავსეთ"));
      return;
    }
    if (reviewSubmitting) return;
    setReviewSubmitting(true);
    if (!isDemoDataMode) {
      try {
        setReviewError("");
        await submitBookingReview({
          bookingId: reviewBooking.id,
          revieweeRole: "craftsman",
          criteria: reviewScores,
        });
      } catch (error) {
        setReviewError(
          error instanceof Error
            ? error.message
            : "შეფასების შენახვა ვერ მოხერხდა"
        );
        setReviewSubmitting(false);
        return;
      }
    }

    const nextReviewed = [...reviewedIds, reviewBooking.id];
    if (isDemoDataMode) {
      const overall =
        (reviewScores.quality +
          reviewScores.punctuality +
          reviewScores.cleanliness +
          reviewScores.deadline) /
        4;
      dataService.addWorkerRating(
        reviewBooking.worker.id,
        reviewBooking.worker.rating,
        reviewBooking.worker.reviewCount,
        overall
      );
      dataService.prependBookingReview({
        bookingId: reviewBooking.id,
        workerId: reviewBooking.worker.id,
        workerName: reviewBooking.worker.name,
        overall,
        criteria: reviewScores,
      });
      dataService.saveReviewedBookingIds(nextReviewed);
    }
    try {
      await onReviewBooking(reviewBooking.id);
    } catch (error) {
      setReviewError(
        error instanceof Error
          ? error.message
          : "ჯავშნის დახურვა ვერ მოხერხდა"
      );
      setReviewSubmitting(false);
      return;
    }
    setReviewedIds(nextReviewed);
    const nextNotifications = notifications.filter(
      (notification) => notification.bookingId !== reviewBooking.id
    );
    setNotifications(nextNotifications);
    if (isDemoDataMode) {
      dataService.saveClientNotifications(nextNotifications);
    }
    setReviewBooking(null);
    setReviewScores({ quality: 0, punctuality: 0, cleanliness: 0, deadline: 0 });
    setReviewSubmitting(false);
  };

  const markLocalNotificationRead = (notificationId: string) => {
    setNotifications((prev) => {
      const next = prev.map((notification) =>
        notification.id === notificationId && "readAt" in notification
          ? {
              ...(notification as AppNotification),
              readAt: new Date().toISOString(),
            }
          : notification
      );
      if (isDemoDataMode) dataService.saveClientNotifications(next);
      return next;
    });
  };

  const markEveryNotificationRead = async () => {
    if (!isDemoDataMode) {
      try {
        await markAllNotificationsRead();
      } catch (error) {
        setNotificationError(
          error instanceof Error
            ? error.message
            : "ნოტიფიკაციების განახლება ვერ მოხერხდა"
        );
        return;
      }
    }
    setNotifications((prev) => {
      const next = prev.map((notification) =>
        "readAt" in notification
          ? {
              ...(notification as AppNotification),
              readAt: new Date().toISOString(),
            }
          : notification
      );
      if (isDemoDataMode) dataService.saveClientNotifications(next);
      return next;
    });
  };

  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        paddingBottom: 90,
        background: "var(--bg)",
      }}
    >
      <div
        style={{
          padding: "34px 28px 18px",
          paddingTop: "calc(34px + var(--safe-top))",
        }}
      >
        <h2 className="screen-title">ჯავშნები</h2>
        <p style={{ fontSize: 13, color: "var(--text2)", marginTop: 4 }}>
          {bookings.length > 0
            ? "ყველა შენი მოთხოვნა"
            : "ყველა შენი მოთხოვნა"}
        </p>
      </div>

      <div style={{ padding: "0 28px 18px" }}>
        {reviewError && (
          <div
            style={{
              marginBottom: 10,
              padding: 11,
              borderRadius: 12,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              fontSize: 12,
              fontWeight: 800,
              lineHeight: 1.45,
            }}
          >
            {reviewError}
          </div>
        )}
        {notificationError && (
          <div
            style={{
              marginBottom: 10,
              padding: 11,
              borderRadius: 12,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              fontSize: 12,
              fontWeight: 800,
              lineHeight: 1.45,
            }}
          >
            {notificationError}
          </div>
        )}
        {visibleNotifications.some((notification) => {
          const appNotification =
            "readAt" in notification ? (notification as AppNotification) : null;
          return !appNotification?.readAt;
        }) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <strong style={{ color: "var(--text)", fontSize: 13 }}>
                ნოტიფიკაციები
              </strong>
              <button
                type="button"
                onClick={markEveryNotificationRead}
                style={{
                  background: "transparent",
                  color: "var(--primary)",
                  fontSize: 11,
                  fontWeight: 900,
                }}
              >
                ყველას წაკითხვა
              </button>
            </div>
            {visibleNotifications
              .filter((notification) => {
                const appNotification =
                  "readAt" in notification ? (notification as AppNotification) : null;
                return !appNotification?.readAt;
              })
              .slice(0, 3)
              .map((notification) => {
              const appNotification =
                "readAt" in notification ? (notification as AppNotification) : null;
              const isRead = Boolean(appNotification?.readAt);
              const canReviewFromNotification =
                notification.type === "review" &&
                notification.bookingId &&
                !closedReviewBookingIds.has(notification.bookingId);
              return (
              <div
                key={notification.id}
                onClick={() => {
                  if (isDemoDataMode && !isRead) {
                    markLocalNotificationRead(notification.id);
                    return;
                  }
                  if (!isDemoDataMode && !isRead) {
                    markNotificationRead(notification.id)
                      .then(() => markLocalNotificationRead(notification.id))
                      .catch((error) => {
                        setNotificationError(
                          error instanceof Error
                            ? error.message
                            : "ნოტიფიკაციის განახლება ვერ მოხერხდა"
                        );
                      });
                  }
                }}
                style={{
                  padding: notification.type === "review" ? 14 : 11,
                  borderRadius: 14,
                  background: notification.type === "review" ? "#ecfdf5" : "#eff6ff",
                  border: `1px solid ${
                    notification.type === "review" ? "#bbf7d0" : "#bfdbfe"
                  }`,
                  color: notification.type === "review" ? "#047857" : "#1d4ed8",
                  fontSize: notification.type === "review" ? 12 : 11,
                  lineHeight: 1.55,
                  fontWeight: 800,
                  opacity: isRead ? 0.68 : 1,
                  cursor: isRead ? "default" : "pointer",
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 10, alignItems: "start" }}>
                  <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                    {appNotification?.title || notificationText(notification)}
                  </span>
                  {appNotification?.createdAt && (
                    <span style={{ flexShrink: 0, opacity: 0.75 }}>
                      {formatNotificationDate(appNotification.createdAt)}
                    </span>
                  )}
                </div>
                {appNotification?.title &&
                  notificationText(appNotification) !== appNotification.title && (
                  <div style={{ marginTop: 4, fontWeight: 750, overflowWrap: "anywhere" }}>
                    {notificationText(appNotification)}
                  </div>
                )}
                {canReviewFromNotification && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!isDemoDataMode) {
                        markNotificationRead(notification.id)
                          .then(() => markLocalNotificationRead(notification.id))
                          .catch((error) => {
                            setNotificationError(
                              error instanceof Error
                                ? error.message
                                : "ნოტიფიკაციის განახლება ვერ მოხერხდა"
                            );
                          });
                      }
                      const target = bookings.find(
                        (booking) => booking.id === notification.bookingId
                      );
                      if (target) {
                        setReviewBooking(target);
                        setReviewScores({
                          quality: 0,
                          punctuality: 0,
                          cleanliness: 0,
                          deadline: 0,
                        });
                      }
                    }}
                    style={{
                      display: "block",
                      marginTop: 10,
                      padding: "9px 13px",
                      borderRadius: 10,
                      background: "#10b981",
                      color: "white",
                      fontSize: 12,
                      fontWeight: 900,
                    }}
                  >
                    ★ შეფასება და ქულების მიღება
                  </button>
                )}
              </div>
            );
            })}
          </div>
        )}
        <div
          style={{
            marginBottom: 14,
            padding: 14,
            borderRadius: 14,
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            color: "#92400e",
            fontSize: 12,
            lineHeight: 1.55,
            fontWeight: 700,
          }}
        >
          {legalSettings.cancellationRules}
        </div>
        {bookings.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: 14,
              padding: 4,
              borderRadius: 14,
              background: "#f1f5f9",
              border: "1px solid var(--border)",
            }}
          >
            {[
              { id: "active" as const, label: "აქტიური", count: activeBookings.length },
              { id: "archive" as const, label: "არქივი", count: archivedBookings.length },
            ].map((item) => {
              const selected = bookingView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setBookingView(item.id)}
                  style={{
                    minHeight: 38,
                    borderRadius: 11,
                    background: selected ? "white" : "transparent",
                    color: selected ? "var(--text)" : "var(--text2)",
                    border: selected ? "1px solid var(--border)" : "1px solid transparent",
                    boxShadow: selected ? "var(--shadow-sm)" : "none",
                    fontSize: 13,
                    fontWeight: 900,
                  }}
                >
                  {item.label} ({item.count})
                </button>
              );
            })}
          </div>
        )}
        {bookings.length === 0 ? (
          <EmptyState
            title="ჯავშნები არ გაქვს"
            description="აირჩიე ხელოსანი, მიუთითე მისამართი და დაჯავშნე დრო."
          />
        ) : visibleBookings.length === 0 ? (
          <EmptyState
            compact
            title={bookingView === "active" ? "აქტიური ჯავშნები არ გაქვს" : "არქივი ცარიელია"}
            description={
              bookingView === "active"
                ? "ახალი ჯავშანი აქ გამოჩნდება, სანამ პროცესი დასრულდება."
                : "დასრულებული, გაუქმებული და უარყოფილი ჯავშნები აქ გადავა."
            }
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {visibleBookings.map((b) => {
              const paymentSummary = paymentSummaries[b.id];
              const effectivePaymentStatus =
                paymentSummary?.status || b.paymentStatus || "held";
              const paymentStatusKey = String(effectivePaymentStatus);
              const isDisputed =
                paymentStatusKey === "failed" ||
                paymentStatusKey === "disputed" ||
                disputedIds.includes(b.id);
              const disputeInfo = disputesByBooking[b.id];
              const disputeReason = b.disputeReason || disputeInfo?.reason;
              const disputeDetails = b.disputeDetails || disputeInfo?.details;
              const disputeStatus = b.disputeStatus || disputeInfo?.status || "open";
              const disputeResolution = b.disputeResolution || disputeInfo?.resolution;
              const disputeUi = disputeMeta(disputeStatus, disputeResolution);
              const disputeEvidence = b.disputeEvidence || disputeInfo?.evidence || [];
              const isCompleted =
                b.status === "client_confirmed" ||
                b.status === "closed" ||
                b.status === "completed" ||
                reviewedIds.includes(b.id);
              const isInactive =
                isCompleted ||
                b.status === "declined" ||
                b.status === "cancelled";
              const bookingFee =
                b.bookingFee || dataService.getPlatformSettings().bookingFee;
              const platformSettings = dataService.getPlatformSettings();
              const hoursLeft = hoursUntilBooking(b);
              const isLateCancellationWindow =
                hoursLeft < platformSettings.freeCancellationHours;
              const possiblePenalty = Math.round(
                (bookingFee * platformSettings.lateCancellationFeePercent) / 100
              );
              const paymentCurrency =
                paymentSummary?.currency || b.paymentCurrency || "GEL";
              const currentPaymentStep = paymentStepIndex(
                b,
                isDisputed,
                effectivePaymentStatus
              );
              const paymentSteps =
                effectivePaymentStatus === "refunded" ||
                b.status === "declined" ||
                b.status === "cancelled"
                  ? ["გაყინულია", "გადამოწმება", "დაბრუნდა"]
                  : isDisputed
                    ? ["გაყინულია", "დავაშია", "გადაწყვეტა"]
                    : ["გაყინულია", "გადამოწმება", "დადასტურდა"];
              const needsClientReview =
                b.status === "worker_completed" && !reviewedIds.includes(b.id);
              const statusTone =
                b.status === "cancelled" || b.status === "declined"
                  ? {
                      bg: "#fef2f2",
                      color: "#b91c1c",
                      border: "#fecaca",
                    }
                  : b.status === "pending"
                    ? {
                        bg: "#fff7ed",
                        color: "#c2410c",
                        border: "#fed7aa",
                      }
                    : isCompleted
                      ? {
                          bg: "#ecfdf5",
                          color: "#047857",
                          border: "#bbf7d0",
                        }
                      : {
                          bg: "#eff6ff",
                          color: "#1d4ed8",
                          border: "#bfdbfe",
                        };
              const statusLabel =
                b.status === "declined"
                  ? "უარყოფილი"
                  : b.status === "cancelled"
                    ? "გაუქმებული"
                  : b.status === "confirmed"
                    ? "დადასტურებული"
                    : b.status === "en_route"
                      ? "გზაშია"
                      : b.status === "started"
                        ? "დაიწყო"
                        : b.status === "worker_completed"
                          ? "ხელოსანმა დაასრულა"
                            : b.status === "client_confirmed"
                              ? "დასრულებული"
                            : b.status === "closed"
                              ? "შესრულებული"
                  : isCompleted
                    ? "შესრულებული"
                      : "მოლოდინში";
              return (
                <div
                key={b.id}
                className="fade-up"
                style={{
                  background: "var(--bg2)",
                  border: `1px solid ${
                    isCompleted ? "#bbf7d0" : statusTone.border
                  }`,
                  borderRadius: 16,
                  overflow: "hidden",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <div style={{ padding: "16px" }}>
                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "center",
                      marginBottom: 12,
                    }}
                  >
                    <div
                      onClick={() => onWorkerSelect(b.worker)}
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: "50%",
                        overflow: "hidden",
                        background: "#eef3f9",
                        border: "1px solid var(--border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                        fontWeight: 700,
                        color: b.worker.avatarColor,
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                    >
                      {b.worker.avatar.startsWith("data:image") ||
                      b.worker.avatar.startsWith("http") ? (
                        <img
                          src={b.worker.avatar}
                          alt={b.worker.name}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        b.worker.avatar
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: "var(--text)",
                        }}
                      >
                        {b.worker.name}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text2)" }}>
                        {b.worker.role}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: "var(--text)",
                          marginTop: 6,
                          fontWeight: 700,
                        }}
                      >
                        ▣ {formatBookingDateTime(b)}
                      </div>
                    </div>
                    <div
                      style={{
                        flex: "0 1 126px",
                        minWidth: 86,
                        background: statusTone.bg,
                        borderRadius: 999,
                        padding: "7px 9px",
                        textAlign: "center",
                        border: `1px solid ${statusTone.border}`,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          lineHeight: 1.25,
                          color: statusTone.color,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {statusLabel}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 12,
                    }}
                  >
                    <Stars rating={b.worker.rating} size={11} />
                    <span style={{ fontSize: 11, color: "var(--text3)" }}>
                      {b.worker.rating} · {b.worker.reviewCount} შეფ.
                    </span>
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: 12,
                        color: "var(--accent)",
                        fontWeight: 700,
                      }}
                    >
                      {b.worker.price}
                    </span>
                  </div>

                  <div
                    style={{
                      margin: "6px 0 14px",
                      padding: 10,
                      borderRadius: 14,
                      background: "#f8fafc",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: `repeat(${trackingSteps.length}, minmax(0, 1fr))`,
                        gap: 5,
                      }}
                    >
                      {trackingSteps.map((step, index) => {
                        const currentIndex = statusIndex(b.status);
                        const reached = currentIndex >= index;
                        const active = currentIndex === index;
                        return (
                          <div key={step.status} style={{ textAlign: "center", minWidth: 0 }}>
                            <div
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: "50%",
                                margin: "0 auto 6px",
                                background: reached ? "#10b981" : "white",
                                border: `2px solid ${
                                  active ? "#047857" : reached ? "#10b981" : "#dbe4ef"
                                }`,
                                boxShadow: active
                                  ? "0 0 0 3px rgba(16,185,129,0.16)"
                                  : "none",
                                color: reached ? "white" : "var(--text3)",
                                fontSize: 11,
                                fontWeight: 950,
                                lineHeight: "18px",
                              }}
                            >
                              {index + 1}
                            </div>
                            <div
                              style={{
                                color: reached ? "#047857" : "var(--text3)",
                                fontSize: 9,
                                fontWeight: 900,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {step.label}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div
                    style={{
                      marginBottom: 12,
                      padding: 11,
                      borderRadius: 12,
                      background: isDisputed ? "#fff1f2" : "#f8fafc",
                      border: `1px solid ${
                        isDisputed ? "#fecaca" : "var(--border)"
                      }`,
                      color: isDisputed ? "#b91c1c" : "var(--text2)",
                      fontSize: 12,
                      fontWeight: 850,
                      lineHeight: 1.45,
                    }}
                  >
                    {paymentMessage(b, isDisputed, effectivePaymentStatus)}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                        gap: 6,
                        marginTop: 10,
                      }}
                    >
                      {paymentSteps.map((step, index) => {
                        const reached = currentPaymentStep >= index;
                        return (
                          <div key={step} style={{ minWidth: 0 }}>
                            <div
                              style={{
                                height: 5,
                                borderRadius: 999,
                                background: reached
                                  ? isDisputed
                                    ? "#f97316"
                                    : effectivePaymentStatus === "refunded" ||
                                        b.status === "cancelled" ||
                                        b.status === "declined"
                                      ? "#ef4444"
                                      : "#10b981"
                                  : "#dbe4ef",
                                marginBottom: 5,
                              }}
                            />
                            <div
                              style={{
                                color: reached ? "currentColor" : "var(--text3)",
                                fontSize: 9,
                                fontWeight: 900,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {step}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div
                      style={{
                        marginTop: 8,
                        paddingTop: 8,
                        borderTop: "1px solid rgba(148, 163, 184, 0.25)",
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                        color: "inherit",
                        fontSize: 11,
                        fontWeight: 900,
                      }}
                    >
                      <span>დაჯავშნის საფასური</span>
                      <span>{money(bookingFee, paymentCurrency)}</span>
                    </div>
                    {!isInactive && (
                      <div
                        style={{
                          marginTop: 8,
                          padding: 9,
                          borderRadius: 11,
                          background: isLateCancellationWindow ? "#fff7ed" : "white",
                          border: `1px solid ${
                            isLateCancellationWindow ? "#fed7aa" : "#dbe4ef"
                          }`,
                          color: isLateCancellationWindow ? "#9a3412" : "var(--text2)",
                          fontSize: 10,
                          fontWeight: 850,
                          lineHeight: 1.4,
                        }}
                      >
                        {isLateCancellationWindow
                          ? `უფასო გაუქმების პერიოდი გასულია. გაუქმების შემთხვევაში Admin გადაამოწმებს მიზეზს. სავარაუდო დაკავება: ${money(possiblePenalty, paymentCurrency)}.`
                          : `უფასო გაუქმება შესაძლებელია ვიზიტამდე ${platformSettings.freeCancellationHours} საათზე ადრე.`}
                        <details style={{ marginTop: 7 }}>
                          <summary
                            style={{
                              color: "#1d4ed8",
                              cursor: "pointer",
                              fontWeight: 950,
                              textDecoration: "underline",
                            }}
                          >
                            გაუქმების წესები
                          </summary>
                          <div style={{ marginTop: 6 }}>
                            {legalSettings.cancellationRules}
                          </div>
                        </details>
                      </div>
                    )}
                  </div>

                  {isDisputed && disputeReason && (
                    <div
                      style={{
                        marginBottom: 12,
                        padding: 11,
                        borderRadius: 12,
                        background: disputeUi.bg,
                        border: `1px solid ${disputeUi.border}`,
                        color: disputeUi.color,
                        fontSize: 12,
                        fontWeight: 850,
                        lineHeight: 1.45,
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 950 }}>{disputeUi.label}</div>
                      <div style={{ marginTop: 4 }}>{disputeUi.detail}</div>
                      <div style={{ marginTop: 7, fontWeight: 900 }}>
                        მიზეზი: {disputeReason}
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(3, 1fr)",
                          gap: 6,
                          marginTop: 9,
                          color: "inherit",
                        }}
                      >
                        {[
                          { key: "open", label: "გაიხსნა" },
                          { key: "reviewing", label: "განხილვაშია" },
                          { key: "resolved", label: "გადაწყდა" },
                        ].map((step, index) => {
                          const active = index <= disputeUi.step;
                          return (
                            <div key={step.key}>
                              <div
                                style={{
                                  height: 5,
                                  borderRadius: 999,
                                  background: active ? disputeUi.color : "rgba(148,163,184,0.35)",
                                  marginBottom: 5,
                                }}
                              />
                              <div
                                style={{
                                  color: active ? "inherit" : "#cbd5e1",
                                  fontSize: 9,
                                  fontWeight: 950,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {step.label}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {disputeDetails && (
                        <div style={{ marginTop: 7, color: "inherit", fontWeight: 750 }}>
                          {disputeDetails}
                        </div>
                      )}
                      {disputeEvidence.length > 0 && (
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(4, 1fr)",
                            gap: 7,
                            marginTop: 9,
                          }}
                        >
                          {disputeEvidence.map((item, index) => (
                            <img
                              key={`${item.url}-${index}`}
                              src={item.url}
                              alt=""
                              style={{
                                width: "100%",
                                aspectRatio: "1 / 1",
                                borderRadius: 8,
                                objectFit: "cover",
                                border: "1px solid #fed7aa",
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {b.cancellationReason && (
                    <div
                      style={{
                        marginBottom: 12,
                        padding: 11,
                        borderRadius: 12,
                        background: "#fef2f2",
                        border: "1px solid #fecaca",
                        color: "#991b1b",
                        fontSize: 12,
                        fontWeight: 850,
                        lineHeight: 1.45,
                      }}
                    >
                      გაუქმების მიზეზი: {b.cancellationReason}
                      {b.cancellationPolicy && (
                        <div style={{ marginTop: 6, color: "#7f1d1d", fontWeight: 800 }}>
                          {b.cancellationPolicy === "late_review"
                            ? `გადამოწმდება Admin-ის მიერ. სავარაუდო დაკავება: ${
                                b.cancellationPenaltyAmount || 0
                              } ლარი.`
                            : "გაუქმება უფასო პერიოდის ფარგლებშია."}
                        </div>
                      )}
                    </div>
                  )}

                  {needsClientReview && (
                    <button
                      type="button"
                      onClick={() => {
                        setReviewBooking(b);
                        setReviewScores({
                          quality: 0,
                          punctuality: 0,
                          cleanliness: 0,
                          deadline: 0,
                        });
                      }}
                      style={{
                        width: "100%",
                        marginBottom: 10,
                        padding: "12px",
                        borderRadius: 12,
                        background: "#10b981",
                        color: "white",
                        fontSize: 13,
                        fontWeight: 900,
                        boxShadow: "0 8px 20px rgba(16,185,129,0.22)",
                      }}
                    >
                      დადასტურება და შეფასება
                    </button>
                  )}

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      onClick={() => onWorkerSelect(b.worker)}
                      style={{
                        flex: 1,
                        padding: "9px",
                        fontSize: 12,
                        fontWeight: 600,
                        background: "var(--bg3)",
                        color: "var(--text)",
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                      }}
                    >
                      პროფილი
                    </button>
                    {!isInactive && (
                      <button
                        onClick={() => {
                          setCancelBooking(b);
                          setCancelReason("");
                          setCancelError("");
                        }}
                        style={{
                          flex: 1,
                          padding: "9px",
                          fontSize: 12,
                          fontWeight: 600,
                          background: "#FEF2F2",
                          color: "#B91C1C",
                          border: "1px solid #FECACA",
                          borderRadius: 10,
                        }}
                      >
                        გაუქმება
                      </button>
                    )}
                    {!isInactive && (
                      <button
                        onClick={() => {
                          setProblemBooking(b);
                          setProblemReason("");
                          setProblemDetails("");
                          setProblemEvidence([]);
                          setProblemError("");
                        }}
                        style={{
                          flex: 1,
                          minWidth: 96,
                          padding: "9px",
                          fontSize: 12,
                          fontWeight: 700,
                          background: "#fff7ed",
                          color: "#c2410c",
                          border: "1px solid #fed7aa",
                          borderRadius: 10,
                        }}
                      >
                        პრობლემა მაქვს
                      </button>
                    )}
                  </div>
                </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {cancelBooking && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 120,
            display: "flex",
            alignItems: "flex-end",
            background: "rgba(15,23,42,0.35)",
          }}
        >
          <div style={{ width: "100%", padding: 22, borderRadius: "22px 22px 0 0", background: "white" }}>
            {(() => {
              const settings = dataService.getPlatformSettings();
              const hoursLeft = hoursUntilBooking(cancelBooking);
              const lateCancellation = hoursLeft < settings.freeCancellationHours;
              const bookingFee = cancelBooking.bookingFee || settings.bookingFee;
              const penaltyAmount = lateCancellation
                ? Math.round(
                    (bookingFee * settings.lateCancellationFeePercent) / 100
                  )
                : 0;
              return (
                <>
            <h2 style={{ margin: "0 0 8px", color: "var(--text)", fontSize: 22, fontWeight: 900 }}>
              ნამდვილად გსურთ გაუქმება?
            </h2>
            <p style={{ margin: "0 0 14px", color: "var(--text2)", fontSize: 13 }}>
              აირჩიეთ გაუქმების მიზეზი
            </p>
            <div
              style={{
                marginBottom: 14,
                padding: 12,
                borderRadius: 12,
                background: lateCancellation ? "#fff7ed" : "#ecfdf5",
                border: `1px solid ${lateCancellation ? "#fed7aa" : "#bbf7d0"}`,
                color: lateCancellation ? "#9a3412" : "#047857",
                fontSize: 12,
                fontWeight: 850,
                lineHeight: 1.5,
              }}
            >
              {lateCancellation
                ? `უფასო გაუქმების დრო გასულია. ეს მოქმედება აისახება ანგარიშზე და Admin გადაამოწმებს. სავარაუდო დაკავება: ${penaltyAmount} ლარი.`
                : `${legalSettings.cancellationRules} დაჯავშნის საფასური დაბრუნდება.`}
            </div>
            {cancelError && (
              <div
                style={{
                  marginBottom: 12,
                  padding: 11,
                  borderRadius: 12,
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#b91c1c",
                  fontSize: 12,
                  fontWeight: 850,
                }}
              >
                {cancelError}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {cancelReasons.map((reason) => (
                <label
                  key={reason}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "11px 12px",
                    borderRadius: 12,
                    border: `1px solid ${
                      cancelReason === reason ? "var(--primary)" : "var(--border)"
                    }`,
                    background: cancelReason === reason ? "#f0f7ff" : "#f8fafc",
                    color: "var(--text)",
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  <input
                    type="radio"
                    checked={cancelReason === reason}
                    onChange={() => setCancelReason(reason)}
                    style={{ accentColor: "var(--primary)" }}
                  />
                  {reason}
                </label>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => setCancelBooking(null)}
                style={{ flex: 1, minHeight: 48, borderRadius: 12, background: "#f1f5f9", color: "var(--text)", fontWeight: 900 }}
              >
                არა
              </button>
              <button
                type="button"
                onClick={submitCancel}
                disabled={!cancelReason}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: 12,
                  background: cancelReason ? "#ef4444" : "#dbe4ef",
                  color: "white",
                  fontWeight: 900,
                }}
              >
                გაუქმება
              </button>
            </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {problemBooking && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 120,
            display: "flex",
            alignItems: "flex-end",
            background: "rgba(15,23,42,0.35)",
          }}
        >
          <div
            style={{
              width: "100%",
              maxHeight: "92vh",
              overflowY: "auto",
              padding: 22,
              borderRadius: "22px 22px 0 0",
              background: "white",
            }}
          >
            <h2
              style={{
                margin: "0 0 8px",
                color: "var(--text)",
                fontSize: 22,
                fontWeight: 900,
              }}
            >
              პრობლემა გაქვთ?
            </h2>
            <p
              style={{
                margin: "0 0 14px",
                color: "var(--text2)",
                fontSize: 13,
                lineHeight: 1.55,
              }}
            >
              აირჩიეთ მიზეზი. დაჯავშნის საფასური დროებით შეჩერდება, სანამ
              საკითხი გაირკვევა.
            </p>
            {problemError && (
              <div
                style={{
                  marginBottom: 12,
                  padding: 11,
                  borderRadius: 12,
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#b91c1c",
                  fontSize: 12,
                  fontWeight: 800,
                  lineHeight: 1.45,
                }}
              >
                {problemError}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {problemReasons.map((reason) => (
                <label
                  key={reason}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: `1px solid ${
                      problemReason === reason ? "#f97316" : "var(--border)"
                    }`,
                    background: problemReason === reason ? "#fff7ed" : "#f8fafc",
                    color: "var(--text)",
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  <input
                    type="radio"
                    checked={problemReason === reason}
                    onChange={() => setProblemReason(reason)}
                    style={{ accentColor: "#f97316" }}
                  />
                  {reason}
                </label>
              ))}
            </div>
            <textarea
              value={problemDetails}
              onChange={(event) => setProblemDetails(event.target.value)}
              placeholder="დაწერეთ მოკლედ რა მოხდა..."
              rows={3}
              style={{
                width: "100%",
                marginTop: 12,
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "#f8fafc",
                color: "var(--text)",
                fontSize: 13,
                fontWeight: 700,
                resize: "vertical",
              }}
            />
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 14,
                background: "#f8fafc",
                border: "1px dashed #cbd5e1",
              }}
            >
              <div
                style={{
                  color: "var(--text)",
                  fontSize: 13,
                  fontWeight: 900,
                }}
              >
                მტკიცებულება
              </div>
              <div
                style={{
                  marginTop: 4,
                  color: "var(--text2)",
                  fontSize: 12,
                  lineHeight: 1.45,
                }}
              >
                ფოტო სავალდებულო არ არის, მაგრამ Admin-ს დაეხმარება უკეთ
                გაარკვიოს რა მოხდა.
              </div>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 46,
                  marginTop: 10,
                  borderRadius: 12,
                  background: "white",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  fontSize: 13,
                  fontWeight: 900,
                }}
              >
                ფოტოს დამატება
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    addProblemEvidence(event.target.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                  style={{ display: "none" }}
                />
              </label>
              {problemEvidence.length > 0 && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 8,
                    marginTop: 10,
                  }}
                >
                  {problemEvidence.map((item, index) => (
                    <button
                      key={`${item.name}-${index}`}
                      type="button"
                      onClick={() => removeProblemEvidence(index)}
                      title="წაშლა"
                      style={{
                        position: "relative",
                        aspectRatio: "1 / 1",
                        borderRadius: 10,
                        overflow: "hidden",
                        border: "1px solid var(--border)",
                        background: "white",
                      }}
                    >
                      <img
                        src={item.url}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                      <span
                        style={{
                          position: "absolute",
                          top: 4,
                          right: 4,
                          width: 18,
                          height: 18,
                          borderRadius: 999,
                          background: "rgba(15,23,42,.85)",
                          color: "white",
                          fontSize: 12,
                          lineHeight: "18px",
                          fontWeight: 900,
                        }}
                      >
                        x
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => {
                  setProblemBooking(null);
                  setProblemEvidence([]);
                }}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: 12,
                  background: "#f1f5f9",
                  color: "var(--text)",
                  fontWeight: 900,
                }}
              >
                დახურვა
              </button>
              <button
                type="button"
                onClick={submitProblem}
                disabled={!problemReason}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: 12,
                  background: problemReason ? "#f97316" : "#dbe4ef",
                  color: "white",
                  fontWeight: 900,
                }}
              >
                გაგზავნა
              </button>
            </div>
          </div>
        </div>
      )}

      {reviewBooking && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 120,
            display: "flex",
            alignItems: "flex-end",
            background: "rgba(15,23,42,0.35)",
          }}
        >
          <div style={{ width: "100%", padding: 22, borderRadius: "22px 22px 0 0", background: "white" }}>
            <h2 style={{ margin: "0 0 8px", color: "var(--text)", fontSize: 22, fontWeight: 900 }}>
              შეაფასე ხელოსანი
            </h2>
            <p style={{ margin: "0 0 16px", color: "var(--text2)", fontSize: 13 }}>
              {reviewBooking.worker.name}
            </p>
            {reviewError && (
              <div
                style={{
                  marginBottom: 12,
                  padding: 11,
                  borderRadius: 12,
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#b91c1c",
                  fontSize: 12,
                  fontWeight: 800,
                  lineHeight: 1.45,
                }}
              >
                {reviewError}
              </div>
            )}
            {[
              { key: "quality" as const, label: "შესრულებული სამუშაოს ხარისხი" },
              { key: "punctuality" as const, label: "დროულად მოსვლა ობიექტზე" },
              { key: "cleanliness" as const, label: "სისუფთავე" },
              { key: "deadline" as const, label: "დათქმულ ვადაში ჩაბარება" },
            ].map((item) => (
              <div key={item.key} style={{ marginBottom: 13 }}>
                <div style={{ marginBottom: 7, color: "var(--text)", fontSize: 13, fontWeight: 900 }}>
                  {item.label}
                </div>
                <div style={{ display: "flex", gap: 7 }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      aria-label={`${item.label} ${star} ვარსკვლავი`}
                      onClick={() =>
                        setReviewScores((prev) => ({ ...prev, [item.key]: star }))
                      }
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        background: reviewScores[item.key] >= star ? "#fff7cc" : "#f8fafc",
                        color: reviewScores[item.key] >= star ? "#f59e0b" : "var(--text3)",
                        border: "1px solid var(--border)",
                        fontSize: 20,
                        fontWeight: 900,
                      }}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  if (!reviewSubmitting) setReviewBooking(null);
                }}
                disabled={reviewSubmitting}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: 12,
                  background: reviewSubmitting ? "#e2e8f0" : "#f1f5f9",
                  color: "var(--text)",
                  fontWeight: 900,
                  opacity: reviewSubmitting ? 0.75 : 1,
                }}
              >
                დახურვა
              </button>
              <button
                type="button"
                onClick={submitReview}
                disabled={
                  reviewSubmitting ||
                  !reviewScores.quality ||
                  !reviewScores.punctuality ||
                  !reviewScores.cleanliness ||
                  !reviewScores.deadline
                }
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: 12,
                  background:
                    reviewScores.quality &&
                    reviewScores.punctuality &&
                    reviewScores.cleanliness &&
                    reviewScores.deadline &&
                    !reviewSubmitting
                      ? "#10b981"
                      : "#dbe4ef",
                  color: "white",
                  fontWeight: 900,
                }}
              >
                {reviewSubmitting ? "ინახება..." : "შეფასება და +10 ქულა"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
