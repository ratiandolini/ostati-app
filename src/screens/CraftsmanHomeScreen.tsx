import React, { useEffect, useMemo, useRef, useState } from "react";
import { BookingStatus, Screen, User } from "../types";
import { categoryGroups, georgiaCities, getAllProfessionValue, getServiceSelectionLabel, makeServiceSelection, sanitizeWorkerProfessions, SUPERVISOR_CAPABILITIES } from "../data/workers";
import { dataService, isDemoDataMode } from "../services/dataService";
import {
  isAbortError,
  isTransientApiError,
  reportApiError,
} from "../services/apiErrorUtils";
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
import { openBookingDispute } from "../services/disputeApiService";
import {
  clientReviewSchema,
  craftsmanProfileSchema,
  getValidationMessage,
} from "../services/validation";
import {
  bookingStatusTransitionError,
  canChangeBookingStatus,
} from "../utils/bookingWorkflow";
import { usePlatformSettings } from "../hooks/usePlatformSettings";
import { JobCard } from "../components/craftsman/JobCard";
import { CraftsmanJobPostsPanel } from "../components/JobPostsPanel";
import { createCurrentWorkerPortfolioItem, PortfolioItem, removePortfolioItem } from "../services/marketplaceApiService";
import { createStoragePath, normalizeSupportedUploadFile, removeStorageFile, uploadStorageFile } from "../services/supabaseStorageService";
import { ReferralPanel } from "../components/ReferralPanel";
import {
  Booking,
  ClientRating,
  uploadErrorMessage,
  keepEqualSnapshot,
  DAYS,
  DAY_TO_WEEKDAY,
  WEEKDAY_TO_DAY,
  isBlankDetail,
  formatDetailValue,
  formatMaterialOwner,
  PROFILE_SECTIONS,
  HOURS,
  readCraftsmanProfile,
  parseStoredPrice,
  formatProfilePrice,
  formatNotificationDate,
  formatBookingDateTime,
  formatWorkDateLabel,
  initialBookings,
  isRealRequest,
  activeWorkStatuses,
  archivedWorkStatuses,
  money,
  parseSnapshotRecord,
  getWorkerPaymentMeta,
  getWorkerDisputeMeta,
} from "./craftsman/craftsmanHome.helpers";

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
  onOpenMessagesForBooking?: (bookingId: string) => void;
}

