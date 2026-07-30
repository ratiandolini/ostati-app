import { PREFLIGHT_MAX_AGE_MS } from "./adminPreflightCache";
import type { SupabasePreflightCheck } from "../../services/supabasePreflightService";

export interface AdminPreflightSummary {
  ok: number;
  warning: number;
  error: number;
  requiredErrors: number;
}

export const getAdminPreflightSummary = (
  preflightChecks: SupabasePreflightCheck[]
): AdminPreflightSummary =>
  preflightChecks.reduce<AdminPreflightSummary>(
    (summary, check) => ({
      ok: summary.ok + Number(check.status === "ok"),
      warning: summary.warning + Number(check.status === "warning"),
      error: summary.error + Number(check.status === "error"),
      requiredErrors:
        summary.requiredErrors +
        Number(check.required !== false && check.status === "error"),
    }),
    { ok: 0, warning: 0, error: 0, requiredErrors: 0 }
  );

export const isAdminPreflightFresh = (preflightCheckedAt: string | null) =>
  Boolean(
    preflightCheckedAt &&
      Date.now() - new Date(preflightCheckedAt).getTime() <= PREFLIGHT_MAX_AGE_MS
  );
