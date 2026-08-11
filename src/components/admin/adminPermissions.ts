import type { AdminMember } from "../../services/dataService";

export type AdminTab =
  | "overview"
  | "verification"
  | "disputes"
  | "bookings"
  | "finance"
  | "users"
  | "settings"
  | "audit";

export type AdminPermission = AdminMember["permissions"][number];

export const tabPermission: Record<AdminTab, AdminPermission | "overview"> = {
  overview: "overview",
  verification: "verification",
  disputes: "disputes",
  bookings: "bookings",
  finance: "finance",
  users: "users",
  settings: "settings",
  audit: "audit",
};

export const allAdminTabs: Array<[AdminTab, string]> = [
  ["overview", "მთავარი"],
  ["verification", "ვერიფიკაცია"],
  ["bookings", "ჯავშნები"],
  ["disputes", "დავები"],
  ["users", "ხელოსნები"],
  ["settings", "პარამეტრები"],
];
