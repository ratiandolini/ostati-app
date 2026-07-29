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

type AdminStatusFilter = "all" | "active" | "closed" | "problem";
type VerificationFilter = "all" | "pending" | "verified" | "rejected";
type DisputeView = "active" | "urgent" | "reviewing" | "archive";

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
  const productionGuardItems = [
    ...draftProductionReadiness
      .filter((item) => item.id !== "production_mode" && !item.ready)
      .map((item) => ({
        id: item.id,
        label: item.label,
        detail: item.detail,
        severity: item.severity,
      })),
    ...(mobileQaNotes.length > 0
      ? [
          {
            id: "mobile_qa_notes",
            label: "Mobile QA შენიშვნები",
            detail: `${mobileQaNotes.length} შენიშვნა დარჩენილია. Ready report-მდე ან გაასწორე საკითხი, ან წაშალე შენიშვნა.`,
            severity: "warning" as const,
          },
        ]
      : []),
    ...(!isDemoDataMode && preflightChecks.length === 0
      ? [
          {
            id: "supabase_preflight_missing",
            label: "Supabase preflight",
            detail: "ჯერ Settings-ში დააჭირე Supabase შემოწმებას.",
            severity: "blocked" as const,
          },
        ]
      : []),
    ...(!isDemoDataMode && preflightChecks.length > 0 && !preflightFresh
      ? [
          {
            id: "supabase_preflight_stale",
            label: "Supabase preflight",
            detail: "შემოწმება 24 საათზე ძველია, თავიდან გაუშვი.",
            severity: "blocked" as const,
          },
        ]
      : []),
    ...(!isDemoDataMode && preflightSummary.requiredErrors > 0
      ? [
          {
            id: "supabase_preflight_errors",
            label: "Supabase preflight",
            detail: `${preflightSummary.requiredErrors} აუცილებელი შეცდომაა გასასწორებელი.`,
            severity: "blocked" as const,
          },
        ]
      : []),
  ];
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
          {[
            {
              label: "შესამოწმებელი",
              value: verificationStatus === "pending" ? 1 : 0,
              hint: "ხელოსნის დოკუმენტები",
              tabId: "verification" as const,
              permission: "verification" as AdminPermission,
              color: verificationStatus === "pending" ? "#c2410c" : "#64748b",
            },
            {
              label: "ღია დავები",
              value: openDisputes.length,
              hint: urgentDisputes.length ? `${urgentDisputes.length} სასწრაფო` : "სასწრაფო არაა",
              tabId: "disputes" as const,
              permission: "disputes" as AdminPermission,
              color: openDisputes.length ? "#b91c1c" : "#64748b",
            },
            {
              label: "Admin ჩარევა",
              value: interventionRequests.length,
              hint: "პრობლემური ჯავშნები",
              tabId: "bookings" as const,
              permission: "bookings" as AdminPermission,
              color: interventionRequests.length ? "#1d4ed8" : "#64748b",
            },
          ].filter((item) => can(item.permission)).map((item) => (
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
            {[
              {
                label: verificationStatus === "pending"
                  ? "ხელოსნის დოკუმენტები შესამოწმებელია"
                  : "ვერიფიკაციის რიგი ცარიელია",
                value: verificationStatus === "pending" ? 1 : 0,
                color: verificationStatus === "pending" ? "#c2410c" : "#64748b",
                tabId: "verification" as const,
                permission: "verification" as AdminPermission,
              },
              {
                label: openDisputes.length
                  ? `${openDisputes.length} დავა საჭიროებს ყურადღებას`
                  : "ღია დავა არ არის",
                value: openDisputes.length,
                color: openDisputes.length ? "#b91c1c" : "#64748b",
                tabId: "disputes" as const,
                permission: "disputes" as AdminPermission,
              },
              {
                label: interventionRequests.length
                  ? `${interventionRequests.length} პრობლემური ჯავშანია გადასამოწმებელი`
                  : "პრობლემური ჯავშანი არ არის",
                value: interventionRequests.length,
                color: interventionRequests.length ? "#1d4ed8" : "#64748b",
                tabId: "bookings" as const,
                permission: "bookings" as AdminPermission,
              },
            ].filter((item) => can(item.permission)).map((item) => (
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
          <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ ...adminCard, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <div>
                  <h2 style={{ margin: "0 0 6px", fontSize: 17, color: "var(--text)" }}>
                    Production მზადყოფნა
                  </h2>
                  <div style={{ color: "var(--text2)", fontSize: 12, lineHeight: 1.5 }}>
                    4-9 ეტაპების საერთო მდგომარეობა: ავტორიზაცია, გადახდა,
                    Admin უფლებები, Supabase, დიზაინი და deploy.
                  </div>
                </div>
                <div
                  style={{
                    flexShrink: 0,
                    width: 54,
                    height: 54,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    background: readyCount === productionReadiness.length ? "#dcfce7" : "#eff6ff",
                    color: readyCount === productionReadiness.length ? "#047857" : "#1d4ed8",
                    fontSize: 15,
                    fontWeight: 950,
                  }}
                >
                  {readyCount}/{productionReadiness.length}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
                {productionReadiness.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      const targetTab = item.label === "Admin უფლებები" ? "users" : "settings";
                      if (canOpenTab(targetTab)) setTab(targetTab);
                    }}
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      background: item.ready ? "#ecfdf5" : "#fff7ed",
                      border: `1px solid ${item.ready ? "#bbf7d0" : "#fed7aa"}`,
                      textAlign: "left",
                      minWidth: 0,
                    }}
                  >
                    <div style={{ color: item.ready ? "#047857" : "#c2410c", fontSize: 11, fontWeight: 950 }}>
                      {item.ready ? "მზადაა" : "დასასრულებელია"}
                    </div>
                    <div style={{ marginTop: 3, color: "var(--text)", fontSize: 12, fontWeight: 950, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.label}
                    </div>
                    <div style={{ marginTop: 2, color: "var(--text3)", fontSize: 10, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.detail}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div
              style={{
                ...adminCard,
                padding: 14,
                background: launchNextAction.bg,
                borderColor: launchNextAction.border,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "flex-start",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      color: launchNextAction.tone,
                      fontSize: 11,
                      fontWeight: 950,
                    }}
                  >
                    Launch-ის შემდეგი მოქმედება
                  </div>
                  <h2
                    style={{
                      margin: "5px 0 4px",
                      color: "var(--text)",
                      fontSize: 16,
                      lineHeight: 1.25,
                    }}
                  >
                    {launchNextAction.label}
                  </h2>
                  <div
                    style={{
                      color: "var(--text2)",
                      fontSize: 11,
                      lineHeight: 1.45,
                      fontWeight: 800,
                    }}
                  >
                    {launchNextAction.detail}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (launchReportStatus === "launch_ready") {
                      downloadAdminReport();
                      return;
                    }
                    if (canOpenTab(launchNextAction.tab)) {
                      setTab(launchNextAction.tab);
                    }
                  }}
                  style={{
                    flexShrink: 0,
                    minHeight: 38,
                    padding: "0 12px",
                    borderRadius: 999,
                    background: launchNextAction.tone,
                    color: "white",
                    border: `1px solid ${launchNextAction.tone}`,
                    fontSize: 11,
                    fontWeight: 950,
                    whiteSpace: "nowrap",
                  }}
                >
                  {launchNextAction.button}
                </button>
              </div>
            </div>

            <div style={{ ...adminCard, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <h2 style={{ margin: "0 0 6px", fontSize: 17, color: "var(--text)" }}>
                    Launch smoke flow
                  </h2>
                  <div style={{ color: "var(--text2)", fontSize: 12, lineHeight: 1.5 }}>
                    ეს არის ბოლო ხელით გასავლელი გზა, რომ დავრწმუნდეთ კლიენტი,
                    ხელოსანი და Admin ერთად სწორად მუშაობენ.
                  </div>
                </div>
                <div
                  style={{
                    flexShrink: 0,
                    padding: "7px 10px",
                    borderRadius: 999,
                    background:
                      launchSmokeDoneCount === launchSmokeSteps.length
                        ? "#dcfce7"
                        : "#eff6ff",
                    color:
                      launchSmokeDoneCount === launchSmokeSteps.length
                        ? "#047857"
                        : "#1d4ed8",
                    border: `1px solid ${
                      launchSmokeDoneCount === launchSmokeSteps.length
                        ? "#bbf7d0"
                        : "#bfdbfe"
                    }`,
                    fontSize: 11,
                    fontWeight: 950,
                    height: 32,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  {launchSmokeDoneCount}/{launchSmokeSteps.length}
                </div>
              </div>
              {nextLaunchSmokeStep ? (
                <button
                  type="button"
                  onClick={() => {
                    if (canOpenTab(nextLaunchSmokeStep.targetTab)) {
                      setTab(nextLaunchSmokeStep.targetTab);
                    }
                  }}
                  style={{
                    width: "100%",
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 12,
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    color: "#1d4ed8",
                    textAlign: "left",
                  }}
                >
                  <span style={{ display: "block", fontSize: 10, fontWeight: 950 }}>
                    შემდეგი ნაბიჯი
                  </span>
                  <strong
                    style={{
                      display: "block",
                      marginTop: 3,
                      color: "var(--text)",
                      fontSize: 13,
                      lineHeight: 1.25,
                    }}
                  >
                    {nextLaunchSmokeStep.label}
                  </strong>
                  <span
                    style={{
                      display: "block",
                      marginTop: 4,
                      fontSize: 11,
                      fontWeight: 800,
                      lineHeight: 1.4,
                    }}
                  >
                    {nextLaunchSmokeStep.detail}
                  </span>
                  {nextLaunchSmokeStep.missing.length > 0 && (
                    <span
                      style={{
                        display: "block",
                        marginTop: 6,
                        color: "#1e40af",
                        fontSize: 10,
                        fontWeight: 900,
                        lineHeight: 1.35,
                      }}
                    >
                      აკლია: {nextLaunchSmokeStep.missing.slice(0, 3).join(", ")}
                      {nextLaunchSmokeStep.missing.length > 3 ? "..." : ""}
                    </span>
                  )}
                </button>
              ) : (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 12,
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    color: "#047857",
                    fontSize: 12,
                    fontWeight: 850,
                    lineHeight: 1.45,
                  }}
                >
                  Smoke flow სრულად გავლილია. ახლა report ჩამოტვირთე და production
                  blocker-ები გადაამოწმე.
                </div>
              )}
              <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                {launchSmokeSteps.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (canOpenTab(item.targetTab)) setTab(item.targetTab);
                    }}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "28px 1fr",
                      gap: 10,
                      alignItems: "center",
                      width: "100%",
                      padding: 10,
                      borderRadius: 12,
                      background: item.done ? "#f0fdf4" : "#f8fafc",
                      border: `1px solid ${item.done ? "#bbf7d0" : "var(--border)"}`,
                      textAlign: "left",
                    }}
                  >
                    <span
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        display: "grid",
                        placeItems: "center",
                        background: item.done ? "#10b981" : "white",
                        color: item.done ? "white" : "var(--text3)",
                        border: `1px solid ${item.done ? "#10b981" : "var(--border2)"}`,
                        fontSize: 11,
                        fontWeight: 950,
                      }}
                    >
                      {item.done ? "✓" : index + 1}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <strong style={{ display: "block", color: "var(--text)", fontSize: 13 }}>
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
                      {!item.done && item.missing.length > 0 && (
                        <span
                          style={{
                            display: "block",
                            marginTop: 5,
                            color: "#c2410c",
                            fontSize: 10,
                            fontWeight: 900,
                            lineHeight: 1.35,
                          }}
                        >
                          აკლია: {item.missing.slice(0, 3).join(", ")}
                          {item.missing.length > 3 ? "..." : ""}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ ...adminCard, padding: 16 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "flex-start",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <h2 style={{ margin: "0 0 6px", fontSize: 17, color: "var(--text)" }}>
                    Admin-ის დღევანდელი რიგი
                  </h2>
                  <div style={{ color: "var(--text2)", fontSize: 12, lineHeight: 1.5 }}>
                    ეს რიგი აერთიანებს ვერიფიკაციას, დავებს, ფინანსებს და პრობლემურ
                    ჯავშნებს. ზემოთ ჩანს ყველაზე სასწრაფო მოქმედება.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (nextAdminAction && canOpenTab(nextAdminAction.tabId)) {
                      setTab(nextAdminAction.tabId);
                    }
                  }}
                  style={{
                    flexShrink: 0,
                    minHeight: 38,
                    padding: "0 12px",
                    borderRadius: 999,
                    background: nextAdminAction?.count ? "var(--primary)" : "#f8fafc",
                    color: nextAdminAction?.count ? "white" : "var(--text2)",
                    border: `1px solid ${
                      nextAdminAction?.count ? "var(--primary)" : "var(--border)"
                    }`,
                    fontSize: 11,
                    fontWeight: 950,
                  }}
                >
                  {nextAdminAction?.count ? "პირველი მოქმედება" : "ყველაფერი სუფთაა"}
                </button>
              </div>
              {nextAdminAction && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 14,
                    background: nextAdminAction.bg,
                    border: "1px solid rgba(148,163,184,0.25)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          color: nextAdminAction.tone,
                          fontSize: 11,
                          fontWeight: 950,
                        }}
                      >
                        შემდეგი პრიორიტეტი
                      </div>
                      <div
                        style={{
                          marginTop: 3,
                          color: "var(--text)",
                          fontSize: 15,
                          fontWeight: 950,
                        }}
                      >
                        {nextAdminAction.label}
                      </div>
                      <div
                        style={{
                          marginTop: 4,
                          color: "var(--text2)",
                          fontSize: 11,
                          lineHeight: 1.4,
                          fontWeight: 800,
                        }}
                      >
                        {nextAdminAction.detail}
                      </div>
                    </div>
                    <div
                      style={{
                        flexShrink: 0,
                        minWidth: 44,
                        height: 44,
                        borderRadius: 14,
                        display: "grid",
                        placeItems: "center",
                        background: "white",
                        color: nextAdminAction.tone,
                        border: "1px solid rgba(148,163,184,0.25)",
                        fontSize: 18,
                        fontWeight: 950,
                      }}
                    >
                      {nextAdminAction.count}
                    </div>
                  </div>
                </div>
              )}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr",
                  gap: 8,
                  marginTop: 12,
                }}
              >
                {operationalQueue.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (canOpenTab(item.tabId)) setTab(item.tabId);
                    }}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "38px 1fr auto",
                      gap: 10,
                      alignItems: "center",
                      width: "100%",
                      padding: 10,
                      borderRadius: 12,
                      background: item.count ? item.bg : "#f8fafc",
                      border: `1px solid ${
                        item.count ? "rgba(148,163,184,0.25)" : "var(--border)"
                      }`,
                      textAlign: "left",
                    }}
                  >
                    <span
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 12,
                        display: "grid",
                        placeItems: "center",
                        background: item.count ? "white" : "#eef3f9",
                        color: item.count ? item.tone : "var(--text3)",
                        border: "1px solid rgba(148,163,184,0.28)",
                        fontSize: 14,
                        fontWeight: 950,
                      }}
                    >
                      {item.count}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <strong
                        style={{
                          display: "block",
                          color: "var(--text)",
                          fontSize: 13,
                          lineHeight: 1.25,
                        }}
                      >
                        {item.label}
                      </strong>
                      <span
                        style={{
                          display: "block",
                          marginTop: 3,
                          color: "var(--text2)",
                          fontSize: 10,
                          lineHeight: 1.35,
                          fontWeight: 780,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {item.detail}
                      </span>
                    </span>
                    <span
                      style={{
                        color: item.count ? item.tone : "var(--text3)",
                        fontSize: 10,
                        fontWeight: 950,
                      }}
                    >
                      გახსნა
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ ...adminCard, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div>
                  <h2 style={{ margin: "0 0 6px", fontSize: 17, color: "var(--text)" }}>
                    სისტემური შემოწმება
                  </h2>
                  <div style={{ color: "var(--text2)", fontSize: 12, lineHeight: 1.5 }}>
                    ეს ბლოკი ავტომატურად ამოწმებს გარემოს და გვაჩვენებს, რა
                    გვაკლია რეალურ რეჟიმამდე.
                  </div>
                </div>
                <div
                  style={{
                    flexShrink: 0,
                    padding: "7px 10px",
                    borderRadius: 999,
                    background: blockingSystemChecks.length ? "#fef2f2" : "#ecfdf5",
                    color: blockingSystemChecks.length ? "#b91c1c" : "#047857",
                    border: `1px solid ${
                      blockingSystemChecks.length ? "#fecaca" : "#bbf7d0"
                    }`,
                    fontSize: 11,
                    fontWeight: 950,
                  }}
                >
                  {blockingSystemChecks.length
                    ? `${blockingSystemChecks.length} blocker`
                    : "blocker არაა"}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                {systemReadinessChecks.map((item) => {
                  const ui =
                    item.severity === "ok"
                      ? { bg: "#f0fdf4", border: "#bbf7d0", color: "#047857", label: "მზადაა" }
                      : item.severity === "blocked"
                        ? { bg: "#fef2f2", border: "#fecaca", color: "#b91c1c", label: "ბლოკავს" }
                        : { bg: "#fff7ed", border: "#fed7aa", color: "#c2410c", label: "გასაკეთებელია" };
                  return (
                    <div
                      key={item.id}
                      style={{
                        padding: 11,
                        borderRadius: 12,
                        background: ui.bg,
                        border: `1px solid ${ui.border}`,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <strong style={{ color: "var(--text)", fontSize: 13 }}>
                          {item.label}
                        </strong>
                        <span style={{ color: ui.color, fontSize: 10, fontWeight: 950 }}>
                          {ui.label}
                        </span>
                      </div>
                      <div style={{ marginTop: 4, color: "var(--text2)", fontSize: 11, lineHeight: 1.45, fontWeight: 750 }}>
                        {item.detail}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ ...adminCard, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div>
                  <h2 style={{ margin: "0 0 6px", fontSize: 17, color: "var(--text)" }}>
                    API migration map
                  </h2>
                  <div style={{ color: "var(--text2)", fontSize: 12, lineHeight: 1.5 }}>
                    აქ ჩანს რომელი ფენა უკვე Supabase/API-სკენაა წაყვანილი და
                    რომელი ჯერ demo fallback-ზე რჩება.
                  </div>
                </div>
                <div
                  style={{
                    flexShrink: 0,
                    padding: "7px 10px",
                    borderRadius: 999,
                    background: "#eff6ff",
                    color: "#1d4ed8",
                    border: "1px solid #bfdbfe",
                    fontSize: 11,
                    fontWeight: 950,
                  }}
                >
                  {apiMigrationSummary.connected}/{apiMigrationSummary.total}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7, marginTop: 12 }}>
                {[
                  {
                    label: "მიერთ.",
                    value: apiMigrationSummary.connected,
                    color: "#047857",
                    bg: "#dcfce7",
                  },
                  {
                    label: "ნაწილ.",
                    value: apiMigrationSummary.partial,
                    color: "#c2410c",
                    bg: "#fff7ed",
                  },
                  {
                    label: "demo",
                    value: apiMigrationSummary.demo,
                    color: "#b91c1c",
                    bg: "#fef2f2",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      padding: 9,
                      borderRadius: 11,
                      background: item.bg,
                      border: "1px solid var(--border)",
                      minWidth: 0,
                    }}
                  >
                    <div style={{ color: item.color, fontSize: 16, fontWeight: 950 }}>
                      {item.value}
                    </div>
                    <div style={{ color: "var(--text3)", fontSize: 10, fontWeight: 850 }}>
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                {apiMigrationItems.map((item) => {
                  const ui = apiMigrationStatusUi[item.status];
                  return (
                    <div
                      key={item.id}
                      style={{
                        padding: 11,
                        borderRadius: 12,
                        background: ui.bg,
                        border: `1px solid ${ui.border}`,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                        <div style={{ minWidth: 0 }}>
                          <span style={{ display: "block", color: "var(--text3)", fontSize: 9, fontWeight: 950 }}>
                            {item.area}
                          </span>
                          <strong style={{ display: "block", marginTop: 2, color: "var(--text)", fontSize: 13, lineHeight: 1.25 }}>
                            {item.label}
                          </strong>
                        </div>
                        <span style={{ flexShrink: 0, color: ui.color, fontSize: 10, fontWeight: 950 }}>
                          {ui.label}
                        </span>
                      </div>
                      <div style={{ marginTop: 5, color: "var(--text2)", fontSize: 11, lineHeight: 1.45, fontWeight: 750 }}>
                        {item.detail}
                      </div>
                      <div style={{ marginTop: 4, color: "var(--text3)", fontSize: 10, lineHeight: 1.4, fontWeight: 800 }}>
                        შემდეგი: {item.nextStep}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ ...adminCard, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div>
                  <h2 style={{ margin: "0 0 6px", fontSize: 17, color: "var(--text)" }}>
                    გადახდამდე გასაკეთებელი
                  </h2>
                  <div style={{ color: "var(--text2)", fontSize: 12, lineHeight: 1.5 }}>
                    ეს არის ბოლო სამუშაო სია, სანამ რეალურ ბარათს, თანხის
                    დაბლოკვას და საკომისიოს ჩავრთავთ.
                  </div>
                </div>
                <div
                  style={{
                    flexShrink: 0,
                    padding: "7px 10px",
                    borderRadius: 999,
                    background:
                      prePaymentDoneCount === prePaymentChecklist.length
                        ? "#dcfce7"
                        : "#fff7ed",
                    color:
                      prePaymentDoneCount === prePaymentChecklist.length
                        ? "#047857"
                        : "#c2410c",
                    border: `1px solid ${
                      prePaymentDoneCount === prePaymentChecklist.length
                        ? "#bbf7d0"
                        : "#fed7aa"
                    }`,
                    fontSize: 11,
                    fontWeight: 950,
                  }}
                >
                  {prePaymentDoneCount}/{prePaymentChecklist.length}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                {prePaymentChecklist.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => togglePrePaymentChecklistItem(item)}
                    disabled={adminApiLoading}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      width: "100%",
                      padding: 11,
                      borderRadius: 12,
                      background: item.done ? "#f0fdf4" : "#f8fafc",
                      border: `1px solid ${item.done ? "#bbf7d0" : "var(--border)"}`,
                      textAlign: "left",
                    }}
                  >
                    <span
                      style={{
                        flexShrink: 0,
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        display: "grid",
                        placeItems: "center",
                        background: item.done ? "#10b981" : "white",
                        color: item.done ? "white" : "var(--text3)",
                        border: `1px solid ${item.done ? "#10b981" : "var(--border2)"}`,
                        fontSize: 12,
                        fontWeight: 950,
                      }}
                    >
                      {item.done ? "✓" : ""}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <strong style={{ display: "block", color: "var(--text)", fontSize: 13 }}>
                        {item.label}
                      </strong>
                      <span style={{ display: "block", marginTop: 3, color: "var(--text2)", fontSize: 11, lineHeight: 1.4, fontWeight: 750 }}>
                        {item.detail}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ ...adminCard, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div>
                  <h2 style={{ margin: "0 0 6px", fontSize: 17, color: "var(--text)" }}>
                    Mobile QA სცენარები
                  </h2>
                  <div style={{ color: "var(--text2)", fontSize: 12, lineHeight: 1.5 }}>
                    ეს სია გაიარე ტელეფონზე ან პატარა ეკრანზე. ყველა პუნქტის
                    დასრულებისას checklist-ის QA პუნქტი ავტომატურად დაიხურება.
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: 5,
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      padding: "7px 10px",
                      borderRadius: 999,
                      background:
                        mobileQaDoneCount === mobileQaScenarios.length
                          ? "#dcfce7"
                          : "#eff6ff",
                      color:
                        mobileQaDoneCount === mobileQaScenarios.length
                          ? "#047857"
                          : "#1d4ed8",
                      border: `1px solid ${
                        mobileQaDoneCount === mobileQaScenarios.length
                          ? "#bbf7d0"
                          : "#bfdbfe"
                      }`,
                      fontSize: 11,
                      fontWeight: 950,
                    }}
                  >
                    {mobileQaDoneCount}/{mobileQaScenarios.length}
                  </span>
                  {mobileQaNotes.length > 0 && (
                    <span
                      style={{
                        padding: "5px 8px",
                        borderRadius: 999,
                        background: "#fff7ed",
                        color: "#c2410c",
                        border: "1px solid #fed7aa",
                        fontSize: 10,
                        fontWeight: 950,
                      }}
                    >
                      {mobileQaNotes.length} შენიშვნა
                    </span>
                  )}
                </div>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  marginTop: 12,
                }}
              >
                {mobileQaProgressByArea.map((item) => (
                  <div
                    key={item.area}
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      background: item.complete ? "#f0fdf4" : "#f8fafc",
                      border: `1px solid ${
                        item.complete ? "#bbf7d0" : "var(--border)"
                      }`,
                    }}
                  >
                    <div
                      style={{
                        color: item.complete ? "#047857" : "var(--text)",
                        fontSize: 12,
                        fontWeight: 950,
                      }}
                    >
                      {item.label}
                    </div>
                    <div
                      style={{
                        marginTop: 5,
                        color: "var(--text2)",
                        fontSize: 11,
                        fontWeight: 850,
                      }}
                    >
                      {item.done}/{item.total || 0} დასრულებული
                    </div>
                  </div>
                ))}
              </div>
              {nextMobileQaScenario ? (
                <div
                  style={{
                    marginTop: 10,
                    padding: 11,
                    borderRadius: 12,
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    color: "#1d4ed8",
                    fontSize: 12,
                    lineHeight: 1.45,
                    fontWeight: 850,
                  }}
                >
                  შემდეგი შესამოწმებელი: {qaAreaLabel[nextMobileQaScenario.area]} ·{" "}
                  {nextMobileQaScenario.label}
                </div>
              ) : (
                <div
                  style={{
                    marginTop: 10,
                    padding: 11,
                    borderRadius: 12,
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    color: "#047857",
                    fontSize: 12,
                    lineHeight: 1.45,
                    fontWeight: 850,
                  }}
                >
                  Mobile QA სრულად გავლილია. ახლა შეიძლება report-ის ჩამოტვირთვა
                  და production blockers-ის გადამოწმება.
                </div>
              )}
              {mobileQaNotes.length > 0 && (
                <div
                  style={{
                    marginTop: 10,
                    padding: 11,
                    borderRadius: 12,
                    background: "#fff7ed",
                    border: "1px solid #fed7aa",
                  }}
                >
                  <div
                    style={{
                      color: "#c2410c",
                      fontSize: 11,
                      fontWeight: 950,
                      marginBottom: 7,
                    }}
                  >
                    ღია QA შენიშვნები
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    {mobileQaNotes.slice(0, 3).map((note) => (
                      <div
                        key={note.id}
                        style={{
                          color: "var(--text2)",
                          fontSize: 10,
                          lineHeight: 1.4,
                          fontWeight: 800,
                        }}
                      >
                        <strong style={{ color: "var(--text)" }}>
                          {note.area} · {note.label}
                        </strong>
                        : {note.note}
                      </div>
                    ))}
                    {mobileQaNotes.length > 3 && (
                      <div style={{ color: "#9a3412", fontSize: 10, fontWeight: 900 }}>
                        კიდევ {mobileQaNotes.length - 3} შენიშვნა ჩანს ქვემოთ card-ებში.
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                {mobileQaScenarios.map((item) => {
                  const guide = mobileQaTestGuide[item.id];
                  return (
                    <div
                      key={item.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "24px 1fr",
                        gap: 10,
                        width: "100%",
                        padding: 11,
                        borderRadius: 12,
                        background: item.done ? "#f0fdf4" : "#f8fafc",
                        border: `1px solid ${item.done ? "#bbf7d0" : "var(--border)"}`,
                        textAlign: "left",
                      }}
                    >
                      <span
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 7,
                          display: "grid",
                          placeItems: "center",
                          background: item.done ? "#10b981" : "white",
                          color: item.done ? "white" : "var(--text3)",
                          border: `1px solid ${item.done ? "#10b981" : "var(--border2)"}`,
                          fontSize: 12,
                          fontWeight: 950,
                        }}
                      >
                        {item.done ? "✓" : ""}
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <span
                          style={{
                            display: "inline-flex",
                            marginBottom: 4,
                            padding: "3px 7px",
                            borderRadius: 999,
                            background: "white",
                            color: "var(--text3)",
                            border: "1px solid var(--border)",
                            fontSize: 9,
                            fontWeight: 950,
                          }}
                        >
                          {qaAreaLabel[item.area]}
                        </span>
                        <strong style={{ display: "block", color: "var(--text)", fontSize: 13, lineHeight: 1.25 }}>
                          {item.label}
                        </strong>
                        <span style={{ display: "block", marginTop: 3, color: "var(--text2)", fontSize: 11, lineHeight: 1.4, fontWeight: 750 }}>
                          {item.detail}
                        </span>
                        {guide && (
                          <span
                            style={{
                              display: "block",
                              marginTop: 8,
                              padding: 9,
                              borderRadius: 10,
                              background: "rgba(255,255,255,.75)",
                              border: "1px solid rgba(148,163,184,.24)",
                            }}
                          >
                            <span
                              style={{
                                display: "block",
                                color: "var(--text3)",
                                fontSize: 9,
                                fontWeight: 950,
                                marginBottom: 4,
                              }}
                            >
                              გასავლელი ნაბიჯები
                            </span>
                            {guide.steps.map((step, index) => (
                              <span
                                key={step}
                                style={{
                                  display: "block",
                                  color: "var(--text2)",
                                  fontSize: 10,
                                  lineHeight: 1.45,
                                  fontWeight: 800,
                                }}
                              >
                                {index + 1}. {step}
                              </span>
                            ))}
                            <span
                              style={{
                                display: "block",
                                marginTop: 6,
                                color: item.done ? "#047857" : "#1d4ed8",
                                fontSize: 10,
                                lineHeight: 1.45,
                                fontWeight: 900,
                              }}
                            >
                              უნდა დადასტურდეს: {guide.expected}
                            </span>
                          </span>
                        )}
                        <textarea
                          defaultValue={item.note || ""}
                          onBlur={(event) =>
                            saveMobileQaScenarioNote(item, event.currentTarget.value.trim())
                          }
                          onClick={(event) => event.stopPropagation()}
                          placeholder="QA შენიშვნა: რა ნახე ტელეფონზე, რა არის გასასწორებელი..."
                          rows={2}
                          disabled={adminApiLoading}
                          style={{
                            width: "100%",
                            marginTop: 9,
                            padding: 10,
                            borderRadius: 10,
                            border: "1px solid var(--border)",
                            background: "white",
                            color: "var(--text)",
                            fontSize: 11,
                            lineHeight: 1.4,
                            fontWeight: 800,
                            resize: "vertical",
                          }}
                        />
                        {item.note?.trim() && (
                          <button
                            type="button"
                            onClick={() => saveMobileQaScenarioNote(item, "")}
                            disabled={adminApiLoading}
                            style={{
                              marginTop: 7,
                              minHeight: 30,
                              padding: "0 10px",
                              borderRadius: 999,
                              background: "#fff7ed",
                              color: "#c2410c",
                              border: "1px solid #fed7aa",
                              fontSize: 10,
                              fontWeight: 950,
                            }}
                          >
                            შენიშვნის გასუფთავება
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => toggleMobileQaScenario(item)}
                          disabled={adminApiLoading}
                          style={{
                            marginTop: 9,
                            minHeight: 34,
                            padding: "0 12px",
                            borderRadius: 999,
                            background: item.done ? "#dcfce7" : "var(--primary)",
                            color: item.done ? "#047857" : "white",
                            border: `1px solid ${item.done ? "#bbf7d0" : "var(--primary)"}`,
                            fontSize: 11,
                            fontWeight: 950,
                          }}
                        >
                          {item.done ? "მონიშვნის მოხსნა" : "შემოწმდა"}
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ ...adminCard, padding: 16 }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 17, color: "var(--text)" }}>
                Admin-ის წესები
              </h2>
              <div style={{ display: "grid", gap: 8 }}>
                {[
                  "ხელოსნის სამუშაო სივრცე იხსნება მხოლოდ ვერიფიკაციის დადასტურების შემდეგ.",
                  "ჯავშანს Admin არ მართავს ყოველდღიურად; Admin ერევა მხოლოდ დავაზე, დაბრუნებაზე ან გაჭედილ სტატუსზე.",
                  "უარყოფა, დაბრუნება, დავის გადაწყვეტა, შეზღუდვა და ბლოკი ყოველთვის უნდა იყოს მიზეზით.",
                  "ყველა მნიშვნელოვანი მოქმედება ინახება ლოგში, რომ მოგვიანებით გაირკვეს რა მოხდა.",
                ].map((rule) => (
                  <div
                    key={rule}
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      background: "#f8fafc",
                      border: "1px solid var(--border)",
                      color: "var(--text2)",
                      fontSize: 12,
                      lineHeight: 1.45,
                      fontWeight: 800,
                    }}
                  >
                    {rule}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {tab === "verification" && (
          <section style={{ ...adminCard, padding: 16 }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18, color: "var(--text)" }}>
                    ვერიფიკაციის რიგი
                  </h2>
                  <p style={{ margin: "5px 0 0", color: "var(--text2)", fontSize: 12, lineHeight: 1.45 }}>
                    ბევრი ხელოსანი აქ compact სიად გამოჩნდება. დოკუმენტები გაიხსნება მხოლოდ არჩეულ ქარდზე.
                  </p>
                </div>
                <span
                  style={{
                    flexShrink: 0,
                    padding: "7px 10px",
                    borderRadius: 999,
                    background: verificationQueue.length ? "#eff6ff" : "#f8fafc",
                    color: verificationQueue.length ? "#1d4ed8" : "var(--text3)",
                    border: `1px solid ${verificationQueue.length ? "#bfdbfe" : "var(--border)"}`,
                    fontSize: 11,
                    fontWeight: 950,
                  }}
                >
                  {verificationQueue.length} ხელოსანი
                </span>
              </div>

              {verificationQueue.length > 0 && (
                <>
                  <div style={{ display: "flex", gap: 7, overflowX: "auto", padding: "12px 0 4px" }}>
                    {[
                      ["all", "ყველა"],
                      ["pending", "შესამოწმებელი"],
                      ["verified", "დადასტურებული"],
                      ["rejected", "უარყოფილი"],
                    ].map(([value, label]) => {
                      const active = verificationFilter === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setVerificationFilter(value as VerificationFilter)}
                          style={{
                            flex: "0 0 auto",
                            minHeight: 34,
                            padding: "0 11px",
                            borderRadius: 999,
                            background: active ? "var(--primary)" : "#f8fafc",
                            color: active ? "white" : "var(--text2)",
                            border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
                            fontSize: 11,
                            fontWeight: 950,
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                    {filteredVerificationQueue.map((item) => {
                      const selected = verificationTarget?.workerId === item.workerId;
                      const docs = [
                        item.documents.idFront,
                        item.documents.idBack,
                        item.documents.bankAccount,
                      ].filter(Boolean).length;
                      const pending = item.verificationStatus === "pending";
                      const verified = item.verificationStatus === "verified";
                      return (
                        <button
                          key={item.workerId}
                          type="button"
                          onClick={() => setSelectedVerificationWorkerId(item.workerId)}
                          style={{
                            width: "100%",
                            padding: 11,
                            borderRadius: 14,
                            background: selected ? "#eff6ff" : "white",
                            border: `1px solid ${selected ? "#bfdbfe" : "var(--border)"}`,
                            textAlign: "left",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                            <div style={{ minWidth: 0 }}>
                              <strong style={{ display: "block", color: "var(--text)", fontSize: 13, lineHeight: 1.25 }}>
                                {item.name || "ხელოსანი"}
                              </strong>
                              <span style={{ display: "block", marginTop: 3, color: "var(--text2)", fontSize: 11, fontWeight: 800 }}>
                                {item.phone} · {item.city || "ქალაქი არაა"} · {docs}/3 დოკ.
                              </span>
                            </div>
                            <span
                              style={{
                                flexShrink: 0,
                                padding: "5px 8px",
                                borderRadius: 999,
                                background: verified ? "#dcfce7" : pending ? "#fff7ed" : "#fef2f2",
                                color: verified ? "#047857" : pending ? "#c2410c" : "#b91c1c",
                                fontSize: 10,
                                fontWeight: 950,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {verificationLabel[
                                item.verificationStatus === "not_started"
                                  ? "not_submitted"
                                  : item.verificationStatus
                              ]}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                    {!filteredVerificationQueue.length && (
                      <div
                        style={{
                          padding: 18,
                          borderRadius: 14,
                          background: "#f8fafc",
                          border: "1px solid var(--border)",
                          color: "var(--text3)",
                          fontSize: 12,
                          fontWeight: 850,
                          textAlign: "center",
                        }}
                      >
                        ამ ფილტრით ხელოსანი არ მოიძებნა.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {verificationQueue.length > 0 && <div style={{ height: 1, background: "var(--border)", margin: "8px 0 14px" }} />}

            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, color: "var(--text)" }}>
                  არჩეული ხელოსნის ვერიფიკაცია
                </h2>
                <p style={{ margin: "5px 0 0", color: "var(--text2)", fontSize: 12 }}>
                  {verificationTarget?.name || profile.name || "ხელოსანი"} ·{" "}
                  {verificationTarget?.phone || profile.phone || "ნომერი არ არის"}
                </p>
              </div>
              <span
                style={{
                  alignSelf: "flex-start",
                  padding: "6px 9px",
                  borderRadius: 999,
                  background: verificationStatus === "verified" ? "#dcfce7" : "#fff7ed",
                  color: verificationStatus === "verified" ? "#047857" : "#c2410c",
                  fontSize: 11,
                  fontWeight: 900,
                  whiteSpace: "nowrap",
                }}
              >
                {verificationLabel[verificationStatus]}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 14 }}>
              {[
                { label: "პირადობა 1", uploaded: verification.idFront },
                { label: "პირადობა 2", uploaded: verification.idBack },
                { label: "ანგარიში", uploaded: verification.bankAccount },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    padding: 10,
                    borderRadius: 12,
                    background: item.uploaded ? "#ecfdf5" : "#f8fafc",
                    border: `1px solid ${item.uploaded ? "#bbf7d0" : "var(--border)"}`,
                    color: item.uploaded ? "#047857" : "var(--text3)",
                    fontSize: 11,
                    fontWeight: 900,
                    textAlign: "center",
                  }}
                >
                  {item.label}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, color: "var(--text2)", fontSize: 12, lineHeight: 1.5 }}>
              ატვირთულია {uploadedDocumentCount}/3 დოკუმენტი. Admin-ის დადასტურების შემდეგ
              ხელოსანი გამოჩნდება როგორც ვერიფიცირებული.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, marginTop: 12 }}>
              {[
                { key: "idFront" as const, label: "პირადობის წინა მხარე" },
                { key: "idBack" as const, label: "პირადობის უკანა მხარე" },
                { key: "bankAccount" as const, label: "ანგარიში ჩარიცხვისთვის" },
              ].map((item) => {
                const documentValue = verificationDocuments[item.key];
                const isBankAccount = item.key === "bankAccount";
                const documentUrl =
                  documentValue && !isBankAccount
                    ? isDemoDataMode
                      ? documentValue
                      : signedVerificationUrls[item.key] || ""
                    : "";
                const hasImage =
                  documentUrl.startsWith("data:image/") ||
                  /\.(png|jpe?g|webp)$/i.test(documentUrl.split("?")[0]);
                const hasOpenableFile = Boolean(documentUrl);
                return (
                  <div
                    key={item.key}
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      background: "#f8fafc",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div style={{ color: "var(--text)", fontSize: 12, fontWeight: 950 }}>
                      {item.label}
                    </div>
                    {isBankAccount && documentValue ? (
                      <div
                        style={{
                          marginTop: 8,
                          padding: 10,
                          borderRadius: 10,
                          background: "white",
                          border: "1px solid var(--border)",
                          color: "var(--text)",
                          fontSize: 12,
                          lineHeight: 1.45,
                          fontWeight: 850,
                          wordBreak: "break-word",
                        }}
                      >
                        {documentValue}
                      </div>
                    ) : hasImage ? (
                      <img
                        src={documentUrl}
                        alt={item.label}
                        style={{
                          width: "100%",
                          maxHeight: 170,
                          marginTop: 8,
                          borderRadius: 10,
                          objectFit: "cover",
                          border: "1px solid var(--border)",
                        }}
                      />
                    ) : (
                      <div style={{ marginTop: 7, color: "var(--text3)", fontSize: 12, fontWeight: 850 }}>
                        {verification[item.key] ? (
                          hasOpenableFile ? (
                            <a
                              href={documentUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: "var(--primary)", fontWeight: 950 }}
                            >
                              ფაილის გახსნა
                            </a>
                          ) : (
                            `ფაილი ატვირთულია: ${documentValue}`
                          )
                        ) : (
                          "ფაილი ჯერ არ არის ატვირთული"
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {(profile.verificationNote || profile.adminNote) && (
              <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "#f8fafc", color: "var(--text2)", fontSize: 12, lineHeight: 1.45 }}>
                Admin ჩანაწერი: {profile.verificationNote || profile.adminNote}
              </div>
            )}
            {verificationStatus === "verified" ? (
              <div
                style={{
                  marginTop: 14,
                  padding: 12,
                  borderRadius: 12,
                  background: "#ecfdf5",
                  border: "1px solid #bbf7d0",
                  color: "#047857",
                  fontSize: 13,
                  lineHeight: 1.45,
                  fontWeight: 900,
                }}
              >
                ვერიფიკაცია დასრულებულია. ხელოსნის სამუშაო ადგილი გახსნილია და
                პროფილი კლიენტებთან გამოჩნდება.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
                <button
                  type="button"
                  disabled={adminApiLoading || uploadedDocumentCount < 3}
                  onClick={() => setVerificationStatus("verified", "დადასტურდა admin-ის მიერ")}
                  style={{
                    ...actionButton(uploadedDocumentCount < 3 ? "#dbe4ef" : "#10b981"),
                  }}
                >
                  დადასტურება
                </button>
                <button
                  type="button"
                  disabled={adminApiLoading}
                  onClick={() => setVerificationStatus("rejected", "დოკუმენტები ხელახლაა გადასამოწმებელი")}
                  style={actionButton("#ef4444")}
                >
                  უარყოფა
                </button>
              </div>
            )}
          </section>
        )}

        {tab === "disputes" && (
          <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ ...adminCard, padding: 14 }}>
              <h2 style={{ margin: "0 0 6px", fontSize: 18, color: "var(--text)" }}>
                დავების სამუშაო მაგიდა
              </h2>
              <div style={{ color: "var(--text2)", fontSize: 12, lineHeight: 1.5 }}>
                აქტიური დავები აქ ჩანს სამუშაო რიგად. დახურული შემთხვევები არქივში გადადის,
                ხოლო სასწრაფოებში 24 საათზე ძველი ღია დავებია.
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
              {[
                ["აქტიური", disputeViewCounts.active, "#1d4ed8", "#eff6ff"],
                ["სასწრაფო", disputeViewCounts.urgent, "#b91c1c", "#fef2f2"],
                ["განხილვაში", disputeViewCounts.reviewing, "#c2410c", "#fff7ed"],
                ["არქივი", disputeViewCounts.archive, "#64748b", "#f8fafc"],
              ].map(([label, value, color, bg]) => (
                <div key={label} style={{ ...adminCard, padding: 10, background: String(bg) }}>
                  <div style={{ color: String(color), fontSize: 19, fontWeight: 950 }}>
                    {value}
                  </div>
                  <div style={{ marginTop: 2, color: "var(--text2)", fontSize: 10, fontWeight: 900 }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 2 }}>
              {[
                ["active", "აქტიური"],
                ["urgent", "სასწრაფო"],
                ["reviewing", "განხილვაში"],
                ["archive", "დახურული არქივი"],
              ].map(([value, label]) => {
                const active = disputeView === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDisputeView(value as DisputeView)}
                    style={{
                      flex: "0 0 auto",
                      minHeight: 36,
                      padding: "0 12px",
                      borderRadius: 999,
                      background: active ? "var(--primary)" : "white",
                      color: active ? "white" : "var(--text2)",
                      border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
                      fontSize: 11,
                      fontWeight: 950,
                    }}
                  >
                    {label} · {disputeViewCounts[value as DisputeView]}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {filteredDisputes.length ? (
                filteredDisputes.map((dispute) => {
                  const disputeUi = disputeStatusUi(dispute.status);
                  const disputeAge = hoursSince(dispute.createdAt);
                  const isUrgentDispute = disputePriorityScore(dispute) >= 3;
                  const selected = selectedDispute?.id === dispute.id;
                  const amount = dispute.amount || platformSettings.bookingFee;
                  const paymentStatus = dispute.paymentStatus || "held";
                  return (
                    <button
                      key={dispute.id}
                      type="button"
                      onClick={() => setSelectedDisputeId(dispute.id)}
                      style={{
                        width: "100%",
                        padding: 12,
                        borderRadius: 14,
                        textAlign: "left",
                        background: selected ? "#eff6ff" : "white",
                        border: `1px solid ${selected ? "#bfdbfe" : "var(--border)"}`,
                        boxShadow: selected ? "0 10px 24px rgba(30,64,175,.08)" : "none",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <strong style={{ display: "block", color: "var(--text)", fontSize: 14 }}>
                            {dispute.reason}
                          </strong>
                          <div style={{ marginTop: 4, color: "var(--text2)", fontSize: 12, fontWeight: 800 }}>
                            {dispute.clientName || "კლიენტი"} {"->"} {dispute.workerName || "ხელოსანი"}
                          </div>
                        </div>
                        <span
                          style={{
                            flexShrink: 0,
                            padding: "5px 8px",
                            borderRadius: 999,
                            background: disputeUi.bg,
                            color: disputeUi.color,
                            fontSize: 10,
                            fontWeight: 950,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {disputeUi.label}
                        </span>
                      </div>
                      <div style={{ marginTop: 7, color: "var(--text3)", fontSize: 11, fontWeight: 850 }}>
                        {dispute.service || "სერვისი"} · {dispute.dateLabel || "თარიღი"} ·{" "}
                        {dispute.time || "დრო"} · {money(amount)}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                        <span style={{ padding: "4px 8px", borderRadius: 999, background: "#f8fafc", color: "var(--text2)", fontSize: 10, fontWeight: 900 }}>
                          {disputeAge} სთ გახსნილია
                        </span>
                        <span style={{ padding: "4px 8px", borderRadius: 999, background: "#f8fafc", color: "var(--text2)", fontSize: 10, fontWeight: 900 }}>
                          {paymentStatusShortLabel[paymentStatus]}
                        </span>
                        {(dispute.evidence || []).length > 0 && (
                          <span style={{ padding: "4px 8px", borderRadius: 999, background: "#fff7ed", color: "#c2410c", fontSize: 10, fontWeight: 950 }}>
                            {(dispute.evidence || []).length} ფოტო
                          </span>
                        )}
                        {isUrgentDispute && (
                          <span style={{ padding: "4px 8px", borderRadius: 999, background: "#fef2f2", color: "#b91c1c", fontSize: 10, fontWeight: 950 }}>
                            სასწრაფო
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div style={{ ...adminCard, padding: 30, textAlign: "center", color: "var(--text3)", fontWeight: 850 }}>
                  ამ ხედში დავა არ მოიძებნა
                </div>
              )}
            </div>

            {selectedDispute && (
              (() => {
                const dispute = selectedDispute;
                const disputeUi = disputeStatusUi(dispute.status);
                const linkedBooking = clientBookings.find(
                  (booking) => booking.id === dispute.bookingId
                );
                const linkedRequest = requests.find(
                  (request) => request.id === dispute.bookingId
                );
                const disputeEvidence = dispute.evidence || [];
                const paymentStatus = dispute.paymentStatus || linkedBooking?.paymentStatus || "held";
                const amount =
                  dispute.amount || linkedBooking?.bookingFee || platformSettings.bookingFee;
                const reviewingLoading =
                  adminActionId === `dispute:${dispute.id}:reviewing`;
                const refundLoading =
                  adminActionId === `dispute:${dispute.id}:refund_client`;
                const releaseLoading =
                  adminActionId === `dispute:${dispute.id}:release_worker`;
                const warningLoading =
                  adminActionId === `dispute:${dispute.id}:warning`;
                return (
                  <div style={{ ...adminCard, padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <h2 style={{ margin: 0, color: "var(--text)", fontSize: 18 }}>
                          დავის დეტალები
                        </h2>
                        <div style={{ marginTop: 4, color: "var(--text3)", fontSize: 11, fontWeight: 850 }}>
                          #{dispute.bookingId.slice(-8)} · {formatDate(dispute.createdAt)} ·{" "}
                          {hoursSince(dispute.createdAt)} სთ
                        </div>
                      </div>
                      <span
                        style={{
                          alignSelf: "flex-start",
                          padding: "6px 9px",
                          borderRadius: 999,
                          background: disputeUi.bg,
                          color: disputeUi.color,
                          fontSize: 11,
                          fontWeight: 950,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {disputeUi.label}
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
                      {[
                        ["კლიენტი", dispute.clientName || linkedRequest?.clientName || "კლიენტი"],
                        ["ხელოსანი", dispute.workerName || linkedBooking?.worker.name || "ხელოსანი"],
                        ["სერვისი", dispute.service || linkedBooking?.worker.role || linkedRequest?.service || "სერვისი"],
                        ["თანხა", `${money(amount)} · ${paymentStatusShortLabel[paymentStatus]}`],
                      ].map(([label, value]) => (
                        <div key={label} style={{ padding: 10, borderRadius: 12, background: "#f8fafc", border: "1px solid var(--border)" }}>
                          <div style={{ color: "var(--text3)", fontSize: 10, fontWeight: 900 }}>{label}</div>
                          <div style={{ marginTop: 4, color: "var(--text)", fontSize: 12, fontWeight: 950, lineHeight: 1.35 }}>
                            {value}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "#fff7ed", border: "1px solid #fed7aa" }}>
                      <div style={{ color: "#9a3412", fontSize: 13, fontWeight: 950 }}>
                        {dispute.reason}
                      </div>
                      <div style={{ marginTop: 6, color: "#7c2d12", fontSize: 12, lineHeight: 1.5, fontWeight: 800 }}>
                        {dispute.details || "კლიენტს დამატებითი აღწერა არ დაუწერია."}
                      </div>
                    </div>

                    {disputeEvidence.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ color: "var(--text)", fontSize: 13, fontWeight: 950, marginBottom: 8 }}>
                          მტკიცებულებები
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                          {disputeEvidence.map((item, index) => {
                            const signedUrl =
                              signedDisputeEvidenceUrls[`${dispute.id}:${index}`] ||
                              item.url;
                            return (
                              <a
                                key={`${item.url}-${index}`}
                                href={signedUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{ aspectRatio: "1 / 1", borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)", background: "#f8fafc" }}
                              >
                                {signedUrl ? (
                                  <img src={signedUrl} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                ) : (
                                  <span style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--text3)", fontSize: 10, fontWeight: 850 }}>
                                    ვერ გაიხსნა
                                  </span>
                                )}
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {dispute.adminNote && (
                      <div style={{ marginTop: 12, padding: 10, borderRadius: 12, background: "#f8fafc", color: "var(--text2)", fontSize: 12, lineHeight: 1.45, fontWeight: 800 }}>
                        Admin ჩანაწერი: {dispute.adminNote}
                      </div>
                    )}

                    {dispute.status !== "resolved" ? (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
                        <button
                          type="button"
                          disabled={adminApiLoading || dispute.status === "reviewing"}
                          onClick={() => markDisputeReviewing(dispute)}
                          style={{
                            ...actionButton(dispute.status === "reviewing" ? "#e2e8f0" : "#f97316", dispute.status === "reviewing" ? "var(--text3)" : "white"),
                            gridColumn: "1 / -1",
                          }}
                        >
                          {reviewingLoading ? "ინიშნება..." : "განხილვაში გადაყვანა"}
                        </button>
                        {can("finance") && (
                          <button type="button" disabled={adminApiLoading} onClick={() => resolveDispute(dispute, "refund_client")} style={actionButton("#ef4444")}>
                            {refundLoading ? "ბრუნდება..." : "კლიენტისთვის თანხის დაბრუნება"}
                          </button>
                        )}
                        {can("finance") && (
                          <button type="button" disabled={adminApiLoading} onClick={() => resolveDispute(dispute, "release_worker")} style={actionButton("#10b981")}>
                            {releaseLoading ? "იხურება..." : "ხელოსნის მხარეს დახურვა"}
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={adminApiLoading}
                          onClick={() => resolveDispute(dispute, "warning")}
                          style={{ ...actionButton("#fff7ed", "#c2410c"), gridColumn: "1 / -1", border: "1px solid #fed7aa" }}
                        >
                          {warningLoading ? "იხურება..." : "გაფრთხილებით დახურვა"}
                        </button>
                      </div>
                    ) : (
                      <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: "#f8fafc", border: "1px solid var(--border)", color: "var(--text2)", fontSize: 12, fontWeight: 850 }}>
                        დავა დახურულია · {dispute.resolvedAt ? formatDate(dispute.resolvedAt) : "თარიღი არ არის"}
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </section>
        )}

        {tab === "bookings" && (
          <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ ...adminCard, padding: 14 }}>
              <h2 style={{ margin: "0 0 7px", fontSize: 17, color: "var(--text)" }}>
                Admin ჩარევა
              </h2>
              <div style={{ color: "var(--text2)", fontSize: 12, lineHeight: 1.5 }}>
                ეს ნაწილი არ არის ჩვეულებრივი ჯავშნის სამართავად. გამოიყენე მაშინ,
                როცა დავა, თანხის დაბრუნება ან ხელით დახურვაა საჭირო. ჩვეულებრივ
                პროცესს კლიენტი და ხელოსანი თვითონ ასრულებენ. Admin ქმედება
                ინახება ლოგში და ცვლის თანხის სტატუსსაც.
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
              {[
                ["ჩარევა", interventionRequests.length],
                ["აქტიური", activeBookings.length],
                ["მოლოდინი", pendingRequests.length],
              ].map(([label, value]) => (
                <div key={label} style={{ ...adminCard, padding: 11 }}>
                  <div style={{ color: "var(--text)", fontSize: 17, fontWeight: 950 }}>
                    {value}
                  </div>
                  <div style={{ marginTop: 2, color: "var(--text3)", fontSize: 10, fontWeight: 850 }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ color: "var(--text)", fontSize: 14, fontWeight: 950, marginTop: 2 }}>
              გადასაწყვეტი შემთხვევები
            </div>
            {interventionRequests.length ? (
              interventionRequests.map((request) => {
                const linkedBooking = getLinkedClientBooking(request.id);
                const paymentStatus = linkedBooking?.paymentStatus || "held";
                return (
                <div key={request.id} style={{ ...adminCard, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <strong
                        style={{
                          display: "block",
                          color: "var(--text)",
                          fontSize: 14,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {request.clientName}
                      </strong>
                      <div style={{ marginTop: 3, color: "var(--text2)", fontSize: 12 }}>
                        {request.service} · {request.date} · {request.time}
                      </div>
                    </div>
                    <span
                      style={{
                        alignSelf: "flex-start",
                        padding: "5px 8px",
                        borderRadius: 999,
                        background: "#fff7ed",
                        color: "#c2410c",
                        fontSize: 11,
                        fontWeight: 900,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {statusLabel[request.status]}
                    </span>
                  </div>
                  <div style={{ marginTop: 8, color: "var(--text3)", fontSize: 12 }}>
                    {request.address}
                  </div>
                  <div style={{ marginTop: 6, color: "var(--text3)", fontSize: 11, fontWeight: 850 }}>
                    {paymentStatusShortLabel[paymentStatus]} · #{request.id.slice(-8)}
                  </div>
                  {(request.cancellationReason || request.disputeReason) && (
                    <div style={{ marginTop: 8, color: "#9a3412", fontSize: 12, fontWeight: 850 }}>
                      {request.cancellationReason || request.disputeReason}
                    </div>
                  )}
                  {request.adminNote && (
                    <div style={{ marginTop: 9, padding: 10, borderRadius: 12, background: "#f8fafc", color: "var(--text2)", fontSize: 12, lineHeight: 1.45 }}>
                      Admin ჩანაწერი: {request.adminNote}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    {can("finance") && (
                      <button
                        type="button"
                        disabled={adminApiLoading}
                        onClick={() => updateBookingEverywhere(request.id, "closed", "released")}
                        style={actionButton("#10b981")}
                      >
                        Admin-ით დახურვა
                      </button>
                    )}
                    {can("finance") && (
                      <button
                        type="button"
                        disabled={adminApiLoading}
                        onClick={() => updateBookingEverywhere(request.id, "cancelled", "refunded")}
                        style={actionButton("#ef4444")}
                      >
                        Admin-ით დაბრუნება
                      </button>
                    )}
                    {can("disputes") && (
                      <button
                        type="button"
                        disabled={adminApiLoading}
                        onClick={() => setBookingPaymentStatus(request.id, "disputed")}
                        style={actionButton("#f97316")}
                      >
                        დავაში დატოვება
                      </button>
                    )}
                  </div>
                </div>
                );
              })
            ) : (
              <div style={{ ...adminCard, padding: 30, textAlign: "center", color: "var(--text3)", fontWeight: 800 }}>
                ამ ეტაპზე Admin ჩარევა არც ერთ ჯავშანს არ სჭირდება
              </div>
            )}

            <div style={{ color: "var(--text)", fontSize: 14, fontWeight: 950, marginTop: 8 }}>
              ჩვეულებრივი ჯავშნები
            </div>
            {visibleRegularRequests.length ? (
              visibleRegularRequests.map((request) => (
                <div key={request.id} style={{ ...adminCard, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <strong
                        style={{
                          display: "block",
                          color: "var(--text)",
                          fontSize: 14,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {request.clientName}
                      </strong>
                      <div style={{ marginTop: 3, color: "var(--text2)", fontSize: 12 }}>
                        {request.service} · {request.date} · {request.time}
                      </div>
                    </div>
                    <span style={{ color: "var(--primary)", fontSize: 11, fontWeight: 900, whiteSpace: "nowrap" }}>
                      {statusLabel[request.status]}
                    </span>
                  </div>
                  <div style={{ marginTop: 8, color: "var(--text3)", fontSize: 12 }}>
                    {request.address || "მისამართი არ არის მითითებული"}
                  </div>
                  <div
                    style={{
                      marginTop: 10,
                      padding: "8px 10px",
                      borderRadius: 12,
                      background: "#f8fafc",
                      color: "var(--text3)",
                      fontSize: 11,
                      fontWeight: 850,
                      lineHeight: 1.4,
                    }}
                  >
                    ჩვეულებრივი პროცესი: სტატუსებს კლიენტი და ხელოსანი ცვლიან.
                    Admin ღილაკები გამოჩნდება მხოლოდ დავაზე ან დაბრუნებაზე.
                  </div>
                </div>
              ))
            ) : (
              <div style={{ ...adminCard, padding: 24, textAlign: "center", color: "var(--text3)", fontWeight: 800 }}>
                ჩვეულებრივი ჯავშანი ამ ფილტრით არ მოიძებნა
              </div>
            )}
          </section>
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
