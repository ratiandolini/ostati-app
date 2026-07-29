import React, { useEffect, useMemo, useState } from "react";
import { BookingStatus, User } from "../types";
import { actionButton, adminCard } from "../components/admin/adminUi";
import {
  accountLabel,
  adminAccountLabel,
  auditLabel,
  paymentStatusHelp,
  paymentStatusLabel,
  paymentStatusShortLabel,
  statusLabel,
  verificationLabel,
} from "../components/admin/adminLabels";
import {
  deriveVerificationStatus,
  disputePriorityScore,
  disputeStatusUi,
  formatDate,
  hoursSince,
  isActiveStatus,
  isClosedStatus,
  matchesQuery,
  money,
  parseFirstAmount,
  penaltyAmountForBooking,
} from "../components/admin/adminUtils";
import {
  clearCachedPreflightState,
  getPreflightCacheScope,
  loadCachedPreflightState,
  PREFLIGHT_MAX_AGE_MS,
  saveCachedPreflightState,
} from "../components/admin/adminPreflightCache";
import {
  appendDemoSystemMessage,
  prependDemoBookingNotification,
  prependDemoCraftsmanNotification,
} from "../components/admin/adminDemoEffects";
import {
  apiMigrationStatusUi,
  bookingStatusPriority,
  mobileQaTestGuide,
  preflightStatusUi,
  qaAreaLabel,
  qaAreaOrder,
} from "../components/admin/adminQaConfig";
import {
  allAdminTabs,
  tabPermission,
} from "../components/admin/adminPermissions";
import type {
  AdminPermission,
  AdminTab,
} from "../components/admin/adminPermissions";
import type {
  AdminStatusFilter,
  DisputeView,
  VerificationFilter,
} from "../components/admin/adminTypes";
import {
  getAdminSummaryCards,
  getAdminWorkQueueItems,
} from "../components/admin/adminOverviewConfig";
import { AdminBookingsTab } from "../components/admin/AdminBookingsTab";
import { AdminDisputesTab } from "../components/admin/AdminDisputesTab";
import { AdminOverviewTab } from "../components/admin/AdminOverviewTab";
import { AdminVerificationTab } from "../components/admin/AdminVerificationTab";
import { getProductionGuardItems } from "../components/admin/adminProductionGuard";
import {
  adminProviderFields,
  legalSettingFields,
  platformSettingNumberFields,
} from "../components/admin/adminSettingsConfig";
import { dataService, isDemoDataMode } from "../services/dataService";
import {
  apiMigrationItems,
  getApiMigrationSummary,
} from "../services/apiMigrationService";
import {
  loadAdminBookings,
  loadAdminDisputes,
  loadAdminLaunchState,
  loadAdminUsers,
  loadCurrentAdminContext,
  markAdminDisputeReviewing,
  reviewAdminWorkerVerification,
  resolveAdminDisputeAction,
  saveAdminLaunchSettings,
  updateAdminAccountStatus,
  updateAdminBookingAction,
  updateAdminMemberState,
  updateLaunchChecklistItem,
} from "../services/adminApiService";
import type {
  AdminBookingAction,
  AdminDisputeResolution,
  AdminLaunchState,
  AdminUserSummary,
  AdminVerificationStatus,
  CurrentAdminContext,
} from "../services/adminApiService";
import { appStorage } from "../services/appStorage";
import {
  getLaunchReadinessChecks,
  getSystemReadinessChecks,
} from "../services/readinessService";
import {
  runSupabasePreflightChecks,
} from "../services/supabasePreflightService";
import type { SupabasePreflightCheck } from "../services/supabasePreflightService";
import { createSignedStorageUrl } from "../services/supabaseStorageService";
import type {
  AdminAuditLog,
  AdminMember,
  BookingDispute,
  ClientProfile,
  CraftsmanBookingRequest,
  CraftsmanProfile,
  LegalSettings,
  MobileQaScenario,
  PlatformSettings,
  PrePaymentChecklistItem,
} from "../services/dataService";
import type { Booking } from "./BookingsScreen";

interface AdminScreenProps {
  user: User;
  onLogout: () => void;
}

