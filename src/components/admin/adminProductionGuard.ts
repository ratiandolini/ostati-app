import type { ReadinessCheck } from "../../services/readinessService";

export type ProductionGuardItem = Pick<
  ReadinessCheck,
  "id" | "label" | "detail" | "severity"
>;

interface ProductionGuardInput {
  draftProductionReadiness: ReadinessCheck[];
  mobileQaNotesCount: number;
  isDemoDataMode: boolean;
  preflightChecksCount: number;
  preflightFresh: boolean;
  preflightRequiredErrors: number;
}

export const getProductionGuardItems = ({
  draftProductionReadiness,
  mobileQaNotesCount,
  isDemoDataMode,
  preflightChecksCount,
  preflightFresh,
  preflightRequiredErrors,
}: ProductionGuardInput): ProductionGuardItem[] => [
  ...draftProductionReadiness
    .filter((item) => item.id !== "production_mode" && !item.ready)
    .map((item) => ({
      id: item.id,
      label: item.label,
      detail: item.detail,
      severity: item.severity,
    })),
  ...(mobileQaNotesCount > 0
    ? [
        {
          id: "mobile_qa_notes",
          label: "Mobile QA შენიშვნები",
          detail: `${mobileQaNotesCount} შენიშვნა დარჩენილია. Ready report-მდე ან გაასწორე საკითხი, ან წაშალე შენიშვნა.`,
          severity: "warning" as const,
        },
      ]
    : []),
  ...(!isDemoDataMode && preflightChecksCount === 0
    ? [
        {
          id: "supabase_preflight_missing",
          label: "Supabase preflight",
          detail: "ჯერ Settings-ში დააჭირე Supabase შემოწმებას.",
          severity: "blocked" as const,
        },
      ]
    : []),
  ...(!isDemoDataMode && preflightChecksCount > 0 && !preflightFresh
    ? [
        {
          id: "supabase_preflight_stale",
          label: "Supabase preflight",
          detail: "შემოწმება 24 საათზე ძველია, თავიდან გაუშვი.",
          severity: "blocked" as const,
        },
      ]
    : []),
  ...(!isDemoDataMode && preflightRequiredErrors > 0
    ? [
        {
          id: "supabase_preflight_errors",
          label: "Supabase preflight",
          detail: `${preflightRequiredErrors} აუცილებელი შეცდომაა გასასწორებელი.`,
          severity: "blocked" as const,
        },
      ]
    : []),
];
