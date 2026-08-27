import type {
  AdminAuditLog,
  AdminMember,
  BookingDispute,
  CraftsmanBookingRequest,
  LegalSettings,
  MobileQaScenario,
  PlatformSettings,
  PrePaymentChecklistItem,
} from "./appStorage";
import type { Booking } from "../screens/BookingsScreen";
import type { BookingDetails } from "../screens/ProfileScreen";
import type { BookingStatus } from "../types";
import { createSupabaseRestClient } from "./supabaseRest";
import { formatGeorgianDate, formatGeorgianTime } from "../utils/georgianDate";

interface ApiAuditLogRow {
  id: string;
  action: AdminAuditLog["action"];
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AdminLaunchState {
  platformSettings: PlatformSettings;
  legalSettings: LegalSettings;
  adminMembers: AdminMember[];
  prePaymentChecklist: PrePaymentChecklistItem[];
  mobileQaScenarios: MobileQaScenario[];
  verificationQueue: AdminVerificationItem[];
  auditLogs: AdminAuditLog[];
}

export interface CurrentAdminContext {
  appUser: {
    id: string;
    phone: string;
    firstName?: string | null;
    lastName?: string | null;
    status: string;
  };
  member: AdminMember & {
    linkedUserId?: string | null;
  };
}

export type AdminAccountRole = "client" | "craftsman";
export type AdminAccountStatus = "active" | "limited" | "blocked";
export type AdminBookingAction =
  | "close_release"
  | "cancel_refund"
  | "mark_disputed"
  | "hold_authorized";
export type AdminDisputeResolution =
  | "refund_client"
  | "release_worker"
  | "warning";
export type AdminVerificationStatus = "verified" | "rejected";

export interface AdminVerificationItem {
  workerId: string;
  userId: string;
  name: string;
  phone: string;
  photoUrl?: string | null;
  city?: string | null;
  verificationStatus: "not_started" | "pending" | "verified" | "rejected";
  accountStatus: "active" | "limited" | "blocked" | "pending";
  documents: {
    idFront?: string | null;
    idBack?: string | null;
    bankAccount?: string | null;
  };
  updatedAt: string;
}

export interface AdminUserSummary {
  id: string;
  role: "client" | "craftsman";
  firstName?: string | null;
  lastName?: string | null;
  phone: string;
  photoUrl?: string | null;
  city?: string | null;
  status: "active" | "limited" | "blocked" | "pending";
  ratingAvg: number;
  ratingCount: number;
  warningCount?: number;
  workerId?: string | null;
  workerRole?: string | null;
  verificationStatus?: "not_started" | "pending" | "verified" | "rejected" | null;
  isWorkerActive?: boolean | null;
  createdAt: string;
  lastLoginAt?: string | null;
  stats: {
    total: number;
    active: number;
    disputed: number;
    cancelled: number;
    completed: number;
    amount: number;
    lastActivity?: string | null;
  };
}

interface AdminLaunchStateRow
  extends Omit<AdminLaunchState, "auditLogs"> {
  auditLogs: ApiAuditLogRow[];
}

interface ApiAdminBookingRow {
  id: string;
  scheduled_at: string;
  updated_at?: string | null;
  status: BookingStatus;
  city?: string | null;
  address_text?: string | null;
  client_comment?: string | null;
  booking_fee_amount?: number | string | null;
  payment_status?: "not_required" | "authorized" | "captured" | "refunded" | "failed" | null;
  cancellation_reason?: string | null;
  client: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    last_initial?: string | null;
    phone?: string | null;
    rating_avg?: number | string | null;
    rating_count?: number | null;
    status?: string | null;
  };
  worker: {
    id: string;
    user_id?: string | null;
    name?: string | null;
    phone?: string | null;
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
  };
  active_dispute?: {
    id: string;
    reason?: string | null;
    details?: string | null;
    evidence?: BookingDispute["evidence"] | null;
    status?: BookingDispute["status"] | null;
    admin_note?: string | null;
    created_at?: string | null;
    resolved_at?: string | null;
  } | null;
  details?: ApiAdminBookingDetails | null;
}

interface ApiAdminBookingDetails {
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
  extra_measurements?: { text?: string } | null;
  uploaded_photo_url?: string | null;
}

