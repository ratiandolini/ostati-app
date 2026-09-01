import { BookingStatus } from "../../types";
import { categories } from "../../data/workers";
import { dataService, isDemoDataMode } from "../../services/dataService";
import {
  formatGeorgianDate,
  formatGeorgianTime,
  normalizeGeorgianDateLabel,
} from "../../utils/georgianDate";

export interface Booking {
  id: string;
  clientName: string;
  clientPhone?: string;
  date: string;
  time: string;
  scheduledAt?: string;
  address: string;
  status: BookingStatus;
  service: string;
  comment?: string;
  cancellationReason?: string;
  bookingFee?: number;
  paymentStatus?: "held" | "released" | "refunded" | "disputed";
  paymentProvider?: string;
  paymentCurrency?: string;
  paymentTransactionId?: string;
  disputeReason?: string;
  disputeDetails?: string;
  disputeStatus?: "open" | "reviewing" | "resolved";
  disputeResolution?: "refund_client" | "release_worker" | "warning" | "none";
  measurements?: {
    area?: string;
    height?: string;
    length?: string;
    rooms?: string;
    extraMeasurements?: string;
    wallCondition?: string;
    targetSurface?: string;
    materialOwner?: string;
    plumbingType?: string;
    floor?: string;
    electricPoints?: string;
    electricPanel?: string;
    isEmergency?: string;
    workScope?: string;
    surfaceType?: string;
    materialNote?: string;
    itemCount?: string;
    currentCondition?: string;
    photoNote?: string;
    sitePhoto?: string;
    roofType?: string;
  };
}

export interface ClientRating {
  communication: number;
  timeManagement: number;
  clarity: number;
}

export const uploadErrorMessage = (
  error: unknown,
  label: "ფოტოს" | "დოკუმენტის" = "ფოტოს"
) => {
  const message = error instanceof Error ? error.message : "";
  if (/EntityTooLarge|size/i.test(message)) {
    return `${label} ფაილი ძალიან დიდია. ატვირთე 4.5 მბ-მდე JPG, PNG, WebP ან PDF.`;
  }
  if (/Unauthorized|RLS|permission|session/i.test(message)) {
    return `${label} ატვირთვა დროებით ვერ მოხერხდა. გადაამოწმე კავშირი და სცადე თავიდან; თუ განმეორდა, მხარდაჭერას მიმართე.`;
  }
  if (/JPG, PNG, WebP|PDF/i.test(message)) return message;
  return `${label} ატვირთვა ვერ მოხერხდა. სცადე სხვა JPG, PNG, WebP ან PDF ფაილი.`;
};

// Polling responses are new arrays even when the server data is unchanged.
// Preserving the old reference prevents visual resets during background sync.
export const keepEqualSnapshot = <T,>(current: T[], next: T[]) =>
  JSON.stringify(current) === JSON.stringify(next) ? current : next;

export const DAYS = ["ორშ", "სამ", "ოთხ", "ხუთ", "პარ", "შაბ", "კვ"];
export const DAY_TO_WEEKDAY: Record<string, number> = {
  ორშ: 1,
  სამ: 2,
  ოთხ: 3,
  ხუთ: 4,
  პარ: 5,
  შაბ: 6,
  კვ: 7,
};
export const WEEKDAY_TO_DAY: Record<number, string> = {
  1: "ორშ",
  2: "სამ",
  3: "ოთხ",
  4: "ხუთ",
  5: "პარ",
  6: "შაბ",
  7: "კვ",
};

export const isBlankDetail = (value?: string) => {
  const normalized = String(value || "").trim().toLowerCase();
  return !normalized || normalized === "unknown" || normalized === "null";
};

export const formatDetailValue = (value?: string, unit = "") => {
  if (isBlankDetail(value)) return "არ არის";
  return unit ? `${String(value).trim()} ${unit}` : String(value).trim();
};

export const formatMaterialOwner = (value?: string) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized || normalized === "unknown") return "";
  if (normalized === "client") return "კლიენტის";
  if (normalized === "worker") return "ხელოსნის";
  return value || "";
};

export const PROFESSION_OPTIONS = categories
  .filter((category) => category !== "all")
  .sort((a, b) => a.localeCompare(b, "ka"));
export const PROFILE_SECTIONS = [
  { id: "edit", label: "რედაქტირება" },
  { id: "professions", label: "პროფესია" },
  { id: "schedule", label: "სამუშაო დრო" },
  { id: "verification", label: "ვერიფიკაცია" },
  { id: "portfolio", label: "ნამუშევრები" },
] as const;
export const HOURS = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
];

export const readCraftsmanProfile = () => {
  if (!isDemoDataMode) return {};
  return dataService.getCraftsmanProfile();
};

