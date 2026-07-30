import type { ClientProfile, CraftsmanProfile } from "../../services/dataService";

export type AdminClientAccountStatus = NonNullable<
  ClientProfile["accountStatus"]
>;
export type AdminCraftsmanAccountStatus = NonNullable<
  CraftsmanProfile["accountStatus"]
>;
export type AdminAccountStatus =
  | AdminClientAccountStatus
  | AdminCraftsmanAccountStatus;

export const requiresAccountStatusNote = (status: AdminAccountStatus) =>
  status !== "active";

export const getAccountStatusConfirmMessage = (
  userType: "client" | "craftsman",
  statusLabel: string
) =>
  userType === "client"
    ? `კლიენტის სტატუსი შეიცვალოს: ${statusLabel}?`
    : `ხელოსნის სტატუსი შეიცვალოს: ${statusLabel}?`;

export const getAccountStatusAuditSummary = (
  userType: "client" | "craftsman",
  statusLabel: string,
  note: string
) =>
  `${userType === "client" ? "კლიენტის" : "ხელოსნის"} სტატუსი: ${statusLabel}${
    note ? ` · ${note}` : ""
  }`;
