import type { Worker } from "../types";
import type { BookingStatus } from "../types";
import type { BookingDetails } from "../screens/ProfileScreen";
import type { Booking } from "../screens/BookingsScreen";
import type { CraftsmanBookingRequest } from "./appStorage";
import { reportApiError } from "./apiErrorUtils";
import { createSupabaseRestClient } from "./supabaseRest";
import {
  createSignedStorageUrl,
  createStoragePath,
  extractStoragePath,
  uploadStorageFile,
} from "./supabaseStorageService";
import { formatGeorgianDate, formatGeorgianTime } from "../utils/georgianDate";

interface CreateBookingPayload {
  worker: Worker;
  scheduledAt: string;
  city?: string;
  addressText?: string;
  details: BookingDetails;
}

interface ApiBookingDetails {
  area?: number | string | null;
  height?: number | string | null;
  length?: number | string | null;
  rooms?: number | string | null;
  wall_condition?: string | null;
  target_surface?: string | null;
  material_owner?: string | null;
  plumbing_type?: string | null;
  floor?: number | string | null;
  electric_points?: number | string | null;
  electric_panel?: string | null;
  is_emergency?: boolean | null;
  work_scope?: string | null;
  surface_type?: string | null;
  material_note?: string | null;
  item_count?: string | null;
  current_condition?: string | null;
  photo_note?: string | null;
  site_photo?: string | null;
  uploaded_photo_url?: string | null;
  roof_type?: string | null;
  extra_measurements?: { text?: string } | null;
}

interface ApiClientBooking {
  id: string;
  scheduled_at: string;
  status: BookingStatus;
  city?: string | null;
  address_text?: string | null;
  client_comment?: string | null;
  cancellation_reason?: string | null;
  booking_fee_amount?: number | string | null;
  payment_status?: "not_required" | "authorized" | "captured" | "refunded" | "failed";
  payment_provider?: string | null;
  payment_currency?: string | null;
  payment_transaction_id?: string | null;
  active_dispute?: {
    reason?: string | null;
    details?: string | null;
    evidence?: Booking["disputeEvidence"] | null;
    status?: Booking["disputeStatus"] | null;
    resolution?: Booking["disputeResolution"] | null;
  } | null;
  worker: {
    id: string;
    name?: string | null;
    role?: string | null;
    avatar_url?: string | null;
    rating_avg?: number | string | null;
    rating_count?: number | null;
    city?: string | null;
    about?: string | null;
    price_type?: "fixed" | "from" | "range" | null;
    price_min?: number | string | null;
    price_max?: number | string | null;
    skills?: string[] | null;
    verification_status?: "not_started" | "pending" | "verified" | "rejected" | null;
  };
  details?: ApiBookingDetails | null;
}

interface ApiWorkerBooking {
  id: string;
  scheduled_at: string;
  status: BookingStatus;
  city?: string | null;
  address_text?: string | null;
  client_comment?: string | null;
  cancellation_reason?: string | null;
  booking_fee_amount?: number | string | null;
  payment_status?: string | null;
  payment_provider?: string | null;
  payment_currency?: string | null;
  payment_transaction_id?: string | null;
  active_dispute?: {
    reason?: string | null;
    details?: string | null;
    evidence?: CraftsmanBookingRequest["disputeEvidence"] | null;
    status?: CraftsmanBookingRequest["disputeStatus"] | null;
    resolution?: CraftsmanBookingRequest["disputeResolution"] | null;
  } | null;
  profession_name?: string | null;
  client: {
    first_name?: string | null;
    last_initial?: string | null;
  };
  details?: ApiBookingDetails | null;
}

const optionalNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && value.trim() ? parsed : null;
};

const optionalBoolean = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (["კი", "yes", "true", "1"].includes(normalized)) return true;
  if (["არა", "no", "false", "0"].includes(normalized)) return false;
  return null;
};

const materialOwner = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.includes("კლიენტ") || normalized.includes("ჩემი")) return "client";
  if (normalized.includes("ხელოს")) return "worker";
  return "unknown";
};

const stableNumberId = (id: string) =>
  id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);

const initialsFromName = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

const formatDateLabel = (value: string) => formatGeorgianDate(value);

const formatTime = (value: string) => formatGeorgianTime(value);

const formatPrice = (
  type?: "fixed" | "from" | "range" | null,
  min?: number | string | null,
  max?: number | string | null
) => {
  const minValue = min == null ? null : Number(min);
  const maxValue = max == null ? null : Number(max);

  if (!minValue) return "ფასი შეთანხმებით";
  if (type === "range" && maxValue) return `${minValue}-${maxValue} ლარი`;
  if (type === "fixed") return `${minValue} ლარი`;
  return `${minValue} ლარიდან`;
};

