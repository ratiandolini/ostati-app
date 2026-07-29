import { appStorage } from "./appStorage";
import { getSupabaseConfig, SupabaseConfigError } from "./supabaseConfig";

const warnApiFallback = (method: string) => {
  try {
    getSupabaseConfig();
  } catch (error) {
    if (error instanceof SupabaseConfigError) {
      throw error;
    }

    throw new Error("Supabase configuration could not be validated.");
  }

  console.warn(
    `apiService.${method} uses local cache fallback until its async Supabase implementation is connected.`
  );
};

export const apiService = new Proxy(appStorage, {
  get(target, property, receiver) {
    const value = Reflect.get(target, property, receiver);

    if (typeof value !== "function") {
      return value;
    }

    return (...args: unknown[]) => {
      warnApiFallback(String(property));
      return value.apply(target, args);
    };
  },
}) as typeof appStorage;
