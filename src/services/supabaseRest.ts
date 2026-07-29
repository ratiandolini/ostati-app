import { getSupabaseAccessToken } from "./supabaseAuthService";
import { getSupabaseConfig } from "./supabaseConfig";
import type { SupabaseConfig } from "./supabaseConfig";

type QueryValue = string | number | boolean;
type QueryParams = Record<string, QueryValue | QueryValue[] | undefined>;

const buildQueryString = (params?: QueryParams) => {
  if (!params) return "";

  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined) return;

    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, String(item)));
      return;
    }

    query.set(key, String(value));
  });

  const text = query.toString();
  return text ? `?${text}` : "";
};

const parseResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Supabase request failed with ${response.status}: ${body || response.statusText}`
    );
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return (await response.json()) as T;
};

export const createSupabaseRestClient = (config = getSupabaseConfig()) => {
  const request = async <T>(
    path: string,
    init: RequestInit = {},
    params?: QueryParams
  ): Promise<T> => {
    const headers = new Headers(init.headers);
    const accessToken = getSupabaseAccessToken();
    headers.set("apikey", config.anonKey);
    headers.set("Authorization", `Bearer ${accessToken || config.anonKey}`);
    headers.set("Content-Type", "application/json");

    const response = await fetch(
      `${config.url}/rest/v1/${path}${buildQueryString(params)}`,
      {
        ...init,
        headers,
      }
    );

    return parseResponse<T>(response);
  };

  return {
    select<T>(table: string, params?: QueryParams) {
      return request<T[]>(
        table,
        {
          method: "GET",
          headers: {
            Prefer: "return=representation",
          },
        },
        params
      );
    },

    insert<T>(table: string, value: unknown) {
      return request<T[]>(
        table,
        {
          method: "POST",
          body: JSON.stringify(value),
          headers: {
            Prefer: "return=representation",
          },
        }
      );
    },

    update<T>(table: string, value: unknown, params: QueryParams) {
      return request<T[]>(
        table,
        {
          method: "PATCH",
          body: JSON.stringify(value),
          headers: {
            Prefer: "return=representation",
          },
        },
        params
      );
    },

    remove(table: string, params: QueryParams) {
      return request<void>(
        table,
        {
          method: "DELETE",
        },
        params
      );
    },

    rpc<T>(functionName: string, value: unknown) {
      return request<T>(
        `rpc/${functionName}`,
        {
          method: "POST",
          body: JSON.stringify(value),
        }
      );
    },
  };
};
