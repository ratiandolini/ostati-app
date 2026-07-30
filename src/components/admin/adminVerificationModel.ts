import { deriveVerificationStatus, matchesQuery } from "./adminUtils";
import type { VerificationFilter } from "./adminTypes";
import type { AdminVerificationItem } from "../../services/adminApiService";
import type { CraftsmanProfile } from "../../services/dataService";

interface AdminVerificationModelInput {
  verificationQueue: AdminVerificationItem[];
  selectedVerificationWorkerId: string;
  verificationFilter: VerificationFilter;
  adminQuery: string;
  profile: CraftsmanProfile;
}

export const getAdminVerificationModel = ({
  verificationQueue,
  selectedVerificationWorkerId,
  verificationFilter,
  adminQuery,
  profile,
}: AdminVerificationModelInput) => {
  const verificationTarget =
    verificationQueue.find(
      (item) => item.workerId === selectedVerificationWorkerId
    ) ??
    verificationQueue.find((item) => item.verificationStatus === "pending") ??
    verificationQueue[0];

  const filteredVerificationQueue = verificationQueue.filter((item) => {
    const statusMatched =
      verificationFilter === "all" ||
      item.verificationStatus === verificationFilter;
    return (
      statusMatched &&
      matchesQuery(adminQuery, [
        item.name,
        item.phone,
        item.city || "",
        item.verificationStatus,
      ])
    );
  });

  const verificationStatus = verificationTarget
    ? verificationTarget.verificationStatus === "not_started"
      ? "not_submitted"
      : verificationTarget.verificationStatus
    : deriveVerificationStatus(profile);

  const verificationDocuments = verificationTarget
    ? {
        idFront: verificationTarget.documents.idFront || undefined,
        idBack: verificationTarget.documents.idBack || undefined,
        bankAccount: verificationTarget.documents.bankAccount || undefined,
      }
    : profile.verificationDocuments || {};

  const verification = verificationTarget
    ? {
        idFront: Boolean(verificationDocuments.idFront),
        idBack: Boolean(verificationDocuments.idBack),
        bankAccount: Boolean(verificationDocuments.bankAccount),
      }
    : profile.verification || {
        idFront: false,
        idBack: false,
        bankAccount: false,
      };

  return {
    verificationTarget,
    filteredVerificationQueue,
    verificationStatus,
    verificationDocuments,
    verification,
    uploadedDocumentCount: Object.values(verification).filter(Boolean).length,
  };
};
