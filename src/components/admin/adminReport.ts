import { qaAreaLabel } from "./adminQaConfig";
import type { AdminTab } from "./adminPermissions";
import type { ProductionGuardItem } from "./adminProductionGuard";
import type { AdminStatusFilter } from "./adminTypes";
import type { AdminUserSummary } from "../../services/adminApiService";
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
} from "../../services/dataService";
import type { ReadinessCheck } from "../../services/readinessService";
import type { SupabasePreflightCheck } from "../../services/supabasePreflightService";
import type { Booking } from "../../screens/BookingsScreen";

interface FinancialSummary {
  held: number;
  released: number;
  refunded: number;
  disputed: number;
}

interface ApiMigrationSummary {
  connected: number;
  partial: number;
  demo: number;
  total: number;
}

interface PreflightSummary {
  ok: number;
  warning: number;
  error: number;
  requiredErrors: number;
}

interface MobileQaNote {
  id: string;
  area: string;
  label: string;
  done: boolean;
  note: string;
}

interface MobileQaAreaProgress {
  area: MobileQaScenario["area"];
  label: string;
  done: number;
  total: number;
  complete: boolean;
}

interface LaunchSmokeStep {
  id: string;
  label: string;
  detail: string;
  done: boolean;
  missing: string[];
  targetTab: AdminTab;
}

interface AdminReportInput {
  exportedBy: string;
  currentAdminMember: AdminMember;
  launchReportStatus: "draft" | "launch_ready";
  launchReportDraftReasons: string[];
  filters: {
    tab: AdminTab;
    query: string;
    status: AdminStatusFilter;
  };
  verificationStatus: string;
  openDisputesCount: number;
  urgentDisputesCount: number;
  pendingRequestsCount: number;
  activeBookingsCount: number;
  financialSummary: FinancialSummary;
  platformSettings: PlatformSettings;
  readyCount: number;
  productionReadiness: ReadinessCheck[];
  prePaymentDoneCount: number;
  prePaymentChecklist: PrePaymentChecklistItem[];
  mobileQaDoneCount: number;
  mobileQaScenarios: MobileQaScenario[];
  remainingMobileQaScenarios: MobileQaScenario[];
  mobileQaNotesCount: number;
  mobileQaNotes: MobileQaNote[];
  mobileQaProgressByArea: MobileQaAreaProgress[];
  blockingSystemChecksCount: number;
  productionGuardItems: ProductionGuardItem[];
  launchSmokeDoneCount: number;
  launchSmokeSteps: LaunchSmokeStep[];
  nextLaunchSmokeStep?: LaunchSmokeStep;
  apiMigrationSummary: ApiMigrationSummary;
  preflightChecks: SupabasePreflightCheck[];
  preflightCheckedAt: string | null;
  preflightFresh: boolean;
  preflightScope: string;
  preflightSummary: PreflightSummary;
  productionReadinessChecks: ReadinessCheck[];
  draftProductionReadiness: ReadinessCheck[];
  systemReadinessChecks: ReadinessCheck[];
  apiMigrationItems: unknown[];
  legalSettings: LegalSettings;
  filteredDisputes: BookingDispute[];
  filteredRequests: CraftsmanBookingRequest[];
  filteredClientBookings: Booking[];
  filteredClientsReport: Array<{ phone: string; profile: ClientProfile }>;
  filteredAdminClients?: AdminUserSummary[];
  filteredAdminCraftsmen?: AdminUserSummary[];
  filteredAuditLogs: AdminAuditLog[];
  profile: CraftsmanProfile;
  requests: CraftsmanBookingRequest[];
  clientBookings: Booking[];
  disputes: BookingDispute[];
  auditLogs: AdminAuditLog[];
  adminMembers: AdminMember[];
}

const sensitiveReportKeyPattern =
  /phone|email|contactphone|contact_phone|clientphone|workerphone|bankaccount|idfront|idback|attachmenturl|sitephoto|photourl|verificationdocuments/i;

const maskSensitiveValue = (value: unknown) => {
  if (typeof value !== "string") return "[დაფარული]";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.includes("@")) {
    const [name, domain = ""] = trimmed.split("@");
    return `${name.slice(0, 2)}***@${domain}`;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 6) {
    return `${digits.slice(0, 3)}***${digits.slice(-2)}`;
  }
  return "[დაფარული]";
};

const sanitizeReportValue = (value: unknown, key = ""): unknown => {
  if (sensitiveReportKeyPattern.test(key)) return maskSensitiveValue(value);
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeReportValue(item));
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).reduce<
      Record<string, unknown>
    >((next, [entryKey, entryValue]) => {
      next[entryKey] = sanitizeReportValue(entryValue, entryKey);
      return next;
    }, {});
  }
  return value;
};

export const downloadLaunchReadinessReport = ({
  exportedBy,
  currentAdminMember,
  launchReportStatus,
  launchReportDraftReasons,
  filters,
  verificationStatus,
  openDisputesCount,
  urgentDisputesCount,
  pendingRequestsCount,
  activeBookingsCount,
  financialSummary,
  platformSettings,
  readyCount,
  productionReadiness,
  prePaymentDoneCount,
  prePaymentChecklist,
  mobileQaDoneCount,
  mobileQaScenarios,
  remainingMobileQaScenarios,
  mobileQaNotesCount,
  mobileQaNotes,
  mobileQaProgressByArea,
  blockingSystemChecksCount,
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
  productionReadinessChecks,
  draftProductionReadiness,
  systemReadinessChecks,
  apiMigrationItems,
  legalSettings,
  filteredDisputes,
  filteredRequests,
  filteredClientBookings,
  filteredClientsReport,
  filteredAdminClients,
  filteredAdminCraftsmen,
  filteredAuditLogs,
  profile,
  requests,
  clientBookings,
  disputes,
  auditLogs,
  adminMembers,
}: AdminReportInput): "downloaded" | "cancelled" => {
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
    return "cancelled";
  }

  const report = {
    exportedAt,
    exportedBy,
    privacy: {
      sensitiveFieldsRedacted: true,
      note:
        "Report-ში ტელეფონი, ელფოსტა, საბანკო ანგარიში და private storage path-ები დაფარულია.",
    },
    exportedRole: currentAdminMember,
    launchStatus: launchReportStatus,
    draftReasons: launchReportDraftReasons,
    filters,
    summary: {
      verificationStatus,
      openDisputes: openDisputesCount,
      urgentDisputes: urgentDisputesCount,
      pendingRequests: pendingRequestsCount,
      activeBookings: activeBookingsCount,
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
        mobileQaNotesCount,
        mobileQaNotes,
        mobileQaByArea: mobileQaProgressByArea,
        blockingSystemChecks: blockingSystemChecksCount,
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
      productionReadiness: productionReadinessChecks,
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
      clients: filteredAdminClients ?? filteredClientsReport,
      craftsmen: filteredAdminCraftsmen,
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

  const blob = new Blob([JSON.stringify(sanitizeReportValue(report), null, 2)], {
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
  return "downloaded";
};
