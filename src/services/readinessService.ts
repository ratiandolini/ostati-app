import { isDemoDataMode } from "./dataService";
import { getSupabaseConfig, SupabaseConfigError } from "./supabaseConfig";
import type { LegalSettings, PlatformSettings } from "./appStorage";
import type { ApiMigrationStatus } from "./apiMigrationService";

export interface ReadinessCheck {
  id: string;
  label: string;
  detail: string;
  ready: boolean;
  severity: "ok" | "warning" | "blocked";
}

export interface LaunchReadinessInput {
  settings: PlatformSettings;
  legalSettings: LegalSettings;
  verificationStatus: string;
  prePaymentDoneCount: number;
  prePaymentTotal: number;
  mobileQaDoneCount: number;
  mobileQaTotal: number;
  activeAdminMemberCount: number;
  apiMigrationSummary: {
    connected: number;
    partial: number;
    demo: number;
    total: number;
  };
}

const resolveSupabaseConfigStatus = () => {
  try {
    const config = getSupabaseConfig();
    return {
      ready: true,
      detail: `${new URL(config.url).host} · anon key ჩაწერილია`,
    };
  } catch (error) {
    return {
      ready: false,
      detail:
        error instanceof SupabaseConfigError
          ? ".env-ში Supabase URL/key არ არის სრულად შევსებული"
          : "Supabase config ვერ შემოწმდა",
    };
  }
};

export const getSystemReadinessChecks = (
  settings: PlatformSettings
): ReadinessCheck[] => {
  const supabaseConfig = resolveSupabaseConfigStatus();
  const authMode = process.env.REACT_APP_AUTH_MODE || "";
  const devPasswordMode = authMode === "dev_password";

  return [
    {
      id: "data_mode",
      label: "მონაცემების რეჟიმი",
      detail: isDemoDataMode
        ? "ახლა მუშაობს demo/localStorage რეჟიმში"
        : "ჩართულია API რეჟიმი",
      ready: !isDemoDataMode,
      severity: isDemoDataMode ? "warning" : "ok",
    },
    {
      id: "supabase_config",
      label: "Supabase კონფიგურაცია",
      detail: supabaseConfig.detail,
      ready: supabaseConfig.ready,
      severity: supabaseConfig.ready ? "ok" : "blocked",
    },
    {
      id: "auth_provider",
      label: "ავტორიზაციის provider",
      detail:
        settings.authProvider === "demo"
          ? "ჯერ ისევ სატესტო კოდი 1234"
          : settings.authProvider === "email_password"
            ? "Email/password არჩეულია"
            : "SMS OTP არჩეულია",
      ready: settings.authProvider !== "demo",
      severity: settings.authProvider === "demo" ? "warning" : "ok",
    },
    {
      id: "auth_env_mode",
      label: "Auth გარემო",
      detail: devPasswordMode
        ? "ჩართულია dev_password რეჟიმი, გამოიყენება მხოლოდ ლოკალური ტესტისთვის"
        : authMode
          ? `${authMode} რეჟიმი`
          : "Auth mode .env-ში არ არის მითითებული",
      ready: !devPasswordMode && Boolean(authMode),
      severity: devPasswordMode || !authMode ? "warning" : "ok",
    },
    {
      id: "payment_provider",
      label: "გადახდის provider",
      detail:
        settings.paymentProvider === "demo"
          ? "გადახდები ჯერ არ იჭრება, მხოლოდ demo escrow ჩანს"
          : settings.paymentProvider === "manual_mvp_hold"
            ? "MVP manual hold ჩართულია · ბანკის provider შემდეგ ეტაპზე დაემატება"
          : `${settings.paymentProvider.toUpperCase()} · ${settings.paymentCurrency}`,
      ready: settings.paymentProvider !== "demo",
      severity:
        settings.paymentProvider === "demo"
          ? "warning"
          : settings.paymentProvider === "manual_mvp_hold"
            ? "warning"
            : "ok",
    },
    {
      id: "production_mode",
      label: "Production mode",
      detail: settings.productionMode
        ? "Admin-მა production mode მონიშნა"
        : "ჯერ დაცულია demo/test რეჟიმი",
      ready: settings.productionMode,
      severity: settings.productionMode ? "ok" : "warning",
    },
  ];
};

