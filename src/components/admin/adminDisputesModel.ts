import {
  disputePriorityScore,
  matchesQuery,
} from "./adminUtils";
import type { DisputeView } from "./adminTypes";
import type { BookingDispute } from "../../services/dataService";

interface AdminDisputeModelInput {
  disputes: BookingDispute[];
  disputeView: DisputeView;
  adminQuery: string;
  selectedDisputeId: string;
}

const disputeMatchesQuery = (adminQuery: string, dispute: BookingDispute) =>
  matchesQuery(adminQuery, [
    dispute.reason,
    dispute.details,
    dispute.bookingId,
    dispute.status,
    dispute.resolution,
    dispute.adminNote,
    dispute.clientName,
    dispute.workerName,
    dispute.service,
  ]);

const disputeMatchesView = (disputeView: DisputeView, dispute: BookingDispute) =>
  (disputeView === "active" && dispute.status !== "resolved") ||
  (disputeView === "urgent" &&
    dispute.status !== "resolved" &&
    disputePriorityScore(dispute) >= 3) ||
  (disputeView === "reviewing" && dispute.status === "reviewing") ||
  (disputeView === "archive" && dispute.status === "resolved");

export const getAdminDisputeModel = ({
  disputes,
  disputeView,
  adminQuery,
  selectedDisputeId,
}: AdminDisputeModelInput) => {
  const activeDisputes = disputes.filter(
    (dispute) => dispute.status !== "resolved"
  );
  const reviewingDisputes = disputes.filter(
    (dispute) => dispute.status === "reviewing"
  );
  const archiveDisputes = disputes.filter(
    (dispute) => dispute.status === "resolved"
  );
  const disputeViewCounts: Record<DisputeView, number> = {
    active: activeDisputes.length,
    urgent: disputes.filter(
      (dispute) =>
        dispute.status !== "resolved" && disputePriorityScore(dispute) >= 3
    ).length,
    reviewing: reviewingDisputes.length,
    archive: archiveDisputes.length,
  };
  const filteredDisputes = disputes
    .filter(
      (dispute) =>
        disputeMatchesView(disputeView, dispute) &&
        disputeMatchesQuery(adminQuery, dispute)
    )
    .sort((a, b) => {
      const priority = disputePriorityScore(b) - disputePriorityScore(a);
      if (priority) return priority;
      return disputeView === "archive"
        ? new Date(b.resolvedAt || b.createdAt).getTime() -
            new Date(a.resolvedAt || a.createdAt).getTime()
        : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  const selectedDispute =
    filteredDisputes.find((dispute) => dispute.id === selectedDisputeId) ||
    filteredDisputes[0];

  return {
    activeDisputes,
    reviewingDisputes,
    archiveDisputes,
    disputeViewCounts,
    filteredDisputes,
    selectedDispute,
  };
};