const textValue = (value: unknown) =>
  value === null || value === undefined ? "" : String(value);

const dataUrlToFile = async (dataUrl: string, name: string) => {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const extension = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
  return new File([blob], `${name}.${extension}`, {
    type: blob.type || "image/jpeg",
  });
};

const mapDetails = (details?: ApiBookingDetails | null): BookingDetails => ({
  comment: "",
  visitAddress: "",
  area: textValue(details?.area),
  height: textValue(details?.height),
  length: textValue(details?.length),
  rooms: textValue(details?.rooms),
  extraMeasurements: textValue(details?.extra_measurements?.text),
  wallCondition: textValue(details?.wall_condition),
  targetSurface: textValue(details?.target_surface),
  materialOwner: textValue(details?.material_owner),
  plumbingType: textValue(details?.plumbing_type),
  floor: textValue(details?.floor),
  electricPoints: textValue(details?.electric_points),
  electricPanel: textValue(details?.electric_panel),
  isEmergency:
    details?.is_emergency === null || details?.is_emergency === undefined
      ? ""
      : details.is_emergency
        ? "კი"
        : "არა",
  workScope: textValue(details?.work_scope),
  surfaceType: textValue(details?.surface_type),
  materialNote: textValue(details?.material_note),
  itemCount: textValue(details?.item_count),
  currentCondition: textValue(details?.current_condition),
  photoNote: textValue(details?.photo_note),
  sitePhoto: textValue(details?.site_photo || details?.uploaded_photo_url),
  roofType: textValue(details?.roof_type),
});

const mapPaymentStatus = (
  status?: ApiClientBooking["payment_status"]
): Booking["paymentStatus"] => {
  if (status === "captured") return "released";
  if (status === "refunded") return "refunded";
  if (status === "failed") return "disputed";
  return "held";
};

const isLateCancellationReason = (reason?: string | null) =>
  Boolean(
    reason &&
      (reason.includes("დაგვიანებული გაუქმება") ||
        reason.includes("გადასამოწმებელია"))
  );

const mapClientBooking = (booking: ApiClientBooking): Booking => {
  const workerName = booking.worker.name || "ხელოსანი";
  const scheduled = new Date(booking.scheduled_at);
  return {
    id: booking.id,
    worker: {
      id: stableNumberId(booking.worker.id),
      backendId: booking.worker.id,
      // A booking can only be created for a verified worker. Older booking RPC
      // responses may omit this field, so keep the historical booking clickable.
      verificationStatus: booking.worker.verification_status || "verified",
      name: workerName,
      role: booking.worker.role || "ხელოსანი",
      avatar: booking.worker.avatar_url || initialsFromName(workerName),
      avatarColor: "#17243a",
      exp: 0,
      rating: Number(booking.worker.rating_avg || 0),
      reviewCount: booking.worker.rating_count || 0,
      status: "free",
      city: booking.worker.city || booking.city || "თბილისი",
      phone: "",
      about: booking.worker.about || "",
      price: formatPrice(
        booking.worker.price_type,
        booking.worker.price_min,
        booking.worker.price_max
      ),
      skills: booking.worker.skills || [booking.worker.role || "ხელოსანი"],
      busyDays: [],
      reviews: [],
    },
    day: scheduled.getDate(),
    time: formatTime(booking.scheduled_at),
    dateLabel: formatDateLabel(booking.scheduled_at),
    details: {
      ...mapDetails(booking.details),
      scheduledAt: booking.scheduled_at,
      comment: booking.client_comment || "",
    },
    status: booking.status,
    bookingFee: Number(booking.booking_fee_amount || 0),
    paymentStatus: mapPaymentStatus(booking.payment_status),
    paymentProvider: booking.payment_provider || undefined,
    paymentCurrency: booking.payment_currency || "GEL",
    paymentTransactionId: booking.payment_transaction_id || undefined,
    disputeReason: booking.active_dispute?.reason || undefined,
    disputeDetails: booking.active_dispute?.details || undefined,
    disputeStatus: booking.active_dispute?.status || undefined,
    disputeResolution: booking.active_dispute?.resolution || undefined,
    disputeEvidence: booking.active_dispute?.evidence || undefined,
    cancellationReason: booking.cancellation_reason || undefined,
    cancellationPolicy: isLateCancellationReason(booking.cancellation_reason)
      ? "late_review"
      : booking.cancellation_reason
        ? "free"
        : undefined,
  };
};

