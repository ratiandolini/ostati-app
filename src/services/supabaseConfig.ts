export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export class SupabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseConfigError";
  }
}

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const getSupabaseConfig = (): SupabaseConfig => {
  const url = process.env.REACT_APP_SUPABASE_URL?.trim();
  const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    throw new SupabaseConfigError(
      "Supabase is not configured. Fill REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY, or keep REACT_APP_DATA_MODE=demo."
    );
  }

  return {
    url: trimTrailingSlash(url),
    anonKey,
  };
};
