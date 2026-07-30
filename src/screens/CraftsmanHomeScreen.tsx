import React, { useEffect, useMemo, useRef, useState } from "react";
import { BookingStatus, Screen, User } from "../types";
import { categories, georgiaCities } from "../data/workers";
import { dataService, isDemoDataMode } from "../services/dataService";
import {
  loadCurrentWorkerProfile,
  saveWorkerBankAccount,
  saveCurrentWorkerProfile,
  WorkerProfileApiResult,
  uploadProfilePhoto,
  uploadVerificationDocument,
} from "../services/profileApiService";
import {
  loadWorkerBookings,
  updateBookingStatus,
} from "../services/bookingApiService";
import {
  AppNotification,
  loadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notificationApiService";
import {
  loadReviewedBookingIds,
  submitBookingReview,
} from "../services/reviewApiService";
import {
  clientReviewSchema,
  craftsmanProfileSchema,
  getValidationMessage,
} from "../services/validation";

interface Booking {
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

interface ClientRating {
  communication: number;
  timeManagement: number;
  clarity: number;
}

interface CraftsmanHomeScreenProps {
  user: User;
  activeScreen: Screen;
  onLogout: () => void;
  accountStatus?: "active" | "limited" | "blocked";
  workerVerified?: boolean;
  onProfileUpdated?: (profile: {
    firstName?: string;
    lastName?: string;
    photoUrl?: string | null;
  }) => void;
}

const DAYS = ["ორშ", "სამ", "ოთხ", "ხუთ", "პარ", "შაბ", "კვ"];
const DAY_TO_WEEKDAY: Record<string, number> = {
  ორშ: 1,
  სამ: 2,
  ოთხ: 3,
  ხუთ: 4,
  პარ: 5,
  შაბ: 6,
  კვ: 7,
};
const WEEKDAY_TO_DAY: Record<number, string> = {
  1: "ორშ",
  2: "სამ",
  3: "ოთხ",
  4: "ხუთ",
  5: "პარ",
  6: "შაბ",
  7: "კვ",
};

const isBlankDetail = (value?: string) => {
  const normalized = String(value || "").trim().toLowerCase();
  return !normalized || normalized === "unknown" || normalized === "null";
};

const formatDetailValue = (value?: string, unit = "") => {
  if (isBlankDetail(value)) return "არ არის";
  return unit ? `${String(value).trim()} ${unit}` : String(value).trim();
};

const formatMaterialOwner = (value?: string) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized || normalized === "unknown") return "";
  if (normalized === "client") return "კლიენტის";
  if (normalized === "worker") return "ხელოსნის";
  return value || "";
};

const PROFESSION_OPTIONS = categories
  .filter((category) => category !== "all")
  .sort((a, b) => a.localeCompare(b, "ka"));
