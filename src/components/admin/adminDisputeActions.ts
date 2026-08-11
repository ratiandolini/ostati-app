import type { AdminDisputeResolution } from "../../services/adminApiService";
import type { AdminAuditLog } from "../../services/dataService";

export const getDisputeResolutionConfirmMessage = (
  resolution: AdminDisputeResolution
) => {
  if (resolution === "refund_client") {
    return "დავა დაიხუროს და თანხა კლიენტს დაუბრუნდეს?";
  }
  if (resolution === "release_worker") {
    return "დავა დაიხუროს და თანხა ხელოსანზე გაიშვას?";
  }
  return "დავა დაიხუროს მხოლოდ Admin გაფრთხილებით?";
};

export const getDisputeResolutionText = (
  resolution: AdminDisputeResolution
) => {
  if (resolution === "refund_client") return "თანხა კლიენტს დაუბრუნდა";
  if (resolution === "release_worker") return "თანხა ხელოსანზე გაიშვა";
  return "დავა დაიხურა გაფრთხილებით";
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
