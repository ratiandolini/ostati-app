import type { AdminPermission, AdminTab } from "./adminPermissions";

export interface AdminOverviewItem {
  label: string;
  value: number;
  hint?: string;
  tabId: AdminTab;
  permission: AdminPermission;
  color: string;
}

interface AdminOverviewInput {
  verificationStatus: string;
  openDisputesCount: number;
  urgentDisputesCount: number;
  interventionRequestsCount: number;
}

export const getAdminSummaryCards = ({
  verificationStatus,
  openDisputesCount,
  urgentDisputesCount,
  interventionRequestsCount,
}: AdminOverviewInput): AdminOverviewItem[] => [
  {
    label: "შესამოწმებელი",
    value: verificationStatus === "pending" ? 1 : 0,
    hint: "ხელოსნის დოკუმენტები",
    tabId: "verification",
    permission: "verification",
    color: verificationStatus === "pending" ? "#c2410c" : "#64748b",
  },
  {
    label: "ღია დავები",
    value: openDisputesCount,
    hint: urgentDisputesCount ? `${urgentDisputesCount} სასწრაფო` : "სასწრაფო არაა",
    tabId: "disputes",
    permission: "disputes",
    color: openDisputesCount ? "#b91c1c" : "#64748b",
  },
  {
    label: "Admin ჩარევა",
    value: interventionRequestsCount,
    hint: "პრობლემური ჯავშნები",
    tabId: "bookings",
    permission: "bookings",
    color: interventionRequestsCount ? "#1d4ed8" : "#64748b",
  },
];

export const getAdminWorkQueueItems = ({
  verificationStatus,
  openDisputesCount,
  interventionRequestsCount,
}: AdminOverviewInput): AdminOverviewItem[] => [
  {
    label:
      verificationStatus === "pending"
        ? "ხელოსნის დოკუმენტები შესამოწმებელია"
        : "ვერიფიკაციის რიგი ცარიელია",
    value: verificationStatus === "pending" ? 1 : 0,
    color: verificationStatus === "pending" ? "#c2410c" : "#64748b",
    tabId: "verification",
    permission: "verification",
  },
  {
    label: openDisputesCount
      ? `${openDisputesCount} დავა საჭიროებს ყურადღებას`
      : "ღია დავა არ არის",
    value: openDisputesCount,
    color: openDisputesCount ? "#b91c1c" : "#64748b",
    tabId: "disputes",
    permission: "disputes",
  },
  {
    label: interventionRequestsCount
      ? `${interventionRequestsCount} პრობლემური ჯავშანია გადასამოწმებელი`
      : "პრობლემური ჯავშანი არ არის",
    value: interventionRequestsCount,
    color: interventionRequestsCount ? "#1d4ed8" : "#64748b",
    tabId: "bookings",
    permission: "bookings",
  },
];
