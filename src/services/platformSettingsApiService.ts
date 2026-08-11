import { createSupabaseRestClient } from "./supabaseRest";
import type { LegalSettings, PlatformSettings } from "./dataService";

interface PublicAppSettingsRow {
  platformSettings?: Partial<PlatformSettings>;
  legalSettings?: Partial<LegalSettings>;
}

export const loadPublicAppSettings = async (signal?: AbortSignal) => {
  const client = createSupabaseRestClient();
  return client.rpc<PublicAppSettingsRow>(
    "get_public_app_settings",
    {},
    { signal }
  );
};