interface ApiAdminDisputeRow {
  id: string;
  booking_id: string;
  reason?: string | null;
  details?: string | null;
  evidence?: BookingDispute["evidence"] | null;
  status: BookingDispute["status"];
  resolution?: BookingDispute["resolution"] | null;
  admin_note?: string | null;
  resolved_at?: string | null;
  created_at: string;
  booking?: {
    scheduled_at?: string | null;
    payment_status?: ApiAdminBookingRow["payment_status"];
    booking_fee_amount?: number | string | null;
    profession_name?: string | null;
  } | null;
  client?: {
    name?: string | null;
    phone?: string | null;
  } | null;
  worker?: {
    name?: string | null;
    phone?: string | null;
  } | null;
}

interface ApiAdminUserRow {
  id: string;
  role: "client" | "craftsman";
  first_name?: string | null;
  last_name?: string | null;
  phone: string;
  photo_url?: string | null;
  city?: string | null;
  status: "active" | "limited" | "blocked" | "pending";
  rating_avg?: number | string | null;
  rating_count?: number | null;
  warning_count?: number | null;
  worker_id?: string | null;
  worker_role?: string | null;
  verification_status?: "not_started" | "pending" | "verified" | "rejected" | null;
  is_worker_active?: boolean | null;
  created_at: string;
  last_login_at?: string | null;
  stats?: {
    total?: number | null;
    active?: number | null;
    disputed?: number | null;
    cancelled?: number | null;
    completed?: number | null;
    amount?: number | string | null;
    last_activity?: string | null;
  } | null;
}

const mapAuditLog = (row: ApiAuditLogRow): AdminAuditLog => ({
  id: row.id,
  action: row.action,
  target: row.entityId || row.entityType,
  summary:
    typeof row.metadata?.summary === "string"
      ? row.metadata.summary
      : row.entityType,
  adminName:
    typeof row.metadata?.adminName === "string"
      ? row.metadata.adminName
      : "Admin",
  createdAt: row.createdAt,
});

const mapLaunchState = (state: AdminLaunchStateRow): AdminLaunchState => ({
  ...state,
  verificationQueue: state.verificationQueue || [],
  auditLogs: (state.auditLogs || []).map(mapAuditLog),
});

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

const textValue = (value: unknown) =>
  value === null || value === undefined ? "" : String(value);

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

const mapAdminPaymentStatus = (
  status: ApiAdminBookingRow["payment_status"],
  bookingStatus: BookingStatus
): Booking["paymentStatus"] => {
  if (bookingStatus === "disputed") return "disputed";
  if (status === "captured") return "released";
  if (status === "refunded") return "refunded";
  if (status === "failed") return "disputed";
  return "held";
};

const mapAdminDetails = (
  details?: ApiAdminBookingDetails | null,
  booking?: ApiAdminBookingRow
): BookingDetails => ({
  comment: booking?.client_comment || "",
  visitAddress: booking?.address_text || "",
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
  workScope: "",
  surfaceType: "",
  materialNote: "",
  itemCount: "",
  currentCondition: "",
  photoNote: "",
  sitePhoto: textValue(details?.uploaded_photo_url),
  roofType: "",
});

const clientName = (client: ApiAdminBookingRow["client"]) =>
  [client.first_name || "კლიენტი", client.last_initial || ""]
    .join(" ")
    .trim() || "კლიენტი";

const mapAdminBookingToClientBooking = (booking: ApiAdminBookingRow): Booking => {
  const workerName = booking.worker.name || "ხელოსანი";
  const scheduled = new Date(booking.scheduled_at);
  return {
    id: booking.id,
    worker: {
      id: stableNumberId(booking.worker.id),
      backendId: booking.worker.id,
      name: workerName,
      role: booking.worker.role || "ხელოსანი",
      avatar: booking.worker.avatar_url || initialsFromName(workerName),
      avatarColor: "#17243a",
      exp: 0,
      rating: Number(booking.worker.rating_avg || 0),
      reviewCount: booking.worker.rating_count || 0,
      status: "free",
      city: booking.worker.city || booking.city || "თბილისი",
      phone: booking.worker.phone || "",
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
    details: mapAdminDetails(booking.details, booking),
    status: booking.status,
    bookingFee: Number(booking.booking_fee_amount || 0),
    paymentStatus: mapAdminPaymentStatus(booking.payment_status, booking.status),
    cancellationReason: booking.cancellation_reason || undefined,
    disputeReason: booking.active_dispute?.reason || undefined,
    disputeDetails: booking.active_dispute?.details || undefined,
    adminNote: booking.active_dispute?.admin_note || undefined,
  };
};

const mapAdminBookingToRequest = (
  booking: ApiAdminBookingRow
): CraftsmanBookingRequest => ({
  id: booking.id,
  clientName: clientName(booking.client),
  clientPhone: booking.client.phone || undefined,
  date: formatDateLabel(booking.scheduled_at),
  time: formatTime(booking.scheduled_at),
  statusUpdatedAt: booking.updated_at || undefined,
  address: booking.address_text || booking.city || "მისამართი დასაზუსტებელია",
  status: booking.status,
  service: booking.worker.role || "ხელოსანი",
  comment: booking.client_comment || "",
  cancellationReason: booking.cancellation_reason || undefined,
  disputeReason: booking.active_dispute?.reason || undefined,
  disputeDetails: booking.active_dispute?.details || undefined,
  adminNote: booking.active_dispute?.admin_note || undefined,
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
  },
});

