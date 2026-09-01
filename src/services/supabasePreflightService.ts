import {
  loadAdminBookings,
  loadAdminDisputes,
  loadAdminLaunchState,
  loadAdminUsers,
  loadCurrentAdminContext,
} from "./adminApiService";
import { loadMessageThreads } from "./messageApiService";
import { loadCurrentUserProfile } from "./profileApiService";
import { loadWorkerPublicReviews } from "./reviewApiService";
import { getSupabaseAccessToken } from "./supabaseAuthService";
import { getSupabaseConfig } from "./supabaseConfig";
import { loadWorkerCatalog } from "./workerCatalogService";

export type SupabasePreflightStatus = "ok" | "warning" | "error";

export interface SupabasePreflightCheck {
  id: string;
  label: string;
  area: "config" | "auth" | "profile" | "reviews" | "bookings" | "messages" | "admin" | "storage";
  status: SupabasePreflightStatus;
  detail: string;
  nextAction?: string;
  sqlFile?: string;
  required?: boolean;
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "უცნობი შეცდომა";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const nextActionForError = (message: string, fallback?: string, sqlFile?: string) => {
  if (/PGRST203|function overloading|Could not choose the best candidate/i.test(message)) {
    return sqlFile
      ? `Supabase-ში function-ის ძველი და ახალი ვერსია ერთად დარჩა. გაუშვი ${sqlFile} ბოლო ვერსიით, რომ ძველი signature წაიშალოს.`
      : "Supabase-ში function overload დარჩა. SQL ფაილი თავიდან გაუშვი, რომ ძველი function signature წაიშალოს.";
  }

  if (/PGRST202|schema cache|Could not find the function/i.test(message)) {
    return sqlFile
      ? `გაუშვი ${sqlFile}, დაელოდე Supabase schema cache-ს განახლებას და თავიდან შეამოწმე.`
      : "Supabase schema cache-ს აკლია ბოლო ცვლილება. SQL-ები თავიდან გაუშვი და ცოტა ხანში გადაამოწმე.";
  }

  if (/401|JWT|session|not authenticated|invalid.*token/i.test(message)) {
    return "გამოდი და თავიდან შედი Admin ანგარიშით, შემდეგ თავიდან დააჭირე Supabase შემოწმებას.";
  }

  if (/403|permission|Only admins|Unauthorized|row-level security/i.test(message)) {
    return fallback || "შეამოწმე Admin როლი/უფლებები და Supabase RLS policies.";
  }

  return fallback || (sqlFile ? `გაუშვი ${sqlFile} და თავიდან შეამოწმე.` : undefined);
};

const skippedCheck = (
  id: string,
  label: string,
  area: SupabasePreflightCheck["area"],
  detail: string,
  nextAction?: string,
  sqlFile?: string,
  required = false
): SupabasePreflightCheck => ({
  id,
  label,
  area,
  status: "warning",
  detail,
  nextAction,
  sqlFile,
  required,
});

const runCheck = async (
  id: string,
  label: string,
  area: SupabasePreflightCheck["area"],
  action: () => Promise<unknown>,
  sqlFile?: string,
  nextAction?: string
): Promise<SupabasePreflightCheck> => {
  try {
    await action();
    return {
      id,
      label,
      area,
      status: "ok",
      detail: "კარგად მუშაობს",
      sqlFile,
      required: true,
    };
  } catch (error) {
    const detail = errorMessage(error);
    return {
      id,
      label,
      area,
      status: "error",
      detail,
      nextAction: nextActionForError(detail, nextAction, sqlFile),
      sqlFile,
      required: true,
    };
  }
};

const runQaNoteSchemaCheck = async (): Promise<SupabasePreflightCheck> => {
  try {
    const state = await loadAdminLaunchState();
    const firstScenario = state.mobileQaScenarios[0];

    if (!firstScenario) {
      return {
        id: "mobile_qa_note_schema",
        label: "Mobile QA note schema",
        area: "admin",
        status: "warning",
        detail: "Mobile QA scenario-ები არ დაბრუნდა, note schema ვერ შემოწმდა.",
        nextAction: "გაუშვი supabase/admin_launch_actions.sql და გადაამოწმე launch checklist seed.",
        sqlFile: "supabase/admin_launch_actions.sql",
        required: false,
      };
    }

    if (
      !isRecord(firstScenario) ||
      !Object.prototype.hasOwnProperty.call(firstScenario, "note")
    ) {
      return {
        id: "mobile_qa_note_schema",
        label: "Mobile QA note schema",
        area: "admin",
        status: "warning",
        detail: "Mobile QA note ველი backend response-ში არ ჩანს.",
        nextAction:
          "გაუშვი supabase/admin_launch_actions.sql ბოლო ვერსიით, რომ launch_checklist_items.note და p_note RPC ჩაირთოს.",
        sqlFile: "supabase/admin_launch_actions.sql",
        required: false,
      };
    }

    return {
      id: "mobile_qa_note_schema",
      label: "Mobile QA note schema",
      area: "admin",
      status: "ok",
      detail: "QA note ველი backend response-ში ჩანს",
      sqlFile: "supabase/admin_launch_actions.sql",
      required: false,
    };
  } catch (error) {
    return skippedCheck(
      "mobile_qa_note_schema",
      "Mobile QA note schema",
      "admin",
      `შემოწმება გამოტოვებულია: ${errorMessage(error)}`,
      "ჯერ Admin launch/settings check გაასწორე, შემდეგ გაუშვი supabase/admin_launch_actions.sql.",
      "supabase/admin_launch_actions.sql",
      false
    );
  }
};

const runPublicReviewFeedCheck = async (): Promise<SupabasePreflightCheck> => {
  try {
    const worker = (await loadWorkerCatalog()).find((item) => item.backendId);
    if (!worker?.backendId) {
      return skippedCheck(
        "public_review_feed",
        "Public review feed",
        "reviews",
        "ვერიფიცირებული ხელოსანი არ მოიძებნა, ამიტომ review feed ვერ შემოწმდა.",
        "ჯერ დაადასტურე მინიმუმ ერთი ხელოსნის პროფილი, შემდეგ თავიდან გაუშვი შემოწმება.",
        "supabase/public_review_feed.sql",
        false
      );
    }

    await loadWorkerPublicReviews(worker.backendId);
    return {
      id: "public_review_feed",
      label: "Public review feed",
      area: "reviews",
      status: "ok",
      detail: "ხელოსნის დეტალური შეფასებები უსაფრთხოდ იტვირთება",
      sqlFile: "supabase/public_review_feed.sql",
      required: true,
    };
  } catch (error) {
    const detail = errorMessage(error);
    return {
      id: "public_review_feed",
      label: "Public review feed",
      area: "reviews",
      status: "error",
      detail,
      nextAction: nextActionForError(
        detail,
        "გაუშვი public_review_feed.sql და დარწმუნდი, რომ authenticated მომხმარებლებს function-ის შესრულების უფლება აქვთ.",
        "supabase/public_review_feed.sql"
      ),
      sqlFile: "supabase/public_review_feed.sql",
      required: true,
    };
  }
};

export const runSupabasePreflightChecks = async () => {
  const checks: SupabasePreflightCheck[] = [];

  try {
    getSupabaseConfig();
    checks.push({
      id: "config",
      label: "Supabase URL / key",
      area: "config",
      status: "ok",
      detail: "გარემოს ცვლადები შევსებულია",
      required: true,
    });
  } catch (error) {
    return [
      {
        id: "config",
        label: "Supabase URL / key",
        area: "config",
        status: "error",
        detail: errorMessage(error),
        nextAction: ".env-ში შეამოწმე REACT_APP_SUPABASE_URL და REACT_APP_SUPABASE_ANON_KEY.",
        required: true,
      },
    ] as SupabasePreflightCheck[];
  }

  const hasSession = Boolean(getSupabaseAccessToken());
  checks.push({
    id: "session",
    label: "მიმდინარე session",
    area: "auth",
    status: hasSession ? "ok" : "error",
    detail: hasSession ? "მომხმარებელი შესულია" : "ჯერ შედი აპში, რომ API შემოწმდეს",
    nextAction: hasSession ? undefined : "შედი Admin ანგარიშით და თავიდან დააჭირე შემოწმებას.",
    required: true,
  });

  if (!hasSession) {
    checks.push(
      skippedCheck(
        "admin_context",
        "Admin უფლებები",
        "admin",
        "შემოწმება გამოტოვებულია, რადგან Admin session ჯერ არ არის აქტიური",
        "შედი Admin ანგარიშით და თავიდან დააჭირე Supabase შემოწმებას.",
        "supabase/admin_launch_actions.sql"
      ),
      skippedCheck(
        "profile",
        "Profile RPC",
        "profile",
        "შემოწმება დაიწყება შესვლის შემდეგ",
        "შესვლის შემდეგ თუ აქ წითელი შეცდომა გამოჩნდა, გაუშვი profile_actions.sql.",
        "supabase/profile_actions.sql"
      ),
      skippedCheck(
        "messages",
        "Messages/unread RPC",
        "messages",
        "შემოწმება დაიწყება შესვლის შემდეგ",
        "შესვლის შემდეგ თუ შეტყობინებები არ ჩაიტვირთა, გაუშვი message_actions.sql და notification_actions.sql.",
        "supabase/message_actions.sql"
      )
    );

    return checks;
  }

  checks.push(
    await runCheck(
      "profile",
      "Profile RPC",
      "profile",
      loadCurrentUserProfile,
      "supabase/profile_actions.sql",
      "გაუშვი schema.sql, policies.sql, auth.sql და profile_actions.sql ბოლო ვერსიით."
    ),
    await runCheck(
      "messages",
      "Messages/unread RPC",
      "messages",
      loadMessageThreads,
      "supabase/message_actions.sql",
      "გაუშვი message_actions.sql და notification_actions.sql."
    ),
    await runPublicReviewFeedCheck()
  );

  const contextCheck = await runCheck(
    "admin_context",
    "Admin უფლებები",
    "admin",
    loadCurrentAdminContext,
    "supabase/admin_launch_actions.sql",
    "გაუშვი admin_launch_actions.sql და დარწმუნდი, რომ current user Admin წევრებშია."
  );
  checks.push(contextCheck);

  const context =
    contextCheck.status === "ok" ? await loadCurrentAdminContext().catch(() => null) : null;

  if (!context) {
    checks.push(
      skippedCheck(
        "launch_state",
        "Admin launch/settings",
        "admin",
        "Admin context არ დადასტურდა, ამიტომ settings შემოწმება გამოტოვებულია",
        "დარწმუნდი, რომ მიმდინარე user დამატებულია Admin წევრებში და გაუშვი admin_launch_actions.sql.",
        "supabase/admin_launch_actions.sql"
      ),
      skippedCheck(
        "admin_bookings",
        "Admin ჯავშნები",
        "bookings",
        "Admin context არ დადასტურდა, ამიტომ ჯავშნების Admin API გამოტოვებულია",
        "შედი owner/support Admin ანგარიშით ან მისცეს ამ Admin-ს bookings permission.",
        "supabase/admin_launch_actions.sql"
      ),
      skippedCheck(
        "admin_disputes",
        "Admin დავები",
        "admin",
        "Admin context არ დადასტურდა, ამიტომ დავების Admin API გამოტოვებულია",
        "შედი owner/support Admin ანგარიშით ან მისცეს ამ Admin-ს disputes permission.",
        "supabase/admin_launch_actions.sql"
      ),
      skippedCheck(
        "admin_users",
        "Admin მომხმარებლები",
        "admin",
        "Admin context არ დადასტურდა, ამიტომ მომხმარებლების Admin API გამოტოვებულია",
        "შედი owner Admin ანგარიშით ან მისცეს ამ Admin-ს users permission.",
        "supabase/admin_launch_actions.sql"
      )
    );

    return checks;
  }

  const can = (permission: "bookings" | "disputes" | "users") =>
    context.member.role === "owner" ||
    context.member.permissions.includes(permission);

  checks.push(
    await runCheck(
      "launch_state",
      "Admin launch/settings",
      "admin",
      loadAdminLaunchState,
      "supabase/admin_launch_actions.sql",
      "გაუშვი admin_launch_actions.sql, შემდეგ შედი owner/support Admin-ით."
    ),
  );
  checks.push(await runQaNoteSchemaCheck());

  if (can("bookings")) {
    checks.push(
      await runCheck(
        "admin_bookings",
        "Admin ჯავშნები",
        "bookings",
        loadAdminBookings,
        "supabase/admin_launch_actions.sql",
        "გაუშვი booking_actions.sql, booking_list.sql, payment_workflow.sql და admin_launch_actions.sql."
      )
    );
  } else {
    checks.push({
      id: "admin_bookings",
      label: "Admin ჯავშნები",
      area: "bookings",
      status: "warning",
      detail: "მიმდინარე Admin-ს bookings უფლება არ აქვს",
      nextAction: "თუ ეს Admin booking-ებს უნდა მართავდეს, owner-მა მისცეს bookings permission.",
      sqlFile: "supabase/admin_launch_actions.sql",
      required: false,
    });
  }

  if (can("disputes")) {
    checks.push(
      await runCheck(
        "admin_disputes",
        "Admin დავები",
        "admin",
        loadAdminDisputes,
        "supabase/admin_launch_actions.sql",
        "გაუშვი dispute_actions.sql, dispute_workflow.sql და admin_launch_actions.sql."
      )
    );
  } else {
    checks.push({
      id: "admin_disputes",
      label: "Admin დავები",
      area: "admin",
      status: "warning",
      detail: "მიმდინარე Admin-ს disputes უფლება არ აქვს",
      nextAction: "თუ ეს Admin დავებს უნდა მართავდეს, owner-მა მისცეს disputes permission.",
      sqlFile: "supabase/admin_launch_actions.sql",
      required: false,
    });
  }

  if (can("users")) {
    checks.push(
      await runCheck(
        "admin_users",
        "Admin მომხმარებლები",
        "admin",
        loadAdminUsers,
        "supabase/admin_launch_actions.sql",
        "გაუშვი admin_launch_actions.sql და შეამოწმე users permission."
      )
    );
  } else {
    checks.push({
      id: "admin_users",
      label: "Admin მომხმარებლები",
      area: "admin",
      status: "warning",
      detail: "მიმდინარე Admin-ს users უფლება არ აქვს",
      nextAction: "თუ ეს Admin მომხმარებლებს უნდა მართავდეს, owner-მა მისცეს users permission.",
      sqlFile: "supabase/admin_launch_actions.sql",
      required: false,
    });
  }

  checks.push({
    id: "private_storage",
    label: "Private Storage manual QA",
    area: "storage",
    status: "ok",
    detail:
      "Private bucket policies ავტომატურად სრულად ვერ მოწმდება, მაგრამ ეს პუნქტი მზადად ითვლება თუ profile/chat/verification ფოტოები იტვირთება და Admin-იდან signed URL-ით იხსნება.",
    sqlFile: "supabase/storage.sql",
    required: false,
  });

  return checks;
};
