import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "@playwright/test";
import { assertApiE2EEnvironment } from "./environment";

type FixtureIdentity = { authUserId: string; userId: string; workerId?: string; email?: string };

export type FixtureState = Record<"client" | "craftsman" | "admin", FixtureIdentity> & {
  projectRef: string;
  runMarker: string;
};

const config = () => {
  assertApiE2EEnvironment();
  return {
    url: process.env.E2E_TEST_SUPABASE_URL!,
    anonKey: process.env.E2E_TEST_SUPABASE_ANON_KEY!,
  };
};

export const loadFixtureState = (): FixtureState =>
  JSON.parse(readFileSync(join(process.cwd(), ".e2e", "fixture-state.json"), "utf8"));

export const signIn = async (email: string, password: string) => {
  const { url, anonKey } = config();
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json();
  if (!response.ok || !body.access_token) {
    throw new Error(`Test login failed: ${body.msg || body.error_description || response.status}`);
  }
  return body.access_token as string;
};

export const rpc = async <T>(accessToken: string, name: string, payload: Record<string, unknown> = {}) => {
  const { url, anonKey } = config();
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${name} failed: ${body?.message || body?.hint || response.status}`);
  return body as T;
};

export const expectRpcDenied = async (
  accessToken: string,
  name: string,
  payload: Record<string, unknown> = {}
) => {
  await expect(rpc(accessToken, name, payload)).rejects.toThrow(`${name} failed:`);
};
