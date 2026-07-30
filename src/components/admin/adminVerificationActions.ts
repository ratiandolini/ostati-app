import type {
  AdminVerificationStatus,
} from "../../services/adminApiService";
import type {
  AdminAuditLog,
  CraftsmanProfile,
} from "../../services/dataService";

export const getVerificationConfirmMessage = (
  status: AdminVerificationStatus
) =>
  status === "verified"
    ? "დარწმუნებული ხარ, რომ ხელოსნის ვერიფიკაცია უნდა დადასტურდეს?"
    : "დარწმუნებული ხარ, რომ ვერიფიკაცია უნდა უარყო?";

export const requiresVerificationNote = (status: AdminVerificationStatus) =>
  status === "rejected";

export const getVerificationAuditAction = (
  status: AdminVerificationStatus
): AdminAuditLog["action"] =>
  status === "verified" ? "verification_approved" : "verification_rejected";

export const applyVerificationStatusToProfile = (
  profile: CraftsmanProfile,
  status: AdminVerificationStatus,
  note: string
): CraftsmanProfile => ({
  ...profile,
  verificationStatus: status,
  verificationNote: note,
  adminNote: note || profile.adminNote,
  accountStatus: status === "verified" ? "active" : profile.accountStatus,
});
