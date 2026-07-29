import {
  getSupabaseAccessToken,
  getSupabaseUserId,
} from "./supabaseAuthService";
import { getSupabaseConfig } from "./supabaseConfig";

export type StorageBucket =
  | "profile-photos"
  | "verification-documents"
  | "booking-photos"
  | "worker-portfolio"
  | "chat-attachments";

interface UploadStorageFileOptions {
  bucket: StorageBucket;
  file: File;
  path: string;
  upsert?: boolean;
}

const normalizePath = (path: string) =>
  path
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/");

const fileExtension = (file: File) => {
  const fromName = file.name.split(".").pop();
  if (fromName && fromName !== file.name) return fromName.toLowerCase();

  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "application/pdf") return "pdf";
  return "bin";
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getSignedUrlFromResponse = (value: unknown) => {
  if (!isRecord(value)) return "";
  if (typeof value.signedURL === "string") return value.signedURL;
  if (typeof value.signedUrl === "string") return value.signedUrl;
  return "";
};

export const createStoragePath = (
  folder: string,
  file: File,
  label = "file"
) => {
  const safeLabel = label.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const userFolder = getSupabaseUserId() || "anonymous";
  return normalizePath(
    `${userFolder}/${folder}/${safeLabel}-${Date.now()}.${fileExtension(file)}`
  );
};

export const getPublicStorageUrl = (bucket: StorageBucket, path: string) => {
  const config = getSupabaseConfig();
  return `${config.url}/storage/v1/object/public/${bucket}/${normalizePath(path)}`;
};

export const extractStoragePath = (bucket: StorageBucket, value: string) => {
  const cleanValue = value.trim();
  if (!cleanValue) return "";
  if (cleanValue.startsWith("data:")) return cleanValue;
  const publicMarker = `/storage/v1/object/public/${bucket}/`;
  const signedMarker = `/storage/v1/object/sign/${bucket}/`;
  const marker = cleanValue.includes(publicMarker) ? publicMarker : signedMarker;
  const markerIndex = cleanValue.indexOf(marker);
  if (markerIndex >= 0) {
    return normalizePath(
      decodeURIComponent(
        cleanValue
          .slice(markerIndex + marker.length)
          .split("?")[0]
      )
    );
  }
  return normalizePath(cleanValue);
};

export const createSignedStorageUrl = async (
  bucket: StorageBucket,
  pathOrUrl: string,
  expiresInSeconds = 60 * 15
) => {
  const config = getSupabaseConfig();
  const accessToken = getSupabaseAccessToken();
  const cleanPath = extractStoragePath(bucket, pathOrUrl);

  if (!cleanPath || cleanPath.startsWith("data:")) return cleanPath;
  if (!accessToken) {
    throw new Error("Supabase session is required before opening private files.");
  }

  const response = await fetch(
    `${config.url}/storage/v1/object/sign/${bucket}/${cleanPath}`,
    {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: expiresInSeconds }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Supabase signed URL failed with ${response.status}: ${
        body || response.statusText
      }`
    );
  }

  const data: unknown = await response.json();
  const signedPath = getSignedUrlFromResponse(data);
  if (!signedPath) throw new Error("Supabase signed URL response was empty.");
  return signedPath.startsWith("http")
    ? signedPath
    : `${config.url}/storage/v1${signedPath}`;
};

export const uploadStorageFile = async ({
  bucket,
  file,
  path,
  upsert = true,
}: UploadStorageFileOptions) => {
  const config = getSupabaseConfig();
  const accessToken = getSupabaseAccessToken();

  if (!accessToken) {
    throw new Error("Supabase session is required before uploading files.");
  }

  const cleanPath = normalizePath(path);
  const response = await fetch(
    `${config.url}/storage/v1/object/${bucket}/${cleanPath}`,
    {
      method: "POST",
      body: file,
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": upsert ? "true" : "false",
      },
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Supabase storage upload failed with ${response.status}: ${
        body || response.statusText
      }`
    );
  }

  return {
    bucket,
    path: cleanPath,
    publicUrl:
      bucket === "profile-photos" ||
      bucket === "worker-portfolio"
        ? getPublicStorageUrl(bucket, cleanPath)
        : null,
  };
};
