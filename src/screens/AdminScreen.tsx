import React, { useEffect, useMemo, useState } from "react";
import { BookingStatus, User } from "../types";
import { actionButton, adminCard } from "../components/admin/adminUi";
import {
  accountLabel,
  adminAccountLabel,
  paymentStatusHelp,
  paymentStatusLabel,
  paymentStatusShortLabel,
  statusLabel,
  verificationLabel,
} from "../components/admin/adminLabels";
import {
  disputePriorityScore,
  disputeStatusUi,
  formatDate,
  hoursSince,
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
import { AdminAuditTab } from "../components/admin/AdminAuditTab";
import { AdminDisputesTab } from "../components/admin/AdminDisputesTab";
import { AdminFinanceTab } from "../components/admin/AdminFinanceTab";
import { AdminOverviewTab } from "../components/admin/AdminOverviewTab";
import { AdminSettingsTab } from "../components/admin/AdminSettingsTab";
import { AdminUsersTab } from "../components/admin/AdminUsersTab";
import { AdminVerificationTab } from "../components/admin/AdminVerificationTab";
import { getProductionGuardItems } from "../components/admin/adminProductionGuard";
import { getAdminLaunchSmokeState } from "../components/admin/adminLaunchSmoke";
import { downloadLaunchReadinessReport } from "../components/admin/adminReport";
import {
  getAdminFinanceQueueState,
  getAdminFinancialSummary,
} from "../components/admin/adminFinanceModel";
import { getAdminOperationalQueue } from "../components/admin/adminOperationalQueue";
import { getAdminDisputeModel } from "../components/admin/adminDisputesModel";
import { getAdminBookingsModel } from "../components/admin/adminBookingsModel";
import { getAdminAuditModel } from "../components/admin/adminAuditModel";
import { getAdminVerificationModel } from "../components/admin/adminVerificationModel";
import {
  getAdminUserDirectory,
  getClientUserStats,
  getCraftsmanUserStats,
} from "../components/admin/adminUsersModel";
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
  const {
    verificationTarget,
    filteredVerificationQueue,
    verificationStatus,
    verificationDocuments,
    verification,
    uploadedDocumentCount,
  } = getAdminVerificationModel({
    verificationQueue,
    selectedVerificationWorkerId,
    verificationFilter,
    adminQuery,
    profile,
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
  const financialSummary = getAdminFinancialSummary(clientBookings, platformSettings);
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
  const {
    launchSmokeSteps,
    launchSmokeDoneCount,
    nextLaunchSmokeStep,
    launchReportSmokeIncomplete,
    launchReportBlockersRemain,
    launchReportStatus,
    launchReportDraftReasons,
    launchNextAction,
  } = getAdminLaunchSmokeState({
    prePaymentChecklist,
    mobileQaScenarios,
    productionGuardItems,
    verificationStatus,
    preflightChecks,
    preflightFresh,
    preflightSummary,
    preflightCheckedAt,
    preflightScope,
  });
  const {
    adminClients,
    adminCraftsmen,
    clients,
    filteredClients,
    filteredAdminClients,
    filteredAdminCraftsmen,
  } = getAdminUserDirectory({
    adminUsersState,
    requests,
    adminQuery,
    statusFilter,
    getClientProfile: fallbackStorage.getClientProfile,
  });
  const {
    activeDisputes,
    reviewingDisputes,
    archiveDisputes,
    disputeViewCounts,
    filteredDisputes,
    selectedDispute,
  } = getAdminDisputeModel({
    disputes,
    disputeView,
    adminQuery,
    selectedDisputeId,
  });
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
  const {
    filteredRequests,
    filteredClientBookings,
    getLinkedClientBooking,
    interventionRequests,
    visibleRegularRequests,
  } = getAdminBookingsModel({
    requests,
    clientBookings,
    adminQuery,
    statusFilter,
  });
  const { filteredAuditLogs } = getAdminAuditModel({
    auditLogs,
    adminQuery,
    statusFilter,
  });
  const {
    filteredFinancialSummary,
    financeReviewBookings,
    financeRefundQueue,
    financeReleaseQueue,
    lateCancellationPenaltyTotal,
    estimatedServiceTotal,
    estimatedCommission,
  } = getAdminFinanceQueueState({
    filteredClientBookings,
    platformSettings,
  });
  const pendingVerificationCount = verificationQueue.filter(
    (item) => item.verificationStatus === "pending"
  ).length;
  const adminOverviewInput = {
    verificationStatus,
    openDisputesCount: openDisputes.length,
    urgentDisputesCount: urgentDisputes.length,
    interventionRequestsCount: interventionRequests.length,
  };
  const adminSummaryCards = getAdminSummaryCards(adminOverviewInput);
  const adminWorkQueueItems = getAdminWorkQueueItems(adminOverviewInput);
  const { operationalQueue, nextAdminAction } = getAdminOperationalQueue({
    pendingVerificationCount,
    urgentDisputesCount: urgentDisputes.length,
    openDisputesCount: openDisputes.length,
    financeReviewCount: financeReviewBookings.length,
    financeRefundCount: financeRefundQueue.length,
    financeReleaseCount: financeReleaseQueue.length,
    lateCancellationPenaltyTotal,
    interventionRequestsCount: interventionRequests.length,
  });
  const userStatsInput = { requests, clientBookings, platformSettings };
  const craftsmanUserStats = getCraftsmanUserStats(userStatsInput);
  const getClientUserStatsForPhone = (phone: string) =>
    getClientUserStats(phone, userStatsInput);

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
    const result = downloadLaunchReadinessReport({
      exportedBy: user.name || "ადმინისტრატორი",
      currentAdminMember,
      launchReportStatus,
      launchReportDraftReasons,
      filters: {
        tab,
        query: adminQuery,
        status: statusFilter,
      },
      verificationStatus,
      openDisputesCount: openDisputes.length,
      urgentDisputesCount: urgentDisputes.length,
      pendingRequestsCount: pendingRequests.length,
      activeBookingsCount: activeBookings.length,
      financialSummary,
      platformSettings,
      readyCount,
      productionReadiness,
      prePaymentDoneCount,
      prePaymentChecklist,
      mobileQaDoneCount,
      mobileQaScenarios,
      remainingMobileQaScenarios,
      mobileQaNotesCount: mobileQaNotes.length,
      mobileQaNotes,
      mobileQaProgressByArea,
      blockingSystemChecksCount: blockingSystemChecks.length,
      productionGuardItems,
      launchSmokeDoneCount,
      launchSmokeSteps,
      nextLaunchSmokeStep,
      apiMigrationSummary,
      preflightChecks,
      preflightCheckedAt,
      preflightFresh,
      preflightScope,
      preflightSummary,
      productionReadinessChecks: productionReadiness,
      draftProductionReadiness,
      systemReadinessChecks,
      apiMigrationItems,
      legalSettings,
      filteredDisputes,
      filteredRequests,
      filteredClientBookings,
      filteredClientsReport: filteredClients.map((phone) => ({
        phone,
        profile: fallbackStorage.getClientProfile(phone),
      })),
      filteredAdminClients: adminUsersState ? filteredAdminClients : undefined,
      filteredAdminCraftsmen: adminUsersState ? filteredAdminCraftsmen : undefined,
      filteredAuditLogs,
      profile,
      requests,
      clientBookings,
      disputes,
      auditLogs,
      adminMembers,
    });

    if (result !== "downloaded") return;

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
          <AdminFinanceTab
            filteredFinancialSummary={filteredFinancialSummary}
            platformSettings={platformSettings}
            financeReviewBookings={financeReviewBookings}
            financeRefundQueue={financeRefundQueue}
            financeReleaseQueue={financeReleaseQueue}
            filteredClientBookings={filteredClientBookings}
            lateCancellationPenaltyTotal={lateCancellationPenaltyTotal}
            estimatedServiceTotal={estimatedServiceTotal}
            estimatedCommission={estimatedCommission}
            adminActionId={adminActionId}
            adminApiLoading={adminApiLoading}
            setBookingPaymentStatus={setBookingPaymentStatus}
          />
        )}

        {tab === "users" && (
          <AdminUsersTab
            can={can}
            adminMembers={adminMembers}
            toggleAdminMember={toggleAdminMember}
            adminApiLoading={adminApiLoading}
            adminUsersState={adminUsersState}
            filteredAdminCraftsmen={filteredAdminCraftsmen}
            filteredAdminClients={filteredAdminClients}
            profile={profile}
            craftsmanUserStats={craftsmanUserStats}
            filteredClients={filteredClients}
            fallbackStorage={fallbackStorage}
            getClientUserStats={getClientUserStatsForPhone}
            setCraftsmanAccountStatus={setCraftsmanAccountStatus}
            setClientAccountStatus={setClientAccountStatus}
          />
        )}

        {tab === "settings" && (
          <AdminSettingsTab
            settingsDraft={settingsDraft}
            legalDraft={legalDraft}
            setLegalDraft={setLegalDraft}
            updateSettingsDraft={updateSettingsDraft}
            updateSettingsChoice={updateSettingsChoice}
            toggleProductionModeDraft={toggleProductionModeDraft}
            productionGuardItems={productionGuardItems}
            preflightChecks={preflightChecks}
            preflightSummary={preflightSummary}
            preflightFresh={preflightFresh}
            preflightCheckedAt={preflightCheckedAt}
            preflightScope={preflightScope}
            preflightLoading={preflightLoading}
            runPreflight={runPreflight}
            resetPreflightCache={resetPreflightCache}
            resetSettingsDrafts={resetSettingsDrafts}
            saveLegalSettings={saveLegalSettings}
            adminApiLoading={adminApiLoading}
            adminApiError={adminApiError}
            settingsSaveMessage={settingsSaveMessage}
          />
        )}

        {tab === "audit" && (
          <AdminAuditTab filteredAuditLogs={filteredAuditLogs} />
        )}
      </div>
    </div>
  );
};