const mapWorkerBooking = (
  booking: ApiWorkerBooking
): CraftsmanBookingRequest => ({
  id: booking.id,
  clientName:
    [booking.client.first_name || "კლიენტი", booking.client.last_initial || ""]
      .join(" ")
      .trim() || "კლიენტი",
  date: formatDateLabel(booking.scheduled_at),
  time: formatTime(booking.scheduled_at),
  scheduledAt: booking.scheduled_at,
  address: booking.address_text || booking.city || "მისამართი დასაზუსტებელია",
  status: booking.status,
  cancellationReason: booking.cancellation_reason || undefined,
  bookingFee: Number(booking.booking_fee_amount || 0),
  paymentStatus: mapPaymentStatus(booking.payment_status as ApiClientBooking["payment_status"]),
  disputeReason: booking.active_dispute?.reason || undefined,
  disputeDetails: booking.active_dispute?.details || undefined,
  disputeStatus: booking.active_dispute?.status || undefined,
  disputeResolution: booking.active_dispute?.resolution || undefined,
  disputeEvidence: booking.active_dispute?.evidence || undefined,
  paymentProvider: booking.payment_provider || undefined,
  paymentCurrency: booking.payment_currency || "GEL",
  paymentTransactionId: booking.payment_transaction_id || undefined,
  service: booking.profession_name || "ხელოსანი",
  comment: booking.client_comment || "",
  measurements: {
    area: textValue(booking.details?.area),
    height: textValue(booking.details?.height),
    length: textValue(booking.details?.length),
    rooms: textValue(booking.details?.rooms),
    extraMeasurements: textValue(booking.details?.extra_measurements?.text),
    wallCondition: textValue(booking.details?.wall_condition),
    targetSurface: textValue(booking.details?.target_surface),
    materialOwner: textValue(booking.details?.material_owner),
    plumbingType: textValue(booking.details?.plumbing_type),
    floor: textValue(booking.details?.floor),
    electricPoints: textValue(booking.details?.electric_points),
    electricPanel: textValue(booking.details?.electric_panel),
    isEmergency:
      booking.details?.is_emergency === null ||
      booking.details?.is_emergency === undefined
        ? ""
        : booking.details.is_emergency
          ? "კი"
          : "არა",
    workScope: textValue(booking.details?.work_scope),
    surfaceType: textValue(booking.details?.surface_type),
    materialNote: textValue(booking.details?.material_note),
    itemCount: textValue(booking.details?.item_count),
    currentCondition: textValue(booking.details?.current_condition),
    photoNote: textValue(booking.details?.photo_note),
    sitePhoto: textValue(
      booking.details?.site_photo || booking.details?.uploaded_photo_url
    ),
    roofType: textValue(booking.details?.roof_type),
  },
});

const signBookingPhoto = async (value: string) => {
  if (!value || value.startsWith("data:")) return value;
  try {
    return await createSignedStorageUrl("booking-photos", value);
  } catch (error) {
    reportApiError(error, { silentTransient: true });
    return value.startsWith("http") ? "" : extractStoragePath("booking-photos", value);
  }
};

const withSignedBookingPhoto = async (
  booking: CraftsmanBookingRequest
): Promise<CraftsmanBookingRequest> => {
  const sitePhoto =
    typeof booking.measurements?.sitePhoto === "string"
      ? booking.measurements.sitePhoto
      : "";
  if (!sitePhoto) return booking;
  return {
    ...booking,
    measurements: {
      ...booking.measurements,
      sitePhoto: await signBookingPhoto(sitePhoto),
    },
  };
};

const withSignedDisputeEvidence = async <
  T extends {
    disputeEvidence?: Array<{ name: string; url: string; type?: "image" | "file" }>;
  },
>(
  booking: T
): Promise<T> => {
  if (!booking.disputeEvidence?.length) return booking;
  const disputeEvidence = await Promise.all(
    booking.disputeEvidence.map(async (item) => {
      if (!item.url || item.url.startsWith("data:") || item.url.startsWith("http")) {
        return item;
      }
      try {
        return {
          ...item,
          url: await createSignedStorageUrl("booking-photos", item.url),
        };
      } catch {
        return item;
      }
    })
  );
  return { ...booking, disputeEvidence };
};

export const createBookingRequest = async ({
  worker,
  scheduledAt,
  city,
  addressText,
  details,
}: CreateBookingPayload) => {
  if (!worker.backendId) {
    throw new Error("Worker backendId is missing. Load workers from API mode first.");
  }

  const client = createSupabaseRestClient();

  return client.rpc<{ booking_id: string }>("create_booking_request", {
    p_worker_id: worker.backendId,
    p_profession_name: worker.role,
    p_scheduled_at: scheduledAt,
    p_city: city || worker.city,
    p_address_text: addressText || null,
    p_client_comment: details.comment || null,
    p_booking_fee_amount: 15,
    p_details: {
      area: optionalNumber(details.area),
      height: optionalNumber(details.height),
      length: optionalNumber(details.length),
      rooms: optionalNumber(details.rooms),
      wall_condition: details.wallCondition || null,
      target_surface: details.targetSurface || null,
      material_owner: materialOwner(details.materialOwner),
      plumbing_type: details.plumbingType || null,
      floor: optionalNumber(details.floor),
      electric_points: optionalNumber(details.electricPoints),
      electric_panel: details.electricPanel || null,
      is_emergency: optionalBoolean(details.isEmergency),
      work_scope: details.workScope || null,
      surface_type: details.surfaceType || null,
      material_note: details.materialNote || null,
      item_count: details.itemCount || null,
      current_condition: details.currentCondition || null,
      photo_note: details.photoNote || null,
      uploaded_photo_url: details.sitePhoto || null,
      roof_type: details.roofType || null,
      extra_measurements: details.extraMeasurements
        ? { text: details.extraMeasurements }
        : {},
    },
  });
};

