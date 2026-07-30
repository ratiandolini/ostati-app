import {
  createSignedStorageUrl,
  StorageBucket,
} from "../../services/supabaseStorageService";
import type { BookingDispute } from "../../services/dataService";

interface VerificationDocuments {
  idFront?: string;
  idBack?: string;
}

const resolveSignedUrl = async (bucket: StorageBucket, url: string) => {
  if (!url || url.startsWith("data:") || url.startsWith("http")) return url;
  return createSignedStorageUrl(bucket, url);
};

const entriesToRecord = (entries: Array<readonly [string, string]>) =>
  entries.reduce<Record<string, string>>((next, [key, value]) => {
    next[key] = value;
    return next;
  }, {});

export const loadVerificationSignedUrls = async (
  documents: VerificationDocuments
): Promise<Record<string, string>> => {
  const entries = await Promise.all(
    (["idFront", "idBack"] as const).map(async (key) => {
      const value = documents[key];
      if (!value) return [key, ""] as const;
      try {
        return [
          key,
          await resolveSignedUrl("verification-documents", value),
        ] as const;
      } catch (error) {
        console.error(error);
        return [key, ""] as const;
      }
    })
  );

  return entriesToRecord(entries);
};

export const loadDisputeEvidenceSignedUrls = async (
  disputes: BookingDispute[]
): Promise<Record<string, string>> => {
  const evidenceItems: Array<{ key: string; url: string }> = [];
  disputes.forEach((dispute) => {
    (dispute.evidence || []).forEach((item, index) => {
      evidenceItems.push({
        key: `${dispute.id}:${index}`,
        url: item.url,
      });
    });
  });

  const entries = await Promise.all(
    evidenceItems.map(async (item) => {
      try {
        return [
          item.key,
          await resolveSignedUrl("booking-photos", item.url),
        ] as const;
      } catch (error) {
        console.error(error);
        return [item.key, ""] as const;
      }
    })
  );

  return entriesToRecord(entries);
};