export const parseStoredPrice = (price?: string) => {
  const values = price?.match(/\d+/g)?.map(Number) || [];
  if (price?.includes("-") && values.length >= 2) {
    return { type: "range" as const, min: values[0], max: values[1] };
  }
  if (price?.includes("ლარიდან") && values.length) {
    return { type: "from" as const, min: values[0], max: null };
  }
  if (values.length) {
    return { type: "fixed" as const, min: values[0], max: null };
  }
  return { type: "range" as const, min: 80, max: 120 };
};

export const formatProfilePrice = (
  type: "fixed" | "from" | "range",
  min: number,
  max: number
) => {
  if (type === "fixed") return `${min} ლარი`;
  if (type === "from") return `${min} ლარიდან`;
  return `${min}-${max} ლარი`;
};

export const formatNotificationDate = (value?: string) => {
  if (!value) return "";
  return formatGeorgianDate(value, { shortMonth: true, year: false });
};

export const formatBookingDateTime = (booking: Booking) => {
  const scheduledAt = booking.scheduledAt;
  if (!scheduledAt) return `${normalizeGeorgianDateLabel(booking.date)} · ${booking.time}`;
  const date = new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) {
    return `${normalizeGeorgianDateLabel(booking.date)} · ${booking.time}`;
  }
  return `${formatGeorgianDate(date)} · ${formatGeorgianTime(date)}`;
};

export const monthNames = [
  "იანვარი",
  "თებერვალი",
  "მარტი",
  "აპრილი",
  "მაისი",
  "ივნისი",
  "ივლისი",
  "აგვისტო",
  "სექტემბერი",
  "ოქტომბერი",
  "ნოემბერი",
  "დეკემბერი",
];

export const formatWorkDateLabel = (date: Date) =>
  `${date.getDate()} ${monthNames[date.getMonth()]}`;

export const initialBookings: Booking[] = [
  {
    id: "1",
    clientName: "გიორგი მამულაშვილი",
    date: "15 მაისი",
    time: "10:00",
    address: "თბილისი, ვაკე",
    status: "pending",
    service: "ოთახის მოხატვა",
  },
  {
    id: "2",
    clientName: "ნინო კვარაცხელია",
    date: "17 მაისი",
    time: "14:00",
    address: "თბილისი, საბურთალო",
    status: "confirmed",
    service: "ფასადის მოხატვა",
  },
  {
    id: "3",
    clientName: "დავით ბერიძე",
    date: "20 მაისი",
    time: "09:00",
    address: "თბილისი, ისანი",
    status: "confirmed",
    service: "სამზარეულოს კედელი",
  },
  {
    id: "4",
    clientName: "მარიამ გელაშვილი",
    date: "10 მაისი",
    time: "11:00",
    address: "თბილისი, გლდანი",
    status: "completed",
    service: "ოთახის მოხატვა",
  },
  {
    id: "5",
    clientName: "ლუკა მელიქიძე",
    date: "8 მაისი",
    time: "15:00",
    address: "თბილისი, დიდუბე",
    status: "completed",
    service: "სარდაფის კედელი",
  },
];

export const isRealRequest = (booking: Booking) => Boolean(booking.id);

export const statusMeta: Record<
  BookingStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  pending: {
    label: "მოლოდინში",
    color: "#f59e0b",
    bg: "#fff7cc",
    border: "#f59e0b",
  },
  confirmed: {
    label: "დადასტურებული",
    color: "#2563eb",
    bg: "#dbeafe",
    border: "#2563eb",
  },
  en_route: {
    label: "გზაშია",
    color: "#7c3aed",
    bg: "#ede9fe",
    border: "#7c3aed",
  },
  started: {
    label: "დაიწყო",
    color: "#0891b2",
    bg: "#cffafe",
    border: "#0891b2",
  },
  worker_completed: {
    label: "დასრულდა ხელოსნის მიერ",
    color: "#0f766e",
    bg: "#ccfbf1",
    border: "#0f766e",
  },
  client_confirmed: {
    label: "დადასტურდა კლიენტის მიერ",
    color: "#16a34a",
    bg: "#dcfce7",
    border: "#16a34a",
  },
  closed: {
    label: "დახურული",
    color: "#17243a",
    bg: "#f1f5f9",
    border: "#dbe4ef",
  },
  declined: {
    label: "უარყოფილი",
    color: "#ef4444",
    bg: "#fee2e2",
    border: "#ef4444",
  },
  cancelled: {
    label: "გაუქმებული",
    color: "#ef4444",
    bg: "#fee2e2",
    border: "#ef4444",
  },
  disputed: {
    label: "დავა გახსნილია",
    color: "#c2410c",
    bg: "#ffedd5",
    border: "#fb923c",
  },
  completed: {
    label: "შესრულებული",
    color: "#17243a",
    bg: "#f1f5f9",
    border: "#dbe4ef",
  },
};

