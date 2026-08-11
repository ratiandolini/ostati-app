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
  pendingVerificationCount: number;
  openDisputesCount: number;
  urgentDisputesCount: number;
  interventionRequestsCount: number;
}

export const getAdminSummaryCards = ({
  pendingVerificationCount,
  openDisputesCount,
  urgentDisputesCount,
  interventionRequestsCount,
}: AdminOverviewInput): AdminOverviewItem[] => [
  {
    label: "შესამოწმებელი",
    value: pendingVerificationCount,
    hint: "ხელოსნის დოკუმენტები",
    tabId: "verification",
    permission: "verification",
    color: pendingVerificationCount ? "#c2410c" : "#64748b",
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
  pendingVerificationCount,
  openDisputesCount,
  interventionRequestsCount,
}: AdminOverviewInput): AdminOverviewItem[] => [
  {
    label:
      pendingVerificationCount
        ? "ხელოსნის დოკუმენტები შესამოწმებელია"
        : "ვერიფიკაციის რიგი ცარიელია",
    value: pendingVerificationCount,
    color: pendingVerificationCount ? "#c2410c" : "#64748b",
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