export const getProductionModeBlockers = (
  settings: PlatformSettings
): ReadinessCheck[] =>
  getSystemReadinessChecks(settings).filter(
    (item) => item.id !== "production_mode" && !item.ready
  );

const migrationSeverity = (
  partial: number,
  demo: number
): ReadinessCheck["severity"] => {
  if (demo > 0) return "blocked";
  if (partial > 0) return "warning";
  return "ok";
};

const migrationStatusLabel = (status: ApiMigrationStatus) => {
  if (status === "connected") return "მიერთებულია";
  if (status === "partial") return "ნაწილობრივია";
  return "demo fallback";
};

export const getLaunchReadinessChecks = ({
  settings,
  legalSettings,
  verificationStatus,
  prePaymentDoneCount,
  prePaymentTotal,
  mobileQaDoneCount,
  mobileQaTotal,
  activeAdminMemberCount,
  apiMigrationSummary,
}: LaunchReadinessInput): ReadinessCheck[] => {
  const systemChecks = getSystemReadinessChecks(settings);
  const migrationReady =
    apiMigrationSummary.demo === 0 && apiMigrationSummary.partial === 0;
  const migrationStatus: ApiMigrationStatus = migrationReady
    ? "connected"
    : apiMigrationSummary.demo > 0
      ? "demo"
      : "partial";

  return [
    ...systemChecks,
    {
      id: "verification_flow",
      label: "ვერიფიკაციის ნაკადი",
      ready: verificationStatus === "verified",
      detail:
        verificationStatus === "verified"
          ? "ხელოსნის დოკუმენტები დადასტურებულია"
          : "ხელოსნის სამუშაო ადგილი ვერ გაიხსნება, სანამ Admin არ დაადასტურებს",
      severity: verificationStatus === "verified" ? "ok" : "warning",
    },
    {
      id: "pre_payment_checklist",
      label: "გადახდამდე checklist",
      ready: prePaymentDoneCount === prePaymentTotal && prePaymentTotal > 0,
      detail: `${prePaymentDoneCount}/${prePaymentTotal} პუნქტი დასრულებულია`,
      severity:
        prePaymentDoneCount === prePaymentTotal && prePaymentTotal > 0
          ? "ok"
          : "warning",
    },
    {
      id: "mobile_qa",
      label: "Mobile QA",
      ready: mobileQaDoneCount === mobileQaTotal && mobileQaTotal > 0,
      detail: `${mobileQaDoneCount}/${mobileQaTotal} მობილური სცენარი შემოწმებულია`,
      severity:
        mobileQaDoneCount === mobileQaTotal && mobileQaTotal > 0
          ? "ok"
          : "warning",
    },
    {
      id: "admin_roles",
      label: "Admin როლები",
      ready: activeAdminMemberCount >= 2,
      detail: `${activeAdminMemberCount} აქტიური Admin როლი`,
      severity: activeAdminMemberCount >= 2 ? "ok" : "warning",
    },
    {
      id: "api_migration",
      label: "API migration",
      ready: migrationReady,
      detail: `${apiMigrationSummary.connected}/${apiMigrationSummary.total} სრულად მიბმულია · ${migrationStatusLabel(migrationStatus)}`,
      severity: migrationSeverity(apiMigrationSummary.partial, apiMigrationSummary.demo),
    },
    {
      id: "legal_texts",
      label: "წესები და ტექსტები",
      ready:
        Boolean(legalSettings.bookingRules.trim()) &&
        Boolean(legalSettings.cancellationRules.trim()) &&
        Boolean(legalSettings.privacyRules.trim()) &&
        Boolean(legalSettings.supportRules.trim()),
      detail: "ჯავშნის, გაუქმების, კონფიდენციალურობისა და დახმარების ტექსტები შევსებულია",
      severity:
        Boolean(legalSettings.bookingRules.trim()) &&
        Boolean(legalSettings.cancellationRules.trim()) &&
        Boolean(legalSettings.privacyRules.trim()) &&
        Boolean(legalSettings.supportRules.trim())
          ? "ok"
          : "warning",
    },
  ];
};

export const getLaunchProductionBlockers = (
  input: LaunchReadinessInput
): ReadinessCheck[] =>
  getLaunchReadinessChecks(input).filter(
    (item) => item.id !== "production_mode" && !item.ready
  );
