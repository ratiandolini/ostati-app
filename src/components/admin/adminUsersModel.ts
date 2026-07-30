import {
  isActiveStatus,
  isClosedStatus,
  matchesQuery,
} from "./adminUtils";
import type { AdminStatusFilter } from "./adminTypes";
import type { AdminUserSummary } from "../../services/adminApiService";
import type {
  ClientProfile,
  CraftsmanBookingRequest,
  PlatformSettings,
} from "../../services/dataService";
import type { Booking } from "../../screens/BookingsScreen";

interface AdminUserDirectoryInput {
  adminUsersState: AdminUserSummary[] | null;
  requests: CraftsmanBookingRequest[];
  adminQuery: string;
  statusFilter: AdminStatusFilter;
  getClientProfile: (phone: string) => ClientProfile;
}

const accountStatusMatches = (
  statusFilter: AdminStatusFilter,
  status: "active" | "limited" | "blocked" | "pending"
) =>
  statusFilter === "all" ||
  (statusFilter === "active" && status === "active") ||
  (statusFilter === "closed" && status === "blocked") ||
  (statusFilter === "problem" && status !== "active");

export const getAdminUserDirectory = ({
  adminUsersState,
  requests,
  adminQuery,
  statusFilter,
  getClientProfile,
}: AdminUserDirectoryInput) => {
  const adminClients = (adminUsersState || []).filter(
    (item) => item.role === "client"
  );
  const adminCraftsmen = (adminUsersState || []).filter(
    (item) => item.role === "craftsman"
  );
  const clients = Array.from(
    new Set(requests.map((request) => request.clientPhone).filter(Boolean))
  ) as string[];

  const filteredClients = clients.filter((phone) => {
    const client = getClientProfile(phone);
    const status = client.accountStatus || "active";
    return (
      accountStatusMatches(statusFilter, status) &&
      matchesQuery(adminQuery, [
        phone,
        client.firstName,
        client.lastName,
        client.city,
        client.address,
        status,
        client.adminNote,
      ])
    );
  });

  const filteredAdminClients = adminClients.filter((client) => {
    return (
      accountStatusMatches(statusFilter, client.status) &&
      matchesQuery(adminQuery, [
        client.phone,
        client.firstName || "",
        client.lastName || "",
        client.city || "",
        client.status,
      ])
    );
  });

  const filteredAdminCraftsmen = adminCraftsmen.filter((craftsman) => {
    const statusMatched =
      statusFilter === "all" ||
      (statusFilter === "active" && craftsman.status === "active") ||
      (statusFilter === "closed" && craftsman.status === "blocked") ||
      (statusFilter === "problem" &&
        (craftsman.status !== "active" ||
          craftsman.verificationStatus !== "verified"));
    return (
      statusMatched &&
      matchesQuery(adminQuery, [
        craftsman.phone,
        craftsman.firstName || "",
        craftsman.lastName || "",
        craftsman.city || "",
        craftsman.workerRole || "",
        craftsman.status,
        craftsman.verificationStatus || "",
      ])
    );
  });

  return {
    adminClients,
    adminCraftsmen,
    clients,
    filteredClients,
    filteredAdminClients,
    filteredAdminCraftsmen,
  };
};

interface UserStatsInput {
  requests: CraftsmanBookingRequest[];
  clientBookings: Booking[];
  platformSettings: PlatformSettings;
}

export const getCraftsmanUserStats = ({
  requests,
  clientBookings,
  platformSettings,
}: UserStatsInput) => ({
  total: requests.length,
  active: requests.filter((request) => isActiveStatus(request.status)).length,
  disputed: requests.filter((request) => request.status === "disputed").length,
  cancelled: requests.filter((request) => request.status === "cancelled").length,
  completed: requests.filter((request) => isClosedStatus(request.status)).length,
  amount: clientBookings.reduce(
    (sum, booking) => sum + (booking.bookingFee || platformSettings.bookingFee),
    0
  ),
});

export const getClientUserStats = (
  phone: string,
  { requests, clientBookings, platformSettings }: UserStatsInput
) => {
  const clientRequests = requests.filter(
    (request) => request.clientPhone === phone
  );
  const requestIds = new Set(clientRequests.map((request) => request.id));
  const relatedBookings = clientBookings.filter((booking) =>
    requestIds.has(booking.id)
  );
  const lastRequest = [...clientRequests].sort((a, b) =>
    `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)
  )[0];
  return {
    total: clientRequests.length,
    active: clientRequests.filter((request) => isActiveStatus(request.status))
      .length,
    disputed: clientRequests.filter((request) => request.status === "disputed")
      .length,
    cancelled: clientRequests.filter((request) => request.status === "cancelled")
      .length,
    completed: clientRequests.filter((request) => isClosedStatus(request.status))
      .length,
    amount: relatedBookings.reduce(
      (sum, booking) => sum + (booking.bookingFee || platformSettings.bookingFee),
      0
    ),
    lastActivity: lastRequest
      ? `${lastRequest.date} · ${lastRequest.time}`
      : "აქტივობა არ არის",
  };
};