const PROFILE_SECTIONS = [
  { id: "edit", label: "რედაქტირება" },
  { id: "professions", label: "პროფესია" },
  { id: "schedule", label: "სამუშაო დრო" },
  { id: "verification", label: "ვერიფიკაცია" },
] as const;
const HOURS = [
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

const readCraftsmanProfile = () => {
  if (!isDemoDataMode) return {};
  return dataService.getCraftsmanProfile();
};

const parseStoredPrice = (price?: string) => {
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

const formatProfilePrice = (
  type: "fixed" | "from" | "range",
  min: number,
  max: number
) => {
  if (type === "fixed") return `${min} ლარი`;
  if (type === "from") return `${min} ლარიდან`;
  return `${min}-${max} ლარი`;
};

const formatNotificationDate = (value?: string) => {
  if (!value) return "";
  return new Date(value).toLocaleDateString("ka-GE", {
    day: "numeric",
    month: "short",
  });
};

const formatBookingDateTime = (booking: Booking) => {
  const scheduledAt = booking.scheduledAt;
  if (!scheduledAt) return `${booking.date} · ${booking.time}`;
  const date = new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) return `${booking.date} · ${booking.time}`;
  return `${date.toLocaleDateString("ka-GE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })} · ${date.toLocaleTimeString("ka-GE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })}`;
};

const monthNames = [
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

const formatWorkDateLabel = (date: Date) =>
  `${date.getDate()} ${monthNames[date.getMonth()]}`;

const initialBookings: Booking[] = [
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

const isRealRequest = (booking: Booking) =>
  Boolean(booking.id) && !/^კლიენტი(\s|$)/.test(booking.clientName || "");

const statusMeta: Record<
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

const activeWorkStatuses: BookingStatus[] = [
  "pending",
  "confirmed",
  "en_route",
  "started",
  "worker_completed",
];
const archivedWorkStatuses: BookingStatus[] = [
  "client_confirmed",
  "closed",
  "completed",
  "declined",
  "cancelled",
  "disputed",
];

const getWorkStatusTone = (status: BookingStatus) => {
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

const money = (value?: number | string, currency = "GEL") => {
  const amount = Number(value || 0);
  return `${amount.toFixed(amount % 1 ? 2 : 0)} ${currency}`;
};

const parseSnapshotRecord = (snapshot: string): Record<string, unknown> => {
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

const getWorkerPaymentMeta = (booking: Booking) => {
  const status = booking.paymentStatus || "held";
  const amount = booking.bookingFee || dataService.getPlatformSettings().bookingFee;
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

const getWorkerDisputeMeta = (booking: Booking) => {
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
      detail: "Admin ამოწმებს კლიენტის აღწერას, ფოტოებს და მიმოწერას.",
      color: "#c2410c",
      bg: "#fff7ed",
      border: "#fed7aa",
    };
  }
  return {
    label: "დავა გახსნილია",
    detail: "კლიენტმა პრობლემა გახსნა. თანხა დროებით შეჩერებულია.",
    color: "#b45309",
    bg: "#fffbeb",
    border: "#fde68a",
  };
};

export const CraftsmanHomeScreen: React.FC<CraftsmanHomeScreenProps> = ({
  user,
  activeScreen,
  onLogout,
  accountStatus = "active",
  workerVerified = false,
  onProfileUpdated,
}) => {
  const [demoMode, setDemoMode] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>(() => {
    return isDemoDataMode
      ? (dataService.pruneDemoCraftsmanRequests() as Booking[])
      : [];
  });
  const [profilePhoto, setProfilePhoto] = useState<string | null>(() => {
    if (!isDemoDataMode) return null;
    const profile = readCraftsmanProfile();
    return typeof profile.avatar === "string" &&
        profile.avatar.startsWith("data:image/")
        ? profile.avatar
        : null;
  });
  const [firstName, setFirstName] = useState(() => {
    if (!isDemoDataMode) return "";
    const [storedFirst] = (readCraftsmanProfile().name || "").trim().split(/\s+/);
    return storedFirst || "გიორგი";
  });
  const [lastName, setLastName] = useState(() => {
    if (!isDemoDataMode) return "";
    const [, ...storedLastParts] = (readCraftsmanProfile().name || "")
      .trim()
      .split(/\s+/);
    return storedLastParts.join(" ") || "კურტანიძე";
  });
  const [profileCity, setProfileCity] = useState(() => {
    if (!isDemoDataMode) return "თბილისი";
    return readCraftsmanProfile().city || "თბილისი";
  });
  const [workDays, setWorkDays] = useState<string[]>([
    "ორშ",
    "სამ",
    "ოთხ",
    "ხუთ",
    "პარ",
  ]);
  const [workStart, setWorkStart] = useState("09:00");
  const [workEnd, setWorkEnd] = useState("18:00");
  const [unavailableStart, setUnavailableStart] = useState("");
  const [unavailableEnd, setUnavailableEnd] = useState("");
  const [unavailableRanges, setUnavailableRanges] = useState<
    Array<{ start: string; end: string }>
  >(() =>
    isDemoDataMode ? dataService.getCraftsmanUnavailableRanges() : []
  );
  const [saved, setSaved] = useState(false);
  const [workFilter, setWorkFilter] = useState<
    "all" | "today" | "pending" | "confirmed" | "completed"
  >("all");
  const [workView, setWorkView] = useState<"active" | "archive">("active");
  const [workQuery, setWorkQuery] = useState("");
  const [rating, setRating] = useState(() => {
    if (!isDemoDataMode) return { value: 0, count: 0 };
    const stored = dataService.getWorkerRating(999);
    const profile = readCraftsmanProfile();
    return {
      value: stored?.value ?? profile.rating ?? 5,
      count: stored?.count ?? profile.reviewCount ?? 0,
    };
  });
  const [completingBooking, setCompletingBooking] = useState<Booking | null>(
    null
  );
  const [detailsBooking, setDetailsBooking] = useState<Booking | null>(null);
  const [showClientRating, setShowClientRating] = useState(false);
  const [clientRating, setClientRating] = useState<ClientRating>({
    communication: 0,
    timeManagement: 0,
    clarity: 0,
  });
  const [reviewedClientBookingIds, setReviewedClientBookingIds] = useState<
    string[]
  >(() => []);
  const [reviewError, setReviewError] = useState("");
  const [profileSection, setProfileSection] =
    useState<(typeof PROFILE_SECTIONS)[number]["id"]>("edit");
  const [profilePhone, setProfilePhone] = useState(() =>
    readCraftsmanProfile().phone?.replace(/^\+995\s*/, "") ||
    (user.phone.includes("@") ? "" : user.phone)
  );
  const [experienceYears, setExperienceYears] = useState(() => {
    if (!isDemoDataMode) return "0";
    return String(readCraftsmanProfile().experienceYears || 0);
  });
  const [extraWorkComment, setExtraWorkComment] = useState(() => {
    if (!isDemoDataMode) return "";
    const profile = readCraftsmanProfile();
    return typeof profile.extraWorkComment === "string"
      ? profile.extraWorkComment
      : "";
  });
  const [professions, setProfessions] = useState<string[]>(() => {
    if (!isDemoDataMode) return ["მალიარი"];
    const profile = readCraftsmanProfile();
    if (Array.isArray(profile.professions) && profile.professions.length) {
      return profile.professions;
    }
    if (typeof profile.role === "string" && profile.role) {
      return [profile.role];
    }
    return ["მალიარი"];
  });
  const initialPrice = isDemoDataMode
    ? parseStoredPrice(readCraftsmanProfile().price)
    : { type: "range" as const, min: 80, max: 120 };
  const [priceType, setPriceType] = useState<"fixed" | "from" | "range">(
    initialPrice.type
  );
  const [priceMin, setPriceMin] = useState(String(initialPrice.min));
  const [priceMax, setPriceMax] = useState(String(initialPrice.max || 120));
  const [verification, setVerification] = useState(() => {
    if (!isDemoDataMode) {
      return {
        idFront: false,
        idBack: false,
        bankAccount: false,
      };
    }
    const profile = readCraftsmanProfile();
    return {
      idFront: Boolean(profile.verification?.idFront),
      idBack: Boolean(profile.verification?.idBack),
      bankAccount: Boolean(profile.verification?.bankAccount),
    };
  });
  const [verificationDocuments, setVerificationDocuments] = useState(() => {
    if (!isDemoDataMode) return {};
    return readCraftsmanProfile().verificationDocuments || {};
  });
  const [bankAccountText, setBankAccountText] = useState(() => {
    if (!isDemoDataMode) return "";
    return readCraftsmanProfile().verificationDocuments?.bankAccount || "";
  });
  const [verificationStatus, setVerificationStatus] = useState(() => {
    if (!isDemoDataMode) return "not_submitted";
    return readCraftsmanProfile().verificationStatus || "not_submitted";
  });
  const [subscriptionInfo, setSubscriptionInfo] = useState<{
    status: "trial" | "active" | "past_due" | "cancelled";
    trialStartedAt: string;
    trialEndsAt: string;
    monthlyAmount: number;
  }>(() => {
    const trialStartedAt = isDemoDataMode
      ? dataService.getCraftsmanTrialStart()
      : new Date().toISOString();
    const trialEndsAt = new Date(
      new Date(trialStartedAt).getTime() + 30 * 86400000
    ).toISOString();
    return {
      status: "trial",
      trialStartedAt,
      trialEndsAt,
      monthlyAmount: 39,
    };
  });
  const [profileUploadError, setProfileUploadError] = useState("");
  const [profileSaveError, setProfileSaveError] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileUploading, setProfileUploading] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationError, setNotificationError] = useState("");
  const [bookingActionError, setBookingActionError] = useState("");
  const [bookingActionId, setBookingActionId] = useState<string | null>(null);
  const [verificationUploadError, setVerificationUploadError] = useState("");
  const [uploadingVerification, setUploadingVerification] = useState<
    keyof typeof verification | null
  >(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fullName =
    `${firstName.trim()} ${lastName.trim()}`.trim() || "სახელი გვარი";
  const normalizedProfilePhone = profilePhone.replace(/\D/g, "");
  const profileContactLabel = normalizedProfilePhone
    ? `+995 ${normalizedProfilePhone}`
    : user.phone.includes("@")
      ? user.phone
      : "ნომერი დასამატებელია";
  const mainProfession = professions[0] || "მალიარი";
  const professionText = professions.join(" · ");
  const normalizedPriceMin = Number(priceMin) || 0;
  const normalizedPriceMax = Number(priceMax) || normalizedPriceMin;
  const normalizedExperienceYears = Math.max(0, Number(experienceYears) || 0);
  const priceValidationError =
    normalizedPriceMin <= 0
      ? "საფასურში მინიმუმ 1 ლარი მიუთითე."
      : priceType === "range" && normalizedPriceMax < normalizedPriceMin
        ? "მაქსიმუმი მინიმუმზე ნაკლები ვერ იქნება."
        : "";
  const profilePrice = formatProfilePrice(
    priceType,
    normalizedPriceMin || 80,
    normalizedPriceMax || 120
  );
  const profileSnapshot = JSON.stringify({
    firstName,
    lastName,
    profilePhone: normalizedProfilePhone,
    profilePhoto,
    profileCity,
    experienceYears: normalizedExperienceYears,
    extraWorkComment,
    professions,
    priceType,
    priceMin: normalizedPriceMin,
    priceMax: normalizedPriceMax,
    workDays,
    workStart,
    workEnd,
    unavailableRanges,
  });
  const [savedProfileSnapshot, setSavedProfileSnapshot] = useState(profileSnapshot);
  const profileChanged = profileSnapshot !== savedProfileSnapshot;
  const hasAllVerificationDocuments = Object.values(verification).every(Boolean);
  const isVerified = workerVerified || verificationStatus === "verified";
  const verificationItems = [
    {
      key: "idFront" as const,
      title: "პირადობის წინა მხარე",
      desc: "ატვირთეთ პირადობის პირველი გვერდი",
    },
    {
      key: "idBack" as const,
      title: "პირადობის უკანა მხარე",
      desc: "ატვირთეთ პირადობის მეორე გვერდი",
    },
    {
      key: "bankAccount" as const,
      title: "ანგარიში ჩარიცხვისთვის",
      desc: "ატვირთეთ ანგარიში/IBAN, სადაც თანხა დაგერიცხებათ",
    },
  ];
  const verifiedDocumentCount = verificationItems.filter(
    (item) => verification[item.key]
  ).length;
  const missingVerificationDocuments = verificationItems
    .filter((item) => !verification[item.key])
    .map((item) => item.title);
  const verificationStatusText =
    verificationStatus === "verified"
      ? "ვერიფიცირებული"
      : verificationStatus === "rejected"
        ? "ვერიფიკაცია უარყოფილია"
      : hasAllVerificationDocuments
        ? "შესამოწმებელია"
        : "ვერიფიკაცია დასასრულებელია";
  const verificationStatusDescription =
    verificationStatus === "verified"
      ? "Admin-მა დოკუმენტები დაადასტურა."
      : verificationStatus === "rejected"
        ? readCraftsmanProfile().verificationNote ||
          "Admin-მა დოკუმენტები უარყო. ატვირთე განახლებული დოკუმენტები და დაელოდე შემოწმებას."
      : hasAllVerificationDocuments
        ? "დოკუმენტები ატვირთულია და Admin-ის შემოწმებას ელოდება."
        : `აკლია: ${missingVerificationDocuments.join(", ")}`;
  const trialDaysLeft = Math.max(
    0,
    Math.ceil(
      (new Date(subscriptionInfo.trialEndsAt).getTime() - Date.now()) / 86400000
    )
  );
  const subscriptionActive =
    subscriptionInfo.status === "trial" || subscriptionInfo.status === "active";
  const subscriptionStatusText =
    subscriptionInfo.status === "active"
      ? "პაკეტი აქტიურია"
      : subscriptionInfo.status === "trial"
        ? "უფასო პერიოდი აქტიურია"
        : subscriptionInfo.status === "past_due"
          ? "გადახდა საჭიროა"
          : "პაკეტი გაუქმებულია";

  useEffect(() => {
    if (!isDemoDataMode) return;
    const nextRating = dataService.getWorkerRating(999);
    if (nextRating) {
      setRating(nextRating);
    }
  }, []);

  useEffect(() => {
    if (!isDemoDataMode) return;
    const storedProfile = readCraftsmanProfile();
    dataService.saveCraftsmanProfile({
        ...storedProfile,
        name: fullName,
        phone: `+995 ${normalizedProfilePhone}`,
        avatar: profilePhoto || "გკ",
        avatarColor: "#17243a",
        rating: rating.value,
        reviewCount: rating.count,
        city: profileCity,
        role: mainProfession,
        experienceYears: normalizedExperienceYears,
        professions,
        extraWorkComment,
        verification,
        verificationDocuments,
        verificationStatus: hasAllVerificationDocuments
          ? verificationStatus
          : "not_submitted",
        price: profilePrice,
      });
    dataService.rememberPhone("craftsman", normalizedProfilePhone);
  }, [
    extraWorkComment,
    fullName,
    mainProfession,
    normalizedExperienceYears,
    normalizedProfilePhone,
    profilePhoto,
    profilePrice,
    profileCity,
    professions,
    rating.count,
    rating.value,
    verification,
    verificationDocuments,
    verificationStatus,
    hasAllVerificationDocuments,
  ]);

  useEffect(() => {
    if (isDemoDataMode) return;

    let cancelled = false;
    const controller = new AbortController();
    loadCurrentWorkerProfile(controller.signal)
      .then((profile) => {
        if (cancelled || !profile) return;
        const [displayFirst = "", ...displayLastParts] = (
          profile.display_name || ""
        )
          .trim()
          .split(/\s+/);
        const nextFirstName = profile.first_name || displayFirst;
        const nextLastName = profile.last_name || displayLastParts.join(" ");
        const nextPhone = profile.contact_phone || "";
        if (nextFirstName) setFirstName(nextFirstName);
        if (nextLastName) setLastName(nextLastName);
        setProfilePhone(nextPhone);
        setProfilePhoto(profile.photo_url || null);
        setProfileCity(profile.city || "თბილისი");
        setExtraWorkComment(profile.about || "");
        const documents = profile.verification_documents || {};
        setVerificationDocuments({
          idFront: documents.id_front || undefined,
          idBack: documents.id_back || undefined,
          bankAccount: documents.bank_account || undefined,
        });
        setBankAccountText(documents.bank_account || "");
        setVerification({
          idFront: Boolean(documents.id_front),
          idBack: Boolean(documents.id_back),
          bankAccount: Boolean(documents.bank_account),
        });
        setVerificationStatus(
          profile.verification_status === "not_started"
            ? "not_submitted"
            : profile.verification_status || "not_submitted"
        );
        if (profile.professions?.length) setProfessions(profile.professions);
        if (profile.price_type) setPriceType(profile.price_type);
        setPriceMin(profile.price_min != null ? String(Number(profile.price_min)) : "");
        setPriceMax(profile.price_max != null ? String(Number(profile.price_max)) : "");
        if (profile.experience_years != null) {
          setExperienceYears(String(Number(profile.experience_years)));
        }
        const trialStartedAt =
          profile.trial_started_at || new Date().toISOString();
        const trialEndsAt =
          profile.subscription?.trial_ends_at ||
          new Date(
            new Date(trialStartedAt).getTime() + 30 * 86400000
          ).toISOString();
        setSubscriptionInfo({
          status:
            profile.subscription?.status ||
            profile.subscription_status ||
            "trial",
          trialStartedAt,
          trialEndsAt,
          monthlyAmount: Number(profile.subscription?.amount || 39),
        });
        if (profile.schedule?.length) {
          const firstSchedule = profile.schedule[0];
          setWorkDays(
            profile.schedule
              .map((item) => WEEKDAY_TO_DAY[item.weekday])
              .filter(Boolean)
          );
          setWorkStart(firstSchedule.start_time.slice(0, 5));
          setWorkEnd(firstSchedule.end_time.slice(0, 5));
        }
        if (profile.unavailable_ranges) {
          setUnavailableRanges(profile.unavailable_ranges);
        }
        setSavedProfileSnapshot(
          JSON.stringify({
            firstName: nextFirstName,
            lastName: nextLastName,
            profilePhone: nextPhone,
            profilePhoto: profile.photo_url || null,
            profileCity: profile.city || "თბილისი",
            experienceYears: Math.max(0, Number(profile.experience_years) || 0),
            extraWorkComment: profile.about || "",
            professions: profile.professions?.length ? profile.professions : professions,
            priceType: profile.price_type || priceType,
            priceMin:
              profile.price_min != null ? Number(profile.price_min) : normalizedPriceMin,
            priceMax:
              profile.price_max != null ? Number(profile.price_max) : normalizedPriceMax,
            workDays,
            workStart,
            workEnd,
            unavailableRanges: profile.unavailable_ranges || unavailableRanges,
          })
        );
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error(error);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!isDemoDataMode) return;
    const refreshDemoBookings = () => {
      const requests = dataService.getRealCraftsmanRequests() as Booking[];
      setBookings((prev) => {
        const known = new Set(prev.map((booking) => booking.id));
        const fresh = requests.filter(
          (booking) => isRealRequest(booking) && !known.has(booking.id)
        );
        return fresh.length ? [...fresh, ...prev] : prev;
      });
    };

    refreshDemoBookings();
    window.addEventListener("craftsman-notifications-updated", refreshDemoBookings);
    window.addEventListener("booking-status-updated", refreshDemoBookings);

    return () => {
      window.removeEventListener("craftsman-notifications-updated", refreshDemoBookings);
      window.removeEventListener("booking-status-updated", refreshDemoBookings);
    };
  }, []);

  useEffect(() => {
    if (isDemoDataMode) return;

    let cancelled = false;
    loadReviewedBookingIds("client")
      .then((ids) => {
        if (!cancelled) {
          setReviewedClientBookingIds(ids);
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
  }, []);

  const refreshCraftsmanNotifications = () => {
    if (isDemoDataMode) {
      setNotifications(dataService.getCraftsmanNotifications() as AppNotification[]);
      setNotificationError("");
      return;
    }

    loadNotifications(10)
      .then((nextNotifications) => {
        setNotifications(nextNotifications);
        setNotificationError("");
      })
      .catch((error) => {
        setNotificationError(
          error instanceof Error
            ? error.message
            : "ნოტიფიკაციების ჩატვირთვა ვერ მოხერხდა"
        );
      });
  };

  useEffect(() => {
    let cancelled = false;
    let activeController: AbortController | null = null;
    const refresh = () => {
      if (cancelled) return;
      if (isDemoDataMode) {
        refreshCraftsmanNotifications();
        return;
      }
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;
      loadNotifications(10, controller.signal)
        .then((nextNotifications) => {
          if (cancelled) return;
          setNotifications(nextNotifications);
          setNotificationError("");
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
    window.addEventListener("craftsman-notifications-updated", refresh);
    window.addEventListener("booking-status-updated", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshOnFocus);

    return () => {
      cancelled = true;
      activeController?.abort();
      window.clearInterval(intervalId);
      window.removeEventListener("craftsman-notifications-updated", refresh);
      window.removeEventListener("booking-status-updated", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, []);

  const markCraftsmanNotificationRead = (notificationId: string) => {
    if (isDemoDataMode) {
      setNotifications((prev) => {
        const next = prev.map((notification) =>
          notification.id === notificationId
            ? { ...notification, readAt: new Date().toISOString() }
            : notification
        );
        dataService.saveCraftsmanNotifications(next);
        return next;
      });
      return;
    }
    markNotificationRead(notificationId)
      .then(() => {
        setNotifications((prev) =>
          prev.map((notification) =>
            notification.id === notificationId
              ? { ...notification, readAt: new Date().toISOString() }
              : notification
          )
        );
      })
      .catch((error) => {
        setNotificationError(
          error instanceof Error
            ? error.message
            : "ნოტიფიკაციის განახლება ვერ მოხერხდა"
        );
      });
  };

  const markEveryCraftsmanNotificationRead = async () => {
    if (isDemoDataMode) {
      setNotifications((prev) => {
        const next = prev.map((notification) => ({
          ...notification,
          readAt: notification.readAt || new Date().toISOString(),
        }));
        dataService.saveCraftsmanNotifications(next);
        return next;
      });
      return;
    }
    try {
      await markAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((notification) => ({
          ...notification,
          readAt: notification.readAt || new Date().toISOString(),
        }))
      );
    } catch (error) {
      setNotificationError(
        error instanceof Error
          ? error.message
          : "ნოტიფიკაციების განახლება ვერ მოხერხდა"
      );
    }
  };

  const openCraftsmanNotification = (notification: AppNotification) => {
    if (!notification.readAt) markCraftsmanNotificationRead(notification.id);
    if (!notification.bookingId) return;
    const linkedBooking = bookings.find(
      (booking) => booking.id === notification.bookingId
    );
    if (linkedBooking) setDetailsBooking(linkedBooking);
  };

  useEffect(() => {
    if (isDemoDataMode) return;

    let cancelled = false;
    let activeController: AbortController | null = null;
    const refreshApiWorkerBookings = () => {
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;
      loadWorkerBookings(controller.signal)
        .then((nextBookings) => {
          if (!cancelled) setBookings(nextBookings as Booking[]);
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          console.error(error);
        });
    };
    const refreshOnFocus = () => {
      if (document.visibilityState === "visible") refreshApiWorkerBookings();
    };

    refreshApiWorkerBookings();
    const intervalId = window.setInterval(refreshApiWorkerBookings, 15000);
    window.addEventListener("booking-status-updated", refreshApiWorkerBookings);
    window.addEventListener("focus", refreshApiWorkerBookings);
    document.addEventListener("visibilitychange", refreshOnFocus);

    return () => {
      cancelled = true;
      activeController?.abort();
      window.clearInterval(intervalId);
      window.removeEventListener("booking-status-updated", refreshApiWorkerBookings);
      window.removeEventListener("focus", refreshApiWorkerBookings);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, []);

  const reloadWorkerBookings = async () => {
    if (isDemoDataMode) return;
    const nextBookings = await loadWorkerBookings();
    setBookings(nextBookings as Booking[]);
  };

  const displayedBookings = demoMode
    ? [...bookings, ...initialBookings]
    : bookings;

  const pending = displayedBookings.filter((b) => b.status === "pending");
  const confirmed = displayedBookings.filter((b) =>
    ["confirmed", "en_route", "started", "worker_completed"].includes(b.status)
  );
  const completed = displayedBookings.filter((b) =>
    archivedWorkStatuses.includes(b.status)
  );
  const activeWorks = useMemo(
    () =>
      displayedBookings.filter(
        (booking) => !archivedWorkStatuses.includes(booking.status)
      ),
    [displayedBookings]
  );
  const archivedWorks = useMemo(
    () =>
      displayedBookings.filter((booking) =>
        archivedWorkStatuses.includes(booking.status)
      ),
    [displayedBookings]
  );

  const visibleWorks = useMemo(() => {
    const q = workQuery.trim().toLowerCase();
    const source = workView === "active" ? activeWorks : archivedWorks;
    const todayLabel = formatWorkDateLabel(new Date());
    const byFilter =
      workFilter === "all"
        ? source
        : workFilter === "today"
          ? source.filter((b) => b.date === todayLabel)
          : workFilter === "confirmed"
            ? source.filter((b) =>
                ["confirmed", "en_route", "started", "worker_completed"].includes(
                  b.status
                )
              )
            : workFilter === "completed"
              ? source.filter((b) =>
                  archivedWorkStatuses.includes(b.status)
                )
              : source.filter((b) => b.status === workFilter);

    const filtered = q
      ? byFilter.filter((booking) =>
          [
            booking.clientName,
            booking.service,
            booking.address,
            booking.date,
            booking.time,
          ]
            .join(" ")
            .toLowerCase()
            .includes(q)
        )
      : byFilter;

    return [...filtered].sort((a, b) => {
      const aArchived = archivedWorkStatuses.includes(a.status);
      const bArchived = archivedWorkStatuses.includes(b.status);
      if (aArchived !== bArchived) return Number(aArchived) - Number(bArchived);
      const aOrder = activeWorkStatuses.indexOf(a.status);
      const bOrder = activeWorkStatuses.indexOf(b.status);
      return (aOrder === -1 ? 99 : aOrder) - (bOrder === -1 ? 99 : bOrder);
    });
  }, [activeWorks, archivedWorks, workFilter, workQuery, workView]);

  const updateStatus = async (id: string, status: BookingStatus) => {
    if (accountStatus !== "active") {
      setBookingActionError(
        "ანგარიში შეზღუდულია. ჯავშნის სტატუსის შეცვლა დროებით შეუძლებელია."
      );
      return;
    }
    const target = bookings.find((booking) => booking.id === id);
    setBookingActionError("");

    if (!isDemoDataMode) {
      if (status === "completed") return;
      setBookingActionId(id);
      try {
        await updateBookingStatus(id, status);
        await reloadWorkerBookings();
        refreshCraftsmanNotifications();
        window.dispatchEvent(
          new CustomEvent("booking-status-updated", {
            detail: { bookingId: id, status, target: "craftsman" },
          })
        );
        setDetailsBooking((current) =>
          current?.id === id ? { ...current, status } : current
        );
        if (status === "confirmed" || status === "declined") {
          setDetailsBooking(null);
        }
      } catch (error) {
        setBookingActionError(
          error instanceof Error
            ? error.message
            : "ჯავშნის სტატუსის შეცვლა ვერ მოხერხდა"
        );
      } finally {
        setBookingActionId(null);
      }
      return;
    }

    setBookings((prev) =>
      prev.map((booking) =>
        booking.id === id ? { ...booking, status } : booking
      )
    );
    persistBookingStatus(id, status);
    if (isDemoDataMode) {
      dataService.updateClientBooking(id, (booking) => ({ ...booking, status }));
    }
    if (target && status === "confirmed") {
      if (isDemoDataMode) {
        dataService.prependClientNotification({
          id: `${id}-confirmed-${Date.now()}`,
          text: `ხელოსანმა დაადასტურა ჯავშანი: ${target.service}`,
          type: "confirmed",
          bookingId: id,
        });
      }
    }
    if (target && ["en_route", "started", "worker_completed"].includes(status)) {
      const text =
        status === "en_route"
          ? `ხელოსანი გზაშია: ${target.service}`
          : status === "started"
            ? `სამუშაო დაიწყო: ${target.service}`
            : `ხელოსანმა სამუშაო დასრულებულად მონიშნა: ${target.service}. დაადასტურეთ და შეაფასეთ.`;
      if (isDemoDataMode) {
        dataService.prependClientNotification({
          id: `${id}-${status}-${Date.now()}`,
          text,
          type: status === "worker_completed" ? "review" : "confirmed",
          bookingId: id,
        });
      }
    }
    if (target && status === "declined") {
      if (isDemoDataMode) {
        const text = `ხელოსანმა ვიზიტი გააუქმა: ${target.service}. შეგიძლიათ შეაფასოთ გამოცდილება.`;
        dataService.prependClientNotification({
          id: `${id}-declined-review-${Date.now()}`,
          text,
          type: "review",
          bookingId: id,
        });
      }
    }
    setDetailsBooking(null);
  };

  const askCompleteBooking = (booking: Booking) => {
    setCompletingBooking(booking);
    setShowClientRating(false);
    setReviewError("");
    setClientRating({ communication: 0, timeManagement: 0, clarity: 0 });
  };

  const completeBooking = async () => {
    if (!completingBooking) return;
    const validation = clientReviewSchema.safeParse(clientRating);
    if (!validation.success) {
      setReviewError(getValidationMessage(validation.error, "კლიენტის შეფასება სრულად შეავსეთ"));
      return;
    }
    const target = completingBooking;
    if (!isDemoDataMode) {
      setBookingActionId(target.id);
      try {
        setReviewError("");
        await updateBookingStatus(target.id, "worker_completed");
        if (!reviewedClientBookingIds.includes(target.id)) {
          await submitBookingReview({
            bookingId: target.id,
            revieweeRole: "client",
            criteria: {
              communication: clientRating.communication,
              timeManagement: clientRating.timeManagement,
              clarity: clientRating.clarity,
            },
          });
          setReviewedClientBookingIds((prev) => [...prev, target.id]);
        }
        await reloadWorkerBookings();
      } catch (error) {
        setReviewError(
          error instanceof Error
            ? error.message
            : "შეფასების შენახვა ვერ მოხერხდა"
        );
        return;
      } finally {
        setBookingActionId(null);
      }
    }
    setBookings((prev) =>
      prev.map((booking) =>
        booking.id === target.id
          ? { ...booking, status: "worker_completed" }
          : booking
      )
    );
    if (isDemoDataMode) {
      const overall =
        (clientRating.communication +
          clientRating.timeManagement +
          clientRating.clarity) /
        3;
      const clientKey = target.clientPhone || target.clientName;
      dataService.addClientRating(clientKey, overall);
      dataService.prependClientReview({
        bookingId: target.id,
        clientPhone: clientKey,
        clientName: target.clientName,
        overall,
        criteria: clientRating,
      });
      persistBookingStatus(target.id, "worker_completed");
      dataService.updateClientBooking(target.id, (booking) => ({
        ...booking,
        status: "worker_completed",
      }));
      dataService.prependClientNotification({
        id: `${target.id}-review-${Date.now()}`,
        text: `საქმე დასრულდა. შეაფასე ${target.service} და მიიღე ქულები.`,
        type: "review",
        bookingId: target.id,
      });
    }
    setCompletingBooking(null);
    setShowClientRating(false);
  };

  const toggleDay = (day: string) => {
    setWorkDays((prev) =>
      prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day]
    );
  };

  const toggleProfession = (profession: string) => {
    setProfessions((prev) => {
      if (prev.includes(profession)) {
        const next = prev.filter((item) => item !== profession);
        return next.length ? next : prev;
      }
      return [...prev, profession];
    });
  };

  const handleSave = async () => {
    setProfileSaveError("");

    const validation = craftsmanProfileSchema.safeParse({
      firstName,
      lastName,
      contactPhone: normalizedProfilePhone,
      city: profileCity,
      professions,
      experienceYears: normalizedExperienceYears,
      priceType,
      priceMin: normalizedPriceMin,
      priceMax: priceType === "range" ? normalizedPriceMax : null,
      workDays,
      workStart,
      workEnd,
    });

    if (!validation.success || priceValidationError) {
      setProfileSaveError(
        priceValidationError ||
          getValidationMessage(validation.success ? null : validation.error, "პროფილის მონაცემები გადაამოწმეთ")
      );
      return;
    }

    if (!isDemoDataMode) {
      setProfileSaving(true);
      try {
        const savedProfile = await saveCurrentWorkerProfile({
          firstName,
          lastName,
          contactPhone: normalizedProfilePhone,
          photoUrl: profilePhoto,
          city: profileCity,
          about: extraWorkComment,
          professions,
          experienceYears: normalizedExperienceYears,
          priceType,
          priceMin: normalizedPriceMin || null,
          priceMax: priceType === "range" ? normalizedPriceMax || null : null,
          schedule: workDays.map((day) => ({
            weekday: DAY_TO_WEEKDAY[day],
            startTime: workStart,
            endTime: workEnd,
          })),
          unavailableRanges,
        });
        if (savedProfile && typeof savedProfile === "object") {
          const profile = savedProfile as WorkerProfileApiResult;
          setProfilePhoto(profile?.photo_url || null);
          setProfileCity(profile?.city || profileCity || "თბილისი");
          setExtraWorkComment(profile?.about || "");
          setVerificationStatus(
            profile?.verification_status === "not_started"
              ? "not_submitted"
              : profile?.verification_status || verificationStatus
          );
        }
        onProfileUpdated?.({ firstName, lastName, photoUrl: profilePhoto });
        setSavedProfileSnapshot(profileSnapshot);
        setSaved(true);
      } catch (error) {
        setProfileSaveError(
          error instanceof Error
            ? error.message
            : "პროფილის შენახვა ვერ მოხერხდა"
        );
      } finally {
        setProfileSaving(false);
        window.setTimeout(() => setSaved(false), 1800);
      }
      return;
    }

    dataService.saveCraftsmanUnavailableRanges(unavailableRanges);
    setSavedProfileSnapshot(profileSnapshot);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const addUnavailableRange = () => {
    if (!unavailableStart || !unavailableEnd) return;
    const range =
      unavailableStart <= unavailableEnd
        ? { start: unavailableStart, end: unavailableEnd }
        : { start: unavailableEnd, end: unavailableStart };
    const next = [...unavailableRanges, range];
    setUnavailableRanges(next);
    if (isDemoDataMode) {
      dataService.saveCraftsmanUnavailableRanges(next);
    }
    setUnavailableStart("");
    setUnavailableEnd("");
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setProfileUploadError("");

    if (!isDemoDataMode) {
      setProfileUploading(true);
      try {
        const uploaded = await uploadProfilePhoto(file, "craftsman");
        setProfilePhoto(uploaded.publicUrl);
        await saveCurrentWorkerProfile({
          firstName,
          lastName,
          contactPhone: normalizedProfilePhone,
          photoUrl: uploaded.publicUrl,
          city: profileCity,
          about: extraWorkComment,
          professions,
          experienceYears: normalizedExperienceYears,
          priceType,
          priceMin: normalizedPriceMin || null,
          priceMax: priceType === "range" ? normalizedPriceMax || null : null,
          schedule: workDays.map((day) => ({
            weekday: DAY_TO_WEEKDAY[day],
            startTime: workStart,
            endTime: workEnd,
          })),
          unavailableRanges,
        });
        onProfileUpdated?.({ firstName, lastName, photoUrl: uploaded.publicUrl });
        setSavedProfileSnapshot(
          JSON.stringify({
            ...parseSnapshotRecord(profileSnapshot),
            profilePhoto: uploaded.publicUrl,
          })
        );
      } catch (error) {
        setProfileUploadError(
          error instanceof Error ? error.message : "ფოტოს ატვირთვა ვერ მოხერხდა"
        );
      } finally {
        setProfileUploading(false);
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setProfilePhoto(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleVerificationUpload = async (
    key: keyof typeof verification,
    file: File
  ) => {
    setVerificationUploadError("");

    if (!isDemoDataMode) {
      if (key === "bankAccount") return;
      const typeByKey: Record<"idFront" | "idBack", "id_front" | "id_back"> = {
        idFront: "id_front",
        idBack: "id_back",
      };

      setUploadingVerification(key);
      try {
        const uploaded = await uploadVerificationDocument(file, typeByKey[key]);
        setVerificationDocuments((prev) => ({
          ...prev,
          [key]: uploaded.path,
        }));
        setVerification((prev) => {
          const next = {
            ...prev,
            [key]: true,
          };
          if (Object.values(next).every(Boolean)) {
            setVerificationStatus("pending");
          }
          return next;
        });
      } catch (error) {
        setVerificationUploadError(
          error instanceof Error
            ? error.message
            : "დოკუმენტის ატვირთვა ვერ მოხერხდა"
        );
      } finally {
        setUploadingVerification(null);
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result : "";
      setVerificationDocuments((prev) => ({ ...prev, [key]: value }));
      setVerification((prev) => {
        const next = {
          ...prev,
          [key]: true,
        };
        if (Object.values(next).every(Boolean)) {
          setVerificationStatus("pending");
        }
        return next;
      });
    };
    reader.onerror = () => {
      setVerificationUploadError("დოკუმენტის წაკითხვა ვერ მოხერხდა.");
    };
    reader.readAsDataURL(file);
  };

  const handleBankAccountSave = async () => {
    const value = bankAccountText.trim();
    setVerificationUploadError("");
    if (!value) {
      setVerificationUploadError("ანგარიშის ნომერი/IBAN ჩაწერე.");
      return;
    }

    if (!isDemoDataMode) {
      setUploadingVerification("bankAccount");
      try {
        await saveWorkerBankAccount(value);
        setVerificationDocuments((prev) => ({ ...prev, bankAccount: value }));
        setVerification((prev) => {
          const next = { ...prev, bankAccount: true };
          if (Object.values(next).every(Boolean)) {
            setVerificationStatus("pending");
          }
          return next;
        });
      } catch (error) {
        setVerificationUploadError(
          error instanceof Error
            ? error.message
            : "ანგარიშის შენახვა ვერ მოხერხდა"
        );
      } finally {
        setUploadingVerification(null);
      }
      return;
    }

    setVerificationDocuments((prev) => ({ ...prev, bankAccount: value }));
    setVerification((prev) => {
      const next = { ...prev, bankAccount: true };
      if (Object.values(next).every(Boolean)) {
        setVerificationStatus("pending");
      }
      return next;
    });
  };

  const persistBookingStatus = (id: string, status: BookingStatus) => {
    if (isDemoDataMode) {
      dataService.updateCraftsmanRequestStatus(id, status);
      return;
    }
    if (status === "completed") return;
    updateBookingStatus(id, status).catch((error) => {
      console.error(error);
    });
  };

  const renderAvatar = (size = 64) => (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        background: "#eef3f9",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--primary)",
        fontSize: size > 80 ? 34 : 22,
        fontWeight: 900,
        flexShrink: 0,
      }}
    >
      {profilePhoto ? (
        <img
          src={profilePhoto}
          alt="ხელოსნის ფოტო"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        "ხ"
      )}
    </div>
  );

  const JobCard = ({ booking }: { booking: Booking }) => {
    const meta = statusMeta[booking.status];
    const tone = getWorkStatusTone(booking.status);
    const isArchived = archivedWorkStatuses.includes(booking.status);
    const actionLoading = bookingActionId === booking.id;
    const clientShortName = booking.clientName.replace(
      /^(\S+)\s+(\S).*/,
      "$1 $2."
    );
    const paymentMeta = getWorkerPaymentMeta(booking);
    const disputeMeta = getWorkerDisputeMeta(booking);

    return (
      <div
        className="fade-up"
        style={{
          background: "white",
          border: `1px solid ${tone.border}`,
          borderTop: `3px solid ${tone.color}`,
          borderRadius: 16,
          padding: 16,
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: "var(--text)" }}>
              {clientShortName}
            </div>
            <div style={{ marginTop: 3, fontSize: 13, color: "var(--text2)" }}>
              {booking.service}
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: meta.color }}>
              {formatBookingDateTime(booking)}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, color: "var(--text3)" }}>
          📍 {booking.address}
        </div>

        <div
          style={{
            display: "inline-flex",
            marginTop: 12,
            padding: "6px 11px",
            borderRadius: 999,
            background: tone.bg,
            color: tone.color,
            border: `1px solid ${tone.border}`,
            fontSize: 11,
            fontWeight: 900,
          }}
        >
          {meta.label}
        </div>

        <div
          style={{
            marginTop: 10,
            padding: 10,
            borderRadius: 12,
            background: paymentMeta.bg,
            border: `1px solid ${paymentMeta.border}`,
            color: paymentMeta.color,
            fontSize: 11,
            fontWeight: 850,
            lineHeight: 1.45,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 950 }}>{paymentMeta.label}</div>
          <div style={{ marginTop: 3 }}>{paymentMeta.detail}</div>
        </div>

        {booking.cancellationReason && (
          <div
            style={{
              marginTop: 10,
              padding: 10,
              borderRadius: 12,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              fontSize: 12,
              fontWeight: 850,
              lineHeight: 1.45,
            }}
          >
            გაუქმების მიზეზი: {booking.cancellationReason}
          </div>
        )}

        {booking.disputeReason && (
          <div
            style={{
              marginTop: 10,
              padding: 10,
              borderRadius: 12,
              background: disputeMeta.bg,
              border: `1px solid ${disputeMeta.border}`,
              color: disputeMeta.color,
              fontSize: 12,
              fontWeight: 850,
              lineHeight: 1.45,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 950 }}>{disputeMeta.label}</div>
            <div style={{ marginTop: 4 }}>{disputeMeta.detail}</div>
            <div style={{ marginTop: 7, fontWeight: 900 }}>
              მიზეზი: {booking.disputeReason}
            </div>
            {booking.disputeDetails && (
              <div style={{ marginTop: 5, color: "inherit", fontWeight: 750 }}>
                {booking.disputeDetails}
              </div>
            )}
          </div>
        )}

        {booking.status === "pending" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
            <button
              type="button"
              onClick={() => setDetailsBooking(booking)}
              style={{
                minHeight: 42,
                borderRadius: 10,
                background: "#f8fafc",
                color: "var(--text)",
                border: "1px solid var(--border)",
                fontSize: 13,
                fontWeight: 900,
              }}
            >
              დეტალები
            </button>
            <button
              type="button"
              onClick={() => updateStatus(booking.id, "confirmed")}
              disabled={actionLoading}
              style={{
                minHeight: 42,
                borderRadius: 10,
                background: actionLoading ? "#94a3b8" : "var(--primary)",
                color: "white",
                fontSize: 13,
                fontWeight: 900,
              }}
            >
              {actionLoading ? "იცვლება..." : "დადასტურება"}
            </button>
            <button
              type="button"
              onClick={() => updateStatus(booking.id, "declined")}
              disabled={actionLoading}
              style={{
                gridColumn: "1 / -1",
                minHeight: 40,
                borderRadius: 10,
                background: actionLoading ? "#f1f5f9" : "#fef2f2",
                color: "#b91c1c",
                border: "1px solid #fecaca",
                fontSize: 13,
                fontWeight: 900,
              }}
            >
              უარყოფა
            </button>
          </div>
        )}
        {booking.status === "confirmed" && (
          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              onClick={() => updateStatus(booking.id, "en_route")}
              disabled={actionLoading}
              style={{
                width: "100%",
                minHeight: 42,
                borderRadius: 10,
                background: actionLoading ? "#94a3b8" : "var(--primary)",
                color: "white",
                fontSize: 13,
                fontWeight: 900,
              }}
            >
              {actionLoading ? "იცვლება..." : "გზაში ვარ"}
            </button>
          </div>
        )}
        {booking.status === "en_route" && (
          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              onClick={() => updateStatus(booking.id, "started")}
              disabled={actionLoading}
              style={{
                width: "100%",
                minHeight: 42,
                borderRadius: 10,
                background: actionLoading ? "#94a3b8" : "#0891b2",
                color: "white",
                fontSize: 13,
                fontWeight: 900,
              }}
            >
              {actionLoading ? "იცვლება..." : "სამუშაო დაიწყო"}
            </button>
          </div>
        )}
        {booking.status === "started" && (
          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              onClick={() => askCompleteBooking(booking)}
              disabled={actionLoading}
              style={{
                width: "100%",
                minHeight: 42,
                borderRadius: 10,
                background: actionLoading ? "#94a3b8" : "#10b981",
                color: "white",
                fontSize: 13,
                fontWeight: 900,
              }}
            >
              ჩემი მხრიდან დასრულდა
            </button>
          </div>
        )}
        {isArchived && (
          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              onClick={() => setDetailsBooking(booking)}
              style={{
                width: "100%",
                minHeight: 40,
                borderRadius: 10,
                background: "#f8fafc",
                color: "var(--text)",
                border: "1px solid var(--border)",
                fontSize: 13,
                fontWeight: 900,
              }}
            >
              დეტალების ნახვა
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        padding: "30px 24px 96px",
        background: "var(--bg)",
      }}
    >
      {activeScreen === "home" && (
        <div className="fade-up">
          <div style={{ color: "var(--text2)", fontSize: 12, fontWeight: 800 }}>
            გამარჯობა
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginTop: 8,
              marginBottom: 22,
            }}
          >
            {renderAvatar(68)}
            <div>
              <h1
                style={{
                  margin: 0,
                  color: "var(--text)",
                  fontSize: 22,
                  lineHeight: 1.18,
                  fontWeight: 900,
                }}
              >
                {fullName}
              </h1>
              <p className="screen-subtitle">{professionText}</p>
              {isVerified && (
                <div
                  style={{
                    display: "inline-flex",
                    marginTop: 6,
                    padding: "5px 9px",
                    borderRadius: 999,
                    background: "#ecfdf5",
                    color: "#047857",
                    fontSize: 11,
                    fontWeight: 900,
                  }}
                >
                  ვერიფიცირებული
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  marginTop: 7,
                  color: "#f59e0b",
                  fontSize: 13,
                  fontWeight: 900,
                }}
              >
                <span>{"★".repeat(rating.value)}</span>
                <span style={{ color: "var(--text)", fontSize: 13 }}>
                  {rating.value.toFixed(1)}
                </span>
                <span style={{ color: "var(--text2)", fontSize: 12 }}>
                  ({rating.count})
                </span>
              </div>
            </div>
          </div>

          <div
            style={{
              marginBottom: 16,
              padding: 14,
              borderRadius: 16,
              background: subscriptionActive ? "#eff6ff" : "#fff7ed",
              border: `1px solid ${subscriptionActive ? "#bfdbfe" : "#fed7aa"}`,
              color: subscriptionActive ? "#1d4ed8" : "#c2410c",
              fontSize: 12,
              lineHeight: 1.55,
              fontWeight: 850,
            }}
          >
            {subscriptionInfo.status === "active"
              ? `პაკეტი აქტიურია. თვიური საფასური: ${subscriptionInfo.monthlyAmount} ლარი.`
              : subscriptionInfo.status === "trial"
                ? `${subscriptionStatusText}: დარჩა ${trialDaysLeft} დღე. შემდეგ პაკეტი იქნება ${subscriptionInfo.monthlyAmount} ლარი/თვე.`
                : `${subscriptionStatusText}. პაკეტის გასააქტიურებლად გადასახდელია ${subscriptionInfo.monthlyAmount} ლარი/თვე.`}
          </div>

          {bookingActionError && (
            <div
              style={{
                marginBottom: 16,
                padding: 12,
                borderRadius: 14,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                fontSize: 12,
                fontWeight: 850,
                lineHeight: 1.45,
              }}
            >
              {bookingActionError}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {[
              { value: pending.length, label: "მოლოდინში", color: "#f59e0b", bg: "#fff7cc" },
              { value: confirmed.length, label: "აქტიური", color: "#2563eb", bg: "#dbeafe" },
              { value: completed.length, label: "დახურული", color: "var(--text)", bg: "#f1f5f9" },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  minHeight: 88,
                  padding: "14px 8px",
                  borderRadius: 14,
                  background: item.bg,
                  border: `1px solid ${item.color}30`,
                  textAlign: "center",
                }}
              >
                <div style={{ color: item.color, fontSize: 24, fontWeight: 900 }}>
                  {item.value}
                </div>
                <div style={{ marginTop: 6, color: item.color, fontSize: 10, fontWeight: 850 }}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>

          {(notifications.length > 0 || notificationError) && (
            <section style={{ marginTop: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: "var(--text)" }}>
                  შეტყობინებები
                </h2>
                {notifications.some((notification) => !notification.readAt) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      type="button"
                      onClick={markEveryCraftsmanNotificationRead}
                      style={{
                        minHeight: 28,
                        padding: "0 9px",
                        borderRadius: 999,
                        background: "#f8fafc",
                        color: "var(--primary)",
                        border: "1px solid var(--border)",
                        fontSize: 10,
                        fontWeight: 900,
                      }}
                    >
                      ყველას წაკითხვა
                    </button>
                    <span
                      style={{
                        minWidth: 20,
                        height: 20,
                        borderRadius: 999,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "#ef4444",
                        color: "white",
                        fontSize: 10,
                        fontWeight: 900,
                      }}
                    >
                      {notifications.filter((notification) => !notification.readAt).length}
                    </span>
                  </div>
                )}
              </div>
              {notificationError && (
                <div
                  style={{
                    marginTop: 10,
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
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                {notifications.slice(0, 3).map((notification) => {
                  const isRead = Boolean(notification.readAt);
                  return (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => openCraftsmanNotification(notification)}
                      style={{
                        width: "100%",
                        padding: 12,
                        borderRadius: 14,
                        border: "1px solid var(--border)",
                        background: isRead ? "white" : "#eff6ff",
                        color: isRead ? "var(--text2)" : "#1d4ed8",
                        textAlign: "left",
                        opacity: isRead ? 0.72 : 1,
                        cursor: notification.bookingId ? "pointer" : "default",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <strong style={{ fontSize: 12 }}>
                          {notification.title}
                        </strong>
                        <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 850, opacity: 0.75 }}>
                          {formatNotificationDate(notification.createdAt)}
                        </span>
                      </div>
                      <div style={{ marginTop: 4, fontSize: 11, fontWeight: 750, lineHeight: 1.45 }}>
                        {notification.text}
                      </div>
                      {notification.bookingId && (
                        <div
                          style={{
                            marginTop: 8,
                            color: isRead ? "var(--text3)" : "#1d4ed8",
                            fontSize: 10,
                            fontWeight: 950,
                          }}
                        >
                          მოთხოვნის გახსნა
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <h2 style={{ margin: "26px 0 12px", fontSize: 20, fontWeight: 900, color: "var(--text)" }}>
            ბოლო საქმეები
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {displayedBookings.slice(0, 3).map((booking) => (
              <JobCard key={booking.id} booking={booking} />
            ))}
          </div>
        </div>
      )}

      {activeScreen === "search" && (
        <div className="fade-up">
          <h1 className="screen-title">საქმეები</h1>
          <p className="screen-subtitle">ნახე შენი საქმეები დროისა და სტატუსის მიხედვით</p>
          <button
            type="button"
            onClick={() => setDemoMode((current) => !current)}
            style={{
              marginTop: 14,
              minHeight: 38,
              padding: "0 13px",
              borderRadius: 11,
              background: demoMode ? "#fff7ed" : "white",
              color: demoMode ? "#c2410c" : "var(--text2)",
              border: `1px solid ${demoMode ? "#fed7aa" : "var(--border)"}`,
              fontSize: 12,
              fontWeight: 900,
            }}
          >
            {demoMode ? "სატესტო რეჟიმის გამორთვა" : "სატესტო რეჟიმის ჩართვა"}
          </button>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              height: 48,
              marginTop: 20,
              padding: "0 14px",
              borderRadius: 15,
              border: "1px solid var(--border)",
              background: "white",
            }}
          >
            <span style={{ color: "var(--text3)", fontSize: 16 }}>⌕</span>
            <input
              type="text"
              value={workQuery}
              onChange={(event) => setWorkQuery(event.target.value)}
              placeholder="კლიენტი, საქმე ან მისამართი..."
              style={{
                flex: 1,
                minWidth: 0,
                background: "transparent",
                color: "var(--text)",
                fontSize: 14,
                fontWeight: 700,
              }}
            />
            {workQuery && (
              <button
                type="button"
                onClick={() => setWorkQuery("")}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  background: "#f1f5f9",
                  color: "var(--text3)",
                  fontSize: 14,
                  fontWeight: 900,
                }}
              >
                ×
              </button>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              margin: "18px 0 10px",
              padding: 4,
              borderRadius: 14,
              background: "#f1f5f9",
              border: "1px solid var(--border)",
            }}
          >
            {[
              { id: "active" as const, label: "აქტიური", count: activeWorks.length },
              { id: "archive" as const, label: "არქივი", count: archivedWorks.length },
            ].map((item) => {
              const selected = workView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setWorkView(item.id)}
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

          <div style={{ display: "flex", gap: 8, overflowX: "auto", margin: "22px 0 16px" }}>
            {[
              { id: "all", label: "ყველა" },
              { id: "today", label: "დღეს" },
              { id: "pending", label: "მოლოდინში" },
              { id: "confirmed", label: "დადასტ." },
              { id: "completed", label: "შესრულ." },
            ].map((filter) => (
              <button
                key={filter.id}
                onClick={() => setWorkFilter(filter.id as typeof workFilter)}
                style={{
                  flexShrink: 0,
                  padding: "9px 14px",
                  borderRadius: 999,
                  background: workFilter === filter.id ? "var(--primary)" : "white",
                  color: workFilter === filter.id ? "white" : "var(--text2)",
                  border: `1px solid ${workFilter === filter.id ? "var(--primary)" : "var(--border)"}`,
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {visibleWorks.length ? (
              visibleWorks.map((booking) => (
                <JobCard key={booking.id} booking={booking} />
              ))
            ) : (
              <div
                style={{
                  padding: 34,
                  borderRadius: 16,
                  background: "white",
                  border: "1px solid var(--border)",
                  textAlign: "center",
                  color: "var(--text3)",
                  fontSize: 13,
                  fontWeight: 800,
                  lineHeight: 1.5,
                }}
              >
                {workView === "active"
                  ? "ამ ფილტრით აქტიური საქმე არ მოიძებნა"
                  : "ამ ფილტრით არქივში საქმე არ მოიძებნა"}
              </div>
            )}
          </div>
        </div>
      )}

      {activeScreen === "bookings" && (
        <div className="fade-up">
          <h1 className="screen-title">ჯავშნები</h1>
          <p className="screen-subtitle">დაადასტურე ან უარყავი ახალი მოთხოვნები</p>
          <div
            style={{
              marginTop: 16,
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
            თუ ხელოსანი აგვიანებს და კლიენტს წინასწარ არ ატყობინებს, წესის
            დარღვევა აისახება რეიტინგსა და ანგარიშზე.
          </div>

          <h2 style={{ margin: "24px 0 12px", fontSize: 18, fontWeight: 900, color: "var(--text)" }}>
            მოლოდინში ({pending.length})
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {pending.length ? (
              pending.map((booking) => <JobCard key={booking.id} booking={booking} />)
            ) : (
              <div style={{ padding: 28, textAlign: "center", color: "var(--text3)" }}>
                ახალი მოთხოვნა არ არის
              </div>
            )}
          </div>

          <h2 style={{ margin: "24px 0 12px", fontSize: 18, fontWeight: 900, color: "var(--text)" }}>
            დადასტურებული ({confirmed.length})
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {confirmed.map((booking) => (
              <JobCard key={booking.id} booking={booking} />
            ))}
          </div>

          <h2 style={{ margin: "24px 0 12px", fontSize: 18, fontWeight: 900, color: "var(--text)" }}>
            არქივი ({completed.length})
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {completed.length ? (
              completed.map((booking) => <JobCard key={booking.id} booking={booking} />)
            ) : (
              <div style={{ padding: 24, textAlign: "center", color: "var(--text3)" }}>
                დახურული საქმეები ჯერ არ არის
              </div>
            )}
          </div>
        </div>
      )}

      {activeScreen === "user-profile" && (
        <div className="fade-up">
          <h1 className="screen-title">პროფილი</h1>
          <p className="screen-subtitle">მართე შენი ფოტო, განრიგი და საკონტაქტო ინფორმაცია</p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 8,
              marginTop: 18,
            }}
          >
            {PROFILE_SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setProfileSection(section.id)}
                style={{
                  minHeight: 42,
                  padding: "0 8px",
                  borderRadius: 12,
                  background:
                    profileSection === section.id ? "var(--primary)" : "white",
                  color:
                    profileSection === section.id ? "white" : "var(--text2)",
                  border: `1px solid ${
                    profileSection === section.id
                      ? "var(--primary)"
                      : "var(--border)"
                  }`,
                  fontSize: 11,
                  fontWeight: 900,
                }}
              >
                {section.label}
              </button>
            ))}
          </div>

          {profileSection === "edit" && (
            <>
          <div
            style={{
              marginTop: 22,
              padding: 20,
              borderRadius: 20,
              border: "1px solid var(--border)",
              background: "white",
              textAlign: "center",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                margin: "0 auto 14px",
                cursor: "pointer",
                border: "2px dashed var(--border2)",
                borderRadius: "50%",
                padding: profilePhoto ? 0 : 12,
                width: 104,
                height: 104,
              }}
            >
              {renderAvatar(100)}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              style={{ display: "none" }}
            />
            <div style={{ fontSize: 18, fontWeight: 900, color: "var(--text)" }}>
              {fullName}
            </div>
            <div style={{ marginTop: 3, fontSize: 13, color: "var(--text2)" }}>
              {professionText}
            </div>
            <div style={{ marginTop: 3, fontSize: 13, color: "var(--text2)" }}>
              {profileContactLabel}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={profileUploading}
              style={{
                marginTop: 14,
                minHeight: 42,
                padding: "0 18px",
                borderRadius: 12,
                background: "var(--primary)",
                color: "white",
                fontSize: 13,
                fontWeight: 900,
              }}
            >
              {profileUploading
                ? "იტვირთება..."
                : profilePhoto
                  ? "ფოტოს შეცვლა"
                  : "ფოტოს ატვირთვა"}
            </button>
            {profileUploadError && (
              <div
                style={{
                  marginTop: 9,
                  color: "#dc2626",
                  fontSize: 12,
                  fontWeight: 800,
                  lineHeight: 1.45,
                }}
              >
                {profileUploadError}
              </div>
            )}
          </div>

          <section style={{ marginTop: 16 }}>
            <h2 style={{ margin: "0 0 12px", fontSize: 19, fontWeight: 900, color: "var(--text)" }}>
              პირადი ინფორმაცია
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              {[
                { label: "სახელი", value: firstName, set: setFirstName },
                { label: "გვარი", value: lastName, set: setLastName },
              ].map((field) => (
                <label
                  key={field.label}
                  style={{
                    color: "var(--text2)",
                    fontSize: 11,
                    fontWeight: 900,
                  }}
                >
                  {field.label}
                  <input
                    type="text"
                    value={field.value}
                    onChange={(event) => field.set(event.target.value)}
                    style={{
                      width: "100%",
                      height: 46,
                      marginTop: 7,
                      padding: "0 12px",
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: "white",
                      color: "var(--text)",
                      fontSize: 14,
                      fontWeight: 800,
                    }}
                  />
                </label>
              ))}
            </div>
            <label
              style={{
                display: "block",
                marginTop: 12,
                color: "var(--text2)",
                fontSize: 11,
                fontWeight: 900,
              }}
            >
              მობილური
              <input
                type="tel"
                value={profilePhone}
                onChange={(event) =>
                  setProfilePhone(event.target.value.replace(/\D/g, "").slice(0, 9))
                }
                style={{
                  width: "100%",
                  height: 46,
                  marginTop: 7,
                  padding: "0 12px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "white",
                  color: "var(--text)",
                  fontSize: 14,
                  fontWeight: 800,
                }}
              />
            </label>
            <label
              style={{
                display: "block",
                marginTop: 12,
                color: "var(--text2)",
                fontSize: 11,
                fontWeight: 900,
              }}
            >
              ქალაქი
              <select
                value={profileCity}
                onChange={(event) => setProfileCity(event.target.value)}
                style={{
                  width: "100%",
                  height: 46,
                  marginTop: 7,
                  padding: "0 12px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "white",
                  color: "var(--text)",
                  fontSize: 14,
                  fontWeight: 800,
                }}
              >
                {georgiaCities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </label>
            <label
              style={{
                display: "block",
                marginTop: 12,
                color: "var(--text2)",
                fontSize: 11,
                fontWeight: 900,
              }}
            >
              სტაჟი წლებით
              <input
                type="number"
                min="0"
                value={experienceYears}
                onChange={(event) => setExperienceYears(event.target.value)}
                placeholder="მაგ: 8"
                style={{
                  width: "100%",
                  height: 46,
                  marginTop: 7,
                  padding: "0 12px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "white",
                  color: "var(--text)",
                  fontSize: 14,
                  fontWeight: 800,
                }}
              />
            </label>
          </section>

          <div
            style={{
              marginTop: 16,
              padding: 16,
              borderRadius: 16,
              border: "1px solid #fed7aa",
              background: "#fff7ed",
            }}
          >
            <div style={{ color: "#c2410c", fontSize: 12, fontWeight: 900, marginBottom: 8 }}>
              მნიშვნელოვანი მოთხოვნები:
            </div>
            {[
              "სახე კარგად უნდა ჩანდეს",
              "მზის სათვალეში გადაღება არ შეიძლება",
            ].map((text) => (
              <div key={text} style={{ color: "#92400e", fontSize: 12, lineHeight: 1.7 }}>
                • {text}
              </div>
            ))}
          </div>
            </>
          )}

          {profileSection === "professions" && (
          <section style={{ marginTop: 24 }}>
            <h2 style={{ margin: "0 0 12px", fontSize: 19, fontWeight: 900, color: "var(--text)" }}>
              პროფესიის არჩევა
            </h2>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 9,
                padding: 14,
                borderRadius: 16,
                border: "1px solid var(--border)",
                background: "white",
              }}
            >
              {PROFESSION_OPTIONS.map((profession) => {
                const selected = professions.includes(profession);
                return (
                  <label
                    key={profession}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      minHeight: 44,
                      padding: "0 12px",
                      borderRadius: 12,
                      border: `1px solid ${
                        selected ? "var(--primary)" : "var(--border)"
                      }`,
                      background: selected ? "#f0f7ff" : "#f8fafc",
                      color: selected ? "var(--primary)" : "var(--text)",
                      fontSize: 14,
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    <span>{profession}</span>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleProfession(profession)}
                      style={{
                        width: 18,
                        height: 18,
                        accentColor: "var(--primary)",
                      }}
                    />
                  </label>
                );
              })}
            </div>
            <label
              style={{
                display: "block",
                marginTop: 14,
                color: "var(--text2)",
                fontSize: 11,
                fontWeight: 900,
              }}
            >
              დამატებითი კომენტარი
              <textarea
                value={extraWorkComment}
                onChange={(event) => setExtraWorkComment(event.target.value)}
                placeholder="მაგალითად: ვაკეთებ მცირე დემონტაჟსაც, კარის შეკეთებასაც..."
                rows={4}
                style={{
                  width: "100%",
                  marginTop: 7,
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "white",
                  color: "var(--text)",
                  fontSize: 14,
                  fontWeight: 700,
                  resize: "vertical",
                }}
              />
            </label>
            <div style={{ marginTop: 18 }}>
              <h3
                style={{
                  margin: "0 0 10px",
                  fontSize: 15,
                  fontWeight: 900,
                  color: "var(--text)",
                }}
              >
                საფასური
              </h3>
              <div
                style={{
                  marginBottom: 10,
                  color: "var(--text2)",
                  fontSize: 12,
                  lineHeight: 1.45,
                  fontWeight: 750,
                }}
              >
                აირჩიე როგორ გინდა გამოჩნდეს ფასი კლიენტისთვის: ზუსტი თანხა,
                საწყისი ფასი ან შუალედი.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {[
                  { value: "fixed" as const, label: "ზუსტი" },
                  { value: "from" as const, label: "დან" },
                  { value: "range" as const, label: "შუალედი" },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setPriceType(item.value)}
                    style={{
                      minHeight: 40,
                      borderRadius: 12,
                      border: `1px solid ${
                        priceType === item.value ? "var(--primary)" : "var(--border)"
                      }`,
                      background: priceType === item.value ? "var(--primary)" : "white",
                      color: priceType === item.value ? "white" : "var(--text2)",
                      fontSize: 12,
                      fontWeight: 900,
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: priceType === "range" ? "1fr 1fr" : "1fr",
                  gap: 12,
                  marginTop: 12,
                }}
              >
                <label style={{ color: "var(--text2)", fontSize: 11, fontWeight: 900 }}>
                  {priceType === "range" ? "მინიმუმი" : "ფასი"}
                  <input
                    type="number"
                    min="0"
                    value={priceMin}
                    onChange={(event) => setPriceMin(event.target.value)}
                    style={{
                      width: "100%",
                      height: 44,
                      marginTop: 7,
                      padding: "0 12px",
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: "white",
                      color: "var(--text)",
                      fontSize: 14,
                      fontWeight: 800,
                    }}
                  />
                </label>
                {priceType === "range" && (
                  <label style={{ color: "var(--text2)", fontSize: 11, fontWeight: 900 }}>
                    მაქსიმუმი
                    <input
                      type="number"
                      min="0"
                      value={priceMax}
                      onChange={(event) => setPriceMax(event.target.value)}
                      style={{
                        width: "100%",
                        height: 44,
                        marginTop: 7,
                        padding: "0 12px",
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        background: "white",
                        color: "var(--text)",
                        fontSize: 14,
                        fontWeight: 800,
                      }}
                    />
                  </label>
                )}
              </div>
              <div
                style={{
                  marginTop: 8,
                  color: priceValidationError ? "#dc2626" : "var(--text2)",
                  fontSize: 12,
                  lineHeight: 1.45,
                  fontWeight: 800,
                }}
              >
                {priceValidationError || `გამოჩნდება ასე: ${profilePrice}`}
              </div>
            </div>
          </section>
          )}

          {profileSection === "verification" && (
            <section style={{ marginTop: 24 }}>
              <h2 style={{ margin: "0 0 12px", fontSize: 19, fontWeight: 900, color: "var(--text)" }}>
                ვერიფიკაცია
              </h2>
              <div
                style={{
                  marginBottom: 14,
                  padding: 14,
                  borderRadius: 14,
                  background: isVerified ? "#ecfdf5" : "#fffbeb",
                  border: `1px solid ${isVerified ? "#86efac" : "#fde68a"}`,
                  color: isVerified ? "#047857" : "#92400e",
                  fontSize: 13,
                  lineHeight: 1.55,
                  fontWeight: 850,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <span style={{ fontSize: 15, fontWeight: 950 }}>
                    {verificationStatusText}
                  </span>
                  <span
                    style={{
                      padding: "5px 9px",
                      borderRadius: 999,
                      background: isVerified ? "#dcfce7" : "#fef3c7",
                      color: isVerified ? "#047857" : "#92400e",
                      fontSize: 12,
                      fontWeight: 950,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {verifiedDocumentCount}/3
                  </span>
                </div>
                <div style={{ marginTop: 8 }}>
                  {verificationStatusDescription}
                </div>
              </div>
              {verificationUploadError && (
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
                  {verificationUploadError}
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {verificationItems.map((item) => {
                  const checked = verification[item.key];
                  if (item.key === "bankAccount") {
                    return (
                      <div
                        key={item.key}
                        style={{
                          width: "100%",
                          padding: 14,
                          borderRadius: 14,
                          border: `1px solid ${checked ? "#86efac" : "var(--border)"}`,
                          background: checked ? "#ecfdf5" : "white",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                          <strong style={{ color: "var(--text)", fontSize: 14 }}>
                            {item.title}
                          </strong>
                          <span style={{ color: checked ? "#16a34a" : "var(--text3)", fontSize: 12, fontWeight: 900 }}>
                            {uploadingVerification === item.key
                              ? "ინახება"
                              : checked
                                ? "დასრულდა"
                                : "ჩაწერა"}
                          </span>
                        </div>
                        <div style={{ marginTop: 6, color: "var(--text2)", fontSize: 12, lineHeight: 1.5 }}>
                          ჩაწერე ანგარიშის ნომერი ან IBAN, სადაც თანხა დაგერიცხება.
                        </div>
                        <input
                          value={bankAccountText}
                          onChange={(event) => setBankAccountText(event.target.value)}
                          placeholder="მაგ: GE00BG0000000000000000"
                          style={{
                            width: "100%",
                            height: 44,
                            marginTop: 10,
                            padding: "0 12px",
                            borderRadius: 12,
                            border: "1px solid var(--border)",
                            background: "white",
                            color: "var(--text)",
                            fontSize: 13,
                            fontWeight: 850,
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleBankAccountSave}
                          disabled={uploadingVerification === item.key}
                          style={{
                            width: "100%",
                            minHeight: 42,
                            marginTop: 10,
                            borderRadius: 12,
                            background: "var(--primary)",
                            color: "white",
                            fontSize: 13,
                            fontWeight: 950,
                          }}
                        >
                          ანგარიშის შენახვა
                        </button>
                      </div>
                    );
                  }
                  return (
                    <label
                      key={item.key}
                      style={{
                        width: "100%",
                        padding: 14,
                        borderRadius: 14,
                        border: `1px solid ${checked ? "#86efac" : "var(--border)"}`,
                        background: checked ? "#ecfdf5" : "white",
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          handleVerificationUpload(item.key, file);
                        }}
                        style={{ display: "none" }}
                      />
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <strong style={{ color: "var(--text)", fontSize: 14 }}>
                          {item.title}
                        </strong>
                        <span style={{ color: checked ? "#16a34a" : "var(--text3)", fontSize: 12, fontWeight: 900 }}>
                          {uploadingVerification === item.key
                            ? "იტვირთება"
                            : checked
                              ? "დასრულდა"
                              : "ატვირთვა"}
                        </span>
                      </div>
                      <div style={{ marginTop: 6, color: "var(--text2)", fontSize: 12, lineHeight: 1.5 }}>
                        {item.desc}
                      </div>
                    </label>
                  );
                })}
              </div>
            </section>
          )}

          {profileSection === "schedule" && (
            <>
          <section style={{ marginTop: 24 }}>
            <h2 style={{ margin: "0 0 12px", fontSize: 19, fontWeight: 900, color: "var(--text)" }}>
              სამუშაო დღეები
            </h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {DAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  style={{
                    padding: "10px 15px",
                    borderRadius: 999,
                    background: workDays.includes(day) ? "var(--primary)" : "white",
                    color: workDays.includes(day) ? "white" : "var(--text2)",
                    border: `1px solid ${workDays.includes(day) ? "var(--primary)" : "var(--border)"}`,
                    fontSize: 13,
                    fontWeight: 900,
                  }}
                >
                  {day}
                </button>
              ))}
            </div>
          </section>

          <section style={{ marginTop: 24 }}>
            <h2 style={{ margin: "0 0 12px", fontSize: 19, fontWeight: 900, color: "var(--text)" }}>
              სამუშაო საათები
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { label: "დაწყება", value: workStart, set: setWorkStart },
                { label: "დასრულება", value: workEnd, set: setWorkEnd },
              ].map((item) => (
                <label key={item.label} style={{ color: "var(--text2)", fontSize: 11, fontWeight: 900 }}>
                  {item.label}
                  <select
                    value={item.value}
                    onChange={(event) => item.set(event.target.value)}
                    style={{
                      width: "100%",
                      height: 44,
                      marginTop: 7,
                      padding: "0 12px",
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: "white",
                      color: "var(--text)",
                      fontSize: 14,
                      fontWeight: 800,
                    }}
                  >
                    {HOURS.map((hour) => (
                      <option key={hour} value={hour}>
                        {hour}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={profileSaving || !profileChanged}
              style={{
                width: "100%",
                minHeight: 52,
                marginTop: 18,
                borderRadius: 14,
                background: saved
                  ? "#10b981"
                  : profileChanged
                    ? "var(--primary)"
                    : "#dbe4ef",
                color: "white",
                opacity: profileSaving || !profileChanged ? 0.75 : 1,
                fontSize: 15,
                fontWeight: 900,
              }}
            >
              {profileSaving
                ? "ინახება..."
                : saved || !profileChanged
                  ? "შენახულია"
                  : "შენახვა"}
            </button>
            {profileSaveError && (
              <div style={{ marginTop: 9, color: "#dc2626", fontSize: 12, fontWeight: 800 }}>
                {profileSaveError}
              </div>
            )}
          </section>

          <section style={{ marginTop: 24 }}>
            <h2 style={{ margin: "0 0 12px", fontSize: 19, fontWeight: 900, color: "var(--text)" }}>
              დაკავებული პერიოდი
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={{ color: "var(--text2)", fontSize: 11, fontWeight: 900 }}>
                როდიდან
                <input
                  type="date"
                  value={unavailableStart}
                  onChange={(event) => setUnavailableStart(event.target.value)}
                  style={{
                    width: "100%",
                    height: 44,
                    marginTop: 7,
                    padding: "0 10px",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "white",
                    color: "var(--text)",
                    fontWeight: 800,
                  }}
                />
              </label>
              <label style={{ color: "var(--text2)", fontSize: 11, fontWeight: 900 }}>
                როდემდე
                <input
                  type="date"
                  value={unavailableEnd}
                  onChange={(event) => setUnavailableEnd(event.target.value)}
                  style={{
                    width: "100%",
                    height: 44,
                    marginTop: 7,
                    padding: "0 10px",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "white",
                    color: "var(--text)",
                    fontWeight: 800,
                  }}
                />
              </label>
            </div>
            <button
              type="button"
              onClick={addUnavailableRange}
              style={{
                width: "100%",
                minHeight: 46,
                marginTop: 10,
                borderRadius: 12,
                background: "var(--primary)",
                color: "white",
                fontWeight: 900,
              }}
            >
              პერიოდის მონიშვნა
            </button>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              {unavailableRanges.map((range, index) => (
                <div
                  key={`${range.start}-${range.end}-${index}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "white",
                    color: "var(--text)",
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  <span>
                    {range.start} - {range.end}
                  </span>
                  <button
                    type="button"
                  onClick={() => {
                      const next = unavailableRanges.filter((_, i) => i !== index);
                      setUnavailableRanges(next);
                      if (isDemoDataMode) {
                        dataService.saveCraftsmanUnavailableRanges(next);
                      }
                    }}
                    style={{ color: "#ef4444", background: "transparent", fontWeight: 900 }}
                  >
                    წაშლა
                  </button>
                </div>
              ))}
            </div>
          </section>
            </>
          )}

          {profileSection !== "schedule" && (
            <>
              <button
                type="button"
                onClick={handleSave}
                disabled={profileSaving || !profileChanged}
                style={{
                  width: "100%",
                  minHeight: 52,
                  marginTop: 20,
                  borderRadius: 14,
                  background: saved
                    ? "#10b981"
                    : profileChanged
                      ? "var(--primary)"
                      : "#dbe4ef",
                  color: "white",
                  opacity: profileSaving || !profileChanged ? 0.75 : 1,
                  fontSize: 15,
                  fontWeight: 900,
                }}
              >
                {profileSaving
                  ? "ინახება..."
                  : saved || !profileChanged
                    ? "შენახულია"
                    : "შენახვა"}
              </button>
              {profileSaveError && (
                <div style={{ marginTop: 9, color: "#dc2626", fontSize: 12, fontWeight: 800 }}>
                  {profileSaveError}
                </div>
              )}
            </>
          )}

          <button
            type="button"
            onClick={onLogout}
            style={{
              width: "100%",
              minHeight: 56,
              marginTop: 20,
              borderRadius: 14,
              background: "white",
              color: "#ef4444",
              border: "1px solid var(--border)",
              fontSize: 15,
              fontWeight: 900,
              textAlign: "left",
              padding: "0 16px",
            }}
          >
            ⇱ გასვლა
          </button>
        </div>
      )}

      {completingBooking && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "flex-end",
            background: "rgba(15,23,42,0.35)",
          }}
        >
          <div
            style={{
              width: "100%",
              padding: 22,
              borderRadius: "22px 22px 0 0",
              background: "white",
              boxShadow: "0 -18px 45px rgba(15,23,42,0.18)",
            }}
          >
            {!showClientRating ? (
              <>
                <h2
                  style={{
                    margin: "0 0 8px",
                    color: "var(--text)",
                    fontSize: 22,
                    fontWeight: 900,
                  }}
                >
                  დარწმუნებული ხართ?
                </h2>
                <p
                  style={{
                    margin: "0 0 18px",
                    color: "var(--text2)",
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  დასრულებულად მონიშვნის შემდეგ ჯავშანი გადავა დასრულებულ
                  საქმეებში და კლიენტთან შეფასების შეტყობინება გაიგზავნება.
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setCompletingBooking(null)}
                    style={{
                      flex: 1,
                      minHeight: 48,
                      borderRadius: 12,
                      background: "#f1f5f9",
                      color: "var(--text)",
                      fontSize: 14,
                      fontWeight: 900,
                    }}
                  >
                    არა
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowClientRating(true)}
                    style={{
                      flex: 1,
                      minHeight: 48,
                      borderRadius: 12,
                      background: "var(--primary)",
                      color: "white",
                      fontSize: 14,
                      fontWeight: 900,
                    }}
                  >
                    დიახ
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2
                  style={{
                    margin: "0 0 8px",
                    color: "var(--text)",
                    fontSize: 22,
                    fontWeight: 900,
                  }}
                >
                  შეაფასე კლიენტი
                </h2>
                <p
                  style={{
                    margin: "0 0 16px",
                    color: "var(--text2)",
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  ეს შეფასება დაგვეხმარება სანდო კლიენტების სისტემის
                  შექმნაში.
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
                  {
                    key: "communication" as const,
                    label: "კომუნიკაცია",
                  },
                  {
                    key: "timeManagement" as const,
                    label: "დროის მენეჯმენტი",
                  },
                  {
                    key: "clarity" as const,
                    label: "დავალების სიცხადე",
                  },
                ].map((item) => (
                  <div key={item.key} style={{ marginBottom: 14 }}>
                    <div
                      style={{
                        marginBottom: 7,
                        color: "var(--text)",
                        fontSize: 13,
                        fontWeight: 900,
                      }}
                    >
                      {item.label}
                    </div>
                    <div style={{ display: "flex", gap: 7 }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          aria-label={`${item.label} ${star} ვარსკვლავი`}
                          onClick={() =>
                            setClientRating((prev) => ({
                              ...prev,
                              [item.key]: star,
                            }))
                          }
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 10,
                            background:
                              clientRating[item.key] >= star
                                ? "#fff7cc"
                                : "#f8fafc",
                            color:
                              clientRating[item.key] >= star
                                ? "#f59e0b"
                                : "var(--text3)",
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
                <button
                  type="button"
                  onClick={completeBooking}
                  disabled={
                    Boolean(bookingActionId) ||
                    !clientRating.communication ||
                    !clientRating.timeManagement ||
                    !clientRating.clarity
                  }
                  style={{
                    width: "100%",
                    minHeight: 50,
                    marginTop: 4,
                    borderRadius: 12,
                    background:
                      !bookingActionId &&
                      clientRating.communication &&
                      clientRating.timeManagement &&
                      clientRating.clarity
                        ? "#10b981"
                        : "#dbe4ef",
                    color: "white",
                    fontSize: 14,
                    fontWeight: 900,
                  }}
                >
                  {bookingActionId ? "ინახება..." : "დასრულება და შეფასების შენახვა"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {detailsBooking && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "flex-end",
            background: "rgba(15,23,42,0.35)",
          }}
        >
          <div
            style={{
              width: "100%",
              maxHeight: "86%",
              overflowY: "auto",
              padding: 22,
              borderRadius: "22px 22px 0 0",
              background: "white",
              boxShadow: "0 -18px 45px rgba(15,23,42,0.18)",
            }}
          >
            <h2
              style={{
                margin: "0 0 6px",
                color: "var(--text)",
                fontSize: 22,
                fontWeight: 900,
              }}
            >
              მოთხოვნის დეტალები
            </h2>
            <p
              style={{
                margin: "0 0 14px",
                color: "var(--text2)",
                fontSize: 13,
                lineHeight: 1.55,
              }}
            >
              {detailsBooking.clientName.replace(/^(\S+)\s+(\S).*/, "$1 $2.")} ·{" "}
              {formatBookingDateTime(detailsBooking)}
            </p>
            {(() => {
              const paymentMeta = getWorkerPaymentMeta(detailsBooking);
              return (
                <div
                  style={{
                    marginBottom: 12,
                    padding: 12,
                    borderRadius: 14,
                    background: paymentMeta.bg,
                    border: `1px solid ${paymentMeta.border}`,
                    color: paymentMeta.color,
                    fontSize: 12,
                    lineHeight: 1.45,
                    fontWeight: 850,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 950 }}>
                    {paymentMeta.label}
                  </div>
                  <div style={{ marginTop: 4 }}>{paymentMeta.detail}</div>
                </div>
              );
            })()}
            {detailsBooking.disputeReason &&
              (() => {
                const disputeMeta = getWorkerDisputeMeta(detailsBooking);
                return (
                  <div
                    style={{
                      marginBottom: 12,
                      padding: 12,
                      borderRadius: 14,
                      background: disputeMeta.bg,
                      border: `1px solid ${disputeMeta.border}`,
                      color: disputeMeta.color,
                      fontSize: 12,
                      lineHeight: 1.45,
                      fontWeight: 850,
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 950 }}>
                      {disputeMeta.label}
                    </div>
                    <div style={{ marginTop: 4 }}>{disputeMeta.detail}</div>
                    <div style={{ marginTop: 7, fontWeight: 900 }}>
                      მიზეზი: {detailsBooking.disputeReason}
                    </div>
                    {detailsBooking.disputeDetails && (
                      <div style={{ marginTop: 5, fontWeight: 750 }}>
                        {detailsBooking.disputeDetails}
                      </div>
                    )}
                  </div>
                );
              })()}
            <div
              style={{
                padding: 14,
                borderRadius: 14,
                border: "1px solid var(--border)",
                background: "#f8fafc",
                marginBottom: 12,
              }}
            >
              <div style={{ color: "var(--text)", fontSize: 14, fontWeight: 900 }}>
                {detailsBooking.service}
              </div>
              <div style={{ marginTop: 8, color: "var(--text2)", fontSize: 12, lineHeight: 1.55 }}>
                {detailsBooking.address}
              </div>
              {detailsBooking.comment && (
                <div style={{ marginTop: 10, color: "var(--text)", fontSize: 13, lineHeight: 1.55 }}>
                  {detailsBooking.comment}
                </div>
              )}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginBottom: 14,
              }}
            >
              {[
                ["სამუშაო ფართი", detailsBooking.measurements?.area, "მ²"],
                ["სამუშაო სიმაღლე", detailsBooking.measurements?.height, "მ"],
                ["სამუშაო სიგრძე", detailsBooking.measurements?.length, "მ"],
                ["ოთახების რაოდენობა", detailsBooking.measurements?.rooms, ""],
              ].map(([label, value, unit]) => (
                <div
                  key={label}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "white",
                  }}
                >
                  <div style={{ color: "var(--text3)", fontSize: 10, fontWeight: 900 }}>
                    {label}
                  </div>
                  <div style={{ marginTop: 5, color: "var(--text)", fontSize: 14, fontWeight: 900 }}>
                    {formatDetailValue(value, unit)}
                  </div>
                </div>
              ))}
            </div>
            {detailsBooking.measurements?.extraMeasurements && (
              <div
                style={{
                  marginBottom: 14,
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "#f8fafc",
                  color: "var(--text)",
                  fontSize: 13,
                  lineHeight: 1.55,
                  fontWeight: 700,
                }}
              >
                {detailsBooking.measurements.extraMeasurements}
              </div>
            )}
            {detailsBooking.measurements?.sitePhoto && (
              <div
                style={{
                  marginBottom: 14,
                  padding: 10,
                  borderRadius: 14,
                  border: "1px solid var(--border)",
                  background: "#f8fafc",
                }}
              >
                <div
                  style={{
                    marginBottom: 8,
                    color: "var(--text3)",
                    fontSize: 10,
                    fontWeight: 900,
                  }}
                >
                  ადგილის ფოტო
                </div>
                <div
                  style={{
                    marginBottom: 8,
                    color: "var(--text2)",
                    fontSize: 12,
                    lineHeight: 1.45,
                    fontWeight: 750,
                  }}
                >
                  კლიენტის დამატებული ფოტო წინასწარი შეფასებისთვის.
                </div>
                <img
                  src={detailsBooking.measurements.sitePhoto}
                  alt="საქმის ფოტო"
                  style={{
                    width: "100%",
                    maxHeight: 220,
                    objectFit: "cover",
                    borderRadius: 12,
                    display: "block",
                  }}
                />
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
              {[
                ["კედლის მდგომარეობა", detailsBooking.measurements?.wallCondition],
                ["საქმის ნაწილი", detailsBooking.measurements?.targetSurface],
                ["მასალა ვისია", detailsBooking.measurements?.materialOwner],
                ["სანტექნიკის ტიპი", detailsBooking.measurements?.plumbingType],
                ["სართული", detailsBooking.measurements?.floor],
                ["ელ. წერტილები", detailsBooking.measurements?.electricPoints],
                ["ელ. ფარი", detailsBooking.measurements?.electricPanel],
                ["ავარიულია", detailsBooking.measurements?.isEmergency],
                ["სამუშაოს ტიპი", detailsBooking.measurements?.workScope],
                ["ზედაპირი/ობიექტი", detailsBooking.measurements?.surfaceType],
                ["მასალის შენიშვნა", detailsBooking.measurements?.materialNote],
                ["რაოდენობა", detailsBooking.measurements?.itemCount],
                ["არსებული მდგომარეობა", detailsBooking.measurements?.currentCondition],
                ["ფოტო/აღწერა", detailsBooking.measurements?.photoNote],
                ["სახურავის ტიპი", detailsBooking.measurements?.roofType],
              ]
                .map(([label, value]) => [
                  label,
                  label === "მასალა ვისია"
                    ? formatMaterialOwner(value)
                    : formatDetailValue(value),
                ])
                .filter(([, value]) => value && value !== "არ არის")
                .map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      padding: 11,
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: "white",
                    }}
                  >
                    <div style={{ color: "var(--text3)", fontSize: 10, fontWeight: 900 }}>
                      {label}
                    </div>
                    <div style={{ marginTop: 4, color: "var(--text)", fontSize: 13, fontWeight: 850 }}>
                      {value}
                    </div>
                  </div>
                ))}
            </div>
            {bookingActionError && (
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
                {bookingActionError}
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  if (bookingActionId !== detailsBooking.id) setDetailsBooking(null);
                }}
                disabled={bookingActionId === detailsBooking.id}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: 12,
                  background: bookingActionId === detailsBooking.id ? "#e2e8f0" : "#f1f5f9",
                  color: "var(--text)",
                  fontWeight: 900,
                  opacity: bookingActionId === detailsBooking.id ? 0.75 : 1,
                }}
              >
                დახურვა
              </button>
              {detailsBooking.status === "pending" && (
                <>
                  <button
                    type="button"
                    onClick={() => updateStatus(detailsBooking.id, "declined")}
                    disabled={bookingActionId === detailsBooking.id}
                    style={{
                      flex: 1,
                      minHeight: 48,
                      borderRadius: 12,
                      background:
                        bookingActionId === detailsBooking.id ? "#f1f5f9" : "#fff1f2",
                      color: "#dc2626",
                      border: "1px solid #fecaca",
                      fontWeight: 900,
                    }}
                  >
                    უარყოფა
                  </button>
                  <button
                    type="button"
                    onClick={() => updateStatus(detailsBooking.id, "confirmed")}
                    disabled={bookingActionId === detailsBooking.id}
                    style={{
                      flex: 1,
                      minHeight: 48,
                      borderRadius: 12,
                      background:
                        bookingActionId === detailsBooking.id
                          ? "#94a3b8"
                          : "var(--primary)",
                      color: "white",
                      fontWeight: 900,
                    }}
                  >
                    {bookingActionId === detailsBooking.id ? "იცვლება..." : "დადასტურება"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
