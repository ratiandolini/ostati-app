import { getSupabaseConfig } from "./supabaseConfig";

export interface SupabaseAuthUser {
  id: string;
  phone?: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}

export interface SupabaseAuthSession {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  token_type?: string;
  user?: SupabaseAuthUser;
}

const sessionKey = "supabaseAuthSession";
const devAuthCode = "1234";
const devAuthPassword = "CodexLocalDemo!2026";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isOptionalString = (value: unknown) =>
  value === undefined || typeof value === "string";

const isOptionalNumber = (value: unknown) =>
  value === undefined || typeof value === "number";

const isSupabaseAuthUser = (value: unknown): value is SupabaseAuthUser => {
  if (!isRecord(value) || typeof value.id !== "string") return false;

  return (
    isOptionalString(value.phone) &&
    isOptionalString(value.email) &&
    (value.user_metadata === undefined || isRecord(value.user_metadata))
  );
};

const isSupabaseAuthSession = (
  value: unknown
): value is SupabaseAuthSession => {
  if (!isRecord(value) || typeof value.access_token !== "string") return false;

  return (
    isOptionalString(value.refresh_token) &&
    isOptionalNumber(value.expires_at) &&
    isOptionalString(value.token_type) &&
    (value.user === undefined || isSupabaseAuthUser(value.user))
  );
};

const isDevPasswordAuth = () => {
  const enabled = process.env.REACT_APP_AUTH_MODE === "dev_password";
  if (enabled && process.env.NODE_ENV === "production") {
    throw new Error(
      "REACT_APP_AUTH_MODE=dev_password is not allowed in production builds. " +
        "Set it to email_password (or unset it) before deploying."
    );
  }
  return enabled;
};

export const usesEmailPasswordAuth = () =>
  process.env.REACT_APP_AUTH_MODE === "email_password";

const normalizePhone = (phone: string) => phone.replace(/\D/g, "");
type AuthRole = "client" | "craftsman" | "admin";

const devEmailForPhone = (phone: string, role: AuthRole) =>
  `${role}.${normalizePhone(phone)}@local.demo`;

class SupabaseAuthError extends Error {
  code?: string;
  status: number;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "SupabaseAuthError";
    this.status = status;
    this.code = code;
  }
}

const parseAuthErrorBody = (body: string) => {
  try {
    const parsed: unknown = JSON.parse(body);
    if (!isRecord(parsed)) return {};

    return {
      message:
        typeof parsed.msg === "string"
          ? parsed.msg
          : typeof parsed.message === "string"
            ? parsed.message
            : undefined,
      code:
        typeof parsed.error_code === "string"
          ? parsed.error_code
          : undefined,
    };
  } catch {
    return {};
  }
};

const authRequest = async <T>(path: string, init: RequestInit): Promise<T> => {
  const config = getSupabaseConfig();
  const headers = new Headers(init.headers);
  headers.set("apikey", config.anonKey);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${config.url}/auth/v1/${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const body = await response.text();
    let message = body || response.statusText;
    let code: string | undefined;
    const parsedError = parseAuthErrorBody(body);
    message = parsedError.message || message;
    code = parsedError.code;

    throw new SupabaseAuthError(
      response.status,
      message || "Supabase auth request failed",
      code
    );
  }

  return (await response.json()) as T;
};

export const getSupabaseSession = (): SupabaseAuthSession | null => {
  try {
    const raw = window.localStorage.getItem(sessionKey);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (isSupabaseAuthSession(parsed)) return parsed;

    window.localStorage.removeItem(sessionKey);
    return null;
  } catch {
    window.localStorage.removeItem(sessionKey);
    return null;
  }
};

export const getSupabaseAccessToken = () => {
  return getSupabaseSession()?.access_token || "";
};

export const getSupabaseUserId = () => {
  return getSupabaseSession()?.user?.id || "";
};

export const saveSupabaseSession = (session: SupabaseAuthSession) => {
  window.localStorage.setItem(sessionKey, JSON.stringify(session));
};

export const clearSupabaseSession = () => {
  window.localStorage.removeItem(sessionKey);
  window.localStorage.removeItem("pendingDevSupabaseAuth");
};

