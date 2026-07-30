import { bookingStatusPriority } from "./adminQaConfig";
import {
  isActiveStatus,
  isClosedStatus,
  matchesQuery,
} from "./adminUtils";
import type { AdminStatusFilter } from "./adminTypes";
import type { CraftsmanBookingRequest } from "../../services/dataService";
import type { Booking } from "../../screens/BookingsScreen";

interface AdminBookingsModelInput {
  requests: CraftsmanBookingRequest[];
  clientBookings: Booking[];
  adminQuery: string;
  statusFilter: AdminStatusFilter;
}

const requestMatchesStatus = (
  statusFilter: AdminStatusFilter,
  request: CraftsmanBookingRequest
) =>
  statusFilter === "all" ||
  (statusFilter === "active" && isActiveStatus(request.status)) ||
  (statusFilter === "closed" && isClosedStatus(request.status)) ||
  (statusFilter === "problem" && request.status === "disputed");

const bookingMatchesStatus = (
  statusFilter: AdminStatusFilter,
  booking: Booking
) =>
  statusFilter === "all" ||
  (statusFilter === "active" && isActiveStatus(booking.status)) ||
  (statusFilter === "closed" && isClosedStatus(booking.status)) ||
  (statusFilter === "problem" &&
    (booking.status === "disputed" || booking.paymentStatus === "disputed"));

export const getAdminBookingsModel = ({
  requests,
  clientBookings,
  adminQuery,
  statusFilter,
}: AdminBookingsModelInput) => {
  const filteredRequests = requests
    .filter(
      (request) =>
        requestMatchesStatus(statusFilter, request) &&
        matchesQuery(adminQuery, [
          request.clientName,
          request.clientPhone,
          request.service,
          request.address,
          request.date,
          request.time,
          request.status,
          request.cancellationReason,
          request.disputeReason,
          request.adminNote,
        ])
    )
    .sort((a, b) => {
      const priority =
        bookingStatusPriority[b.status] - bookingStatusPriority[a.status];
      if (priority) return priority;
      return `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);
    });

  const filteredClientBookings = clientBookings.filter(
    (booking) =>
      bookingMatchesStatus(statusFilter, booking) &&
      matchesQuery(adminQuery, [
        booking.worker.name,
        booking.worker.role,
        booking.dateLabel,
        booking.time,
        booking.status,
        booking.paymentStatus,
        booking.adminNote,
        booking.id,
      ])
  );

  const getLinkedClientBooking = (bookingId: string) =>
    clientBookings.find((booking) => booking.id === bookingId);

  const needsAdminIntervention = (request: CraftsmanBookingRequest) => {
    const linkedBooking = getLinkedClientBooking(request.id);
    return (
      request.status === "disputed" ||
      linkedBooking?.status === "disputed" ||
      linkedBooking?.paymentStatus === "disputed" ||
      Boolean(request.disputeReason || request.cancellationReason)
    );
  };

  const interventionRequests = filteredRequests.filter(needsAdminIntervention);
  const visibleRegularRequests = filteredRequests.filter(
    (request) => !needsAdminIntervention(request)
  );

  return {
    filteredRequests,
    filteredClientBookings,
    getLinkedClientBooking,
    needsAdminIntervention,
    interventionRequests,
    visibleRegularRequests,
  };
};