const mapAdminDispute = (dispute: ApiAdminDisputeRow): BookingDispute => ({
  id: dispute.id,
  bookingId: dispute.booking_id,
  reason: dispute.reason || "დავა",
  details: dispute.details || "",
  clientName: dispute.client?.name || dispute.client?.phone || undefined,
  workerName: dispute.worker?.name || dispute.worker?.phone || undefined,
  service: dispute.booking?.profession_name || undefined,
  dateLabel: dispute.booking?.scheduled_at
    ? formatGeorgianDate(dispute.booking.scheduled_at)
    : undefined,
  time: dispute.booking?.scheduled_at
    ? formatGeorgianTime(dispute.booking.scheduled_at)
    : undefined,
  amount: Number(dispute.booking?.booking_fee_amount || 0) || undefined,
  paymentStatus: mapAdminPaymentStatus(
    dispute.booking?.payment_status,
    dispute.status === "open" || dispute.status === "reviewing"
      ? "disputed"
      : "closed"
  ),
  evidence: dispute.evidence || undefined,
  createdAt: dispute.created_at,
  status: dispute.status,
  resolution: dispute.resolution || undefined,
  adminNote: dispute.admin_note || undefined,
  resolvedAt: dispute.resolved_at || undefined,
});

const mapAdminUser = (user: ApiAdminUserRow): AdminUserSummary => ({
  id: user.id,
  role: user.role,
  firstName: user.first_name,
  lastName: user.last_name,
  phone: user.phone,
  photoUrl: user.photo_url,
  city: user.city,
  status: user.status,
  ratingAvg: Number(user.rating_avg || 0),
  ratingCount: user.rating_count || 0,
  warningCount: user.warning_count || 0,
  workerId: user.worker_id,
  workerRole: user.worker_role,
  verificationStatus: user.verification_status,
  isWorkerActive: user.is_worker_active,
  createdAt: user.created_at,
  lastLoginAt: user.last_login_at,
  stats: {
    total: user.stats?.total || 0,
    active: user.stats?.active || 0,
    disputed: user.stats?.disputed || 0,
    cancelled: user.stats?.cancelled || 0,
    completed: user.stats?.completed || 0,
    amount: Number(user.stats?.amount || 0),
    lastActivity: user.stats?.last_activity,
  },
});

export const loadAdminLaunchState = async () => {
  const client = createSupabaseRestClient();
  const state = await client.rpc<AdminLaunchStateRow>("get_admin_launch_state", {});
  return mapLaunchState(state);
};

export const loadCurrentAdminContext = async () => {
  const client = createSupabaseRestClient();
  return client.rpc<CurrentAdminContext>("get_current_admin_context", {});
};

export const loadAdminBookings = async () => {
  const client = createSupabaseRestClient();
  const rows = await client.rpc<ApiAdminBookingRow[]>("list_admin_bookings", {});
  return {
    clientBookings: rows.map(mapAdminBookingToClientBooking),
    requests: rows.map(mapAdminBookingToRequest),
  };
};

