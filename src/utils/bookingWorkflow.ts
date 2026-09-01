import type { BookingStatus } from "../types";

type WorkflowRole = "client" | "craftsman" | "admin";

const transitions: Partial<Record<BookingStatus, BookingStatus[]>> = {
  pending: ["confirmed", "declined", "cancelled", "disputed"],
  confirmed: ["en_route", "started", "cancelled", "disputed"],
  en_route: ["started", "cancelled", "disputed"],
  started: ["worker_completed", "cancelled", "disputed"],
  worker_completed: ["client_confirmed", "disputed"],
  client_confirmed: ["closed", "disputed"],
  disputed: ["closed", "cancelled"],
};

const allowedByRole: Record<WorkflowRole, BookingStatus[]> = {
  client: ["client_confirmed", "cancelled", "disputed"],
  craftsman: [
    "confirmed",
    "declined",
    "en_route",
    "started",
    "worker_completed",
    "cancelled",
  ],
  admin: [
    "confirmed",
    "declined",
    "en_route",
    "started",
    "worker_completed",
    "client_confirmed",
    "closed",
    "cancelled",
    "disputed",
  ],
};

export const canChangeBookingStatus = (
  role: WorkflowRole,
  currentStatus: BookingStatus | undefined,
  nextStatus: BookingStatus
) => {
  if (!currentStatus || currentStatus === nextStatus) return false;
  return (
    allowedByRole[role].includes(nextStatus) &&
    (transitions[currentStatus] || []).includes(nextStatus)
  );
};

export const bookingStatusTransitionError = (role: WorkflowRole) =>
  role === "client"
    ? "ამ ეტაპზე ეს მოქმედება კლიენტისთვის ხელმისაწვდომი აღარ არის. განაახლეთ ჯავშანი."
    : "ამ ჯავშნის სტატუსი უკვე შეიცვალა. განაახლეთ საქმეების სია და სცადეთ ხელახლა.";
