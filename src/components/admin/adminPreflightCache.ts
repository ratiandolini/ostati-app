import { isDemoDataMode } from "../../services/dataService";
import { getSupabaseConfig } from "../../services/supabaseConfig";
import type { SupabasePreflightCheck } from "../../services/supabasePreflightService";

export const PREFLIGHT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const PREFLIGHT_CACHE_KEY = "adminSupabasePreflight:v1";

export interface CachedPreflightState {
  checks: SupabasePreflightCheck[];
  checkedAt: string | null;
  scope: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const getPreflightCacheScope = () => {
  if (isDemoDataMode) return "demo";

  try {
    return new URL(getSupabaseConfig().url).host;
  } catch {
    return "missing-supabase-config";
  }
};

const emptyCachedPreflightState = (): CachedPreflightState => ({
  checks: [],
  checkedAt: null,
  scope: getPreflightCacheScope(),
});

export const loadCachedPreflightState = (): CachedPreflightState => {
  if (typeof window === "undefined") {
    return emptyCachedPreflightState();
  }

  try {
    const raw = window.localStorage.getItem(PREFLIGHT_CACHE_KEY);
    if (!raw) return emptyCachedPreflightState();
    const parsed: unknown = JSON.parse(raw);
    const scope = getPreflightCacheScope();
    if (
      !isRecord(parsed) ||
      !Array.isArray(parsed.checks) ||
      parsed.scope !== scope
    ) {
      window.localStorage.removeItem(PREFLIGHT_CACHE_KEY);
      return emptyCachedPreflightState();
    }
    return {
      checks: parsed.checks as SupabasePreflightCheck[],
      checkedAt: typeof parsed.checkedAt === "string" ? parsed.checkedAt : null,
      scope,
    };
  } catch {
    window.localStorage.removeItem(PREFLIGHT_CACHE_KEY);
    return emptyCachedPreflightState();
  }
};

export const saveCachedPreflightState = (state: CachedPreflightState) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(PREFLIGHT_CACHE_KEY, JSON.stringify(state));
  } catch {
    // Cache is only a convenience; failing to save it must not block Admin work.
  }
};

export const clearCachedPreflightState = () => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(PREFLIGHT_CACHE_KEY);
  } catch {
    // Clearing cache is a convenience action; UI state still resets below.
  }
};