export const requestPhoneOtp = (phone: string, role: AuthRole) => {
  if (isDevPasswordAuth()) {
    return Promise.resolve({ message_id: "dev-password-auth" });
  }

  return authRequest<{ message_id?: string }>("otp", {
    method: "POST",
    body: JSON.stringify({
      phone,
      create_user: true,
      data: { role },
    }),
  });
};

const signInWithDevPassword = async (
  phone: string,
  role: AuthRole
) => {
  const email = devEmailForPhone(phone, role);

  try {
    await authRequest("signup", {
      method: "POST",
      body: JSON.stringify({
        email,
        password: devAuthPassword,
        data: {
          role,
          phone,
        },
      }),
    });
  } catch {
    // Existing users continue through the password grant below.
  }

  const session = await authRequest<SupabaseAuthSession>(
    "token?grant_type=password",
    {
      method: "POST",
      body: JSON.stringify({
        email,
        password: devAuthPassword,
      }),
    }
  );

  saveSupabaseSession(session);
  return session;
};

export const verifyPhoneOtp = async (
  phone: string,
  token: string,
  role: AuthRole
): Promise<SupabaseAuthSession> => {
  if (isDevPasswordAuth()) {
    if (token !== devAuthCode) {
      throw new Error("კოდი არასწორია. სატესტო კოდია: 1234");
    }
    return signInWithDevPassword(phone, role);
  }

  const session = await authRequest<SupabaseAuthSession>("verify", {
    method: "POST",
    body: JSON.stringify({
      phone,
      token,
      type: "sms",
    }),
  });

  saveSupabaseSession(session);
  return session;
};

export const signInOrSignUpWithEmail = async (
  email: string,
  password: string,
  role: AuthRole,
  allowSignUp = true
): Promise<SupabaseAuthSession> => {
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const existingSession = await authRequest<SupabaseAuthSession>(
      "token?grant_type=password",
      {
        method: "POST",
        body: JSON.stringify({
          email: normalizedEmail,
          password,
        }),
      }
    );
    saveSupabaseSession(existingSession);
    return existingSession;
  } catch (loginError) {
    if (
      loginError instanceof SupabaseAuthError &&
      loginError.code !== "invalid_credentials"
    ) {
      throw loginError;
    }
    if (!allowSignUp) {
      throw new Error("Admin-ის მონაცემები ვერ დადასტურდა.");
    }
    // If login fails, try creating the user below.
  }

  let signupResult: SupabaseAuthSession;

  try {
    signupResult = await authRequest<SupabaseAuthSession>("signup", {
      method: "POST",
      body: JSON.stringify({
        email: normalizedEmail,
        password,
        data: {
          role,
        },
      }),
    });
  } catch (signupError) {
    if (signupError instanceof SupabaseAuthError) {
      if (signupError.code === "email_address_invalid") {
        throw new Error(
          "ეს ელ.ფოსტა Supabase-მა არ მიიღო. სცადე რეალური, აქტიური მეილი, მაგალითად Gmail-ში მინიმუმ 6 სიმბოლო @-მდე."
        );
      }
      if (
        signupError.code === "user_already_exists" ||
        signupError.message.toLowerCase().includes("already registered")
      ) {
        throw new Error("ეს მეილი უკვე რეგისტრირებულია. პაროლი გადაამოწმე.");
      }
    }
    throw signupError;
  }

  if (signupResult.access_token) {
    saveSupabaseSession(signupResult);
    return signupResult;
  }

  throw new Error(
    "Email confirmation ჩართულია Supabase-ში. ტესტისთვის გამორთე Auth > Providers > Email > Confirm email, ან დაადასტურე მეილი და მერე სცადე შესვლა."
  );
};

export const refreshSupabaseSession = async () => {
  const current = getSupabaseSession();
  if (!current?.refresh_token) return null;

  const session = await authRequest<SupabaseAuthSession>(
    "token?grant_type=refresh_token",
    {
      method: "POST",
      body: JSON.stringify({
        refresh_token: current.refresh_token,
      }),
    }
  );

  saveSupabaseSession(session);
  return session;
};

export const signOutSupabase = async () => {
  const config = getSupabaseConfig();
  const accessToken = getSupabaseAccessToken();

  try {
    if (accessToken) {
      await fetch(`${config.url}/auth/v1/logout`, {
        method: "POST",
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${accessToken}`,
        },
      });
    }
  } finally {
    clearSupabaseSession();
  }
};
