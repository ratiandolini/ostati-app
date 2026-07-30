import { auditLabel } from "./adminLabels";
import { matchesQuery } from "./adminUtils";
import type { AdminStatusFilter } from "./adminTypes";
import type { AdminAuditLog } from "../../services/dataService";

const activeAuditExclusions: AdminAuditLog["action"][] = [
  "booking_refunded",
  "dispute_refunded",
  "verification_rejected",
];

const closedAuditActions: AdminAuditLog["action"][] = [
  "booking_closed",
  "dispute_released",
];

const problemAuditActions: AdminAuditLog["action"][] = [
  "booking_refunded",
  "dispute_refunded",
  "dispute_reviewing",
  "verification_rejected",
];

const auditMatchesStatus = (
  statusFilter: AdminStatusFilter,
  action: AdminAuditLog["action"]
) =>
  statusFilter === "all" ||
  (statusFilter === "active" && !activeAuditExclusions.includes(action)) ||
  (statusFilter === "closed" && closedAuditActions.includes(action)) ||
  (statusFilter === "problem" && problemAuditActions.includes(action));

interface AdminAuditModelInput {
  auditLogs: AdminAuditLog[];
  adminQuery: string;
  statusFilter: AdminStatusFilter;
}

export const getAdminAuditModel = ({
  auditLogs,
  adminQuery,
  statusFilter,
}: AdminAuditModelInput) => ({
  filteredAuditLogs: auditLogs.filter(
    (log) =>
      auditMatchesStatus(statusFilter, log.action) &&
      matchesQuery(adminQuery, [
        auditLabel[log.action],
        log.summary,
        log.target,
        log.adminName,
      ])
  ),
});
