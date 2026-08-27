import { createSupabaseRestClient } from "./supabaseRest";
import {
  createStoragePath,
  uploadStorageFile,
} from "./supabaseStorageService";

export type WorkerPriceType = "fixed" | "from" | "range";

export interface WorkerScheduleDay {
  weekday: number;
  startTime: string;
  endTime: string;
}

export interface WorkerUnavailableRangeInput {
  start: string;
  end: string;
}

export interface WorkerProfileApiPayload {
  firstName?: string;
  lastName?: string;
  contactPhone?: string;
  photoUrl?: string | null;
  city?: string;
  about?: string;
  professions: string[];
  experienceYears: number | null;
  priceType: WorkerPriceType;
  priceMin: number | null;
  priceMax: number | null;
  schedule: WorkerScheduleDay[];
  unavailableRanges: WorkerUnavailableRangeInput[];
}

export interface WorkerProfileApiResult {
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  photo_url?: string | null;
  contact_phone?: string | null;
  city?: string | null;
  about?: string | null;
  verification_status?: "not_started" | "pending" | "verified" | "rejected" | null;
  trial_started_at?: string | null;
  subscription_status?: "trial" | "active" | "past_due" | "cancelled" | null;
  subscription?: {
    plan?: string | null;
    amount?: number | string | null;
    status?: "trial" | "active" | "past_due" | "cancelled" | null;
    trial_ends_at?: string | null;
    current_period_start?: string | null;
    current_period_end?: string | null;
  } | null;
  verification_documents?: {
    id_front?: string | null;
    id_back?: string | null;
    bank_account?: string | null;
  } | null;
  professions?: string[] | null;
  price_type?: WorkerPriceType | null;
  price_min?: number | string | null;
  price_max?: number | string | null;
  experience_years?: number | string | null;
  schedule?: Array<{
    weekday: number;
    start_time: string;
    end_time: string;
  }> | null;
  unavailable_ranges?: Array<{
    start: string;
    end: string;
  }> | null;
}

export interface CurrentUserProfileApiResult {
  id: string;
  role: "client" | "craftsman" | "admin";
  phone: string;
  contact_phone?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  photo_url?: string | null;
  city?: string | null;
  address_text?: string | null;
  rating_avg?: number | string | null;
  rating_count?: number | null;
  status?: string | null;
}

export const uploadProfilePhoto = async (
  file: File,
  role: "client" | "craftsman"
) => {
  return uploadStorageFile({
    bucket: "profile-photos",
    file,
    path: createStoragePath(role, file, "avatar"),
  });
};

export const saveCurrentUserProfile = async (profile: {
  firstName?: string;
  lastName?: string;
  contactPhone?: string;
  photoUrl?: string | null;
  city?: string;
  addressText?: string;
}) => {
  const client = createSupabaseRestClient();

  const payload = {
    p_first_name: profile.firstName || null,
    p_last_name: profile.lastName || null,
    p_contact_phone: profile.contactPhone || null,
    p_photo_url: profile.photoUrl || null,
    p_city: profile.city || null,
    p_address_text: profile.addressText || null,
  };

  try {
    return await client.rpc("update_current_user_profile", payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!/PGRST202|PGRST203|schema cache|Could not find the function|Could not choose the best candidate/i.test(message)) {
      throw error;
    }
    return client.rpc("update_current_user_profile", {
      p_first_name: profile.firstName || null,
      p_last_name: profile.lastName || null,
      p_photo_url: profile.photoUrl || null,
      p_city: profile.city || null,
      p_address_text: profile.addressText || null,
    });
  }
};

export const loadCurrentUserProfile =
  async (signal?: AbortSignal): Promise<CurrentUserProfileApiResult | null> => {
    const client = createSupabaseRestClient();
    return client.rpc<CurrentUserProfileApiResult | null>(
      "get_current_user_profile",
      {},
      { signal }
    );
  };

export const loadCurrentWorkerProfile =
  async (signal?: AbortSignal): Promise<WorkerProfileApiResult | null> => {
    const client = createSupabaseRestClient();
    return client.rpc<WorkerProfileApiResult | null>(
      "get_current_worker_profile",
      {},
      { signal }
    );
  };

export const saveCurrentWorkerProfile = async (
  profile: WorkerProfileApiPayload
) => {
  const client = createSupabaseRestClient();

  const payload = {
    p_first_name: profile.firstName || null,
    p_last_name: profile.lastName || null,
    p_contact_phone: profile.contactPhone || null,
    p_photo_url: profile.photoUrl || null,
    p_city: profile.city || null,
    p_about: profile.about || null,
    p_professions: profile.professions,
    p_experience_years: profile.experienceYears,
    p_price_type: profile.priceType,
    p_price_min: profile.priceMin,
    p_price_max: profile.priceMax,
    p_schedule: profile.schedule.map((item) => ({
      weekday: item.weekday,
      start_time: item.startTime,
      end_time: item.endTime,
    })),
    p_unavailable_ranges: profile.unavailableRanges.map((item) => ({
      start: item.start,
      end: item.end,
    })),
  };

  try {
    return await client.rpc("save_current_worker_profile", payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!/PGRST202|PGRST203|schema cache|Could not find the function|Could not choose the best candidate/i.test(message)) {
      throw error;
    }
    if (profile.contactPhone?.trim()) {
      throw new Error("პროფილის შენახვის სერვერი განახლებას საჭიროებს. ადმინმა Supabase-ში უნდა გაუშვას profile_actions.sql.");
    }
    return client.rpc("save_current_worker_profile", {
      p_first_name: profile.firstName || null,
      p_last_name: profile.lastName || null,
      p_photo_url: profile.photoUrl || null,
      p_city: profile.city || null,
      p_about: profile.about || null,
      p_professions: profile.professions,
      p_experience_years: profile.experienceYears,
      p_price_type: profile.priceType,
      p_price_min: profile.priceMin,
      p_price_max: profile.priceMax,
      p_schedule: profile.schedule.map((item) => ({
        weekday: item.weekday,
        start_time: item.startTime,
        end_time: item.endTime,
      })),
      p_unavailable_ranges: profile.unavailableRanges.map((item) => ({
        start: item.start,
        end: item.end,
      })),
    });
  }
};

export const uploadVerificationDocument = async (
  file: File,
  type: "id_front" | "id_back"
) => {
  const uploaded = await uploadStorageFile({
    bucket: "verification-documents",
    file,
    path: createStoragePath("verification", file, type),
  });

  const client = createSupabaseRestClient();
  await client.rpc("add_worker_verification_document", {
    p_type: type,
    p_file_url: uploaded.path,
  });

  return uploaded;
};

export const saveWorkerBankAccount = async (bankAccount: string) => {
  const client = createSupabaseRestClient();
  return client.rpc("add_worker_verification_document", {
    p_type: "bank_account",
    p_file_url: bankAccount.trim(),
  });
};