export const CraftsmanHomeScreen: React.FC<CraftsmanHomeScreenProps> = ({
  user,
  activeScreen,
  onLogout,
  accountStatus = "active",
  workerVerified = false,
  onProfileUpdated,
  onOpenMessagesForBooking,
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
  const [expandedArchiveIds, setExpandedArchiveIds] = useState<string[]>([]);
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
  const [bookingReasonAction, setBookingReasonAction] = useState<{
    booking: Booking;
    kind: "decline" | "cannot_complete";
  } | null>(null);
  const [bookingReason, setBookingReason] = useState("");
  const [bookingReasonNote, setBookingReasonNote] = useState("");
  const [bookingReasonError, setBookingReasonError] = useState("");
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
    if (!isDemoDataMode) return [];
    const profile = readCraftsmanProfile();
    const storedProfessions = Array.isArray(profile.professions) ? profile.professions : [];
    return sanitizeWorkerProfessions(
      storedProfessions.length ? storedProfessions : typeof profile.role === "string" ? [profile.role] : []
    );
  });
  const [expandedProfessionCategoryId, setExpandedProfessionCategoryId] =
    useState("");
  const [expandedSupervisorOptions, setExpandedSupervisorOptions] =
    useState(false);
  const storedPrice = isDemoDataMode ? readCraftsmanProfile().price : "";
  const initialPrice = storedPrice
    ? parseStoredPrice(storedPrice)
    : { type: "range" as const, min: 0, max: null };
  const [priceType, setPriceType] = useState<"fixed" | "from" | "range">(
    initialPrice.type
  );
  const [priceMin, setPriceMin] = useState(
    initialPrice.min > 0 ? String(initialPrice.min) : ""
  );
  const [priceMax, setPriceMax] = useState(
    initialPrice.max ? String(initialPrice.max) : ""
  );
  const [priceTouched, setPriceTouched] = useState(false);
  const { platformSettings } = usePlatformSettings();
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
  const [profileUploadError, setProfileUploadError] = useState("");
  const [profileSaveError, setProfileSaveError] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [profileUploading, setProfileUploading] = useState(false);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [portfolioBusy, setPortfolioBusy] = useState(false);
  const [portfolioError, setPortfolioError] = useState("");
  const [portfolioReplaceId, setPortfolioReplaceId] = useState("");
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationError, setNotificationError] = useState("");
  const [bookingActionError, setBookingActionError] = useState("");
  const [bookingActionId, setBookingActionId] = useState<string | null>(null);
  const [verificationUploadError, setVerificationUploadError] = useState("");
  const [uploadingVerification, setUploadingVerification] = useState<
    keyof typeof verification | null
  >(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const portfolioInputRef = useRef<HTMLInputElement | null>(null);
  const portfolioFileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("ფოტოს წაკითხვა ვერ მოხერხდა."));
    reader.onerror = () => reject(new Error("ფოტოს წაკითხვა ვერ მოხერხდა."));
    reader.readAsDataURL(file);
  });
  const fullName =
    `${firstName.trim()} ${lastName.trim()}`.trim() || "სახელი გვარი";
  const normalizedProfilePhone = profilePhone.replace(/\D/g, "");
  const profileContactLabel = normalizedProfilePhone
    ? `+995 ${normalizedProfilePhone}`
    : user.phone.includes("@")
      ? user.phone
      : "ნომერი დასამატებელია";
  const canonicalProfessions = useMemo(() => sanitizeWorkerProfessions(professions), [professions]);
  const mainProfession = canonicalProfessions.length ? getServiceSelectionLabel(canonicalProfessions[0]) : "პროფესია ასარჩევია";
  const professionText = canonicalProfessions.length ? canonicalProfessions.map(getServiceSelectionLabel).join(" · ") : "პროფესია ასარჩევია";
  const priceMinText = priceMin.trim();
  const priceMaxText = priceMax.trim();
  const normalizedPriceMin = priceMinText ? Number(priceMinText) : null;
  const normalizedPriceMax = priceMaxText ? Number(priceMaxText) : null;
  const normalizedExperienceYears = Math.max(0, Number(experienceYears) || 0);
  const priceChoice =
    priceType === "fixed"
      ? "fixed"
      : priceType === "range" && normalizedPriceMin == null
        ? "negotiable"
        : "from";
  const priceValidationError =
    priceChoice !== "negotiable" && normalizedPriceMin == null
      ? "ფასი მიუთითე ან აირჩიე „შეთანხმებით“."
      : priceChoice !== "negotiable" &&
          (!Number.isFinite(normalizedPriceMin) || (normalizedPriceMin || 0) <= 0)
        ? "ფასი დადებით რიცხვად მიუთითე."
        : "";
  const visiblePriceValidationError =
    priceTouched && priceChoice !== "negotiable" ? priceValidationError : "";
  const profilePrice =
    priceChoice === "negotiable"
      ? "ფასი შეთანხმებით"
      : formatProfilePrice(
          priceType,
          normalizedPriceMin || 0,
          normalizedPriceMax || normalizedPriceMin || 0
        );
  const profileSnapshot = JSON.stringify({
    firstName,
    lastName,
    profilePhone: normalizedProfilePhone,
    profilePhoto,
    profileCity,
    experienceYears: normalizedExperienceYears,
    extraWorkComment,
    professions: canonicalProfessions,
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
  const profileSaveLabel = profileSaving
    ? "ინახება..."
    : saved
      ? "შენახულია ✓"
      : profileChanged
        ? "შენახვა"
        : "შენახულია";
  const profileSaveButtonStyle: React.CSSProperties = {
    width: "100%",
    minHeight: 52,
    borderRadius: 14,
    background: saved ? "#10b981" : profileChanged ? "var(--primary)" : "#dbe4ef",
    color: "white",
    opacity: profileSaving || !profileChanged ? 0.75 : 1,
    fontSize: 15,
    fontWeight: 900,
  };
  const hasAllVerificationDocuments = Object.values(verification).every(Boolean);
  const isVerified = workerVerified || verificationStatus === "verified";
  const verificationItems = [
    {
      key: "idFront" as const,
      title: "პირადობა ან პასპორტი - პირველი გვერდი",
      desc: "ატვირთე პირადობის ან პასპორტის პირველი გვერდი",
    },
    {
      key: "idBack" as const,
      title: "პირადობა ან პასპორტი - მეორე გვერდი",
      desc: "ატვირთე პირადობის ან პასპორტის მეორე გვერდი",
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

  useEffect(() => {
    if (!isDemoDataMode) return;
    const nextRating = dataService.getWorkerRating(999);
    if (nextRating) {
      setRating(nextRating);
    }
  }, []);

  useEffect(() => {
    if (profileChanged) setSaved(false);
  }, [profileChanged]);

  useEffect(() => {
    let cancelled = false;
    import("../services/marketplaceApiService")
      .then(({ loadWorkerPortfolio }) => loadWorkerPortfolio("demo-worker"))
      .then((items) => { if (!cancelled) setPortfolioItems(items); })
      .catch(() => undefined);
    return () => { cancelled = true; };
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
        professions: canonicalProfessions,
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
    canonicalProfessions,
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
        const nextProfessions = sanitizeWorkerProfessions(profile.professions || professions);
        const nextPriceType = profile.price_type || priceType;
        const nextPriceMin = profile.price_min != null
          ? Number(profile.price_min)
          : normalizedPriceMin;
        const nextPriceMax = profile.price_max != null
          ? Number(profile.price_max)
          : normalizedPriceMax;
        const nextWorkDays = profile.schedule?.length
          ? profile.schedule
              .map((item) => WEEKDAY_TO_DAY[item.weekday])
              .filter(Boolean)
          : workDays;
        const nextWorkStart = profile.schedule?.length
          ? profile.schedule[0].start_time.slice(0, 5)
          : workStart;
        const nextWorkEnd = profile.schedule?.length
          ? profile.schedule[0].end_time.slice(0, 5)
          : workEnd;
        const nextUnavailableRanges = profile.unavailable_ranges || unavailableRanges;
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
        setProfessions(nextProfessions);
        setPriceType(nextPriceType);
        setPriceMin(nextPriceMin != null ? String(nextPriceMin) : "");
        setPriceMax(nextPriceMax != null ? String(nextPriceMax) : "");
        if (profile.experience_years != null) {
          setExperienceYears(String(Number(profile.experience_years)));
        }
        setWorkDays(nextWorkDays);
        setWorkStart(nextWorkStart);
        setWorkEnd(nextWorkEnd);
        setUnavailableRanges(nextUnavailableRanges);
        setSavedProfileSnapshot(
          JSON.stringify({
            firstName: nextFirstName,
            lastName: nextLastName,
            profilePhone: nextPhone,
            profilePhoto: profile.photo_url || null,
            profileCity: profile.city || "თბილისი",
            experienceYears: Math.max(0, Number(profile.experience_years) || 0),
            extraWorkComment: profile.about || "",
            professions: nextProfessions,
            priceType: nextPriceType,
            priceMin: nextPriceMin,
            priceMax: nextPriceMax,
            workDays: nextWorkDays,
            workStart: nextWorkStart,
            workEnd: nextWorkEnd,
            unavailableRanges: nextUnavailableRanges,
          })
        );
      })
      .catch((error) => {
        if (isAbortError(error)) return;
        reportApiError(error, { silentTransient: true });
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
      setNotifications((current) =>
        keepEqualSnapshot(
          current,
          dataService.getCraftsmanNotifications() as AppNotification[]
        )
      );
      setNotificationError("");
      return;
    }

    loadNotifications(10)
      .then((nextNotifications) => {
        setNotifications((current) =>
          keepEqualSnapshot(current, nextNotifications)
        );
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
          setNotifications((current) =>
            keepEqualSnapshot(current, nextNotifications)
          );
          setNotificationError("");
        })
        .catch((error) => {
          if (isAbortError(error)) return;
          if (cancelled) return;
          if (isTransientApiError(error)) return;
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
    window.addEventListener("craftsman-notifications-updated", refresh);
    window.addEventListener("booking-status-updated", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshOnFocus);

    return () => {
      cancelled = true;
      activeController?.abort();
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
    if (
      notification.sourceType === "admin_message" ||
      notification.sourceType === "admin_warning" ||
      notification.sourceType === "account_status" ||
      notification.title === "Admin შეტყობინება"
    ) {
      return;
    }
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
          if (!cancelled) {
            setBookings((current) =>
              keepEqualSnapshot(current, nextBookings as Booking[])
            );
          }
        })
        .catch((error) => {
          if (isAbortError(error)) return;
          reportApiError(error, { silentTransient: true });
        });
    };
    const refreshOnFocus = () => {
      if (document.visibilityState === "visible") refreshApiWorkerBookings();
    };

    refreshApiWorkerBookings();
    window.addEventListener("booking-status-updated", refreshApiWorkerBookings);
    window.addEventListener("focus", refreshApiWorkerBookings);
    document.addEventListener("visibilitychange", refreshOnFocus);

    return () => {
      cancelled = true;
      activeController?.abort();
      window.removeEventListener("booking-status-updated", refreshApiWorkerBookings);
      window.removeEventListener("focus", refreshApiWorkerBookings);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, []);

  const reloadWorkerBookings = async () => {
    if (isDemoDataMode) return;
    const nextBookings = await loadWorkerBookings();
    setBookings((current) =>
      keepEqualSnapshot(current, nextBookings as Booking[])
    );
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
  const visibleHomeNotifications = useMemo(
    () => notifications.filter((notification) => !notification.readAt).slice(0, 2),
    [notifications]
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

  const updateStatus = async (
    id: string,
    status: BookingStatus,
    cancellationReason?: string
  ) => {
    if (accountStatus !== "active") {
      setBookingActionError(
        "ანგარიში შეზღუდულია. ჯავშნის სტატუსის შეცვლა დროებით შეუძლებელია."
      );
      return;
    }
    const target = bookings.find((booking) => booking.id === id);
    if (!target || !canChangeBookingStatus("craftsman", target.status, status)) {
      setBookingActionError(bookingStatusTransitionError("craftsman"));
      return;
    }
    setBookingActionError("");

    if (!isDemoDataMode) {
      if (status === "completed") return;
      setBookingActionId(id);
      try {
        await updateBookingStatus(id, status, cancellationReason);
        await reloadWorkerBookings();
        refreshCraftsmanNotifications();
        window.dispatchEvent(
          new CustomEvent("booking-status-updated", {
            detail: { bookingId: id, status, target: "craftsman" },
          })
        );
        setDetailsBooking((current) =>
          current?.id === id
            ? { ...current, status, cancellationReason: cancellationReason || current.cancellationReason }
            : current
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
        booking.id === id
          ? { ...booking, status, cancellationReason: cancellationReason || booking.cancellationReason }
          : booking
      )
    );
    persistBookingStatus(id, status);
    if (isDemoDataMode) {
      dataService.updateClientBooking(id, (booking) => ({
        ...booking,
        status,
        cancellationReason: cancellationReason || booking.cancellationReason,
      }));
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
            : `დაადასტურეთ შესრულება და შეაფასეთ: ${target.service}`;
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
        const text = `ხელოსანმა ჯავშანი უარყო: ${target.service}.${
          cancellationReason ? ` მიზეზი: ${cancellationReason}` : ""
        }`;
        dataService.prependClientNotification({
          id: `${id}-declined-review-${Date.now()}`,
          text,
          type: "confirmed",
          bookingId: id,
        });
      }
    }
    setDetailsBooking(null);
  };

  const openBookingReasonAction = (
    booking: Booking,
    kind: "decline" | "cannot_complete"
  ) => {
    setBookingReasonAction({ booking, kind });
    setBookingReason("");
    setBookingReasonNote("");
    setBookingReasonError("");
  };

  const submitBookingReasonAction = async () => {
    if (!bookingReasonAction) return;
    if (!bookingReason) {
      setBookingReasonError("აირჩიეთ მიზეზი.");
      return;
    }

    const { booking, kind } = bookingReasonAction;
    const fullReason = [bookingReason, bookingReasonNote.trim()]
      .filter(Boolean)
      .join(". ");
    setBookingReasonError("");

    try {
      if (kind === "decline") {
        await updateStatus(booking.id, "declined", fullReason);
      } else if (!isDemoDataMode) {
        setBookingActionId(booking.id);
        await openBookingDispute(
          booking.id,
          "ხელოსანმა სამუშაო ვერ შეასრულა",
          fullReason
        );
        await reloadWorkerBookings();
        refreshCraftsmanNotifications();
        setDetailsBooking(null);
      } else {
        setBookings((current) =>
          current.map((item) =>
            item.id === booking.id
              ? {
                  ...item,
                  status: "disputed",
                  paymentStatus: "disputed",
                  disputeReason: "ხელოსანმა სამუშაო ვერ შეასრულა",
                  disputeDetails: fullReason,
                }
              : item
          )
        );
        dataService.updateCraftsmanRequest(booking.id, (item) => ({
          ...item,
          status: "disputed",
          paymentStatus: "disputed",
          disputeReason: "ხელოსანმა სამუშაო ვერ შეასრულა",
          disputeDetails: fullReason,
        }));
        dataService.updateClientBooking(booking.id, (item) => ({
          ...item,
          status: "disputed",
          paymentStatus: "disputed",
          disputeReason: "ხელოსანმა სამუშაო ვერ შეასრულა",
          disputeDetails: fullReason,
        }));
        dataService.prependBookingDispute({
          id: `${booking.id}-worker-cannot-complete-${Date.now()}`,
          bookingId: booking.id,
          reason: "ხელოსანმა სამუშაო ვერ შეასრულა",
          details: fullReason,
          createdAt: new Date().toISOString(),
          status: "open",
        });
        dataService.prependClientNotification({
          id: `${booking.id}-worker-cannot-complete-${Date.now()}`,
          bookingId: booking.id,
          type: "confirmed",
          text: `ხელოსანმა დააფიქსირა, რომ სამუშაო ვერ სრულდება. Admin გადაამოწმებს. მიზეზი: ${fullReason}`,
        });
        setDetailsBooking(null);
      }
      setBookingReasonAction(null);
    } catch (error) {
      setBookingReasonError(
        error instanceof Error ? error.message : "მოქმედება ვერ შესრულდა"
      );
    } finally {
      setBookingActionId(null);
    }
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
    if (!canChangeBookingStatus("craftsman", target.status, "worker_completed")) {
      setReviewError(bookingStatusTransitionError("craftsman"));
      return;
    }
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
        return prev.filter((item) => item !== profession);
      }
      return [...prev, profession];
    });
  };

  const toggleCategoryAll = (category: (typeof categoryGroups)[number]) => {
    const allValue = getAllProfessionValue(category);
    const categoryValues = category.subcategories.map((item) => makeServiceSelection(category.id, item.label));
    setProfessions((current) => current.includes(allValue)
      ? current.filter((item) => item !== allValue)
      : [...current.filter((item) => !categoryValues.includes(item)), allValue]
    );
  };

  const handlePortfolioUpload = async (files: File[], replaceId = "") => {
    if (!files.length) return;
    const selectedFiles = replaceId ? files.slice(0, 1) : files;
    if (!replaceId && portfolioItems.length + selectedFiles.length > 15) {
      setPortfolioError("პორტფოლიოში მაქსიმუმ 15 ნამუშევრის დამატება შეიძლება.");
      return;
    }
    setPortfolioBusy(true);
    setPortfolioError("");
    try {
      const created: PortfolioItem[] = [];
      for (const file of selectedFiles) {
        let resolvedImageUrl: string;
        if (isDemoDataMode) {
          resolvedImageUrl = await portfolioFileToDataUrl(file);
        } else {
          const uploaded = await uploadStorageFile({
            bucket: "worker-portfolio",
            file,
            path: createStoragePath("portfolio", file, "work"),
          });
          resolvedImageUrl = uploaded.publicUrl || uploaded.path;
        }
        created.push(await createCurrentWorkerPortfolioItem(resolvedImageUrl, getServiceSelectionLabel(canonicalProfessions[0]), ""));
      }
      if (replaceId) {
        const oldItem = portfolioItems.find((item) => item.id === replaceId);
        await removePortfolioItem(replaceId);
        if (oldItem && !isDemoDataMode) await removeStorageFile("worker-portfolio", oldItem.image_url).catch(() => undefined);
        setPortfolioItems((current) => [created[0], ...current.filter((item) => item.id !== replaceId)]);
      } else {
        setPortfolioItems((current) => [...created, ...current]);
      }
    } catch (error) {
      setPortfolioError(error instanceof Error ? error.message : "ფოტოს ატვირთვა ვერ მოხერხდა.");
    } finally {
      setPortfolioReplaceId("");
      setPortfolioBusy(false);
    }
  };

  const handleRemovePortfolioItem = async (item: PortfolioItem) => {
    setPortfolioBusy(true); setPortfolioError("");
    try {
      await removePortfolioItem(item.id);
      if (!isDemoDataMode) await removeStorageFile("worker-portfolio", item.image_url).catch(() => undefined);
      setPortfolioItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
    } catch (error) {
      setPortfolioError(error instanceof Error ? error.message : "ფოტოს წაშლა ვერ მოხერხდა.");
    } finally { setPortfolioBusy(false); }
  };

  const handleRemoveAllPortfolioItems = async () => {
    if (!portfolioItems.length || !window.confirm("ყველა ნამუშევრის ფოტო წაიშლება. გავაგრძელოთ?")) return;
    setPortfolioBusy(true); setPortfolioError("");
    try {
      const items = [...portfolioItems];
      await Promise.all(items.map(async (item) => {
        await removePortfolioItem(item.id);
        if (!isDemoDataMode) await removeStorageFile("worker-portfolio", item.image_url).catch(() => undefined);
      }));
      setPortfolioItems([]);
    } catch (error) {
      setPortfolioError(error instanceof Error ? error.message : "პორტფოლიოს სრულად წაშლა ვერ მოხერხდა.");
    } finally { setPortfolioBusy(false); }
  };

  const handleSave = async () => {
    setProfileSaveError("");

    const validation = craftsmanProfileSchema.safeParse({
      firstName,
      lastName,
      contactPhone: normalizedProfilePhone,
      city: profileCity,
      professions: canonicalProfessions,
      experienceYears: normalizedExperienceYears,
      priceType,
      priceMin: normalizedPriceMin,
      priceMax: priceType === "range" ? normalizedPriceMax : null,
      workDays,
      workStart,
      workEnd,
    });

    if (!validation.success || priceValidationError) {
      if (priceValidationError) setPriceTouched(true);
      setProfileSaveError(
        priceValidationError ||
          `${getValidationMessage(validation.success ? null : validation.error, "პროფილის მონაცემები გადაამოწმეთ")}. საჭირო ველები პროფილის მონაცემებსა და პროფესიის არჩევაშია.`
      );
      return;
    }

    if (professions.join("\u0000") !== canonicalProfessions.join("\u0000")) {
      setProfessions(canonicalProfessions);
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
          professions: canonicalProfessions,
          experienceYears: normalizedExperienceYears,
          priceType,
          priceMin: normalizedPriceMin,
          priceMax: priceType === "range" ? normalizedPriceMax : null,
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
            ? `შენახვა ვერ მოხერხდა: ${error.message}`
            : "პროფილის შენახვა ვერ მოხერხდა. გადაამოწმე მონიშნული ველები."
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
    // The user can choose the same corrected photo after an upload error.
    event.currentTarget.value = "";
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
          professions: canonicalProfessions,
          experienceYears: normalizedExperienceYears,
          priceType,
          priceMin: normalizedPriceMin,
          priceMax: priceType === "range" ? normalizedPriceMax : null,
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
        setProfileUploadError(uploadErrorMessage(error));
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

    let supportedFile: File;
    try {
      supportedFile = normalizeSupportedUploadFile(file);
    } catch (error) {
      setVerificationUploadError(error instanceof Error ? error.message : "ატვირთე მხოლოდ JPG, PNG, WebP ან PDF დოკუმენტი.");
      return;
    }
    if (supportedFile.type === "application/pdf" && supportedFile.size > 4_500_000) {
      setVerificationUploadError("PDF ფაილი 4.5 მბ-ზე ნაკლები უნდა იყოს.");
      return;
    }

    if (!isDemoDataMode) {
      if (key === "bankAccount") return;
      const typeByKey: Record<"idFront" | "idBack", "id_front" | "id_back"> = {
        idFront: "id_front",
        idBack: "id_back",
      };

      setUploadingVerification(key);
      try {
        const uploaded = await uploadVerificationDocument(supportedFile, typeByKey[key]);
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
        setVerificationUploadError(uploadErrorMessage(error, "დოკუმენტის"));
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
    reader.readAsDataURL(supportedFile);
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
      reportApiError(error, { silentTransient: true });
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

  const jobCardProps = {
    bookingFee: platformSettings.bookingFee,
    expandedArchiveIds,
    bookingActionId,
    onExpand: (bookingId: string) =>
      setExpandedArchiveIds((current) =>
        current.includes(bookingId) ? current : [...current, bookingId]
      ),
    onCollapse: (bookingId: string) =>
      setExpandedArchiveIds((current) =>
        current.filter((id) => id !== bookingId)
      ),
    onShowDetails: setDetailsBooking,
    onUpdateStatus: updateStatus,
    onOpenReasonAction: openBookingReasonAction,
    onCompleteBooking: askCompleteBooking,
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
            <div style={{ minWidth: 0, flex: 1 }}>
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
              <p className="screen-subtitle profile-profession-summary">{professionText}</p>
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

          {isVerified && <CraftsmanJobPostsPanel professions={canonicalProfessions} />}

          {(visibleHomeNotifications.length > 0 || notificationError) && (
            <section style={{ marginTop: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: "var(--text)" }}>
                  შეტყობინებები
                </h2>
                {visibleHomeNotifications.length > 0 && (
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
                {visibleHomeNotifications.map((notification) => {
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
                      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 10 }}>
                        <strong style={{ minWidth: 0, fontSize: 12, lineHeight: 1.35, overflowWrap: "anywhere" }}>
                          {notification.title}
                        </strong>
                        <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 850, opacity: 0.75 }}>
                          {formatNotificationDate(notification.createdAt)}
                        </span>
                      </div>
                      <div style={{ marginTop: 4, fontSize: 11, fontWeight: 750, lineHeight: 1.45, overflowWrap: "anywhere" }}>
                        {notification.text}
                      </div>
                      {notification.bookingId &&
                        notification.sourceType !== "admin_message" &&
                        notification.sourceType !== "admin_warning" &&
                        notification.sourceType !== "account_status" && (
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
              <JobCard key={booking.id} booking={booking} {...jobCardProps} />
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
                <JobCard key={booking.id} booking={booking} {...jobCardProps} />
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
              pending.map((booking) => <JobCard key={booking.id} booking={booking} {...jobCardProps} />)
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
              <JobCard key={booking.id} booking={booking} {...jobCardProps} />
            ))}
          </div>

          <h2 style={{ margin: "24px 0 12px", fontSize: 18, fontWeight: 900, color: "var(--text)" }}>
            არქივი ({completed.length})
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {completed.length ? (
              completed.map((booking) => <JobCard key={booking.id} booking={booking} {...jobCardProps} />)
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
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 8,
              marginTop: 16,
            }}
          >
            {PROFILE_SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setProfileSection(section.id)}
                style={{
                  gridColumn: section.id === "portfolio" ? "1 / -1" : undefined,
                  minHeight: 46,
                  padding: "7px 10px",
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
                  fontSize: 12,
                  lineHeight: 1.25,
                  fontWeight: 900,
                  textAlign: "center",
                  overflowWrap: "normal",
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
            <div className="profile-profession-summary" style={{ marginTop: 3, fontSize: 13, color: "var(--text2)" }}>
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
            <div
              style={{
                marginTop: 14,
                padding: 14,
                borderRadius: 14,
                border: "1px solid #fed7aa",
                background: "#fff7ed",
                textAlign: "left",
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
                { label: "სახელი (ქართულად)", value: firstName, set: setFirstName },
                { label: "გვარი (ქართულად)", value: lastName, set: setLastName },
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

            </>
          )}

          {profileSection === "edit" && <ReferralPanel roleLabel="ხელოსანი" />}

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
              {categoryGroups.map((category) => {
                const allValue = getAllProfessionValue(category);
                const allSelected = professions.includes(allValue);
                const selectedCount = professions.filter((value) =>
                  value.startsWith(`${category.id}::`)
                ).length;
                const isExpanded = expandedProfessionCategoryId === category.id;
                const indicator = allSelected
                  ? "ყველა სამუშაო"
                  : selectedCount
                    ? `${selectedCount} სამუშაო არჩეული`
                    : "არაფერი არჩეული";
                return <div key={category.id} style={{ border: `1px solid ${isExpanded || selectedCount || allSelected ? "var(--primary)" : "var(--border)"}`, borderRadius: 12, overflow: "hidden", background: "white" }}>
                  <button type="button" onClick={() => setExpandedProfessionCategoryId((current) => current === category.id ? "" : category.id)} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center", gap: 12, width: "100%", minHeight: 54, padding: "10px 12px", background: isExpanded ? "#f0f7ff" : "white", color: "var(--text)", textAlign: "left" }}>
                    <span style={{ minWidth: 0 }}><span style={{ display: "block", fontSize: 14, lineHeight: 1.35, fontWeight: 900, overflowWrap: "anywhere" }}>{category.label}</span><span style={{ display: "block", marginTop: 2, color: isExpanded || selectedCount || allSelected ? "var(--primary)" : "var(--text3)", fontSize: 12, lineHeight: 1.3, fontWeight: 800 }}>{indicator}</span></span>
                    <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1, color: "var(--primary)" }}>{isExpanded ? "⌃" : "⌄"}</span>
                  </button>
                  {isExpanded && <div style={{ display: "grid", gap: 8, padding: 12, borderTop: "1px solid var(--border)", background: "#f8fafc" }}>
                    <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 42, padding: "0 10px", borderRadius: 9, background: allSelected ? "#f0f7ff" : "white", color: allSelected ? "var(--primary)" : "var(--text)", fontSize: 13, lineHeight: 1.35, fontWeight: 900, cursor: "pointer" }}><span style={{ minWidth: 0, overflowWrap: "anywhere" }}>ყველაფერს ვასრულებ</span><input type="checkbox" checked={allSelected} onChange={() => toggleCategoryAll(category)} style={{ flex: "0 0 auto", width: 18, height: 18, accentColor: "var(--primary)" }} /></label>
                  <div style={{ display: "grid", gap: 7 }}>
                    {category.subcategories.map((subcategory) => {
                      const value = makeServiceSelection(category.id, subcategory.label);
                      const selected = allSelected || professions.includes(value);
                      return <label key={value} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 42, padding: "8px 10px", borderRadius: 9, background: selected ? "#f0f7ff" : "white", color: selected ? "var(--primary)" : "var(--text2)", fontSize: 13, lineHeight: 1.35, fontWeight: 800, cursor: "pointer" }}>
                        <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{subcategory.label}</span>
                        <input type="checkbox" checked={selected} disabled={allSelected} onChange={() => setProfessions((current) => {
                          const withoutAll = current.filter((item) => item !== allValue);
                          return withoutAll.includes(value) ? withoutAll.filter((item) => item !== value) : [...withoutAll, value];
                        })} style={{ flex: "0 0 auto", width: 17, height: 17, accentColor: "var(--primary)" }} />
                      </label>;
                    })}
                  </div>
                  </div>}
                </div>;
              })}
              <div style={{ border: `1px solid ${expandedSupervisorOptions || SUPERVISOR_CAPABILITIES.some((capability) => professions.includes(capability)) ? "var(--primary)" : "var(--border)"}`, borderRadius: 12, overflow: "hidden", background: "white" }}>
                <button type="button" onClick={() => setExpandedSupervisorOptions((current) => !current)} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center", gap: 12, width: "100%", minHeight: 54, padding: "10px 12px", background: expandedSupervisorOptions ? "#f0f7ff" : "white", color: "var(--text)", textAlign: "left" }}><span style={{ minWidth: 0 }}><strong style={{ display: "block", fontSize: 14, lineHeight: 1.35, overflowWrap: "anywhere" }}>სამუშაოთა ხელმძღვანელი (პრარაბი / ბრიგადირი)</strong><span style={{ display: "block", marginTop: 2, color: expandedSupervisorOptions || SUPERVISOR_CAPABILITIES.some((capability) => professions.includes(capability)) ? "var(--primary)" : "var(--text3)", fontSize: 12, lineHeight: 1.3, fontWeight: 800 }}>{(() => { const count = SUPERVISOR_CAPABILITIES.filter((capability) => professions.includes(capability)).length; return count ? `${count} სამუშაო არჩეული` : "არაფერი არჩეული"; })()}</span></span><span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1, color: "var(--primary)" }}>{expandedSupervisorOptions ? "⌃" : "⌄"}</span></button>
                {expandedSupervisorOptions && <div style={{ display: "grid", gap: 7, padding: 12, borderTop: "1px solid var(--border)", background: "#f8fafc" }}>{SUPERVISOR_CAPABILITIES.map((capability) => <label key={capability} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 42, padding: "8px 10px", borderRadius: 9, background: professions.includes(capability) ? "#f0f7ff" : "white", color: professions.includes(capability) ? "var(--primary)" : "var(--text2)", fontSize: 13, lineHeight: 1.35, fontWeight: 800, cursor: "pointer" }}><span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{capability}</span><input type="checkbox" checked={professions.includes(capability)} onChange={() => toggleProfession(capability)} style={{ flex: "0 0 auto", width: 17, height: 17, accentColor: "var(--primary)" }} /></label>)}</div>}
              </div>
            </div>
            <section style={{ marginTop: 16 }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: 15,
                  lineHeight: 1.35,
                  fontWeight: 900,
                  color: "var(--text)",
                }}
              >
                დამატებითი ინფორმაცია
              </h3>
              <p
                style={{
                  margin: "4px 0 8px",
                  color: "var(--text2)",
                  fontSize: 12,
                  lineHeight: 1.45,
                  fontWeight: 750,
                }}
              >
                მოკლედ მიუთითე მნიშვნელოვანი დეტალი, რომელიც კლიენტმა წინასწარ უნდა იცოდეს.
              </p>
              <textarea
                value={extraWorkComment}
                onChange={(event) => setExtraWorkComment(event.target.value)}
                placeholder="მაგ: მასალითაც ვმუშაობ, თბილისის გარეთაც გავდივარ..."
                rows={3}
                className="profile-extra-info"
                style={{
                  width: "100%",
                  minHeight: 92,
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "white",
                  color: "var(--text)",
                  fontSize: 14,
                  lineHeight: 1.45,
                  fontWeight: 700,
                  resize: "vertical",
                }}
              />
            </section>
            <div style={{ marginTop: 16 }}>
              <h3
                style={{
                  margin: "0 0 10px",
                  fontSize: 15,
                  fontWeight: 900,
                  color: "var(--text)",
                }}
              >
                ფასი
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
                აირჩიე, როგორ გამოჩნდეს ფასი კლიენტისთვის.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                {[
                  { value: "fixed" as const, label: "ზუსტი ფასი" },
                  { value: "from" as const, label: "ფასი იწყება" },
                  { value: "negotiable" as const, label: "შეთანხმებით" },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      if (item.value === "negotiable") {
                        setPriceType("range");
                        setPriceMin("");
                        setPriceMax("");
                        setPriceTouched(false);
                        setProfileSaveError((current) =>
                          current.startsWith("ფასი") ? "" : current
                        );
                        return;
                      }
                      setPriceType(item.value);
                      setPriceMax("");
                      setPriceTouched(false);
                    }}
                    style={{
                      minHeight: 46,
                      borderRadius: 12,
                      border: `1px solid ${
                        priceChoice === item.value ? "var(--primary)" : "var(--border)"
                      }`,
                      background: priceChoice === item.value ? "var(--primary)" : "white",
                      color: priceChoice === item.value ? "white" : "var(--text2)",
                      padding: "6px 5px",
                      fontSize: 12,
                      lineHeight: 1.2,
                      fontWeight: 900,
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              {priceChoice !== "negotiable" && (
                <label
                  style={{
                    display: "block",
                    marginTop: 12,
                    color: "var(--text2)",
                    fontSize: 12,
                    lineHeight: 1.35,
                    fontWeight: 900,
                  }}
                >
                  {priceChoice === "fixed" ? "ფასი" : "ფასი იწყება"}
                  <span style={{ display: "block", position: "relative", marginTop: 7 }}>
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={priceMin}
                      onChange={(event) => {
                        setPriceMin(event.target.value);
                        setPriceTouched(true);
                        setProfileSaveError("");
                      }}
                      onBlur={() => setPriceTouched(true)}
                      style={{
                        width: "100%",
                        height: 46,
                        padding: "0 42px 0 12px",
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        background: "white",
                        color: "var(--text)",
                        fontSize: 15,
                        fontWeight: 800,
                      }}
                    />
                    <span
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        top: "50%",
                        right: 14,
                        transform: "translateY(-50%)",
                        color: "var(--text2)",
                        fontSize: 15,
                        fontWeight: 900,
                        pointerEvents: "none",
                      }}
                    >
                      ₾
                    </span>
                  </span>
                </label>
              )}
              <div
                style={{
                  marginTop: 8,
                  color: visiblePriceValidationError ? "#dc2626" : "var(--text2)",
                  fontSize: 12,
                  lineHeight: 1.45,
                  fontWeight: 800,
                }}
              >
                {visiblePriceValidationError || `გამოჩნდება ასე: ${profilePrice}`}
              </div>
            </div>
          </section>
          )}

          {profileSection === "portfolio" && (
            <section style={{ marginTop: 24 }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 19, fontWeight: 900, color: "var(--text)" }}>ნამუშევრები</h2>
              <p style={{ margin: "0 0 14px", color: "var(--text2)", fontSize: 12, lineHeight: 1.45, fontWeight: 700 }}>
                ატვირთე რეალური შესრულებული სამუშაო. კლიენტი პროფესიისა და აღწერის მიხედვით ნახავს შენს გამოცდილებას.
              </p>
              <input ref={portfolioInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple style={{ display: "none" }} onChange={(event) => { void handlePortfolioUpload(Array.from(event.target.files || []), portfolioReplaceId); event.currentTarget.value = ""; }} />
              <div style={{ display: "grid", gridTemplateColumns: portfolioItems.length ? "minmax(0, 1fr) auto" : "1fr", gap: 8 }}>
                <button type="button" disabled={portfolioBusy} onClick={() => { setPortfolioReplaceId(""); portfolioInputRef.current?.click(); }} style={{ width: "100%", minHeight: 48, borderRadius: 12, background: "var(--primary)", color: "white", fontSize: 14, fontWeight: 900, opacity: portfolioBusy ? .55 : 1 }}>
                  {portfolioBusy ? "ფოტოები იტვირთება..." : "ნამუშევრების ფოტოების დამატება"}
                </button>
                {portfolioItems.length > 0 && <button type="button" disabled={portfolioBusy} onClick={() => void handleRemoveAllPortfolioItems()} style={{ minHeight: 48, padding: "0 12px", borderRadius: 12, background: "white", color: "#b91c1c", border: "1px solid #fecaca", fontSize: 12, fontWeight: 900 }}>ყველას წაშლა</button>}
              </div>
              {portfolioError && <p style={{ margin: "10px 0 0", color: "#b91c1c", fontSize: 12, fontWeight: 800, lineHeight: 1.4 }}>{portfolioError}</p>}
              {portfolioItems.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>{portfolioItems.map((item) => <div key={item.id} style={{ minWidth: 0 }}><img src={item.image_url} alt="ნამუშევარი" style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: 12, border: "1px solid var(--border)", display: "block" }} /><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }}><button type="button" disabled={portfolioBusy} onClick={() => { setPortfolioReplaceId(item.id); portfolioInputRef.current?.click(); }} style={{ minHeight: 34, borderRadius: 8, background: "#eef6ff", color: "var(--primary)", border: "1px solid #bfdbfe", fontSize: 11, fontWeight: 900 }}>ჩანაცვლება</button><button type="button" disabled={portfolioBusy} onClick={() => void handleRemovePortfolioItem(item)} style={{ minHeight: 34, borderRadius: 8, background: "white", color: "#b91c1c", border: "1px solid #fecaca", fontSize: 11, fontWeight: 900 }}>წაშლა</button></div></div>)}</div>}
              {!portfolioItems.length && <p style={{ margin: "14px 0 0", color: "var(--text2)", fontSize: 12, fontWeight: 700 }}>ჯერ ფოტო არ დაგიმატებია. მაქსიმუმ 15 ნამუშევარი შეგიძლია აჩვენო.</p>}
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
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) handleVerificationUpload(item.key, file);
                          // The same corrected file can be selected again after an error.
                          event.currentTarget.value = "";
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
                      <div style={{ marginTop: 8, color: "var(--text3)", fontSize: 11, lineHeight: 1.45, fontWeight: 750 }}>
                        დოკუმენტი მკაფიოდ უნდა ჩანდეს. მიიღება JPG, PNG, WebP ან PDF; საბოლოოდ მას Admin ამოწმებს.
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
                marginTop: 18,
                ...profileSaveButtonStyle,
              }}
            >
              {profileSaveLabel}
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
              პერიოდის დამატება
            </button>
            <p style={{ margin: "8px 0 0", color: "var(--text2)", fontSize: 11, fontWeight: 700, lineHeight: 1.4 }}>
              პერიოდის დამატების შემდეგ ქვემოთ დააჭირე „შენახვას“, რათა ხელოსნის კალენდარიც განახლდეს.
            </p>
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
                  marginTop: 20,
                  ...profileSaveButtonStyle,
                }}
              >
                {profileSaveLabel}
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
            onClick={() => setLogoutConfirmOpen(true)}
            style={{
              width: "100%",
              minHeight: 46,
              margin: "24px 0 8px",
              borderRadius: 12,
              background: "white",
              color: "#ef4444",
              border: "1px solid #fecaca",
              fontSize: 14,
              fontWeight: 900,
              textAlign: "center",
              padding: "0 14px",
            }}
          >
            <span aria-hidden="true" style={{ marginRight: 8 }}>↪</span>
            ანგარიშიდან გასვლა
          </button>

          {logoutConfirmOpen && (
            <div
              role="dialog"
              aria-modal="true"
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 120,
                display: "flex",
                alignItems: "flex-end",
                background: "rgba(15,23,42,0.42)",
              }}
            >
              <div
                style={{
                  width: "100%",
                  padding: "20px 24px calc(24px + var(--safe-bottom))",
                  borderRadius: "18px 18px 0 0",
                  background: "white",
                }}
              >
                <h2 style={{ margin: 0, color: "var(--text)", fontSize: 18, lineHeight: 1.3, fontWeight: 900 }}>
                  ანგარიშიდან გასვლა?
                </h2>
                <p style={{ margin: "8px 0 18px", color: "var(--text2)", fontSize: 13, lineHeight: 1.45, fontWeight: 700 }}>
                  გასვლის შემდეგ ამ მოწყობილობაზე თავიდან შესვლა დაგჭირდება.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setLogoutConfirmOpen(false)}
                    style={{ minHeight: 46, borderRadius: 12, background: "white", color: "var(--text2)", border: "1px solid var(--border)", fontSize: 14, fontWeight: 900 }}
                  >
                    დარჩენა
                  </button>
                  <button
                    type="button"
                    onClick={onLogout}
                    style={{ minHeight: 46, borderRadius: 12, background: "#ef4444", color: "white", fontSize: 14, fontWeight: 900 }}
                  >
                    გასვლა
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {bookingReasonAction && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 110,
            display: "flex",
            alignItems: "flex-end",
            background: "rgba(15,23,42,0.42)",
          }}
        >
          <div
            style={{
              width: "100%",
              maxHeight: "86%",
              overflowY: "auto",
              padding: "22px 22px max(22px, env(safe-area-inset-bottom))",
              borderRadius: "22px 22px 0 0",
              background: "white",
              boxShadow: "0 -18px 45px rgba(15,23,42,0.18)",
            }}
          >
            <h2 style={{ margin: "0 0 8px", color: "var(--text)", fontSize: 21, fontWeight: 900 }}>
              {bookingReasonAction.kind === "decline" ? "ჯავშნის უარყოფა" : "სამუშაო ვერ სრულდება"}
            </h2>
            <p style={{ margin: "0 0 16px", color: "var(--text2)", fontSize: 13, lineHeight: 1.55 }}>
              {bookingReasonAction.kind === "decline"
                ? "კლიენტი მიზეზს შეტყობინებაში ნახავს და შეძლებს სხვა ხელოსნის არჩევას."
                : "კლიენტს და Admin-ს ეცნობება მიზეზი. ჯავშანი გადავა გადამოწმებაზე; თანხის გადაწყვეტილებას სისტემა/Admin მიიღებს."}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(bookingReasonAction.kind === "decline"
                ? ["დრო არ მაქვს", "მისამართი ძალიან შორსაა", "ეს საქმე ჩემი სფერო არაა", "მოთხოვნა ბუნდოვანია", "სხვა მიზეზი"]
                : ["სამუშაო მოცულობა აღწერილს არ შეესაბამება", "უსაფრთხოდ შესრულება შეუძლებელია", "საჭირო სპეციალისტი/ინსტრუმენტი არ მაქვს", "კლიენტი ადგილზე არ დამხვდა", "სხვა მიზეზი"]
              ).map((reason) => {
                const selected = bookingReason === reason;
                return (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => { setBookingReason(reason); setBookingReasonError(""); }}
                    style={{
                      minHeight: 44,
                      padding: "10px 12px",
                      textAlign: "left",
                      borderRadius: 11,
                      border: `1px solid ${selected ? "#17243a" : "var(--border)"}`,
                      background: selected ? "#17243a" : "white",
                      color: selected ? "white" : "var(--text)",
                      fontSize: 13,
                      fontWeight: 850,
                    }}
                  >
                    {reason}
                  </button>
                );
              })}
            </div>
            <label style={{ display: "block", marginTop: 16, color: "var(--text2)", fontSize: 12, fontWeight: 850 }}>
              დამატებითი განმარტება (სურვილისამებრ)
              <textarea
                value={bookingReasonNote}
                onChange={(event) => setBookingReasonNote(event.target.value)}
                placeholder="მოკლედ აუხსენით რა მოხდა..."
                style={{
                  width: "100%",
                  minHeight: 82,
                  boxSizing: "border-box",
                  resize: "vertical",
                  marginTop: 7,
                  padding: 11,
                  borderRadius: 11,
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  fontFamily: "inherit",
                  fontSize: 13,
                }}
              />
            </label>
            {bookingReasonError && (
              <div style={{ marginTop: 10, color: "#b91c1c", fontSize: 12, fontWeight: 800 }}>
                {bookingReasonError}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button
                type="button"
                onClick={() => setBookingReasonAction(null)}
                disabled={Boolean(bookingActionId)}
                style={{ flex: 1, minHeight: 48, borderRadius: 12, background: "#f1f5f9", color: "var(--text)", fontWeight: 900 }}
              >
                უკან
              </button>
              <button
                type="button"
                onClick={submitBookingReasonAction}
                disabled={Boolean(bookingActionId)}
                style={{ flex: 1, minHeight: 48, borderRadius: 12, background: "#c2410c", color: "white", fontWeight: 900, opacity: bookingActionId ? 0.7 : 1 }}
              >
                {bookingActionId ? "იგზავნება..." : "გაგზავნა"}
              </button>
            </div>
          </div>
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
              maxHeight: "86%",
              overflowY: "auto",
              padding: "22px 22px max(22px, env(safe-area-inset-bottom))",
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
                  დაასრულე საქმე და შეაფასე კლიენტი
                </h2>
                <p
                  style={{
                    margin: "0 0 18px",
                    color: "var(--text2)",
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  შემდეგ ეტაპზე შეაფასებ კლიენტს. შეფასების შენახვის შემდეგ
                  ჯავშანი დასრულებულად მოინიშნება და კლიენტს შეტყობინება გაეგზავნება.
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
                    შემდეგი
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
              const paymentMeta = getWorkerPaymentMeta(
                detailsBooking,
                platformSettings.bookingFee
              );
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
                    onClick={() => openBookingReasonAction(detailsBooking, "decline")}
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
