import type { AdminDisputeResolution } from "../../services/adminApiService";
import type { AdminAuditLog } from "../../services/dataService";

export const getDisputeResolutionConfirmMessage = (
  resolution: AdminDisputeResolution
) => {
  if (resolution === "refund_client") {
    return "დავა დაიხუროს კლიენტისთვის თანხის დაბრუნებით?";
  }
  if (resolution === "release_worker") {
    return "დავა დაიხუროს ხელოსანზე თანხის გაშვებით?";
  }
  return "დავა დაიხუროს გაფრთხილებით?";
};

export const getDisputeResolutionText = (
  resolution: AdminDisputeResolution
) => {
  if (resolution === "refund_client") return "თანხა კლიენტს უბრუნდება";
  if (resolution === "release_worker") return "თანხა ხელოსანზე გადადის";
  return "დავა გაფრთხილებით დაიხურა";
};

export const getDisputeAuditAction = (
  resolution: AdminDisputeResolution
): AdminAuditLog["action"] => {
  if (resolution === "refund_client") return "dispute_refunded";
  if (resolution === "release_worker") return "dispute_released";
  return "dispute_warning";
};

export const needsFinanceForDisputeResolution = (
  resolution: AdminDisputeResolution
) => resolution === "refund_client" || resolution === "release_worker";

export const getDisputeNotificationText = (
  resolutionText: string,
  note: string
) =>
  `დავის გადაწყვეტილება: ${resolutionText}${note ? `. Admin ჩანაწერი: ${note}` : ""}`;