export const AdminScreen: React.FC<AdminScreenProps> = ({ user, onLogout }) => {
  const cachedPreflightState = useMemo(loadCachedPreflightState, []);
  const preflightScope = useMemo(getPreflightCacheScope, []);
  const [tab, setTab] = useState<AdminTab>("overview");
  const [adminQuery, setAdminQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<AdminStatusFilter>("all");
  const [verificationFilter, setVerificationFilter] =
    useState<VerificationFilter>("all");
  const [disputeView, setDisputeView] = useState<DisputeView>("active");
  const [selectedDisputeId, setSelectedDisputeId] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [activeAdminMemberId, setActiveAdminMemberId] = useState("owner");
  const [selectedVerificationWorkerId, setSelectedVerificationWorkerId] =
    useState("");
  const [settingsDraft, setSettingsDraft] = useState<PlatformSettings>(() =>
    appStorage.getPlatformSettings()
  );
  const [legalDraft, setLegalDraft] = useState<LegalSettings>(() =>
    appStorage.getLegalSettings()
  );
  const [adminLaunchState, setAdminLaunchState] =
    useState<AdminLaunchState | null>(null);
  const [adminBookingsState, setAdminBookingsState] = useState<{
    clientBookings: Booking[];
    requests: CraftsmanBookingRequest[];
  } | null>(null);
  const [adminDisputesState, setAdminDisputesState] =
    useState<BookingDispute[] | null>(null);
  const [adminUsersState, setAdminUsersState] =
    useState<AdminUserSummary[] | null>(null);
  const [currentAdminContext, setCurrentAdminContext] =
    useState<CurrentAdminContext | null>(null);
  const [adminApiLoading, setAdminApiLoading] = useState(false);
  const [adminActionId, setAdminActionId] = useState<string | null>(null);
  const [adminApiError, setAdminApiError] = useState("");
  const [adminApiSuccess, setAdminApiSuccess] = useState("");
  const [signedVerificationUrls, setSignedVerificationUrls] = useState<
    Record<string, string>
  >({});
  const [signedDisputeEvidenceUrls, setSignedDisputeEvidenceUrls] = useState<
    Record<string, string>
  >({});
  const [preflightChecks, setPreflightChecks] = useState<
    SupabasePreflightCheck[]
  >(cachedPreflightState.checks);
  const [preflightCheckedAt, setPreflightCheckedAt] = useState<string | null>(
    cachedPreflightState.checkedAt
  );
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [settingsSaveMessage, setSettingsSaveMessage] = useState("");
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((current) => current + 1);
  const preflightSummary = useMemo(
    () =>
      preflightChecks.reduce(
        (summary, check) => ({
          ok: summary.ok + Number(check.status === "ok"),
          warning: summary.warning + Number(check.status === "warning"),
          error: summary.error + Number(check.status === "error"),
          requiredErrors:
            summary.requiredErrors +
            Number(check.required !== false && check.status === "error"),
        }),
        { ok: 0, warning: 0, error: 0, requiredErrors: 0 }
      ),
    [preflightChecks]
  );
  const preflightFresh = Boolean(
    preflightCheckedAt &&
      Date.now() - new Date(preflightCheckedAt).getTime() <= PREFLIGHT_MAX_AGE_MS
  );

  useEffect(() => {
    if (isDemoDataMode) return;

    let cancelled = false;
    setAdminApiLoading(true);
    setAdminApiError("");
    setAdminApiSuccess("");

    const loadState = async () => {
      try {
        const context = await loadCurrentAdminContext();
        const contextCan = (permission: AdminPermission) =>
          context.member.role === "owner" ||
          context.member.permissions.includes(permission);
        const [state, adminBookings, adminDisputes, adminUsers] = await Promise.all([
          loadAdminLaunchState(),
          contextCan("bookings") || contextCan("finance") || contextCan("disputes")
            ? loadAdminBookings()
            : Promise.resolve(null),
          contextCan("disputes") || contextCan("finance")
            ? loadAdminDisputes()
            : Promise.resolve([]),
          contextCan("users") ? loadAdminUsers() : Promise.resolve([]),
        ]);
        if (cancelled) return;
        setCurrentAdminContext(context);
        setActiveAdminMemberId(context.member.id);
        setAdminLaunchState(state);
        setAdminBookingsState(adminBookings);
        setAdminDisputesState(adminDisputes);
        setAdminUsersState(adminUsers);
        setSettingsDraft(state.platformSettings);
        setLegalDraft(state.legalSettings);
      } catch (error) {
        if (cancelled) return;
        setAdminApiError(
          error instanceof Error
            ? error.message
            : "Admin მონაცემები ვერ ჩაიტვირთა"
        );
      } finally {
        if (!cancelled) setAdminApiLoading(false);
      }
    };

    loadState();

    return () => {
      cancelled = true;
    };
  }, [version]);

  const runPreflight = async () => {
    if (isDemoDataMode) {
      setPreflightChecks([
        {
          id: "demo_mode",
          label: "Demo რეჟიმი",
          area: "config",
          status: "warning",
          detail:
            "ახლა აპი local/demo მონაცემებს იყენებს. Supabase preflight რეალურ რეჟიმში გამოჩნდება.",
          nextAction: "ჩართე REACT_APP_DATA_MODE=supabase და შედი Admin ანგარიშით.",
          required: true,
        },
      ]);
      return;
    }

    setPreflightLoading(true);
    setAdminApiError("");
    setAdminApiSuccess("");
    try {
      const checks = await runSupabasePreflightChecks();
      const checkedAt = new Date().toISOString();
      setPreflightChecks(checks);
      setPreflightCheckedAt(checkedAt);
      saveCachedPreflightState({
        checks,
        checkedAt,
        scope: preflightScope,
      });

      const requiredErrors = checks.filter(
        (check) => check.required !== false && check.status === "error"
      ).length;
      const hasActiveSession = checks.some(
        (check) => check.id === "session" && check.status === "ok"
      );
      const supabaseChecklistItem = prePaymentChecklist.find(
        (item) => item.id === "supabase"
      );

      if (requiredErrors === 0 && hasActiveSession && supabaseChecklistItem?.done === false) {
        applyAdminLaunchState(await updateLaunchChecklistItem("supabase", true));
        setAdminApiSuccess(
          "Supabase preflight მწვანეა და checklist-ში Supabase/API პუნქტი ავტომატურად დაიხურა."
        );
      } else if (requiredErrors === 0 && hasActiveSession) {
        setAdminApiSuccess("Supabase preflight მწვანეა. აუცილებელი შეცდომა არ დარჩა.");
      }
    } catch (error) {
      setAdminApiError(
        error instanceof Error ? error.message : "Supabase preflight ვერ დასრულდა"
      );
    } finally {
      setPreflightLoading(false);
    }
  };

  const resetPreflightCache = () => {
    clearCachedPreflightState();
    setPreflightChecks([]);
    setPreflightCheckedAt(null);
    setAdminApiSuccess("Supabase preflight cache გასუფთავდა. თავიდან გაუშვი შემოწმება.");
    setAdminApiError("");
  };

  const fallbackStorage = isDemoDataMode ? dataService : appStorage;
  const profile = useMemo(() => fallbackStorage.getCraftsmanProfile(), [version]);
  const requests = useMemo(
    () => adminBookingsState?.requests ?? fallbackStorage.getCraftsmanRequests(),
    [adminBookingsState, version]
  );
  const clientBookings = useMemo(
    () => adminBookingsState?.clientBookings ?? fallbackStorage.getClientBookings(),
    [adminBookingsState, version]
  );
  const disputes = useMemo(
    () => adminDisputesState ?? fallbackStorage.getBookingDisputes(),
    [adminDisputesState, version]
  );
  const auditLogs = useMemo(
    () => adminLaunchState?.auditLogs ?? fallbackStorage.getAdminAuditLogs(),
    [adminLaunchState, version]
  );
  const adminMembers = useMemo(
    () => adminLaunchState?.adminMembers ?? fallbackStorage.getAdminMembers(),
    [adminLaunchState, version]
  );
  const currentAdminMember =
    (!isDemoDataMode && currentAdminContext?.member.active
      ? currentAdminContext.member
      : undefined) ||
    adminMembers.find(
      (member) => member.id === activeAdminMemberId && member.active
    ) ||
    adminMembers.find((member) => member.id === "owner" && member.active) ||
    adminMembers.find((member) => member.active) ||
    adminMembers[0];
  const isOwner = currentAdminMember?.role === "owner";
  const can = (permission: AdminPermission) =>
    Boolean(isOwner || currentAdminMember?.permissions.includes(permission));
  const canOpenTab = (targetTab: AdminTab) => {
    const permission = tabPermission[targetTab];
    return permission === "overview" || can(permission);
  };
  const availableTabs = allAdminTabs.filter(([id]) => canOpenTab(id));

  useEffect(() => {
    if (!canOpenTab(tab)) {
      setTab(availableTabs[0]?.[0] || "overview");
    }
  }, [activeAdminMemberId, adminMembers, tab]);
  const platformSettings = useMemo(
    () =>
      adminLaunchState?.platformSettings ?? fallbackStorage.getPlatformSettings(),
    [adminLaunchState, version]
  );
  const legalSettings = useMemo(
    () => adminLaunchState?.legalSettings ?? fallbackStorage.getLegalSettings(),
    [adminLaunchState, version]
  );
  const prePaymentChecklist = useMemo(
    () =>
      adminLaunchState?.prePaymentChecklist ??
      fallbackStorage.getPrePaymentChecklist(),
    [adminLaunchState, version]
  );
  const mobileQaScenarios = useMemo(
    () =>
      adminLaunchState?.mobileQaScenarios ??
      fallbackStorage.getMobileQaScenarios(),
    [adminLaunchState, version]
  );
  const verificationQueue = adminLaunchState?.verificationQueue ?? [];
  const verificationTarget =
    verificationQueue.find((item) => item.workerId === selectedVerificationWorkerId) ??
    verificationQueue.find((item) => item.verificationStatus === "pending") ??
    verificationQueue[0];
  const filteredVerificationQueue = verificationQueue.filter((item) => {
    const statusMatched =
      verificationFilter === "all" || item.verificationStatus === verificationFilter;
    return (
      statusMatched &&
      matchesQuery(adminQuery, [
        item.name,
        item.phone,
        item.city || "",
        item.verificationStatus,
      ])
    );
  });
  const mobileQaDoneCount = mobileQaScenarios.filter((item) => item.done).length;
  const mobileQaNotes = mobileQaScenarios
    .filter((item) => Boolean(item.note?.trim()))
    .map((item) => ({
      id: item.id,
      area: qaAreaLabel[item.area],
      label: item.label,
      done: item.done,
      note: item.note?.trim() || "",
    }));
  const prePaymentDoneCount = prePaymentChecklist.filter((item) => item.done).length;
  const mobileQaProgressByArea = qaAreaOrder.map((area) => {
    const items = mobileQaScenarios.filter((item) => item.area === area);
    const done = items.filter((item) => item.done).length;
    return {
      area,
      label: qaAreaLabel[area],
      done,
      total: items.length,
      complete: items.length > 0 && done === items.length,
    };
  });
  const remainingMobileQaScenarios = mobileQaScenarios.filter((item) => !item.done);
  const nextMobileQaScenario = remainingMobileQaScenarios[0];
  const systemReadinessChecks = useMemo(
    () => getSystemReadinessChecks(platformSettings),
    [platformSettings]
  );
  const apiMigrationSummary = useMemo(getApiMigrationSummary, []);
  const blockingSystemChecks = systemReadinessChecks.filter(
    (item) => item.severity === "blocked"
  );
  const verificationStatus = verificationTarget
    ? verificationTarget.verificationStatus === "not_started"
      ? "not_submitted"
      : verificationTarget.verificationStatus
    : deriveVerificationStatus(profile);
  const verificationDocuments = verificationTarget
    ? {
        idFront: verificationTarget.documents.idFront || undefined,
        idBack: verificationTarget.documents.idBack || undefined,
        bankAccount: verificationTarget.documents.bankAccount || undefined,
      }
    : profile.verificationDocuments || {};
  const verification = verificationTarget
    ? {
        idFront: Boolean(verificationDocuments.idFront),
        idBack: Boolean(verificationDocuments.idBack),
        bankAccount: Boolean(verificationDocuments.bankAccount),
      }
    : profile.verification || {
        idFront: false,
        idBack: false,
        bankAccount: false,
      };
  const uploadedDocumentCount = Object.values(verification).filter(Boolean).length;

  useEffect(() => {
    if (!verificationQueue.length) {
      setSelectedVerificationWorkerId("");
      return;
    }
    if (
      selectedVerificationWorkerId &&
      verificationQueue.some((item) => item.workerId === selectedVerificationWorkerId)
    ) {
      return;
    }
    const next =
      verificationQueue.find((item) => item.verificationStatus === "pending") ??
      verificationQueue[0];
    setSelectedVerificationWorkerId(next.workerId);
  }, [selectedVerificationWorkerId, verificationQueue]);

  useEffect(() => {
    if (isDemoDataMode || !verificationTarget) {
      setSignedVerificationUrls({});
      return;
    }

    let cancelled = false;
    const loadSignedUrls = async () => {
      const entries = await Promise.all(
        (["idFront", "idBack"] as const).map(async (key) => {
          const value = verificationDocuments[key];
          if (!value) return [key, ""] as const;
          if (value.startsWith("data:")) return [key, value] as const;
          try {
            return [
              key,
              await createSignedStorageUrl("verification-documents", value),
            ] as const;
          } catch (error) {
            console.error(error);
            return [key, ""] as const;
          }
        })
      );
      if (!cancelled) {
        setSignedVerificationUrls(
          entries.reduce<Record<string, string>>((next, [key, value]) => {
            next[key] = value;
            return next;
          }, {})
        );
      }
    };

    loadSignedUrls();

    return () => {
      cancelled = true;
    };
  }, [
    verificationDocuments.idFront,
    verificationDocuments.idBack,
    verificationTarget,
  ]);

  useEffect(() => {
    const evidenceItems: Array<{ key: string; url: string }> = [];
    disputes.forEach((dispute) => {
      (dispute.evidence || []).forEach((item, index) => {
        evidenceItems.push({
        key: `${dispute.id}:${index}`,
        url: item.url,
        });
      });
    });

    if (isDemoDataMode || evidenceItems.length === 0) {
      setSignedDisputeEvidenceUrls({});
      return;
    }

    let cancelled = false;
    const loadSignedUrls = async () => {
      const entries = await Promise.all(
        evidenceItems.map(async (item) => {
          if (!item.url || item.url.startsWith("data:") || item.url.startsWith("http")) {
            return [item.key, item.url] as const;
          }
          try {
            return [
              item.key,
              await createSignedStorageUrl("booking-photos", item.url),
            ] as const;
          } catch (error) {
            console.error(error);
            return [item.key, ""] as const;
          }
        })
      );
      if (!cancelled) {
        setSignedDisputeEvidenceUrls(
          entries.reduce<Record<string, string>>((next, [key, value]) => {
            next[key] = value;
            return next;
          }, {})
        );
      }
    };

    loadSignedUrls();

    return () => {
      cancelled = true;
    };
  }, [disputes]);

  const openDisputes = disputes.filter((dispute) => dispute.status !== "resolved");
  const urgentDisputes = openDisputes.filter(
    (dispute) => disputePriorityScore(dispute) >= 3
  );
  const pendingRequests = requests.filter((request) => request.status === "pending");
  const activeBookings = clientBookings.filter((booking) =>
    ["pending", "confirmed", "en_route", "started", "worker_completed"].includes(
      booking.status || "pending"
    )
  );
  const financialSummary = clientBookings.reduce(
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
  const platformIncome = financialSummary.released;
  const productionReadiness = getLaunchReadinessChecks({
    settings: platformSettings,
    legalSettings,
    verificationStatus,
    prePaymentDoneCount,
    prePaymentTotal: prePaymentChecklist.length,
    mobileQaDoneCount,
    mobileQaTotal: mobileQaScenarios.length,
    activeAdminMemberCount: adminMembers.filter((member) => member.active).length,
    apiMigrationSummary,
  });
  const readyCount = productionReadiness.filter((item) => item.ready).length;
  const draftProductionReadiness = getLaunchReadinessChecks({
    settings: settingsDraft,
    legalSettings: legalDraft,
    verificationStatus,
    prePaymentDoneCount,
    prePaymentTotal: prePaymentChecklist.length,
    mobileQaDoneCount,
    mobileQaTotal: mobileQaScenarios.length,
    activeAdminMemberCount: adminMembers.filter((member) => member.active).length,
    apiMigrationSummary,
  });
  const productionGuardItems = getProductionGuardItems({
    draftProductionReadiness,
    mobileQaNotesCount: mobileQaNotes.length,
    isDemoDataMode,
    preflightChecksCount: preflightChecks.length,
    preflightFresh,
    preflightRequiredErrors: preflightSummary.requiredErrors,
  });
  const checklistItem = (id: string) =>
    prePaymentChecklist.find((item) => item.id === id);
  const qaItem = (id: string) =>
    mobileQaScenarios.find((item) => item.id === id);
  const checklistDone = (id: string) => checklistItem(id)?.done === true;
  const qaDone = (id: string) => qaItem(id)?.done === true;
  const missingChecklistLabels = (ids: string[]) =>
    ids
      .map((id) => checklistItem(id))
      .filter((item): item is PrePaymentChecklistItem => Boolean(item && !item.done))
      .map((item) => item.label);
  const missingQaLabels = (ids: string[]) =>
    ids
      .map((id) => qaItem(id))
      .filter((item): item is MobileQaScenario => Boolean(item && !item.done))
      .map((item) => item.label);
  const supabaseSmokeDone =
    preflightChecks.length > 0 &&
    preflightFresh &&
    preflightSummary.requiredErrors === 0;
  const verificationSmokeMissing = [
    ...(verificationStatus === "verified" ? [] : ["ხელოსნის დოკუმენტების დადასტურება"]),
    ...missingChecklistLabels(["verification"]),
  ];
  const bookingSmokeMissing = [
    ...missingChecklistLabels(["booking_flow"]),
    ...missingQaLabels(["worker_status_flow"]),
  ];
  const chatReviewSmokeMissing = [
    ...missingChecklistLabels(["chat", "reviews"]),
    ...missingQaLabels(["chat_unread", "mobile_reviews"]),
  ];
  const disputeSmokeMissing = missingQaLabels(["admin_dispute"]);
  const launchReportSmokeMissing = productionGuardItems.map((item) => item.label);
  const launchSmokeSteps: Array<{
    id: string;
    label: string;
    detail: string;
    done: boolean;
    missing: string[];
    targetTab: AdminTab;
  }> = [
    {
      id: "supabase",
      label: "Supabase/API შემოწმება",
      detail: preflightCheckedAt
        ? `${preflightScope} · ${formatDate(preflightCheckedAt)}`
        : "Settings-ში გაუშვი Supabase შემოწმება",
      done: supabaseSmokeDone,
      missing: supabaseSmokeDone
        ? []
        : preflightChecks.length === 0
          ? ["Supabase შემოწმება"]
          : !preflightFresh
            ? ["24 საათზე ახალი preflight"]
            : [`${preflightSummary.requiredErrors} აუცილებელი შეცდომა`],
      targetTab: "settings",
    },
    {
      id: "verification",
      label: "ხელოსნის ვერიფიკაცია",
      detail:
        verificationStatus === "verified"
          ? "ხელოსანს სამუშაო ადგილი გახსნილი აქვს"
          : "Admin-მა უნდა დაადასტუროს დოკუმენტები",
      done: verificationStatus === "verified" && checklistDone("verification"),
      missing: verificationSmokeMissing,
      targetTab: "verification",
    },
    {
      id: "booking_flow",
      label: "ჯავშნის სრული flow",
      detail: "კლიენტი ჯავშნის, ხელოსანი ადასტურებს და სტატუსებს ცვლის",
      done: checklistDone("booking_flow") && qaDone("worker_status_flow"),
      missing: bookingSmokeMissing,
      targetTab: "bookings",
    },
    {
      id: "chat_reviews",
      label: "ჩატი, unread და შეფასება",
      detail: "მესიჯის წაკითხვა აქრობს badge-ს, დასრულების შემდეგ review იწერება",
      done:
        checklistDone("chat") &&
        checklistDone("reviews") &&
        qaDone("chat_unread") &&
        qaDone("mobile_reviews"),
      missing: chatReviewSmokeMissing,
      targetTab: "overview",
    },
    {
      id: "disputes",
      label: "დავა და Admin გადაწყვეტა",
      detail: "პრობლემა იხსნება, Admin განიხილავს და ხურავს შედეგით",
      done: qaDone("admin_dispute"),
      missing: disputeSmokeMissing,
      targetTab: "disputes",
    },
    {
      id: "launch_report",
      label: "Final report snapshot",
      detail:
        productionGuardItems.length === 0
          ? "Report მზადაა launch snapshot-ისთვის"
          : `${productionGuardItems.length} blocker დარჩა report-მდე`,
      done: productionGuardItems.length === 0,
      missing: launchReportSmokeMissing,
      targetTab: "settings",
    },
  ];
  const launchSmokeDoneCount = launchSmokeSteps.filter((item) => item.done).length;
  const nextLaunchSmokeStep = launchSmokeSteps.find((item) => !item.done);
  const launchReportSmokeIncomplete =
    launchSmokeDoneCount < launchSmokeSteps.length;
  const launchReportBlockersRemain = productionGuardItems.length > 0;
  const launchReportStatus =
    launchReportSmokeIncomplete || launchReportBlockersRemain
      ? "draft"
      : "launch_ready";
  const launchReportDraftReasons = [
    launchReportBlockersRemain
      ? `Production blocker-ები დარჩენილია: ${productionGuardItems.length}`
      : "",
    launchReportSmokeIncomplete
      ? `Smoke flow დასრულებულია ${launchSmokeDoneCount}/${launchSmokeSteps.length}`
      : "",
    launchReportSmokeIncomplete && nextLaunchSmokeStep
      ? `შემდეგი smoke ნაბიჯი: ${nextLaunchSmokeStep.label}`
      : "",
  ].filter(Boolean);
  const nextProductionGuardItem = productionGuardItems[0];
  const launchNextAction = nextLaunchSmokeStep
    ? {
        tone: "#1d4ed8",
        bg: "#eff6ff",
        border: "#bfdbfe",
        label: nextLaunchSmokeStep.label,
        detail: nextLaunchSmokeStep.missing.length
          ? `აკლია: ${nextLaunchSmokeStep.missing.slice(0, 3).join(", ")}${
              nextLaunchSmokeStep.missing.length > 3 ? "..." : ""
            }`
          : nextLaunchSmokeStep.detail,
        button: "ნაბიჯზე გადასვლა",
        tab: nextLaunchSmokeStep.targetTab,
      }
    : nextProductionGuardItem
      ? {
          tone:
            nextProductionGuardItem.severity === "blocked"
              ? "#b91c1c"
              : "#c2410c",
          bg:
            nextProductionGuardItem.severity === "blocked"
              ? "#fef2f2"
              : "#fff7ed",
          border:
            nextProductionGuardItem.severity === "blocked"
              ? "#fecaca"
              : "#fed7aa",
          label: nextProductionGuardItem.label,
          detail: nextProductionGuardItem.detail,
          button: "გასასწორებლად გადასვლა",
          tab:
            nextProductionGuardItem.id === "admin_roles"
              ? ("users" as AdminTab)
              : ("settings" as AdminTab),
        }
      : {
          tone: "#047857",
          bg: "#f0fdf4",
          border: "#bbf7d0",
          label: "Launch snapshot მზადაა",
          detail:
            "Smoke flow და production blockers დახურულია. შეგიძლია საბოლოო report ჩამოტვირთო.",
          button: "Report ჩამოტვირთვა",
          tab: "settings" as AdminTab,
        };
  const adminClients = (adminUsersState || []).filter(
    (item) => item.role === "client"
  );
  const adminCraftsmen = (adminUsersState || []).filter(
    (item) => item.role === "craftsman"
  );
  const clients = Array.from(
    new Set(requests.map((request) => request.clientPhone).filter(Boolean))
  ) as string[];
  const disputeMatchesQuery = (dispute: BookingDispute) =>
    matchesQuery(adminQuery, [
      dispute.reason,
      dispute.details,
      dispute.bookingId,
      dispute.status,
      dispute.resolution,
      dispute.adminNote,
      dispute.clientName,
      dispute.workerName,
      dispute.service,
    ]);
  const activeDisputes = disputes.filter((dispute) => dispute.status !== "resolved");
  const reviewingDisputes = disputes.filter((dispute) => dispute.status === "reviewing");
  const archiveDisputes = disputes.filter((dispute) => dispute.status === "resolved");
  const disputeViewCounts: Record<DisputeView, number> = {
    active: activeDisputes.length,
    urgent: disputes.filter(
      (dispute) =>
        dispute.status !== "resolved" && disputePriorityScore(dispute) >= 3
    ).length,
    reviewing: reviewingDisputes.length,
    archive: archiveDisputes.length,
  };
  const filteredDisputes = disputes
    .filter((dispute) => {
      const viewMatched =
        (disputeView === "active" && dispute.status !== "resolved") ||
        (disputeView === "urgent" &&
          dispute.status !== "resolved" &&
          disputePriorityScore(dispute) >= 3) ||
        (disputeView === "reviewing" && dispute.status === "reviewing") ||
        (disputeView === "archive" && dispute.status === "resolved");
      return viewMatched && disputeMatchesQuery(dispute);
    })
    .sort((a, b) => {
      const priority = disputePriorityScore(b) - disputePriorityScore(a);
      if (priority) return priority;
      return disputeView === "archive"
        ? new Date(b.resolvedAt || b.createdAt).getTime() -
            new Date(a.resolvedAt || a.createdAt).getTime()
        : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  const selectedDispute =
    filteredDisputes.find((dispute) => dispute.id === selectedDisputeId) ||
    filteredDisputes[0];
  useEffect(() => {
    if (!filteredDisputes.length) {
      setSelectedDisputeId("");
      return;
    }
    if (
      selectedDisputeId &&
      filteredDisputes.some((dispute) => dispute.id === selectedDisputeId)
    ) {
      return;
    }
    setSelectedDisputeId(filteredDisputes[0].id);
  }, [filteredDisputes, selectedDisputeId]);
  const filteredRequests = requests
    .filter((request) => {
      const statusMatched =
        statusFilter === "all" ||
        (statusFilter === "active" && isActiveStatus(request.status)) ||
        (statusFilter === "closed" && isClosedStatus(request.status)) ||
        (statusFilter === "problem" && request.status === "disputed");
      return (
        statusMatched &&
        matchesQuery(adminQuery, [
          request.clientName,
          request.clientPhone,
          request.service,
          request.address,
          request.date,
          request.time,
          request.status,
          request.cancellationReason,
          request.disputeReason,
          request.adminNote,
        ])
      );
    })
    .sort((a, b) => {
      const priority =
        bookingStatusPriority[b.status] - bookingStatusPriority[a.status];
      if (priority) return priority;
      return `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);
    });
  const filteredClientBookings = clientBookings.filter((booking) => {
    const statusMatched =
      statusFilter === "all" ||
      (statusFilter === "active" && isActiveStatus(booking.status)) ||
      (statusFilter === "closed" && isClosedStatus(booking.status)) ||
      (statusFilter === "problem" &&
        (booking.status === "disputed" || booking.paymentStatus === "disputed"));
    return (
      statusMatched &&
      matchesQuery(adminQuery, [
        booking.worker.name,
        booking.worker.role,
        booking.dateLabel,
        booking.time,
        booking.status,
        booking.paymentStatus,
        booking.adminNote,
        booking.id,
      ])
    );
  });
  const filteredClients = clients.filter((phone) => {
    const client = fallbackStorage.getClientProfile(phone);
    const status = client.accountStatus || "active";
    const statusMatched =
      statusFilter === "all" ||
      (statusFilter === "active" && status === "active") ||
      (statusFilter === "closed" && status === "blocked") ||
      (statusFilter === "problem" && status !== "active");
    return (
      statusMatched &&
      matchesQuery(adminQuery, [
        phone,
        client.firstName,
        client.lastName,
        client.city,
        client.address,
        status,
        client.adminNote,
      ])
    );
  });
  const filteredAdminClients = adminClients.filter((client) => {
    const statusMatched =
      statusFilter === "all" ||
      (statusFilter === "active" && client.status === "active") ||
      (statusFilter === "closed" && client.status === "blocked") ||
      (statusFilter === "problem" && client.status !== "active");
    return (
      statusMatched &&
      matchesQuery(adminQuery, [
        client.phone,
        client.firstName || "",
        client.lastName || "",
        client.city || "",
        client.status,
      ])
    );
  });
  const filteredAdminCraftsmen = adminCraftsmen.filter((craftsman) => {
    const statusMatched =
      statusFilter === "all" ||
      (statusFilter === "active" && craftsman.status === "active") ||
      (statusFilter === "closed" && craftsman.status === "blocked") ||
      (statusFilter === "problem" &&
        (craftsman.status !== "active" ||
          craftsman.verificationStatus !== "verified"));
    return (
      statusMatched &&
      matchesQuery(adminQuery, [
        craftsman.phone,
        craftsman.firstName || "",
        craftsman.lastName || "",
        craftsman.city || "",
        craftsman.workerRole || "",
        craftsman.status,
        craftsman.verificationStatus || "",
      ])
    );
  });
  const filteredAuditLogs = auditLogs.filter((log) => {
    const statusMatched =
      statusFilter === "all" ||
      (statusFilter === "active" &&
        !["booking_refunded", "dispute_refunded", "verification_rejected"].includes(
          log.action
        )) ||
      (statusFilter === "closed" &&
        ["booking_closed", "dispute_released"].includes(log.action)) ||
      (statusFilter === "problem" &&
        [
          "booking_refunded",
          "dispute_refunded",
          "dispute_reviewing",
          "verification_rejected",
        ].includes(log.action));
    return (
      statusMatched &&
      matchesQuery(adminQuery, [
        auditLabel[log.action],
        log.summary,
        log.target,
        log.adminName,
      ])
    );
  });
  const filteredFinancialSummary = filteredClientBookings.reduce(
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
  const pendingVerificationCount = verificationQueue.filter(
    (item) => item.verificationStatus === "pending"
  ).length;
  const estimatedServiceTotal = filteredClientBookings.reduce(
    (sum, booking) => sum + parseFirstAmount(booking.worker.price),
    0
  );
  const estimatedCommission = Math.round(
    (estimatedServiceTotal * platformSettings.commissionPercent) / 100
  );
  const getLinkedClientBooking = (bookingId: string) =>
    clientBookings.find((booking) => booking.id === bookingId);
  const needsAdminIntervention = (request: (typeof requests)[number]) => {
    const linkedBooking = getLinkedClientBooking(request.id);
    return (
      request.status === "disputed" ||
      linkedBooking?.status === "disputed" ||
      linkedBooking?.paymentStatus === "disputed" ||
      Boolean(request.disputeReason || request.cancellationReason)
    );
  };
  const interventionRequests = filteredRequests.filter(needsAdminIntervention);
  const adminOverviewInput = {
    verificationStatus,
    openDisputesCount: openDisputes.length,
    urgentDisputesCount: urgentDisputes.length,
    interventionRequestsCount: interventionRequests.length,
  };
  const adminSummaryCards = getAdminSummaryCards(adminOverviewInput);
  const adminWorkQueueItems = getAdminWorkQueueItems(adminOverviewInput);
  const visibleRegularRequests = filteredRequests.filter(
    (request) => !needsAdminIntervention(request)
  );
  const operationalQueue = [
    {
      id: "verification",
      label: "ვერიფიკაცია",
      count: pendingVerificationCount,
      detail: pendingVerificationCount
        ? "ხელოსნის დოკუმენტები ელოდება დადასტურებას"
        : "შესამოწმებელი ვერიფიკაცია არ არის",
      tabId: "verification" as const,
      priority: pendingVerificationCount ? 3 : 0,
      tone: "#1d4ed8",
      bg: "#eff6ff",
    },
    {
      id: "urgent-disputes",
      label: "სასწრაფო დავები",
      count: urgentDisputes.length,
      detail: urgentDisputes.length
        ? "დავა 24 საათზე მეტია ღიაა ან განხილვას ითხოვს"
        : "ვადაგასული დავა არ არის",
      tabId: "disputes" as const,
      priority: urgentDisputes.length ? 4 : 0,
      tone: "#b91c1c",
      bg: "#fef2f2",
    },
    {
      id: "open-disputes",
      label: "ღია დავები",
      count: openDisputes.length,
      detail: openDisputes.length
        ? "კლიენტის/ხელოსნის პრობლემა Admin-ის პასუხს ელოდება"
        : "ღია დავა არ არის",
      tabId: "disputes" as const,
      priority: openDisputes.length ? 2 : 0,
      tone: "#c2410c",
      bg: "#fff7ed",
    },
    {
      id: "finance-review",
      label: "ფინანსური განხილვა",
      count:
        financeReviewBookings.length +
        financeRefundQueue.length +
        financeReleaseQueue.length,
      detail: financeReviewBookings.length
        ? `დაგვიანებული გაუქმება/დავა. სავარაუდო დაკავება ${money(
            lateCancellationPenaltyTotal
          )}`
        : financeRefundQueue.length
          ? "თანხის დაბრუნების რიგია გადასახედი"
          : financeReleaseQueue.length
            ? "დასრულებულ ჯავშანზე თანხა გასაშვებია"
            : "ფინანსური ჩარევა არ სჭირდება",
      tabId: "finance" as const,
      priority:
        financeReviewBookings.length || financeRefundQueue.length || financeReleaseQueue.length
          ? 3
          : 0,
      tone: "#047857",
      bg: "#ecfdf5",
    },
    {
      id: "problem-bookings",
      label: "პრობლემური ჯავშნები",
      count: interventionRequests.length,
      detail: interventionRequests.length
        ? "გაუქმება, დავა ან Admin ჩანაწერი გადასაწყვეტია"
        : "ჯავშნების რიგი სუფთაა",
      tabId: "bookings" as const,
      priority: interventionRequests.length ? 2 : 0,
      tone: "#7c3aed",
      bg: "#f5f3ff",
    },
  ].sort((a, b) => b.priority - a.priority || b.count - a.count);
  const nextAdminAction =
    operationalQueue.find((item) => item.count > 0) || operationalQueue[0];
  const craftsmanUserStats = {
    total: requests.length,
    active: requests.filter((request) => isActiveStatus(request.status)).length,
    disputed: requests.filter((request) => request.status === "disputed").length,
    cancelled: requests.filter((request) => request.status === "cancelled").length,
    completed: requests.filter((request) => isClosedStatus(request.status)).length,
    amount: clientBookings.reduce(
      (sum, booking) => sum + (booking.bookingFee || platformSettings.bookingFee),
      0
    ),
  };
  const getClientUserStats = (phone: string) => {
    const clientRequests = requests.filter(
      (request) => request.clientPhone === phone
    );
    const requestIds = new Set(clientRequests.map((request) => request.id));
    const relatedBookings = clientBookings.filter((booking) =>
      requestIds.has(booking.id)
    );
    const lastRequest = [...clientRequests].sort((a, b) =>
      `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)
    )[0];
    return {
      total: clientRequests.length,
      active: clientRequests.filter((request) => isActiveStatus(request.status))
        .length,
      disputed: clientRequests.filter((request) => request.status === "disputed")
        .length,
      cancelled: clientRequests.filter((request) => request.status === "cancelled")
        .length,
      completed: clientRequests.filter((request) => isClosedStatus(request.status))
        .length,
      amount: relatedBookings.reduce(
        (sum, booking) => sum + (booking.bookingFee || platformSettings.bookingFee),
        0
      ),
      lastActivity: lastRequest
        ? `${lastRequest.date} · ${lastRequest.time}`
        : "აქტივობა არ არის",
    };
  };

  const saveCraftsmanProfile = (next: CraftsmanProfile) => {
    dataService.saveCraftsmanProfile(next);
    refresh();
  };

  const recordAudit = (
    action: AdminAuditLog["action"],
    target: string,
    summary: string
  ) => {
    if (!isDemoDataMode) return;
    dataService.prependAdminAuditLog({
      action,
      target,
      summary,
      adminName: user.name || "ადმინისტრატორი",
    });
  };

  const confirmAdminAction = (
    message: string,
    options?: { requireNote?: boolean }
  ) => {
    if (options?.requireNote && !adminNote.trim()) {
      window.alert("ამ მოქმედებისთვის ჯერ Admin ჩანაწერში მიუთითე მიზეზი.");
      return false;
    }
    return window.confirm(message);
  };

  const downloadAdminReport = () => {
    const exportedAt = new Date().toISOString();
    if (
      launchReportStatus === "draft" &&
      !window.confirm(
        [
          "ეს report ჯერ draft იქნება.",
          ...launchReportDraftReasons,
          "მაინც ჩამოვტვირთო report?",
        ].join("\n")
      )
    ) {
      return;
    }

    const report = {
      exportedAt,
      exportedBy: user.name || "ადმინისტრატორი",
      exportedRole: currentAdminMember,
      launchStatus: launchReportStatus,
      draftReasons: launchReportDraftReasons,
      filters: {
        tab,
        query: adminQuery,
        status: statusFilter,
      },
      summary: {
        verificationStatus,
        openDisputes: openDisputes.length,
        urgentDisputes: urgentDisputes.length,
        pendingRequests: pendingRequests.length,
        activeBookings: activeBookings.length,
        finance: financialSummary,
        platformSettings,
        readiness: {
          productionReady: readyCount === productionReadiness.length,
          productionReadyCount: readyCount,
          productionReadyTotal: productionReadiness.length,
          prePaymentDoneCount,
          prePaymentTotal: prePaymentChecklist.length,
          mobileQaDoneCount,
          mobileQaTotal: mobileQaScenarios.length,
          mobileQaRemaining: remainingMobileQaScenarios.map((item) => ({
            area: qaAreaLabel[item.area],
            label: item.label,
          })),
          mobileQaNotesCount: mobileQaNotes.length,
          mobileQaNotes,
          mobileQaByArea: mobileQaProgressByArea,
          blockingSystemChecks: blockingSystemChecks.length,
          productionGuardCount: productionGuardItems.length,
          productionGuardItems,
          launchSmokeDoneCount,
          launchSmokeTotal: launchSmokeSteps.length,
          nextLaunchSmokeStep,
          apiMigration: apiMigrationSummary,
          supabasePreflight: {
            hasRun: preflightChecks.length > 0,
            checkedAt: preflightCheckedAt,
            fresh: preflightFresh,
            scope: preflightScope,
            ok: preflightSummary.ok,
            warning: preflightSummary.warning,
            error: preflightSummary.error,
            requiredErrors: preflightSummary.requiredErrors,
            ready:
              preflightChecks.length > 0 &&
              preflightFresh &&
              preflightSummary.requiredErrors === 0,
          },
        },
      },
      launchReadiness: {
        productionReadiness,
        draftProductionReadiness,
        systemReadinessChecks,
        apiMigrationItems,
        prePaymentChecklist,
        mobileQaScenarios,
        launchSmokeSteps,
        supabasePreflightChecks: preflightChecks,
        legalSettings,
      },
      filtered: {
        disputes: filteredDisputes,
        bookings: filteredRequests,
        finance: filteredClientBookings,
        clients: adminUsersState
          ? filteredAdminClients
          : filteredClients.map((phone) => ({
              phone,
              profile: fallbackStorage.getClientProfile(phone),
            })),
        craftsmen: adminUsersState ? filteredAdminCraftsmen : undefined,
        auditLogs: filteredAuditLogs,
      },
      all: {
        craftsmanProfile: profile,
        requests,
        clientBookings,
        disputes,
        auditLogs,
        adminMembers,
        currentAdminMember,
      },
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `launch-readiness-report-${launchReportStatus}-${exportedAt.slice(
      0,
      10
    )}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setAdminApiSuccess(
      launchReportStatus === "launch_ready"
        ? "Launch-ready report ჩამოიტვირთა."
        : "Draft readiness report ჩამოიტვირთა; დარჩენილი საკითხები report-შიც წერია."
    );
  };

  const setVerificationStatus = async (
    status: AdminVerificationStatus,
    note = ""
  ) => {
    if (!can("verification")) {
      setAdminApiError("ამ Admin როლს ვერიფიკაციის უფლება არ აქვს");
      return;
    }
    const requiresNote = status === "rejected";
    if (
      !confirmAdminAction(
        status === "verified"
          ? "დარწმუნებული ხარ, რომ ხელოსნის ვერიფიკაცია უნდა დადასტურდეს?"
          : "დარწმუნებული ხარ, რომ ვერიფიკაცია უნდა უარყო?",
        { requireNote: requiresNote }
      )
    ) {
      return;
    }
    const finalNote = adminNote.trim() || note;

    if (!isDemoDataMode) {
      if (!verificationTarget?.workerId) {
        setAdminApiError("ვერიფიკაციისთვის ხელოსნის API ჩანაწერი არ ჩანს");
        return;
      }

      setAdminApiLoading(true);
      setAdminApiError("");
      try {
        applyAdminLaunchState(
          await reviewAdminWorkerVerification(
            verificationTarget.workerId,
            status,
            finalNote || undefined
          )
        );
        saveCraftsmanProfile({
          ...profile,
          verificationStatus: status,
          verificationNote: finalNote,
          adminNote: finalNote || profile.adminNote,
          accountStatus: status === "verified" ? "active" : profile.accountStatus,
        });
        setAdminNote("");
        refresh();
      } catch (error) {
        setAdminApiError(
          error instanceof Error
            ? error.message
            : "ხელოსნის ვერიფიკაციის განახლება ვერ მოხერხდა"
        );
      } finally {
        setAdminApiLoading(false);
      }
      return;
    }

    saveCraftsmanProfile({
      ...profile,
      verificationStatus: status,
      verificationNote: finalNote,
      adminNote: finalNote || profile.adminNote,
      accountStatus: status === "verified" ? "active" : profile.accountStatus,
    });
    recordAudit(
      status === "verified" ? "verification_approved" : "verification_rejected",
      profile.phone || "craftsman",
      finalNote || verificationLabel[status]
    );
    setAdminNote("");
  };

  const mirrorBookingUpdate = (
    bookingId: string,
    status: BookingStatus,
    paymentStatus?: "released" | "refunded" | "disputed",
    note = adminNote.trim()
  ) => {
    dataService.updateClientBooking(bookingId, (booking) => ({
      ...booking,
      status,
      paymentStatus: paymentStatus || booking.paymentStatus,
      adminNote: note || booking.adminNote,
    }));
    dataService.updateCraftsmanRequest(bookingId, (request) => ({
      ...request,
      status,
      adminNote: note || request.adminNote,
    }));
  };

  const bookingActionFromState = (
    status: BookingStatus,
    paymentStatus?: "released" | "refunded" | "disputed"
  ): AdminBookingAction => {
    if (paymentStatus === "refunded" || status === "cancelled") {
      return "cancel_refund";
    }
    if (paymentStatus === "disputed" || status === "disputed") {
      return "mark_disputed";
    }
    return "close_release";
  };

  const bookingActionFromPaymentStatus = (
    paymentStatus: NonNullable<import("./BookingsScreen").Booking["paymentStatus"]>
  ): AdminBookingAction => {
    if (paymentStatus === "held") return "hold_authorized";
    if (paymentStatus === "refunded") return "cancel_refund";
    if (paymentStatus === "disputed") return "mark_disputed";
    return "close_release";
  };

  const updateBookingEverywhere = async (
    bookingId: string,
    status: BookingStatus,
    paymentStatus?: "released" | "refunded" | "disputed",
    options?: { skipConfirm?: boolean }
  ) => {
    if (!can("bookings")) {
      setAdminApiError("ამ Admin როლს ჯავშნების მართვის უფლება არ აქვს");
      return;
    }
    if ((paymentStatus === "released" || paymentStatus === "refunded") && !can("finance")) {
      setAdminApiError("თანხის გაშვება/დაბრუნებისთვის ფინანსების უფლებაა საჭირო");
      return;
    }
    const isRefund = paymentStatus === "refunded" || status === "cancelled";
    if (
      !options?.skipConfirm &&
      !confirmAdminAction(
        isRefund
          ? "დარწმუნებული ხარ, რომ ჯავშანი უნდა გაუქმდეს და თანხა დაბრუნდეს?"
          : "დარწმუნებული ხარ, რომ ჯავშანი უნდა დაიხუროს?",
        { requireNote: isRefund }
      )
    ) {
      return;
    }
    const note = adminNote.trim();

    if (!isDemoDataMode) {
      setAdminApiLoading(true);
      setAdminActionId(`booking:${bookingId}:${status}`);
      setAdminApiError("");
      setAdminApiSuccess("");
      try {
        applyAdminLaunchState(
          await updateAdminBookingAction(
            bookingId,
            bookingActionFromState(status, paymentStatus),
            note || undefined
          )
        );
        mirrorBookingUpdate(bookingId, status, paymentStatus, note);
        setAdminNote("");
        setAdminApiSuccess(
          isRefund
            ? "ჯავშანი გაუქმდა და თანხის დაბრუნება დაფიქსირდა."
            : "ჯავშანი დაიხურა და თანხის გაშვება დაფიქსირდა."
        );
        refresh();
      } catch (error) {
        setAdminApiError(
          error instanceof Error
            ? error.message
            : "ჯავშნის Admin action ვერ შესრულდა"
        );
      } finally {
        setAdminApiLoading(false);
        setAdminActionId(null);
      }
      return;
    }

    mirrorBookingUpdate(bookingId, status, paymentStatus, note);
    recordAudit(
      status === "cancelled" ? "booking_refunded" : "booking_closed",
      bookingId,
      `${statusLabel[status]}${paymentStatus ? ` · ${paymentStatus}` : ""}${
        note ? ` · ${note}` : ""
      }`
    );
    setAdminNote("");
    refresh();
  };

  const resolveDispute = async (
    dispute: BookingDispute,
    resolution: AdminDisputeResolution
  ) => {
    if (!can("disputes")) {
      setAdminApiError("ამ Admin როლს დავების მართვის უფლება არ აქვს");
      return;
    }
    if ((resolution === "refund_client" || resolution === "release_worker") && !can("finance")) {
      setAdminApiError("თანხის დაბრუნება/გაშვებისთვის ფინანსების უფლებაა საჭირო");
      return;
    }
    const actionText =
      resolution === "refund_client"
        ? "დავა დაიხუროს კლიენტისთვის თანხის დაბრუნებით?"
        : resolution === "release_worker"
          ? "დავა დაიხუროს ხელოსანზე თანხის გაშვებით?"
          : "დავა დაიხუროს გაფრთხილებით?";
    if (!confirmAdminAction(actionText, { requireNote: true })) {
      return;
    }
    const note = adminNote.trim();
    const resolutionText =
      resolution === "refund_client"
        ? "თანხა კლიენტს უბრუნდება"
        : resolution === "release_worker"
          ? "თანხა ხელოსანზე გადადის"
          : "დავა გაფრთხილებით დაიხურა";

    if (!isDemoDataMode) {
      setAdminApiLoading(true);
      setAdminActionId(`dispute:${dispute.id}:${resolution}`);
      setAdminApiError("");
      setAdminApiSuccess("");
      try {
        applyAdminLaunchState(
          await resolveAdminDisputeAction(dispute.id, resolution, note)
        );
        dataService.updateBookingDispute(dispute.id, (current) => ({
          ...current,
          status: "resolved",
          resolution,
          adminNote: note || current.adminNote,
          resolvedAt: new Date().toISOString(),
        }));
        if (resolution === "refund_client") {
          mirrorBookingUpdate(dispute.bookingId, "cancelled", "refunded", note);
        } else if (resolution === "release_worker") {
          mirrorBookingUpdate(dispute.bookingId, "closed", "released", note);
        }
        dataService.prependClientNotification({
          id: `${dispute.id}-${Date.now()}`,
          bookingId: dispute.bookingId,
          type: "confirmed",
          title: "დავა დაიხურა",
          text: `დავის გადაწყვეტილება: ${resolutionText}`,
          readAt: null,
          createdAt: new Date().toISOString(),
        });
        dataService.prependCraftsmanNotification({
          id: `${dispute.id}-worker-${Date.now()}`,
          bookingId: dispute.bookingId,
          type: "confirmed",
          title: "დავა დაიხურა",
          text: `დავის გადაწყვეტილება: ${resolutionText}`,
          readAt: null,
          createdAt: new Date().toISOString(),
        });
        setAdminNote("");
        setAdminApiSuccess("დავის გადაწყვეტილება შენახულია და მხარეებს შეტყობინება გაეგზავნათ.");
        refresh();
      } catch (error) {
        setAdminApiError(
          error instanceof Error
            ? error.message
            : "დავის დახურვა ვერ მოხერხდა"
        );
      } finally {
        setAdminApiLoading(false);
        setAdminActionId(null);
      }
      return;
    }

    dataService.updateBookingDispute(dispute.id, (current) => ({
      ...current,
      status: "resolved",
      resolution,
      adminNote: note || current.adminNote,
      resolvedAt: new Date().toISOString(),
    }));
    appendDemoSystemMessage(
      dispute.bookingId,
      `დავის გადაწყვეტილება: ${resolutionText}. ${note ? `Admin ჩანაწერი: ${note}` : ""}`.trim()
    );
    if (resolution === "refund_client") {
      recordAudit(
        "dispute_refunded",
        dispute.bookingId,
        note || dispute.reason
      );
      updateBookingEverywhere(dispute.bookingId, "cancelled", "refunded", {
        skipConfirm: true,
      });
    } else if (resolution === "release_worker") {
      recordAudit(
        "dispute_released",
        dispute.bookingId,
        note || dispute.reason
      );
      updateBookingEverywhere(dispute.bookingId, "closed", "released", {
        skipConfirm: true,
      });
    } else {
      recordAudit(
        "dispute_warning",
        dispute.bookingId,
        note || dispute.reason
      );
      setAdminNote("");
      refresh();
    }
    prependDemoBookingNotification(
      dispute.bookingId,
      "დავა დაიხურა",
      `დავის გადაწყვეტილება: ${resolutionText}${note ? `. Admin ჩანაწერი: ${note}` : ""}`
    );
    prependDemoCraftsmanNotification(
      dispute.bookingId,
      "დავა დაიხურა",
      `დავის გადაწყვეტილება: ${resolutionText}${note ? `. Admin ჩანაწერი: ${note}` : ""}`
    );
  };

  const markDisputeReviewing = async (dispute: BookingDispute) => {
    if (!can("disputes")) {
      setAdminApiError("ამ Admin როლს დავების მართვის უფლება არ აქვს");
      return;
    }
    const note = adminNote.trim();

    if (!isDemoDataMode) {
      setAdminApiLoading(true);
      setAdminActionId(`dispute:${dispute.id}:reviewing`);
      setAdminApiError("");
      setAdminApiSuccess("");
      try {
        applyAdminLaunchState(
          await markAdminDisputeReviewing(dispute.id, note || undefined)
        );
        dataService.updateBookingDispute(dispute.id, (current) => ({
          ...current,
          status: "reviewing",
          adminNote: note || current.adminNote,
        }));
        dataService.prependClientNotification({
          id: `${dispute.id}-reviewing-${Date.now()}`,
          bookingId: dispute.bookingId,
          type: "confirmed",
          title: "დავა განხილვაშია",
          text: note
            ? `Admin ამოწმებს დავას. ჩანაწერი: ${note}`
            : "Admin ამოწმებს დავის დეტალებს და თანხა დროებით შეჩერებულია.",
          readAt: null,
          createdAt: new Date().toISOString(),
        });
        dataService.prependCraftsmanNotification({
          id: `${dispute.id}-worker-reviewing-${Date.now()}`,
          bookingId: dispute.bookingId,
          type: "confirmed",
          title: "დავა განხილვაშია",
          text: note
            ? `Admin ამოწმებს დავას. ჩანაწერი: ${note}`
            : "Admin ამოწმებს დავის დეტალებს და თანხა დროებით შეჩერებულია.",
          readAt: null,
          createdAt: new Date().toISOString(),
        });
        setAdminNote("");
        setAdminApiSuccess("დავა გადავიდა განხილვაში და მხარეებს შეტყობინება გაეგზავნათ.");
        refresh();
      } catch (error) {
        setAdminApiError(
          error instanceof Error
            ? error.message
            : "დავის განხილვაში გადაყვანა ვერ მოხერხდა"
        );
      } finally {
        setAdminApiLoading(false);
        setAdminActionId(null);
      }
      return;
    }

    dataService.updateBookingDispute(dispute.id, (current) => ({
      ...current,
      status: "reviewing",
      adminNote: note || current.adminNote,
    }));
    appendDemoSystemMessage(
      dispute.bookingId,
      `დავა გადავიდა განხილვაში. ${note ? `Admin ჩანაწერი: ${note}` : "Admin ამოწმებს დეტალებს."}`
    );
    prependDemoBookingNotification(
      dispute.bookingId,
      "დავა განხილვაშია",
      note
        ? `Admin ამოწმებს დავას. ჩანაწერი: ${note}`
        : "Admin ამოწმებს დავის დეტალებს და თანხა დროებით შეჩერებულია."
    );
    prependDemoCraftsmanNotification(
      dispute.bookingId,
      "დავა განხილვაშია",
      note
        ? `Admin ამოწმებს დავას. ჩანაწერი: ${note}`
        : "Admin ამოწმებს დავის დეტალებს და თანხა დროებით შეჩერებულია."
    );
    recordAudit(
      "dispute_reviewing",
      dispute.bookingId,
      note || "Admin-მა დავა გადაიყვანა განხილვაში"
    );
    setAdminNote("");
    refresh();
  };

  const setBookingPaymentStatus = async (
    bookingId: string,
    paymentStatus: NonNullable<import("./BookingsScreen").Booking["paymentStatus"]>
  ) => {
    if (!can("finance")) {
      setAdminApiError("ამ Admin როლს ფინანსების მართვის უფლება არ აქვს");
      return;
    }
    if (
      !confirmAdminAction(
        `Admin ჩარევა დადასტურდეს: ${paymentStatusShortLabel[paymentStatus]}?`,
        { requireNote: paymentStatus !== "held" }
      )
    ) {
      return;
    }
    const note = adminNote.trim();
    const nextStatus =
      paymentStatus === "refunded"
        ? "cancelled"
        : paymentStatus === "released"
          ? "closed"
          : paymentStatus === "disputed"
            ? "disputed"
            : undefined;

    if (!isDemoDataMode) {
      setAdminApiLoading(true);
      setAdminActionId(`payment:${bookingId}:${paymentStatus}`);
      setAdminApiError("");
      setAdminApiSuccess("");
      try {
        applyAdminLaunchState(
          await updateAdminBookingAction(
            bookingId,
            bookingActionFromPaymentStatus(paymentStatus),
            note || undefined
          )
        );
        if (nextStatus && paymentStatus !== "held") {
          mirrorBookingUpdate(bookingId, nextStatus, paymentStatus, note);
        } else {
          dataService.updateClientBooking(bookingId, (booking) => ({
            ...booking,
            paymentStatus,
            adminNote: note || booking.adminNote,
          }));
        }
        setAdminNote("");
        setAdminApiSuccess(`ფინანსური სტატუსი განახლდა: ${paymentStatusShortLabel[paymentStatus]}.`);
        refresh();
      } catch (error) {
        setAdminApiError(
          error instanceof Error
            ? error.message
            : "თანხის სტატუსის შეცვლა ვერ მოხერხდა"
        );
      } finally {
        setAdminApiLoading(false);
        setAdminActionId(null);
      }
      return;
    }

    dataService.updateClientBooking(bookingId, (booking) => ({
      ...booking,
      paymentStatus,
      status: nextStatus || booking.status,
      adminNote: note || booking.adminNote,
    }));
    dataService.updateCraftsmanRequest(bookingId, (request) => ({
      ...request,
      status: nextStatus || request.status,
      adminNote: note || request.adminNote,
    }));
    recordAudit(
      "payment_status_changed",
      bookingId,
      `${paymentStatusShortLabel[paymentStatus]}${
        note ? ` · ${note}` : ""
      }`
    );
    setAdminNote("");
    refresh();
  };

  const updateSettingsDraft = (key: keyof PlatformSettings, value: string) => {
    const numeric = Number(value);
    setSettingsDraft((current) => ({
      ...current,
      [key]: Number.isFinite(numeric) ? Math.max(0, numeric) : current[key],
    }));
  };

  const updateSettingsChoice = <Key extends keyof PlatformSettings>(
    key: Key,
    value: PlatformSettings[Key]
  ) => {
    setSettingsDraft((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const getProductionGuardMessages = () => {
    return productionGuardItems.map((item) => `${item.label}: ${item.detail}`);
  };

  const toggleProductionModeDraft = () => {
    if (settingsDraft.productionMode) {
      updateSettingsChoice("productionMode", false);
      return;
    }

    const blockers = getProductionGuardMessages();
    if (blockers.length) {
      window.alert(
        [
          "Production mode ჯერ ვერ ჩაირთვება.",
          "",
          ...blockers.map((item) => `- ${item}`),
          "",
          "ეს დაცვა გვიცავს იმ სიტუაციისგან, სადაც აპი რეალურ რეჟიმად ჩანს, მაგრამ launch checklist ბოლომდე მზად არ არის.",
        ].join("\n")
      );
      return;
    }

    updateSettingsChoice("productionMode", true);
  };

  const applyAdminLaunchState = (state: AdminLaunchState) => {
    setAdminLaunchState(state);
    setSettingsDraft(state.platformSettings);
    setLegalDraft(state.legalSettings);
    setAdminApiError("");
    setSettingsSaveMessage("შენახულია");
  };

  const resetSettingsDrafts = () => {
    setSettingsDraft({ ...platformSettings });
    setLegalDraft({ ...legalSettings });
    setAdminApiError("");
    setSettingsSaveMessage("ცვლილებები გაუქმდა");
  };

  const savePlatformSettings = async () => {
    setSettingsSaveMessage("");
    if (!can("settings")) {
      setAdminApiError("ამ Admin როლს პარამეტრების შეცვლის უფლება არ აქვს");
      return;
    }
    if (settingsDraft.productionMode) {
      const blockers = getProductionGuardMessages();
      if (blockers.length) {
        setAdminApiError(
          [
            "Production პარამეტრები ვერ შეინახა, რადგან აუცილებელი შემოწმებები დარჩა:",
            ...blockers.map((item) => `- ${item}`),
          ].join("\n")
        );
        return;
      }
    }
    if (!isDemoDataMode) {
      setAdminApiLoading(true);
      setAdminApiError("");
      try {
        applyAdminLaunchState(
          await saveAdminLaunchSettings(settingsDraft, legalDraft)
        );
      } catch (error) {
        setAdminApiError(
          error instanceof Error
            ? error.message
            : "პლატფორმის პარამეტრების შენახვა ვერ მოხერხდა"
        );
      } finally {
        setAdminApiLoading(false);
      }
      return;
    }

    dataService.savePlatformSettings(settingsDraft);
    recordAudit(
      "platform_settings_updated",
      "platform",
      `ჯავშანი ${settingsDraft.bookingFee} ლარი · საკომისიო ${settingsDraft.commissionPercent}% · თვიური ${settingsDraft.craftsmanMonthlyFee} ლარი · late cancel ${settingsDraft.lateCancellationFeePercent}%`
    );
    refresh();
  };

  const saveLegalSettings = async () => {
    setSettingsSaveMessage("");
    if (!can("settings")) {
      setAdminApiError("ამ Admin როლს წესების შეცვლის უფლება არ აქვს");
      return;
    }
    if (!isDemoDataMode) {
      setAdminApiLoading(true);
      setAdminApiError("");
      try {
        applyAdminLaunchState(
          await saveAdminLaunchSettings(settingsDraft, legalDraft)
        );
      } catch (error) {
        setAdminApiError(
          error instanceof Error
            ? error.message
            : "წესების შენახვა ვერ მოხერხდა"
        );
      } finally {
        setAdminApiLoading(false);
      }
      return;
    }

    dataService.saveLegalSettings(legalDraft);
    recordAudit(
      "platform_settings_updated",
      "legal",
      "წესების და მხარდაჭერის ტექსტები განახლდა"
    );
    setSettingsSaveMessage("შენახულია");
    refresh();
  };

  const togglePrePaymentChecklistItem = async (item: PrePaymentChecklistItem) => {
    if (!isDemoDataMode) {
      setAdminApiLoading(true);
      setAdminApiError("");
      try {
        applyAdminLaunchState(
          await updateLaunchChecklistItem(item.id, !item.done)
        );
      } catch (error) {
        setAdminApiError(
          error instanceof Error
            ? error.message
            : "Checklist პუნქტის განახლება ვერ მოხერხდა"
        );
      } finally {
        setAdminApiLoading(false);
      }
      return;
    }

    dataService.updatePrePaymentChecklistItem(item.id, !item.done);
    recordAudit(
      "platform_settings_updated",
      item.id,
      `${item.label}: ${item.done ? "დაბრუნდა შესასრულებელში" : "მოინიშნა მზადად"}`
    );
    refresh();
  };

  const toggleMobileQaScenario = async (item: MobileQaScenario) => {
    if (!isDemoDataMode) {
      setAdminApiLoading(true);
      setAdminApiError("");
      try {
        applyAdminLaunchState(
          await updateLaunchChecklistItem(item.id, !item.done, item.note)
        );
      } catch (error) {
        setAdminApiError(
          error instanceof Error
            ? error.message
            : "QA სცენარის განახლება ვერ მოხერხდა"
        );
      } finally {
        setAdminApiLoading(false);
      }
      return;
    }

    dataService.updateMobileQaScenario(item.id, !item.done);
    recordAudit(
      "platform_settings_updated",
      item.id,
      `QA ${qaAreaLabel[item.area]} · ${item.label}: ${
        item.done ? "ხელახლა შესამოწმებელია" : "დადასტურდა"
      }`
    );
    refresh();
  };

  const saveMobileQaScenarioNote = async (
    item: MobileQaScenario,
    note: string
  ) => {
    if ((item.note || "") === note) return;

    if (!isDemoDataMode) {
      setAdminApiLoading(true);
      setAdminApiError("");
      try {
        applyAdminLaunchState(
          await updateLaunchChecklistItem(item.id, item.done, note)
        );
      } catch (error) {
        setAdminApiError(
          error instanceof Error
            ? error.message
            : "QA შენიშვნის შენახვა ვერ მოხერხდა"
        );
      } finally {
        setAdminApiLoading(false);
      }
      return;
    }

    dataService.updateMobileQaScenarioNote(item.id, note);
    recordAudit(
      "platform_settings_updated",
      item.id,
      `QA შენიშვნა განახლდა: ${qaAreaLabel[item.area]} · ${item.label}`
    );
    refresh();
  };

  const toggleAdminMember = async (member: (typeof adminMembers)[number]) => {
    if (!can("settings")) {
      setAdminApiError("ამ Admin როლს Admin წევრების მართვის უფლება არ აქვს");
      return;
    }
    if (!isDemoDataMode) {
      setAdminApiLoading(true);
      setAdminApiError("");
      try {
        applyAdminLaunchState(
          await updateAdminMemberState(member.id, !member.active)
        );
      } catch (error) {
        setAdminApiError(
          error instanceof Error
            ? error.message
            : "Admin წევრის სტატუსის განახლება ვერ მოხერხდა"
        );
      } finally {
        setAdminApiLoading(false);
      }
      return;
    }

    dataService.updateAdminMember(member.id, (current) => ({
      ...current,
      active: !current.active,
    }));
    recordAudit(
      "admin_member_updated",
      member.id,
      `Admin role ${member.name}: ${member.active ? "disabled" : "enabled"}`
    );
    refresh();
  };

  const setClientAccountStatus = async (
    phone: string,
    status: NonNullable<ClientProfile["accountStatus"]>
  ) => {
    if (!can("users")) {
      setAdminApiError("ამ Admin როლს მომხმარებლების მართვის უფლება არ აქვს");
      return;
    }
    if (
      !confirmAdminAction(
        `კლიენტის სტატუსი შეიცვალოს: ${accountLabel[status]}?`,
        { requireNote: status !== "active" }
      )
    ) {
      return;
    }
    const note = adminNote.trim();

    if (!isDemoDataMode) {
      setAdminApiLoading(true);
      setAdminApiError("");
      try {
        applyAdminLaunchState(
          await updateAdminAccountStatus(
            "client",
            phone,
            status,
            note || undefined
          )
        );
        setAdminNote("");
      } catch (error) {
        setAdminApiError(
          error instanceof Error
            ? error.message
            : "კლიენტის სტატუსის განახლება ვერ მოხერხდა"
        );
      } finally {
        setAdminApiLoading(false);
      }
      return;
    }

    fallbackStorage.saveClientProfile(phone, {
      ...fallbackStorage.getClientProfile(phone),
      accountStatus: status,
      adminNote:
        note || fallbackStorage.getClientProfile(phone).adminNote,
    });
    recordAudit(
      "client_status_changed",
      phone,
      `კლიენტის სტატუსი: ${accountLabel[status]}${
        note ? ` · ${note}` : ""
      }`
    );
    setAdminNote("");
    refresh();
  };

  const setCraftsmanAccountStatus = async (
    status: NonNullable<CraftsmanProfile["accountStatus"]>,
    targetPhone = profile.phone
  ) => {
    if (!can("users")) {
      setAdminApiError("ამ Admin როლს მომხმარებლების მართვის უფლება არ აქვს");
      return;
    }
    if (
      !confirmAdminAction(
        `ხელოსნის სტატუსი შეიცვალოს: ${accountLabel[status]}?`,
        { requireNote: status !== "active" }
      )
    ) {
      return;
    }
    const note = adminNote.trim();

    if (!isDemoDataMode) {
      if (!targetPhone) {
        setAdminApiError("ხელოსნის ტელეფონი/API id არ ჩანს");
        return;
      }

      setAdminApiLoading(true);
      setAdminApiError("");
      try {
        applyAdminLaunchState(
          await updateAdminAccountStatus(
            "craftsman",
            targetPhone,
            status,
            note || undefined
          )
        );
        setAdminNote("");
      } catch (error) {
        setAdminApiError(
          error instanceof Error
            ? error.message
            : "ხელოსნის სტატუსის განახლება ვერ მოხერხდა"
        );
      } finally {
        setAdminApiLoading(false);
      }
      return;
    }

    saveCraftsmanProfile({
      ...profile,
      accountStatus: status,
      adminNote: note || profile.adminNote,
    });
    recordAudit(
      "craftsman_status_changed",
      targetPhone || "craftsman",
      `ხელოსნის სტატუსი: ${accountLabel[status]}${
        note ? ` · ${note}` : ""
      }`
    );
    setAdminNote("");
  };

  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        paddingBottom: 28,
        background: "var(--bg)",
      }}
    >
      <div style={{ padding: "34px 24px 18px", paddingTop: "calc(34px + var(--safe-top))" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h1 className="screen-title">ადმინი</h1>
            <p className="screen-subtitle">ვერიფიკაცია, ჯავშნები და დავები</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {can("audit") && (
              <button
                type="button"
                onClick={downloadAdminReport}
                style={actionButton("#0f172a")}
              >
                რეპორტი
              </button>
            )}
            <button
              type="button"
              onClick={onLogout}
              style={actionButton("#f1f5f9", "var(--text)")}
            >
              გასვლა
            </button>
          </div>
        </div>
        <div
          style={{
            marginTop: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            color: "var(--text3)",
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          <span>{user.name || "ადმინისტრატორი"}</span>
          {can("audit") && (
            <span
              title={
                launchReportStatus === "launch_ready"
                  ? "Report მზადაა launch snapshot-ისთვის"
                  : launchReportDraftReasons.join(" · ")
              }
              style={{
                maxWidth: 180,
                padding: "5px 9px",
                borderRadius: 999,
                border: `1px solid ${
                  launchReportStatus === "launch_ready" ? "#bbf7d0" : "#fed7aa"
                }`,
                background:
                  launchReportStatus === "launch_ready" ? "#f0fdf4" : "#fff7ed",
                color:
                  launchReportStatus === "launch_ready" ? "#047857" : "#c2410c",
                fontSize: 10,
                fontWeight: 950,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              Report: {launchReportStatus === "launch_ready" ? "Ready" : "Draft"}
            </span>
          )}
        </div>
        <div style={{ marginTop: 10 }}>
          <select
            value={currentAdminMember?.id || activeAdminMemberId}
            onChange={(event) => setActiveAdminMemberId(event.target.value)}
            disabled={!isDemoDataMode && Boolean(currentAdminContext)}
            style={{
              width: "100%",
              minHeight: 38,
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: !isDemoDataMode && currentAdminContext ? "#f8fafc" : "white",
              color: "var(--text)",
              padding: "0 10px",
              fontSize: 12,
              fontWeight: 850,
            }}
          >
            {adminMembers
              .filter((member) => member.active)
              .map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} · {member.role}
                </option>
              ))}
          </select>
          <div style={{ marginTop: 6, color: "var(--text3)", fontSize: 10, fontWeight: 800 }}>
            {currentAdminContext && !isDemoDataMode
              ? "როლი Supabase session-იდან არის მიბმული"
              : "Demo role selector"}{" "}
            · უფლებები: {isOwner ? "ყველა" : currentAdminMember?.permissions.join(", ")}
          </div>
        </div>
      </div>

      <div style={{ padding: "0 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
          {adminSummaryCards.filter((item) => can(item.permission)).map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setTab(item.tabId)}
              style={{
                ...adminCard,
                padding: 12,
                textAlign: "left",
                minWidth: 0,
              }}
            >
              <div style={{ color: "var(--text3)", fontSize: 11, fontWeight: 900 }}>
                {item.label}
              </div>
              <div
                style={{
                  marginTop: 6,
                  color: item.color,
                  fontSize: 23,
                  fontWeight: 950,
                  lineHeight: 1.05,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {item.value}
              </div>
              <div style={{ marginTop: 5, color: "var(--text3)", fontSize: 10, fontWeight: 800 }}>
                {item.hint}
              </div>
            </button>
          ))}
        </div>

        <div style={{ ...adminCard, padding: 14, marginTop: 12 }}>
          <div style={{ color: "var(--text)", fontSize: 14, fontWeight: 950 }}>
            რა უნდა გააკეთოს Admin-მა ახლა
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8, marginTop: 10 }}>
            {adminWorkQueueItems.filter((item) => can(item.permission)).map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setTab(item.tabId)}
                style={{
                  minHeight: 48,
                  padding: 10,
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "#f8fafc",
                  textAlign: "left",
                }}
              >
                <div style={{ color: item.color, fontSize: 18, fontWeight: 950 }}>
                  {item.value}
                </div>
                <div style={{ color: "var(--text2)", fontSize: 11, fontWeight: 850 }}>
                  {item.label}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            overflowX: "auto",
            gap: 6,
            margin: "18px 0 14px",
            padding: 4,
            borderRadius: 14,
            border: "1px solid var(--border)",
            background: "#f1f5f9",
          }}
        >
          {availableTabs.map(([id, label]) => {
            const selected = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id as AdminTab)}
                style={{
                  flex: "0 0 auto",
                  minWidth: 58,
                  minHeight: 36,
                  padding: "0 9px",
                  borderRadius: 10,
                  background: selected ? "white" : "transparent",
                  color: selected ? "var(--text)" : "var(--text2)",
                  border: selected ? "1px solid var(--border)" : "1px solid transparent",
                  fontSize: 11,
                  fontWeight: 900,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div
          style={{
            ...adminCard,
            padding: 12,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              minHeight: 42,
              padding: "0 12px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "#f8fafc",
            }}
          >
            <span style={{ color: "var(--text3)", fontSize: 15 }}>⌕</span>
            <input
              value={adminQuery}
              onChange={(event) => setAdminQuery(event.target.value)}
              placeholder="ძებნა: კლიენტი, ჯავშანი, დავა, ლოგი..."
              style={{
                flex: 1,
                minWidth: 0,
                background: "transparent",
                color: "var(--text)",
                fontSize: 13,
                fontWeight: 750,
              }}
            />
            {adminQuery && (
              <button
                type="button"
                onClick={() => setAdminQuery("")}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  background: "white",
                  color: "var(--text3)",
                  border: "1px solid var(--border)",
                  fontSize: 14,
                  fontWeight: 900,
                }}
              >
                ×
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 7, overflowX: "auto", marginTop: 10 }}>
            {[
              { id: "all" as const, label: "ყველა" },
              { id: "active" as const, label: "აქტიური" },
              { id: "closed" as const, label: "დახურული" },
              { id: "problem" as const, label: "პრობლემა" },
            ].map((item) => {
              const selected = statusFilter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setStatusFilter(item.id)}
                  style={{
                    flexShrink: 0,
                    minHeight: 34,
                    padding: "0 11px",
                    borderRadius: 999,
                    background: selected ? "var(--primary)" : "white",
                    color: selected ? "white" : "var(--text2)",
                    border: `1px solid ${selected ? "var(--primary)" : "var(--border)"}`,
                    fontSize: 11,
                    fontWeight: 900,
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          <textarea
            value={adminNote}
            onChange={(event) => setAdminNote(event.target.value)}
            placeholder="Admin ჩანაწერი ან გადაწყვეტილების მიზეზი..."
            rows={3}
            style={{
              width: "100%",
              marginTop: 10,
              padding: 12,
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "white",
              color: "var(--text)",
              fontSize: 12,
              fontWeight: 750,
              lineHeight: 1.45,
              resize: "vertical",
            }}
          />
          <div style={{ marginTop: 7, color: "var(--text3)", fontSize: 11, lineHeight: 1.4, fontWeight: 750 }}>
            მიზეზი აუცილებელია უარყოფაზე, თანხის დაბრუნებაზე, დავის გადაწყვეტაზე,
            შეზღუდვასა და ბლოკზე.
          </div>
        </div>

        {!isDemoDataMode && (adminApiLoading || adminApiError || adminApiSuccess) && (
          <div
            style={{
              ...adminCard,
              padding: 12,
              marginBottom: 14,
              background: adminApiError
                ? "#fef2f2"
                : adminApiSuccess
                  ? "#ecfdf5"
                  : "#eff6ff",
              border: `1px solid ${
                adminApiError ? "#fecaca" : adminApiSuccess ? "#bbf7d0" : "#bfdbfe"
              }`,
              color: adminApiError
                ? "#b91c1c"
                : adminApiSuccess
                  ? "#047857"
                  : "#1d4ed8",
              fontSize: 12,
              lineHeight: 1.5,
              fontWeight: 850,
            }}
          >
            {adminApiError || adminApiSuccess || "Admin launch state იტვირთება Supabase-იდან..."}
          </div>
        )}

        {tab === "overview" && (
          <AdminOverviewTab
            readyCount={readyCount}
            productionReadiness={productionReadiness}
            canOpenTab={canOpenTab}
            setTab={setTab}
            launchNextAction={launchNextAction}
            launchReportStatus={launchReportStatus}
            downloadAdminReport={downloadAdminReport}
            launchSmokeDoneCount={launchSmokeDoneCount}
            launchSmokeSteps={launchSmokeSteps}
            nextLaunchSmokeStep={nextLaunchSmokeStep}
            nextAdminAction={nextAdminAction}
            operationalQueue={operationalQueue}
            systemReadinessChecks={systemReadinessChecks}
            blockingSystemChecks={blockingSystemChecks}
            apiMigrationSummary={apiMigrationSummary}
            apiMigrationItems={apiMigrationItems}
            prePaymentDoneCount={prePaymentDoneCount}
            prePaymentChecklist={prePaymentChecklist}
            togglePrePaymentChecklistItem={togglePrePaymentChecklistItem}
            adminApiLoading={adminApiLoading}
            mobileQaDoneCount={mobileQaDoneCount}
            mobileQaScenarios={mobileQaScenarios}
            mobileQaNotes={mobileQaNotes}
            mobileQaProgressByArea={mobileQaProgressByArea}
            nextMobileQaScenario={nextMobileQaScenario}
            saveMobileQaScenarioNote={saveMobileQaScenarioNote}
            toggleMobileQaScenario={toggleMobileQaScenario}
          />
        )}

        {tab === "verification" && (
          <AdminVerificationTab
            verificationQueue={verificationQueue}
            verificationFilter={verificationFilter}
            setVerificationFilter={setVerificationFilter}
            filteredVerificationQueue={filteredVerificationQueue}
            verificationTarget={verificationTarget}
            setSelectedVerificationWorkerId={setSelectedVerificationWorkerId}
            profile={profile}
            verificationStatus={verificationStatus}
            verification={verification}
            uploadedDocumentCount={uploadedDocumentCount}
            verificationDocuments={verificationDocuments}
            isDemoDataMode={isDemoDataMode}
            signedVerificationUrls={signedVerificationUrls}
            adminApiLoading={adminApiLoading}
            setVerificationStatus={setVerificationStatus}
          />
        )}

        {tab === "disputes" && (
          <AdminDisputesTab
            disputeViewCounts={disputeViewCounts}
            disputeView={disputeView}
            setDisputeView={setDisputeView}
            filteredDisputes={filteredDisputes}
            selectedDispute={selectedDispute}
            setSelectedDisputeId={setSelectedDisputeId}
            platformSettings={platformSettings}
            clientBookings={clientBookings}
            requests={requests}
            signedDisputeEvidenceUrls={signedDisputeEvidenceUrls}
            adminActionId={adminActionId}
            adminApiLoading={adminApiLoading}
            markDisputeReviewing={markDisputeReviewing}
            resolveDispute={resolveDispute}
            can={can}
          />
        )}

        {tab === "bookings" && (
          <AdminBookingsTab
            interventionRequests={interventionRequests}
            activeBookings={activeBookings}
            pendingRequests={pendingRequests}
            visibleRegularRequests={visibleRegularRequests}
            getLinkedClientBooking={getLinkedClientBooking}
            can={can}
            adminApiLoading={adminApiLoading}
            updateBookingEverywhere={updateBookingEverywhere}
            setBookingPaymentStatus={setBookingPaymentStatus}
          />
        )}

        {tab === "finance" && (
          <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
              {[
                { label: "დაბლოკილია", value: filteredFinancialSummary.held, color: "#1d4ed8", bg: "#eff6ff" },
                { label: "დადასტურდა", value: filteredFinancialSummary.released, color: "#047857", bg: "#ecfdf5" },
                { label: "დაბრუნებულია", value: filteredFinancialSummary.refunded, color: "#b91c1c", bg: "#fef2f2" },
                { label: "დავაშია", value: filteredFinancialSummary.disputed, color: "#c2410c", bg: "#fff7ed" },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    ...adminCard,
                    padding: 14,
                    background: item.bg,
                    borderColor: "transparent",
                  }}
                >
                  <div style={{ color: item.color, fontSize: 11, fontWeight: 900 }}>
                    {item.label}
                  </div>
                  <div style={{ marginTop: 7, color: item.color, fontSize: 22, fontWeight: 950 }}>
                    {money(item.value)}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ ...adminCard, padding: 14 }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 17, color: "var(--text)" }}>
                ფინანსური მოდელი
              </h2>
              <div style={{ color: "var(--text2)", fontSize: 12, lineHeight: 1.55 }}>
                ახლა დემოში კლიენტს ებლოკება დაჯავშნის საფასური. სამუშაოს დასრულების
                და კლიენტის დადასტურების შემდეგ საფასური იხურება. Admin ერევა
                მხოლოდ დავის, დაბრუნების ან გაჭედილი სტატუსის შემთხვევაში.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 12 }}>
                {[
                  {
                    label: "ჯავშნის საფასური",
                    value: money(platformSettings.bookingFee),
                    hint: "იბლოკება დაჯავშნისას",
                  },
                  {
                    label: "საკომისიო",
                    value: `${platformSettings.commissionPercent}%`,
                    hint: "სერვისის ფასიდან",
                  },
                  {
                    label: "დაგვიანებული გაუქმება",
                    value: `${platformSettings.lateCancellationFeePercent}%`,
                    hint: "სავარაუდო დაკავება",
                  },
                  {
                    label: "თვიური",
                    value: money(platformSettings.craftsmanMonthlyFee),
                    hint: "ხელოსნის პაკეტი",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      background: "#f8fafc",
                      border: "1px solid var(--border)",
                      minWidth: 0,
                    }}
                  >
                    <div style={{ color: "var(--text)", fontSize: 15, fontWeight: 950, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.value}
                    </div>
                    <div style={{ marginTop: 3, color: "var(--text2)", fontSize: 10, fontWeight: 900 }}>
                      {item.label}
                    </div>
                    <div style={{ marginTop: 3, color: "var(--text3)", fontSize: 10, fontWeight: 750, lineHeight: 1.25 }}>
                      {item.hint}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ ...adminCard, padding: 14 }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 17, color: "var(--text)" }}>
                Admin-ის ფინანსური რიგი
              </h2>
              <div style={{ color: "var(--text2)", fontSize: 12, lineHeight: 1.5 }}>
                აქ ჩანს მხოლოდ ის, რაზეც Admin-ს გადაწყვეტილება შეიძლება დასჭირდეს:
                თანხის დაბრუნება, თანხის გაშვება ან დაგვიანებული გაუქმების გადამოწმება.
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 8,
                  marginTop: 12,
                }}
              >
                {[
                  {
                    label: "გადამოწმება",
                    value: financeReviewBookings.length,
                    hint: `სავარაუდო დაკავება ${money(lateCancellationPenaltyTotal)}`,
                    bg: "#fff7ed",
                    color: "#c2410c",
                  },
                  {
                    label: "დასაბრუნებელი",
                    value: financeRefundQueue.length,
                    hint: "უფასო გაუქმება ან უარყოფილი ჯავშანი",
                    bg: "#fef2f2",
                    color: "#b91c1c",
                  },
                  {
                    label: "გასაშვები თანხა",
                    value: financeReleaseQueue.length,
                    hint: "კლიენტმა დაადასტურა, თანხა ჯერ დაბლოკილია",
                    bg: "#ecfdf5",
                    color: "#047857",
                  },
                  {
                    label: "აქტიური hold",
                    value: filteredClientBookings.filter(
                      (booking) => (booking.paymentStatus || "held") === "held"
                    ).length,
                    hint: "ჩვეულებრივი მიმდინარე ჯავშნები",
                    bg: "#eff6ff",
                    color: "#1d4ed8",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      padding: 11,
                      borderRadius: 12,
                      background: item.bg,
                      border: "1px solid rgba(148,163,184,0.2)",
                      minWidth: 0,
                    }}
                  >
                    <div style={{ color: item.color, fontSize: 20, fontWeight: 950 }}>
                      {item.value}
                    </div>
                    <div style={{ marginTop: 2, color: item.color, fontSize: 11, fontWeight: 950 }}>
                      {item.label}
                    </div>
                    <div style={{ marginTop: 3, color: item.color, fontSize: 10, fontWeight: 750, lineHeight: 1.3 }}>
                      {item.hint}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ ...adminCard, padding: 14 }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 17, color: "var(--text)" }}>
                სავარაუდო საკომისიო
              </h2>
              <div style={{ color: "var(--text2)", fontSize: 12, lineHeight: 1.5 }}>
                სერვისის ფასებში ვიღებთ პირველ რიცხვს როგორც საწყის შეფასებას.
                საბოლოო თანხა რეალურ აპში დადასტურდება ხელოსნის შეთავაზებით და
                კლიენტის თანხმობით.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
                <div style={{ padding: 11, borderRadius: 12, background: "#f8fafc", border: "1px solid var(--border)" }}>
                  <div style={{ color: "var(--text)", fontSize: 18, fontWeight: 950 }}>
                    {money(estimatedServiceTotal)}
                  </div>
                  <div style={{ color: "var(--text3)", fontSize: 10, fontWeight: 850 }}>
                    სამუშაოების საწყისი ჯამი
                  </div>
                </div>
                <div style={{ padding: 11, borderRadius: 12, background: "#ecfdf5", border: "1px solid #bbf7d0" }}>
                  <div style={{ color: "#047857", fontSize: 18, fontWeight: 950 }}>
                    {money(estimatedCommission)}
                  </div>
                  <div style={{ color: "#047857", fontSize: 10, fontWeight: 850 }}>
                    აპის სავარაუდო წილი
                  </div>
                </div>
              </div>
            </div>

            {filteredClientBookings.length ? (
              filteredClientBookings.map((booking) => {
                const paymentStatus = booking.paymentStatus || "held";
                const amount = booking.bookingFee || platformSettings.bookingFee;
                const statusColor =
                  paymentStatus === "released"
                    ? "#047857"
                    : paymentStatus === "refunded"
                      ? "#b91c1c"
                      : paymentStatus === "disputed"
                        ? "#c2410c"
                        : "#1d4ed8";
                const statusText =
                  paymentStatus === "released"
                    ? "დადასტურდა"
                    : paymentStatus === "refunded"
                      ? "დაბრუნდა"
                      : paymentStatus === "disputed"
                        ? "დავაშია"
                        : "დაბლოკილია";
                const isLateCancellationReview =
                  booking.cancellationPolicy === "late_review" &&
                  paymentStatus !== "refunded" &&
                  paymentStatus !== "released";
                const isRefundCandidate =
                  booking.status === "cancelled" ||
                  booking.status === "declined" ||
                  paymentStatus === "refunded";
                const isReleaseCandidate =
                  booking.status === "client_confirmed" ||
                  booking.status === "closed" ||
                  paymentStatus === "released";
                const primaryFinanceAction =
                  isLateCancellationReview || isRefundCandidate
                    ? ({ status: "refunded" as const, label: "თანხის დაბრუნება", bg: "#ef4444" })
                    : isReleaseCandidate
                      ? ({ status: "released" as const, label: "თანხის გაშვება", bg: "#10b981" })
                      : null;
                const secondaryFinanceActions = [
                  ...(isLateCancellationReview
                    ? [{ status: "disputed" as const, label: "დავაში გადატანა", bg: "#f97316" }]
                    : []),
                  ...(paymentStatus === "disputed"
                    ? [
                        { status: "refunded" as const, label: "დაბრუნება", bg: "#ef4444" },
                        { status: "released" as const, label: "გაშვება", bg: "#10b981" },
                      ]
                    : []),
                  ...(paymentStatus !== "held" && paymentStatus !== "released" && paymentStatus !== "refunded"
                    ? [{ status: "held" as const, label: "hold-ზე დაბრუნება", bg: "#1d4ed8" }]
                    : []),
                ];
                const financeActions = [
                  ...(primaryFinanceAction ? [primaryFinanceAction] : []),
                  ...secondaryFinanceActions.filter(
                    (action, index, list) =>
                      action.status !== primaryFinanceAction?.status &&
                      list.findIndex((item) => item.status === action.status) === index
                  ),
                ];
                return (
                  <div key={booking.id} style={{ ...adminCard, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ color: "var(--text)", fontSize: 14 }}>
                          {booking.worker.name}
                        </strong>
                        <div style={{ marginTop: 3, color: "var(--text2)", fontSize: 12 }}>
                          {booking.worker.role} · {booking.dateLabel} · {booking.time}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ color: statusColor, fontSize: 14, fontWeight: 950 }}>
                          {money(amount)}
                        </div>
                        <div style={{ marginTop: 2, color: statusColor, fontSize: 11, fontWeight: 900 }}>
                          {statusText}
                        </div>
                      </div>
                    </div>
                    <div style={{ marginTop: 8, color: "var(--text3)", fontSize: 11, fontWeight: 800 }}>
                      #{booking.id.slice(-8)} · {statusLabel[booking.status || "pending"]}
                    </div>
                    <div style={{ marginTop: 8, padding: 10, borderRadius: 12, background: "#f8fafc", color: "var(--text2)", fontSize: 11, fontWeight: 800, lineHeight: 1.45 }}>
                      {paymentStatusHelp[paymentStatus]}
                    </div>
                    {booking.cancellationPolicy === "late_review" && (
                      <div
                        style={{
                          marginTop: 8,
                          padding: 10,
                          borderRadius: 12,
                          background: "#fff7ed",
                          border: "1px solid #fed7aa",
                          color: "#9a3412",
                          fontSize: 11,
                          fontWeight: 850,
                          lineHeight: 1.45,
                        }}
                      >
                        დაგვიანებული გაუქმება. Admin-მა უნდა გადაამოწმოს მიზეზი და
                        გადაწყვიტოს დაბრუნება თუ დაკავება. სავარაუდო დაკავება:{" "}
                        {money(penaltyAmountForBooking(booking, platformSettings))}.
                      </div>
                    )}
                    <div style={{ marginTop: 5, color: "var(--text3)", fontSize: 10, fontWeight: 850, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      ტექნიკური ჩანაწერი: {booking.paymentProvider || platformSettings.paymentProvider} ·{" "}
                      {booking.paymentCurrency || platformSettings.paymentCurrency} ·{" "}
                      {booking.paymentTransactionId || "transaction pending"}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 7, marginTop: 10 }}>
                      {[
                        ["დაჯავშნა", money(amount)],
                        ["საწყისი ფასი", money(parseFirstAmount(booking.worker.price))],
                        [
                          "საკომისიო",
                          money(
                            Math.round(
                              (parseFirstAmount(booking.worker.price) *
                                platformSettings.commissionPercent) /
                                100
                            )
                          ),
                        ],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          style={{
                            padding: 8,
                            borderRadius: 11,
                            background: "#f8fafc",
                            border: "1px solid var(--border)",
                            minWidth: 0,
                          }}
                        >
                          <div style={{ color: "var(--text)", fontSize: 12, fontWeight: 950, overflow: "hidden", textOverflow: "ellipsis" }}>
                            {value}
                          </div>
                          <div style={{ marginTop: 2, color: "var(--text3)", fontSize: 9, fontWeight: 850 }}>
                            {label}
                          </div>
                        </div>
                      ))}
                    </div>
                    {booking.adminNote && (
                      <div style={{ marginTop: 9, padding: 10, borderRadius: 12, background: "#f8fafc", color: "var(--text2)", fontSize: 12, lineHeight: 1.45 }}>
                        Admin ჩანაწერი: {booking.adminNote}
                      </div>
                    )}
                    <div style={{ marginTop: 12, color: "var(--text)", fontSize: 12, fontWeight: 950 }}>
                      ფინანსური გადაწყვეტილება
                    </div>
                    <div style={{ marginTop: 3, color: "var(--text3)", fontSize: 10, fontWeight: 800, lineHeight: 1.35 }}>
                      ღილაკი ჩანს მხოლოდ მაშინ, როცა Admin-ის ჩარევა საჭიროა. ჩვეულებრივი მიმდინარე hold არ იხურება ხელით.
                    </div>
                    {financeActions.length ? (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: financeActions.length === 1 ? "1fr" : "repeat(2, 1fr)",
                          gap: 8,
                          marginTop: 9,
                        }}
                      >
                        {financeActions.map((item) => {
                          const loading =
                            adminActionId === `payment:${booking.id}:${item.status}` ||
                            adminActionId ===
                              `booking:${booking.id}:${
                                item.status === "refunded" ? "cancelled" : "closed"
                              }`;
                          return (
                            <button
                              key={item.status}
                              type="button"
                              disabled={adminApiLoading || paymentStatus === item.status}
                              onClick={() => setBookingPaymentStatus(booking.id, item.status)}
                              style={{
                                ...actionButton(
                                  paymentStatus === item.status ? "#e2e8f0" : item.bg,
                                  paymentStatus === item.status ? "var(--text3)" : "white"
                                ),
                              }}
                            >
                              {loading ? "მიმდინარეობს..." : item.label}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ marginTop: 9, padding: 10, borderRadius: 12, background: "#f8fafc", color: "var(--text3)", fontSize: 11, fontWeight: 850, lineHeight: 1.4 }}>
                        ამ ჯავშანზე ფინანსური action ჯერ არ არის საჭირო.
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div style={{ ...adminCard, padding: 30, textAlign: "center", color: "var(--text3)", fontWeight: 800 }}>
                ფინანსური ჩანაწერი ამ ფილტრით არ მოიძებნა
              </div>
            )}
          </section>
        )}

        {tab === "users" && (
          <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {can("settings") && (
            <div style={{ ...adminCard, padding: 14 }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 17, color: "var(--text)" }}>
                Admin წევრები და უფლებები
              </h2>
              <div style={{ color: "var(--text2)", fontSize: 12, lineHeight: 1.5 }}>
                Production-ში აქ რეალური admin მომხმარებლები მიებმება. თითოეულს
                ექნება მხოლოდ თავისი უფლება: ვერიფიკაცია, support, ფინანსები ან სრული კონტროლი.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                {adminMembers.map((member) => (
                  <div
                    key={member.id}
                    style={{
                      padding: 11,
                      borderRadius: 12,
                      background: member.active ? "#f8fafc" : "#f1f5f9",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ display: "block", color: "var(--text)", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {member.name}
                        </strong>
                        <div style={{ marginTop: 3, color: "var(--text3)", fontSize: 10, fontWeight: 850 }}>
                          {member.role} · {member.permissions.join(", ")}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleAdminMember(member)}
                        disabled={adminApiLoading}
                        style={{
                          flexShrink: 0,
                          minHeight: 32,
                          padding: "0 10px",
                          borderRadius: 999,
                          background: member.active ? "#dcfce7" : "#fef2f2",
                          color: member.active ? "#047857" : "#b91c1c",
                          border: `1px solid ${member.active ? "#bbf7d0" : "#fecaca"}`,
                          fontSize: 10,
                          fontWeight: 950,
                        }}
                      >
                        {member.active ? "აქტიური" : "გამორთული"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            )}

            {adminUsersState && (
              <>
                <div style={{ ...adminCard, padding: 14 }}>
                  <h2 style={{ margin: "0 0 8px", fontSize: 17, color: "var(--text)" }}>
                    ხელოსნები
                  </h2>
                  <div style={{ color: "var(--text2)", fontSize: 12, lineHeight: 1.45 }}>
                    Supabase-იდან წამოსული ხელოსნები, ვერიფიკაცია და სამუშაო სტატისტიკა.
                  </div>
                </div>
                {filteredAdminCraftsmen.length ? (
                  filteredAdminCraftsmen.map((craftsman) => {
                    const displayName =
                      [craftsman.firstName, craftsman.lastName]
                        .filter(Boolean)
                        .join(" ") || `+995 ${craftsman.phone}`;
                    return (
                      <div key={craftsman.id} style={{ ...adminCard, padding: 14 }}>
                        <strong style={{ color: "var(--text)", fontSize: 14 }}>
                          {displayName}
                        </strong>
                        <div style={{ marginTop: 4, color: "var(--text2)", fontSize: 12, lineHeight: 1.45 }}>
                          +995 {craftsman.phone} · {craftsman.workerRole || "ხელოსანი"} ·{" "}
                          {adminAccountLabel(craftsman.status)} ·{" "}
                          {verificationLabel[
                            craftsman.verificationStatus === "not_started" || !craftsman.verificationStatus
                              ? "not_submitted"
                              : craftsman.verificationStatus
                          ]}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7, marginTop: 12 }}>
                          {[
                            ["ჯავშნები", craftsman.stats.total],
                            ["აქტიური", craftsman.stats.active],
                            ["დავაში", craftsman.stats.disputed],
                            ["გაუქმ.", craftsman.stats.cancelled],
                            ["დახურული", craftsman.stats.completed],
                            ["თანხა", money(craftsman.stats.amount)],
                          ].map(([label, value]) => (
                            <div key={label} style={{ padding: 9, borderRadius: 11, background: "#f8fafc", border: "1px solid var(--border)" }}>
                              <div style={{ color: "var(--text)", fontSize: 13, fontWeight: 950 }}>
                                {value}
                              </div>
                              <div style={{ marginTop: 2, color: "var(--text3)", fontSize: 10, fontWeight: 850 }}>
                                {label}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div style={{ marginTop: 8, color: "var(--text3)", fontSize: 11, fontWeight: 800 }}>
                          ბოლო აქტივობა:{" "}
                          {craftsman.stats.lastActivity
                            ? `${new Date(craftsman.stats.lastActivity).toLocaleDateString("ka-GE")} · ${new Date(craftsman.stats.lastActivity).toLocaleTimeString("ka-GE", { hour: "2-digit", minute: "2-digit" })}`
                            : "აქტივობა არ არის"}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginTop: 12 }}>
                          <button type="button" onClick={() => setCraftsmanAccountStatus("active", craftsman.phone)} disabled={adminApiLoading} style={actionButton("#10b981")}>
                            აქტიური
                          </button>
                          <button type="button" onClick={() => setCraftsmanAccountStatus("limited", craftsman.phone)} disabled={adminApiLoading} style={actionButton("#f97316")}>
                            შეზღუდვა
                          </button>
                          <button type="button" onClick={() => setCraftsmanAccountStatus("blocked", craftsman.phone)} disabled={adminApiLoading} style={actionButton("#ef4444")}>
                            ბლოკი
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ ...adminCard, padding: 22, textAlign: "center", color: "var(--text3)", fontWeight: 800 }}>
                    ხელოსანი ამ ფილტრით არ მოიძებნა
                  </div>
                )}

                <div style={{ ...adminCard, padding: 14 }}>
                  <h2 style={{ margin: "0 0 8px", fontSize: 17, color: "var(--text)" }}>
                    კლიენტები
                  </h2>
                  <div style={{ color: "var(--text2)", fontSize: 12, lineHeight: 1.45 }}>
                    Supabase მომხმარებლები ჯავშნების, დავების და თანხების სტატისტიკით.
                  </div>
                </div>
                {filteredAdminClients.length ? (
                  filteredAdminClients.map((client) => {
                    const displayName =
                      [client.firstName, client.lastName].filter(Boolean).join(" ") ||
                      `+995 ${client.phone}`;
                    return (
                      <div key={client.id} style={{ ...adminCard, padding: 14 }}>
                        <strong style={{ color: "var(--text)", fontSize: 14 }}>
                          {displayName}
                        </strong>
                        <div style={{ marginTop: 4, color: "var(--text2)", fontSize: 12 }}>
                          +995 {client.phone} · {adminAccountLabel(client.status)}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7, marginTop: 12 }}>
                          {[
                            ["ჯავშნები", client.stats.total],
                            ["აქტიური", client.stats.active],
                            ["დავაში", client.stats.disputed],
                            ["გაუქმ.", client.stats.cancelled],
                            ["დახურული", client.stats.completed],
                            ["თანხა", money(client.stats.amount)],
                          ].map(([label, value]) => (
                            <div key={label} style={{ padding: 9, borderRadius: 11, background: "#f8fafc", border: "1px solid var(--border)" }}>
                              <div style={{ color: "var(--text)", fontSize: 13, fontWeight: 950 }}>
                                {value}
                              </div>
                              <div style={{ marginTop: 2, color: "var(--text3)", fontSize: 10, fontWeight: 850 }}>
                                {label}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div style={{ marginTop: 8, color: "var(--text3)", fontSize: 11, fontWeight: 800 }}>
                          ბოლო აქტივობა:{" "}
                          {client.stats.lastActivity
                            ? `${new Date(client.stats.lastActivity).toLocaleDateString("ka-GE")} · ${new Date(client.stats.lastActivity).toLocaleTimeString("ka-GE", { hour: "2-digit", minute: "2-digit" })}`
                            : "აქტივობა არ არის"}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginTop: 12 }}>
                          <button type="button" onClick={() => setClientAccountStatus(client.phone, "active")} disabled={adminApiLoading} style={actionButton("#10b981")}>
                            აქტიური
                          </button>
                          <button type="button" onClick={() => setClientAccountStatus(client.phone, "limited")} disabled={adminApiLoading} style={actionButton("#f97316")}>
                            შეზღუდვა
                          </button>
                          <button type="button" onClick={() => setClientAccountStatus(client.phone, "blocked")} disabled={adminApiLoading} style={actionButton("#ef4444")}>
                            ბლოკი
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ ...adminCard, padding: 22, textAlign: "center", color: "var(--text3)", fontWeight: 800 }}>
                    კლიენტი ამ ფილტრით არ მოიძებნა
                  </div>
                )}
              </>
            )}

            {!adminUsersState && (
              <>
            <div style={{ ...adminCard, padding: 14 }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 17, color: "var(--text)" }}>
                ხელოსანი
              </h2>
              <div style={{ color: "var(--text2)", fontSize: 12 }}>
                {profile.name || "ხელოსანი"} · {accountLabel[profile.accountStatus || "active"]}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7, marginTop: 12 }}>
                {[
                  ["ჯავშნები", craftsmanUserStats.total],
                  ["აქტიური", craftsmanUserStats.active],
                  ["დავაში", craftsmanUserStats.disputed],
                  ["გაუქმ.", craftsmanUserStats.cancelled],
                  ["დახურული", craftsmanUserStats.completed],
                  ["თანხა", money(craftsmanUserStats.amount)],
                ].map(([label, value]) => (
                  <div key={label} style={{ padding: 9, borderRadius: 11, background: "#f8fafc", border: "1px solid var(--border)" }}>
                    <div style={{ color: "var(--text)", fontSize: 13, fontWeight: 950 }}>
                      {value}
                    </div>
                    <div style={{ marginTop: 2, color: "var(--text3)", fontSize: 10, fontWeight: 850 }}>
                      {label}
                    </div>
                  </div>
                ))}
              </div>
              {profile.adminNote && (
                <div style={{ marginTop: 9, padding: 10, borderRadius: 12, background: "#f8fafc", color: "var(--text2)", fontSize: 12, lineHeight: 1.45 }}>
                  Admin ჩანაწერი: {profile.adminNote}
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginTop: 12 }}>
                <button type="button" onClick={() => setCraftsmanAccountStatus("active")} disabled={adminApiLoading} style={actionButton("#10b981")}>
                  აქტიური
                </button>
                <button type="button" onClick={() => setCraftsmanAccountStatus("limited")} disabled={adminApiLoading} style={actionButton("#f97316")}>
                  შეზღუდვა
                </button>
                <button type="button" onClick={() => setCraftsmanAccountStatus("blocked")} disabled={adminApiLoading} style={actionButton("#ef4444")}>
                  ბლოკი
                </button>
              </div>
            </div>
            {filteredClients.length ? (
              filteredClients.map((phone) => {
                const client = fallbackStorage.getClientProfile(phone);
                const stats = getClientUserStats(phone);
                return (
                  <div key={phone} style={{ ...adminCard, padding: 14 }}>
                    <strong style={{ color: "var(--text)", fontSize: 14 }}>
                      {[client.firstName, client.lastName].filter(Boolean).join(" ") || `+995 ${phone}`}
                    </strong>
                    <div style={{ marginTop: 4, color: "var(--text2)", fontSize: 12 }}>
                      +995 {phone} · {accountLabel[client.accountStatus || "active"]}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7, marginTop: 12 }}>
                      {[
                        ["ჯავშნები", stats.total],
                        ["აქტიური", stats.active],
                        ["დავაში", stats.disputed],
                        ["გაუქმ.", stats.cancelled],
                        ["დახურული", stats.completed],
                        ["თანხა", money(stats.amount)],
                      ].map(([label, value]) => (
                        <div key={label} style={{ padding: 9, borderRadius: 11, background: "#f8fafc", border: "1px solid var(--border)" }}>
                          <div style={{ color: "var(--text)", fontSize: 13, fontWeight: 950 }}>
                            {value}
                          </div>
                          <div style={{ marginTop: 2, color: "var(--text3)", fontSize: 10, fontWeight: 850 }}>
                            {label}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 8, color: "var(--text3)", fontSize: 11, fontWeight: 800 }}>
                      ბოლო აქტივობა: {stats.lastActivity}
                    </div>
                    {client.adminNote && (
                      <div style={{ marginTop: 9, padding: 10, borderRadius: 12, background: "#f8fafc", color: "var(--text2)", fontSize: 12, lineHeight: 1.45 }}>
                        Admin ჩანაწერი: {client.adminNote}
                      </div>
                    )}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginTop: 12 }}>
                      <button type="button" onClick={() => setClientAccountStatus(phone, "active")} disabled={adminApiLoading} style={actionButton("#10b981")}>
                        აქტიური
                      </button>
                      <button type="button" onClick={() => setClientAccountStatus(phone, "limited")} disabled={adminApiLoading} style={actionButton("#f97316")}>
                        შეზღუდვა
                      </button>
                      <button type="button" onClick={() => setClientAccountStatus(phone, "blocked")} disabled={adminApiLoading} style={actionButton("#ef4444")}>
                        ბლოკი
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ ...adminCard, padding: 22, textAlign: "center", color: "var(--text3)", fontWeight: 800 }}>
                მომხმარებელი ამ ფილტრით არ მოიძებნა
              </div>
            )}
              </>
            )}
          </section>
        )}

        {tab === "settings" && (
          <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ ...adminCard, padding: 16 }}>
              <h2 style={{ margin: "0 0 6px", fontSize: 18, color: "var(--text)" }}>
                პლატფორმის პარამეტრები
              </h2>
              <div style={{ color: "var(--text2)", fontSize: 12, lineHeight: 1.5 }}>
                ეს მნიშვნელობები გამოიყენება demo ჯავშნებზე და მომავალში იგივე
                წესები გადავა backend/payment ლოგიკაში.
              </div>
            </div>

            <div style={{ ...adminCard, padding: 14 }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 17, color: "var(--text)" }}>
                Production providers
              </h2>
              <div style={{ display: "grid", gap: 10 }}>
                {adminProviderFields.map((item) => (
                  <label
                    key={item.key}
                    style={{ display: "block", color: "var(--text)", fontSize: 13, fontWeight: 950 }}
                  >
                    {item.label}
                    <select
                      value={String(settingsDraft[item.key])}
                      onChange={(event) =>
                        updateSettingsChoice(
                          item.key,
                          event.target.value as PlatformSettings[typeof item.key]
                        )
                      }
                      style={{
                        width: "100%",
                        height: 42,
                        marginTop: 7,
                        padding: "0 12px",
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        background: "#f8fafc",
                        color: "var(--text)",
                        fontSize: 13,
                        fontWeight: 900,
                      }}
                    >
                      {item.options.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                <button
                  type="button"
                  onClick={toggleProductionModeDraft}
                  style={{
                    minHeight: 42,
                    borderRadius: 12,
                    background: settingsDraft.productionMode ? "#dcfce7" : "#fff7ed",
                    color: settingsDraft.productionMode ? "#047857" : "#c2410c",
                    border: `1px solid ${
                      settingsDraft.productionMode ? "#bbf7d0" : "#fed7aa"
                    }`,
                    fontSize: 12,
                    fontWeight: 950,
                  }}
                >
                  {settingsDraft.productionMode
                    ? "Production mode მონიშნულია"
                    : "Production mode გამორთულია"}
                </button>
                <div style={{ color: "var(--text3)", fontSize: 11, lineHeight: 1.45, fontWeight: 750 }}>
                  ჩართვა დაიბლოკება, თუ Supabase/API ან ავტორიზაცია demo რეჟიმშია.
                  Manual MVP hold დროებით საკმარისია სატესტო/საპილოტე გაშვებისთვის,
                  საბანკო provider კი რეალური თანხის ჩამოჭრის ეტაპზე დაემატება.
                </div>
                {!isDemoDataMode && (
                  <div
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      background:
                        preflightChecks.length && preflightSummary.requiredErrors === 0
                          ? "#ecfdf5"
                          : "#fff7ed",
                      border: `1px solid ${
                        preflightChecks.length && preflightSummary.requiredErrors === 0
                          ? "#bbf7d0"
                          : "#fed7aa"
                      }`,
                      color:
                        preflightChecks.length && preflightSummary.requiredErrors === 0
                          ? "#047857"
                          : "#c2410c",
                      fontSize: 11,
                      lineHeight: 1.45,
                      fontWeight: 850,
                    }}
                    >
                      {preflightChecks.length
                      ? preflightSummary.requiredErrors === 0 && preflightFresh
                        ? `Supabase preflight ახალია და აუცილებელი შეცდომა არ დარჩა. ბოლო: ${formatDate(preflightCheckedAt || undefined)}`
                        : preflightSummary.requiredErrors === 0
                          ? `Supabase preflight მწვანეა, მაგრამ 24 საათზე ძველია. ბოლო: ${formatDate(preflightCheckedAt || undefined)}`
                          : `Supabase preflight-ში ${preflightSummary.requiredErrors} აუცილებელი შეცდომაა. ბოლო: ${formatDate(preflightCheckedAt || undefined)}`
                      : "Production-მდე ჯერ გაუშვი Supabase შემოწმება ამავე გვერდზე."}
                  </div>
                )}
              </div>
            </div>

            <div
              style={{
                ...adminCard,
                padding: 14,
                borderColor: productionGuardItems.length ? "#fed7aa" : "#bbf7d0",
                background: productionGuardItems.length ? "#fff7ed" : "#f0fdf4",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <h2 style={{ margin: "0 0 6px", fontSize: 17, color: "var(--text)" }}>
                    Production blocker-ები
                  </h2>
                  <div
                    style={{
                      color: productionGuardItems.length ? "#9a3412" : "#047857",
                      fontSize: 12,
                      fontWeight: 850,
                      lineHeight: 1.45,
                    }}
                  >
                    {productionGuardItems.length
                      ? "ქვემოთ დარჩენილია ის პუნქტები, რომლებიც production mode-ს ბლოკავს."
                      : "ყველა აუცილებელი პუნქტი მზადაა. Production mode-ის მონიშვნა შეიძლება."}
                  </div>
                </div>
                <div
                  style={{
                    flexShrink: 0,
                    minWidth: 42,
                    height: 34,
                    borderRadius: 999,
                    display: "grid",
                    placeItems: "center",
                    background: productionGuardItems.length ? "#ffedd5" : "#dcfce7",
                    color: productionGuardItems.length ? "#c2410c" : "#047857",
                    border: `1px solid ${productionGuardItems.length ? "#fdba74" : "#86efac"}`,
                    fontSize: 13,
                    fontWeight: 950,
                  }}
                >
                  {productionGuardItems.length}
                </div>
              </div>
              {productionGuardItems.length > 0 && (
                <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                  {productionGuardItems.slice(0, 6).map((item) => (
                    <div
                      key={item.id}
                      style={{
                        padding: 10,
                        borderRadius: 12,
                        background: "rgba(255,255,255,.72)",
                        border: "1px solid rgba(251,146,60,.45)",
                      }}
                    >
                      <strong style={{ display: "block", color: "var(--text)", fontSize: 12 }}>
                        {item.label}
                      </strong>
                      <span
                        style={{
                          display: "block",
                          marginTop: 3,
                          color: "var(--text2)",
                          fontSize: 11,
                          fontWeight: 800,
                          lineHeight: 1.4,
                        }}
                      >
                        {item.detail}
                      </span>
                    </div>
                  ))}
                  {productionGuardItems.length > 6 && (
                    <div style={{ color: "#9a3412", fontSize: 11, fontWeight: 850 }}>
                      კიდევ {productionGuardItems.length - 6} პუნქტია readiness სიაში.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ ...adminCard, padding: 14 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <div>
                  <h2
                    style={{
                      margin: "0 0 6px",
                      fontSize: 17,
                      color: "var(--text)",
                    }}
                  >
                    Supabase შემოწმება
                  </h2>
                  <div
                    style={{
                      color: "var(--text2)",
                      fontSize: 12,
                      lineHeight: 1.5,
                    }}
                  >
                    ამით ვამოწმებთ, მართლა მუშაობს თუ არა მთავარი RPC-ები,
                    Admin უფლებები და private storage policy.
                    {preflightCheckedAt
                      ? ` ბოლო შემოწმება: ${formatDate(preflightCheckedAt)}.`
                      : ""}
                  </div>
                  {!isDemoDataMode && (
                    <div
                      style={{
                        marginTop: 6,
                        color: preflightFresh ? "#047857" : "var(--text3)",
                        fontSize: 11,
                        fontWeight: 850,
                        overflowWrap: "anywhere",
                      }}
                    >
                      Project: {preflightScope} ·{" "}
                      {preflightCheckedAt
                        ? preflightFresh
                          ? "შემოწმება ახალია"
                          : "შემოწმება დასაახლებელია"
                        : "ჯერ არ შემოწმებულა"}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  <button
                    type="button"
                    onClick={runPreflight}
                    disabled={preflightLoading}
                    style={{
                      ...actionButton("#17243a"),
                      minWidth: 112,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {preflightLoading ? "მოწმდება..." : "შემოწმება"}
                  </button>
                  {preflightChecks.length > 0 && (
                    <button
                      type="button"
                      onClick={resetPreflightCache}
                      disabled={preflightLoading}
                      style={{
                        ...actionButton("#f1f5f9", "var(--text2)"),
                        minWidth: 112,
                        whiteSpace: "nowrap",
                      }}
                    >
                      გასუფთავება
                    </button>
                  )}
                </div>
              </div>

              {preflightChecks.length > 0 && (
                <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                      gap: 8,
                    }}
                  >
                    {[
                      ["კარგია", preflightSummary.ok, "#047857", "#ecfdf5", "#bbf7d0"],
                      ["საყურადღებო", preflightSummary.warning, "#c2410c", "#fff7ed", "#fed7aa"],
                      ["შეცდომა", preflightSummary.error, "#b91c1c", "#fef2f2", "#fecaca"],
                    ].map(([label, value, color, bg, border]) => (
                      <div
                        key={label}
                        style={{
                          padding: 10,
                          borderRadius: 12,
                          background: String(bg),
                          border: `1px solid ${border}`,
                          minWidth: 0,
                        }}
                      >
                        <div style={{ color: String(color), fontSize: 19, fontWeight: 950 }}>
                          {value}
                        </div>
                        <div style={{ marginTop: 2, color: String(color), fontSize: 10, fontWeight: 900 }}>
                          {label}
                        </div>
                      </div>
                    ))}
                  </div>
                  {preflightSummary.requiredErrors > 0 && (
                    <div
                      style={{
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
                      Production-მდე ჯერ {preflightSummary.requiredErrors} აუცილებელი
                      Supabase შემოწმებაა გასასწორებელი.
                    </div>
                  )}
                  {preflightChecks.map((check) => {
                    const ui = preflightStatusUi[check.status];
                    return (
                      <div
                        key={check.id}
                        style={{
                          border: `1px solid ${ui.border}`,
                          background: ui.bg,
                          borderRadius: 12,
                          padding: 10,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 8,
                            alignItems: "center",
                          }}
                        >
                          <strong
                            style={{
                              color: "var(--text)",
                              fontSize: 13,
                              lineHeight: 1.25,
                            }}
                          >
                            {check.label}
                          </strong>
                          <span
                            style={{
                              flex: "0 0 auto",
                              color: ui.color,
                              fontSize: 10,
                              fontWeight: 950,
                              border: `1px solid ${ui.border}`,
                              background: "rgba(255,255,255,.68)",
                              borderRadius: 999,
                              padding: "4px 8px",
                            }}
                          >
                            {ui.label}
                          </span>
                        </div>
                        <div
                          style={{
                            marginTop: 6,
                            color: check.status === "error" ? "#b91c1c" : "var(--text2)",
                            fontSize: 11,
                            lineHeight: 1.45,
                            fontWeight: 750,
                            overflowWrap: "anywhere",
                          }}
                          >
                            {check.detail}
                          </div>
                        {check.nextAction && check.status !== "ok" && (
                          <div
                            style={{
                              marginTop: 7,
                              padding: 9,
                              borderRadius: 10,
                              background: "rgba(255,255,255,.62)",
                              color: ui.color,
                              fontSize: 10,
                              fontWeight: 850,
                              lineHeight: 1.4,
                              overflowWrap: "anywhere",
                            }}
                          >
                            შემდეგი ნაბიჯი: {check.nextAction}
                          </div>
                        )}
                        {check.sqlFile && check.status !== "ok" && (
                          <div
                            style={{
                              marginTop: 6,
                              color: "var(--text3)",
                              fontSize: 10,
                              fontWeight: 850,
                              overflowWrap: "anywhere",
                            }}
                          >
                            SQL: {check.sqlFile}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {platformSettingNumberFields.map((item) => (
              <div key={item.key} style={{ ...adminCard, padding: 14 }}>
                <label style={{ display: "block", color: "var(--text)", fontSize: 13, fontWeight: 950 }}>
                  {item.label}
                </label>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                  <input
                    type="number"
                    min={0}
                    value={settingsDraft[item.key]}
                    onChange={(event) => updateSettingsDraft(item.key, event.target.value)}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      height: 42,
                      padding: "0 12px",
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: "#f8fafc",
                      color: "var(--text)",
                      fontSize: 15,
                      fontWeight: 900,
                    }}
                  />
                  <span style={{ color: "var(--text2)", fontSize: 12, fontWeight: 900, minWidth: 45 }}>
                    {item.suffix}
                  </span>
                </div>
                <div style={{ marginTop: 7, color: "var(--text3)", fontSize: 11, lineHeight: 1.4, fontWeight: 750 }}>
                  {item.hint}
                </div>
              </div>
            ))}

            <div style={{ ...adminCard, padding: 14 }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 17, color: "var(--text)" }}>
                წესები და ტექსტები
              </h2>
              <div style={{ color: "var(--text2)", fontSize: 12, lineHeight: 1.5, marginBottom: 12 }}>
                ეს ტექსტები ჩანს დაჯავშნისას და გამოიყენება support/Admin პროცესში.
                გადახდის ჩართვამდე აქ უნდა იყოს საბოლოო, გასაგები ფორმულირება.
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {legalSettingFields.map((item) => (
                  <label
                    key={item.key}
                    style={{ display: "block", color: "var(--text)", fontSize: 12, fontWeight: 950 }}
                  >
                    {item.label}
                    <textarea
                      value={legalDraft[item.key]}
                      onChange={(event) =>
                        setLegalDraft((current) => ({
                          ...current,
                          [item.key]: event.target.value,
                        }))
                      }
                      rows={3}
                      style={{
                        width: "100%",
                        marginTop: 7,
                        padding: 10,
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        background: "#f8fafc",
                        color: "var(--text)",
                        fontSize: 12,
                        lineHeight: 1.45,
                        fontWeight: 750,
                        resize: "vertical",
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button
                type="button"
                onClick={resetSettingsDrafts}
                style={actionButton("#f1f5f9", "var(--text)")}
              >
                დაბრუნება
              </button>
              <button
                type="button"
                onClick={saveLegalSettings}
                disabled={adminApiLoading}
                style={actionButton("#10b981")}
              >
                ყველაფრის შენახვა
              </button>
            </div>
            {(settingsSaveMessage || adminApiError) && (
              <div
                style={{
                  padding: 11,
                  borderRadius: 12,
                  background: adminApiError ? "#fef2f2" : "#f0fdf4",
                  border: `1px solid ${adminApiError ? "#fecaca" : "#bbf7d0"}`,
                  color: adminApiError ? "#b91c1c" : "#047857",
                  fontSize: 12,
                  lineHeight: 1.45,
                  fontWeight: 850,
                }}
              >
                {adminApiError || settingsSaveMessage}
              </div>
            )}
          </section>
        )}

        {tab === "audit" && (
          <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filteredAuditLogs.length ? (
              filteredAuditLogs.map((log) => (
                <div key={log.id} style={{ ...adminCard, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <strong style={{ color: "var(--text)", fontSize: 14 }}>
                      {auditLabel[log.action]}
                    </strong>
                    <span
                      style={{
                        color: "var(--text3)",
                        fontSize: 11,
                        fontWeight: 850,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatDate(log.createdAt)}
                    </span>
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      color: "var(--text2)",
                      fontSize: 12,
                      lineHeight: 1.5,
                      fontWeight: 750,
                    }}
                  >
                    {log.summary}
                  </div>
                  <div
                    style={{
                      marginTop: 7,
                      color: "var(--text3)",
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    {log.adminName} · {log.target}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ ...adminCard, padding: 30, textAlign: "center", color: "var(--text3)", fontWeight: 800 }}>
                Admin ქმედება ამ ფილტრით არ მოიძებნა
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
};
