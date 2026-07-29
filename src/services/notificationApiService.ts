import type { ClientNotification } from "./appStorage";
import { createSupabaseRestClient } from "./supabaseRest";

interface ApiNotificationRow {
  id: string;
  booking_id: string | null;
  type: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
}

export interface AppNotification extends ClientNotification {
  title: string;
  readAt: string | null;
  createdAt: string;
}

const mapNotificationType = (type: string): ClientNotification["type"] => {
  if (type === "review") return "review";
  if (type === "booking_status") return "confirmed";
  if (type === "new_booking") return "confirmed";
  if (type === "subscription") return "confirmed";
  return "confirmed";
};

const mapNotification = (row: ApiNotificationRow): AppNotification => ({
  id: row.id,
  bookingId: row.booking_id || undefined,
  type: mapNotificationType(row.type),
  title: row.title,
  text: row.body || row.title,
  readAt: row.read_at,
  createdAt: row.created_at,
});

export const loadNotifications = async (limit = 30) => {
  const client = createSupabaseRestClient();
  const rows = await client.rpc<ApiNotificationRow[]>("list_my_notifications", {
    p_limit: limit,
  });

  return rows.map(mapNotification);
};

export const loadUnreadNotificationCount = async () => {
  const client = createSupabaseRestClient();
  const result = await client.rpc<{ unread_count: number | string }>(
    "get_unread_notification_count",
    {}
  );
  return Number(result.unread_count || 0);
};

export const markNotificationRead = (notificationId: string) => {
  const client = createSupabaseRestClient();
  return client.rpc<{ notification_id: string }>("mark_notification_read", {
    p_notification_id: notificationId,
  });
};

export const markBookingNotificationsRead = (bookingId: string) => {
  const client = createSupabaseRestClient();
  return client.rpc<{ booking_id: string; updated_count: number }>(
    "mark_booking_notifications_read",
    {
      p_booking_id: bookingId,
    }
  );
};

export const markAllNotificationsRead = () => {
  const client = createSupabaseRestClient();
  return client.rpc<{ updated_count: number }>("mark_all_notifications_read", {});
};
