import type { BookingStatus } from "../../types";
import type {
  AdminAuditLog,
  ClientProfile,
  CraftsmanProfile,
} from "../../services/dataService";

export const statusLabel: Record<BookingStatus, string> = {
  pending: "მოლოდინში",
  confirmed: "დადასტურებული",
  en_route: "გზაშია",
  started: "დაიწყო",
  worker_completed: "ხელოსანმა დაასრულა",
  client_confirmed: "დადასტურდა კლიენტით",
  closed: "დახურული",
  completed: "შესრულებული",
  declined: "უარყოფილი",
  cancelled: "გაუქმებული",
  disputed: "დავა გახსნილია",
};

export const verificationLabel: Record<
  NonNullable<CraftsmanProfile["verificationStatus"]>,
  string
> = {
  not_submitted: "არ არის გამოგზავნილი",
  pending: "შესამოწმებელია",
  verified: "ვერიფიცირებული",
  rejected: "უარყოფილი",
};

export const accountLabel: Record<
  NonNullable<ClientProfile["accountStatus"]>,
  string
> = {
  active: "აქტიური",
  limited: "შეზღუდული",
  blocked: "დაბლოკილი",
};

export const auditLabel: Record<AdminAuditLog["action"], string> = {
  verification_approved: "ვერიფიკაცია დადასტურდა",
  verification_rejected: "ვერიფიკაცია უარყოფილია",
  dispute_reviewing: "დავა გადავიდა განხილვაში",
  dispute_refunded: "დავა დაიხურა თანხის დაბრუნებით",
  dispute_released: "დავა დაიხურა ხელოსანზე თანხის გაშვებით",
  dispute_warning: "დავა დაიხურა გაფრთხილებით",
  booking_closed: "ჯავშანი დაიხურა",
  booking_refunded: "ჯავშანი გაუქმდა და თანხა დაბრუნდა",
  payment_captured: "თანხა დადასტურდა",
  payment_status_changed: "თანხის სტატუსი შეიცვალა",
  platform_settings_updated: "პლატფორმის პარამეტრები შეიცვალა",
  admin_member_updated: "Admin წევრი შეიცვალა",
  launch_checklist_updated: "Launch checklist შეიცვალა",
  client_status_changed: "კლიენტის სტატუსი შეიცვალა",
  craftsman_status_changed: "ხელოსნის სტატუსი შეიცვალა",
};