export const loadAdminDisputes = async () => {
  const client = createSupabaseRestClient();
  const rows = await client.rpc<ApiAdminDisputeRow[]>("list_admin_disputes", {});
  // Keep the Admin queue stable even if older test data contains multiple open
  // disputes for the same booking. Historical resolved disputes stay visible.
  const seen = new Set<string>();
  return rows
    .map(mapAdminDispute)
    .filter((dispute) => {
      const key = dispute.status === "resolved" ? dispute.id : dispute.bookingId;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

export const loadAdminUsers = async () => {
  const client = createSupabaseRestClient();
  const rows = await client.rpc<ApiAdminUserRow[]>("list_admin_users", {});
  return rows.map(mapAdminUser);
};

export const saveAdminLaunchSettings = async (
  platformSettings: PlatformSettings,
  legalSettings: LegalSettings
) => {
  const client = createSupabaseRestClient();
  const state = await client.rpc<AdminLaunchStateRow>(
    "save_admin_platform_settings",
    {
      p_platform_settings: platformSettings,
      p_legal_settings: legalSettings,
    }
  );
  return mapLaunchState(state);
};

export const updateAdminMemberState = async (id: string, active: boolean) => {
  const client = createSupabaseRestClient();
  const state = await client.rpc<AdminLaunchStateRow>("update_admin_member_state", {
    p_id: id,
    p_active: active,
  });
  return mapLaunchState(state);
};

const isRpcSignatureCacheError = (error: unknown) =>
  error instanceof Error &&
  (error.message.includes("PGRST202") ||
    error.message.includes("PGRST203") ||
    error.message.includes("schema cache") ||
    error.message.includes("Could not find the function") ||
    error.message.includes("Could not choose the best candidate"));

export const updateLaunchChecklistItem = async (
  id: string,
  done: boolean,
  note?: string
) => {
  const client = createSupabaseRestClient();
  const payload =
    note === undefined
      ? { p_id: id, p_done: done }
      : { p_id: id, p_done: done, p_note: note };
  let state: AdminLaunchStateRow;
  try {
    state = await client.rpc<AdminLaunchStateRow>(
      "update_launch_checklist_item",
      payload
    );
  } catch (error) {
    if (note === undefined || !isRpcSignatureCacheError(error)) {
      throw error;
    }

    console.warn(
      "update_launch_checklist_item p_note is not available yet. Run supabase/admin_launch_actions.sql to persist QA notes."
    );
    state = await client.rpc<AdminLaunchStateRow>(
      "update_launch_checklist_item",
      {
        p_id: id,
        p_done: done,
      }
    );
  }
  return mapLaunchState(state);
};

export const updateAdminAccountStatus = async (
  targetRole: AdminAccountRole,
  phone: string,
  status: AdminAccountStatus,
  adminNote?: string
) => {
  const client = createSupabaseRestClient();
  const state = await client.rpc<AdminLaunchStateRow>(
    "update_admin_account_status",
    {
      p_target_role: targetRole,
      p_phone: phone,
      p_status: status,
      p_admin_note: adminNote || null,
    }
  );
  return mapLaunchState(state);
};

export const sendAdminUserNotice = async (
  targetRole: AdminAccountRole,
  phone: string,
  message: string
) => {
  const client = createSupabaseRestClient();
  const state = await client.rpc<AdminLaunchStateRow>(
    "admin_send_user_notice",
    {
      p_target_role: targetRole,
      p_phone: phone,
      p_message: message,
    }
  );
  return mapLaunchState(state);
};

export const warnAdminUser = async (
  targetRole: AdminAccountRole,
  phone: string,
  message: string
) => {
  const client = createSupabaseRestClient();
  const state = await client.rpc<AdminLaunchStateRow>(
    "admin_warn_user",
    {
      p_target_role: targetRole,
      p_phone: phone,
      p_message: message,
    }
  );
  return mapLaunchState(state);
};

export const updateAdminBookingAction = async (
  bookingId: string,
  action: AdminBookingAction,
  adminNote?: string
) => {
  const client = createSupabaseRestClient();
  const state = await client.rpc<AdminLaunchStateRow>(
    "admin_update_booking_action",
    {
      p_booking_id: bookingId,
      p_action: action,
      p_admin_note: adminNote || null,
    }
  );
  return mapLaunchState(state);
};

export const markAdminDisputeReviewing = async (
  disputeId: string,
  adminNote?: string
) => {
  const client = createSupabaseRestClient();
  const state = await client.rpc<AdminLaunchStateRow>(
    "admin_mark_dispute_reviewing",
    {
      p_dispute_id: disputeId,
      p_admin_note: adminNote || null,
    }
  );
  return mapLaunchState(state);
};

export const resolveAdminDisputeAction = async (
  disputeId: string,
  resolution: AdminDisputeResolution,
  adminNote: string
) => {
  const client = createSupabaseRestClient();
  const state = await client.rpc<AdminLaunchStateRow>(
    "admin_resolve_dispute_action",
    {
      p_dispute_id: disputeId,
      p_resolution: resolution,
      p_admin_note: adminNote,
    }
  );
  return mapLaunchState(state);
};

export const reviewAdminWorkerVerification = async (
  workerId: string,
  status: AdminVerificationStatus,
  adminNote?: string
) => {
  const client = createSupabaseRestClient();
  const state = await client.rpc<AdminLaunchStateRow>(
    "admin_review_worker_verification",
    {
      p_worker_id: workerId,
      p_status: status,
      p_admin_note: adminNote || null,
    }
  );
  return mapLaunchState(state);
};
