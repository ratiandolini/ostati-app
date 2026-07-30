import { formatDate } from "./adminUtils";
import type { AdminTab } from "./adminPermissions";
import type { ProductionGuardItem } from "./adminProductionGuard";
import type {
  MobileQaScenario,
  PrePaymentChecklistItem,
} from "../../services/dataService";
import type { SupabasePreflightCheck } from "../../services/supabasePreflightService";

interface PreflightSummary {
  requiredErrors: number;
}

export interface LaunchSmokeStep {
  id: string;
  label: string;
  detail: string;
  done: boolean;
  missing: string[];
  targetTab: AdminTab;
}

export interface LaunchNextAction {
  tone: string;
  bg: string;
  border: string;
  label: string;
  detail: string;
  button: string;
  tab: AdminTab;
}

interface AdminLaunchSmokeInput {
  prePaymentChecklist: PrePaymentChecklistItem[];
  mobileQaScenarios: MobileQaScenario[];
  productionGuardItems: ProductionGuardItem[];
  verificationStatus: string;
  preflightChecks: SupabasePreflightCheck[];
  preflightFresh: boolean;
  preflightSummary: PreflightSummary;
  preflightCheckedAt: string | null;
  preflightScope: string;
}

export const getAdminLaunchSmokeState = ({
  prePaymentChecklist,
  mobileQaScenarios,
  productionGuardItems,
  verificationStatus,
  preflightChecks,
  preflightFresh,
  preflightSummary,
  preflightCheckedAt,
  preflightScope,
}: AdminLaunchSmokeInput) => {
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
    ...(verificationStatus === "verified"
      ? []
      : ["ხელოსნის დოკუმენტების დადასტურება"]),
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
  const launchSmokeSteps: LaunchSmokeStep[] = [
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
  const launchReportStatus: "draft" | "launch_ready" =
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
  const launchNextAction: LaunchNextAction = nextLaunchSmokeStep
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
              ? "users"
              : "settings",
        }
      : {
          tone: "#047857",
          bg: "#f0fdf4",
          border: "#bbf7d0",
          label: "Launch snapshot მზადაა",
          detail:
            "Smoke flow და production blockers დახურულია. შეგიძლია საბოლოო report ჩამოტვირთო.",
          button: "Report ჩამოტვირთვა",
          tab: "settings",
        };

  return {
    launchSmokeSteps,
    launchSmokeDoneCount,
    nextLaunchSmokeStep,
    launchReportSmokeIncomplete,
    launchReportBlockersRemain,
    launchReportStatus,
    launchReportDraftReasons,
    launchNextAction,
  };
};