export const activeWorkStatuses: BookingStatus[] = [
  "pending",
  "confirmed",
  "en_route",
  "started",
  "worker_completed",
];
export const archivedWorkStatuses: BookingStatus[] = [
  "client_confirmed",
  "closed",
  "completed",
  "declined",
  "cancelled",
  "disputed",
];

export const getWorkStatusTone = (status: BookingStatus) => {
  if (status === "pending") {
    return { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" };
  }
  if (status === "declined" || status === "cancelled") {
    return { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" };
  }
  if (["client_confirmed", "closed", "completed"].includes(status)) {
    return { bg: "#ecfdf5", color: "#047857", border: "#bbf7d0" };
  }
  if (status === "disputed") {
    return { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" };
  }
  return { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" };
};

export const money = (value?: number | string, currency = "GEL") => {
  const amount = Number(value || 0);
  return `${amount.toFixed(amount % 1 ? 2 : 0)} ${currency}`;
};

export const parseSnapshotRecord = (snapshot: string): Record<string, unknown> => {
  try {
    const parsed: unknown = JSON.parse(snapshot);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
};

export const getWorkerPaymentMeta = (booking: Booking, fallbackBookingFee: number) => {
  const status = booking.paymentStatus || "held";
  const amount = booking.bookingFee || fallbackBookingFee;
  if (status === "released") {
    return {
      label: "თანხა დადასტურდა",
      detail: `დაჯავშნის საფასური ${money(amount, booking.paymentCurrency)} დახურულია.`,
      color: "#047857",
      bg: "#ecfdf5",
      border: "#bbf7d0",
    };
  }
  if (status === "refunded") {
    return {
      label: "თანხა დაბრუნდა",
      detail: "ჯავშნის საფასური კლიენტს დაუბრუნდა.",
      color: "#b91c1c",
      bg: "#fef2f2",
      border: "#fecaca",
    };
  }
  if (status === "disputed" || booking.status === "disputed" || booking.disputeReason) {
    return {
      label: "თანხა შეჩერებულია",
      detail: "დავა/პრობლემა განხილვაშია და თანხა დროებით არ ირიცხება.",
      color: "#c2410c",
      bg: "#fff7ed",
      border: "#fed7aa",
    };
  }
  if (booking.status === "client_confirmed" || booking.status === "closed") {
    return {
      label: "გადამოწმება",
      detail: "კლიენტმა შესრულება დაადასტურა. თანხა გადამოწმების შემდეგ დაიხურება.",
      color: "#1d4ed8",
      bg: "#eff6ff",
      border: "#bfdbfe",
    };
  }
  return {
    label: "ჯავშნის თანხა",
    detail: "კლიენტის ჯავშანი აქტიურია. თანხის საბოლოო დადასტურებას სისტემა მართავს.",
    color: "#1d4ed8",
    bg: "#eff6ff",
    border: "#bfdbfe",
  };
};

export const getWorkerDisputeMeta = (booking: Booking) => {
  if (booking.disputeStatus === "resolved") {
    if (booking.disputeResolution === "refund_client") {
      return {
        label: "დავა დაიხურა",
        detail: "Admin-ის გადაწყვეტილებით თანხა კლიენტს დაუბრუნდა.",
        color: "#b91c1c",
        bg: "#fef2f2",
        border: "#fecaca",
      };
    }
    if (booking.disputeResolution === "release_worker") {
      return {
        label: "დავა დაიხურა",
        detail: "Admin-ის გადაწყვეტილებით თანხა ხელოსნის მხარეს დადასტურდა.",
        color: "#047857",
        bg: "#ecfdf5",
        border: "#bbf7d0",
      };
    }
    return {
      label: "დავა დაიხურა",
      detail: "Admin-მა საკითხი გაფრთხილებით დახურა.",
      color: "#047857",
      bg: "#ecfdf5",
      border: "#bbf7d0",
    };
  }
  if (booking.disputeStatus === "reviewing") {
    return {
      label: "დავა განხილვაშია",
      detail: "Admin ამოწმებს კლიენტის აღწერას, ფოტოებს და მიმოწერას. პირველ პასუხს მაქსიმუმ 48 საათში მიიღებ.",
      color: "#c2410c",
      bg: "#fff7ed",
      border: "#fed7aa",
    };
  }
  return {
    label: "დავა გახსნილია",
    detail: "პრობლემა მიღებულია. Admin მას 48 საათში გადაიყვანს განხილვაში ან მოგწერს დამატებით დეტალებს.",
    color: "#b45309",
    bg: "#fffbeb",
    border: "#fde68a",
  };
};