export const uploadBookingSitePhoto = async (
  sitePhoto: string,
  workerId: string | number
) => {
  if (!sitePhoto || !sitePhoto.startsWith("data:image")) return sitePhoto;
  const file = await dataUrlToFile(sitePhoto, "booking-site-photo");
  const uploaded = await uploadStorageFile({
    bucket: "booking-photos",
    file,
    path: createStoragePath(`booking-site/${workerId}`, file, "site-photo"),
  });
  return uploaded.path;
};

export const loadClientBookings = async (
  signal?: AbortSignal
): Promise<Booking[]> => {
  const client = createSupabaseRestClient();
  const rows = await client.rpc<ApiClientBooking[]>(
    "list_my_client_bookings",
    {},
    { signal }
  );
  return Promise.all(rows.map((row) => withSignedDisputeEvidence(mapClientBooking(row))));
};

export const loadWorkerBookings = async (
  signal?: AbortSignal
): Promise<CraftsmanBookingRequest[]> => {
  const client = createSupabaseRestClient();
  const rows = await client.rpc<ApiWorkerBooking[]>(
    "list_my_worker_bookings",
    {},
    { signal }
  );
  return Promise.all(
    rows.map((row) =>
      withSignedBookingPhoto(mapWorkerBooking(row)).then(withSignedDisputeEvidence)
    )
  );
};

type ApiBookingStatus = Exclude<BookingStatus, "completed"> | "cancelled" | "disputed";

export const updateBookingStatus = async (
  bookingId: string,
  status: ApiBookingStatus,
  cancellationReason?: string
) => {
  const client = createSupabaseRestClient();

  return client.rpc<{ booking_id: string; status: ApiBookingStatus }>(
    "update_booking_status_action",
    {
      p_booking_id: bookingId,
      p_status: status,
      p_cancellation_reason: cancellationReason || null,
    }
  );
};

export const cancelBookingRequest = (
  bookingId: string,
  cancellationReason: string
) => {
  return updateBookingStatus(bookingId, "cancelled", cancellationReason);
};

export const changeBookingWorkerRequest = async (
  bookingId: string,
  worker: Worker,
  reason?: string
) => {
  if (!worker.backendId) {
    throw new Error("არჩეული ხელოსნის მონაცემები სრულად არ არის ჩატვირთული");
  }

  const client = createSupabaseRestClient();
  return client.rpc<{
    old_booking_id: string;
    new_booking_id: string;
    status: "pending";
  }>("change_my_booking_worker", {
    p_booking_id: bookingId,
    p_new_worker_id: worker.backendId,
    p_reason: reason || null,
  });
};

export const confirmBookingCompletion = (bookingId: string) => {
  return updateBookingStatus(bookingId, "client_confirmed");
};

export const captureBookingPayment = async (bookingId: string) => {
  const client = createSupabaseRestClient();
  return client.rpc<{
    booking_id: string;
    payment_id: string | null;
    status: "captured" | "not_required";
  }>("capture_booking_payment", {
    p_booking_id: bookingId,
  });
};

export const refundBookingPayment = async (
  bookingId: string,
  reason?: string
) => {
  const client = createSupabaseRestClient();
  return client.rpc<{
    booking_id: string;
    payment_id: string | null;
    status: "refunded" | "not_required";
  }>("refund_booking_payment", {
    p_booking_id: bookingId,
    p_reason: reason || null,
  });
};

export interface BookingPaymentSummary {
  booking_id: string;
  payment_id: string | null;
  amount: number | string;
  platform_fee_amount: number | string;
  worker_amount: number | string;
  currency: string;
  provider: string | null;
  provider_payment_id: string | null;
  status: "not_required" | "authorized" | "captured" | "refunded" | "failed";
  captured_at: string | null;
  refunded_at: string | null;
}

export const loadBookingPaymentSummary = async (bookingId: string) => {
  const client = createSupabaseRestClient();
  return client.rpc<BookingPaymentSummary>("get_booking_payment_summary", {
    p_booking_id: bookingId,
  });
};
