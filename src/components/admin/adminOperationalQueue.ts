import { money } from "./adminUtils";
import type { AdminTab } from "./adminPermissions";

export interface OperationalQueueItem {
  id: string;
  label: string;
  count: number;
  detail: string;
  tabId: AdminTab;
  priority: number;
  tone: string;
  bg: string;
}

interface AdminOperationalQueueInput {
  pendingVerificationCount: number;
  urgentDisputesCount: number;
  openDisputesCount: number;
  financeReviewCount: number;
  financeRefundCount: number;
  financeReleaseCount: number;
  lateCancellationPenaltyTotal: number;
  interventionRequestsCount: number;
}

export const getAdminOperationalQueue = ({
  pendingVerificationCount,
  urgentDisputesCount,
  openDisputesCount,
  financeReviewCount,
  financeRefundCount,
  financeReleaseCount,
  lateCancellationPenaltyTotal,
  interventionRequestsCount,
}: AdminOperationalQueueInput) => {
  const queue: OperationalQueueItem[] = [
    {
      id: "verification",
      label: "ვერიფიკაცია",
      count: pendingVerificationCount,
      detail: pendingVerificationCount
        ? "ხელოსნის დოკუმენტები ელოდება დადასტურებას"
        : "შესამოწმებელი ვერიფიკაცია არ არის",
      tabId: "verification",
      priority: pendingVerificationCount ? 3 : 0,
      tone: "#1d4ed8",
      bg: "#eff6ff",
    },
    {
      id: "urgent-disputes",
      label: "სასწრაფო დავები",
      count: urgentDisputesCount,
      detail: urgentDisputesCount
        ? "დავა 24 საათზე მეტია ღიაა ან განხილვას ითხოვს"
        : "ვადაგასული დავა არ არის",
      tabId: "disputes",
      priority: urgentDisputesCount ? 4 : 0,
      tone: "#b91c1c",
      bg: "#fef2f2",
    },
    {
      id: "open-disputes",
      label: "ღია დავები",
      count: openDisputesCount,
      detail: openDisputesCount
        ? "კლიენტის/ხელოსნის პრობლემა Admin-ის პასუხს ელოდება"
        : "ღია დავა არ არის",
      tabId: "disputes",
      priority: openDisputesCount ? 2 : 0,
      tone: "#c2410c",
      bg: "#fff7ed",
    },
    {
      id: "finance-review",
      label: "ფინანსური განხილვა",
      count: financeReviewCount + financeRefundCount + financeReleaseCount,
      detail: financeReviewCount
        ? `დაგვიანებული გაუქმება/დავა. სავარაუდო დაკავება ${money(
            lateCancellationPenaltyTotal
          )}`
        : financeRefundCount
          ? "თანხის დაბრუნების რიგია გადასახედი"
          : financeReleaseCount
            ? "დასრულებულ ჯავშანზე თანხა გასაშვებია"
            : "ფინანსური ჩარევა არ სჭირდება",
      tabId: "finance",
      priority:
        financeReviewCount || financeRefundCount || financeReleaseCount ? 3 : 0,
      tone: "#047857",
      bg: "#ecfdf5",
    },
    {
      id: "problem-bookings",
      label: "პრობლემური ჯავშნები",
      count: interventionRequestsCount,
      detail: interventionRequestsCount
        ? "გაუქმება, დავა ან Admin ჩანაწერი გადასაწყვეტია"
        : "ჯავშნების რიგი სუფთაა",
      tabId: "bookings",
      priority: interventionRequestsCount ? 2 : 0,
      tone: "#7c3aed",
      bg: "#f5f3ff",
    },
  ];
  queue.sort((a, b) => b.priority - a.priority || b.count - a.count);

  return {
    operationalQueue: queue,
    nextAdminAction: queue.find((item) => item.count > 0) || queue[0],
  };
};
