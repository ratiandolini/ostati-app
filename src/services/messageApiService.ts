import type { BookingMessage } from "./appStorage";
import { reportApiError } from "./apiErrorUtils";
import { createSupabaseRestClient } from "./supabaseRest";
import {
  createSignedStorageUrl,
  createStoragePath,
  extractStoragePath,
  uploadStorageFile,
} from "./supabaseStorageService";

interface ApiMessageRow {
  id: string;
  booking_id: string;
  sender: "client" | "craftsman" | "system";
  text: string;
  attachment_url?: string | null;
  attachment_type?: "image" | string | null;
  attachment_name?: string | null;
  created_at: string;
}

export interface ApiMessageThread {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  lastText: string;
  lastAt: string;
  unreadCount: number;
  archived: boolean;
}

interface ApiMessageThreadRow {
  booking_id: string;
  title: string | null;
  subtitle: string | null;
  status: string | null;
  last_text: string | null;
  last_at: string | null;
  unread_count: number | string | null;
  archived: boolean | null;
}

const signChatAttachment = async (value?: string | null) => {
  if (!value || value.startsWith("data:")) return value || undefined;
  try {
    return await createSignedStorageUrl("chat-attachments", value);
  } catch (error) {
    reportApiError(error, { silentTransient: true });
    return value.startsWith("http")
      ? undefined
      : extractStoragePath("chat-attachments", value);
  }
};

const mapMessage = async (row: ApiMessageRow): Promise<BookingMessage> => ({
  id: row.id,
  bookingId: row.booking_id,
  sender: row.sender,
  text: row.text,
  createdAt: row.created_at,
  attachmentUrl: await signChatAttachment(row.attachment_url),
  attachmentType:
    row.attachment_type === "image" || row.attachment_url
      ? "image"
      : undefined,
  attachmentName: row.attachment_name || undefined,
});

export const loadMessageThreads = async (
  signal?: AbortSignal
): Promise<ApiMessageThread[]> => {
  const client = createSupabaseRestClient();
  const rows = await client.rpc<ApiMessageThreadRow[]>(
    "list_my_message_threads",
    {},
    { signal }
  );

  return rows.map((row) => ({
    id: row.booking_id,
    title: row.title || "ჯავშანი",
    subtitle: row.subtitle || "",
    status: row.status || "pending",
    lastText: row.last_text || "ჯერ მიმოწერა არ არის",
    lastAt: row.last_at || "",
    unreadCount: Number(row.unread_count || 0),
    archived: Boolean(row.archived),
  }));
};

export const loadBookingMessages = async (
  bookingId: string
): Promise<BookingMessage[]> => {
  const client = createSupabaseRestClient();
  const rows = await client.rpc<ApiMessageRow[]>("list_booking_messages", {
    p_booking_id: bookingId,
  });

  return Promise.all(rows.map(mapMessage));
};

export const sendBookingMessage = async (bookingId: string, text: string) => {
  const client = createSupabaseRestClient();
  return client.rpc<{ message_id: string; booking_id: string }>(
    "send_booking_message",
    {
      p_booking_id: bookingId,
      p_text: text,
      p_attachment_url: null,
      p_attachment_type: null,
      p_attachment_name: null,
    }
  );
};

export const sendAdminBookingMessage = async (bookingId: string, text: string) => {
  const client = createSupabaseRestClient();
  return client.rpc<{ message_id: string; booking_id: string }>(
    "admin_send_booking_message",
    {
      p_booking_id: bookingId,
      p_text: text,
    }
  );
};

export const sendBookingAttachment = async (bookingId: string, file: File) => {
  const uploaded = await uploadStorageFile({
    bucket: "chat-attachments",
    file,
    path: createStoragePath(`chat/${bookingId}`, file, "attachment"),
  });
  const client = createSupabaseRestClient();
  await client.rpc<{ message_id: string; booking_id: string }>(
    "send_booking_message",
    {
      p_booking_id: bookingId,
      p_text: "ფოტო",
      p_attachment_url: uploaded.path,
      p_attachment_type: "image",
      p_attachment_name: file.name,
    }
  );
  return uploaded;
};

export const markBookingMessagesRead = async (bookingId: string) => {
  const client = createSupabaseRestClient();
  try {
    return await client.rpc<{ booking_id: string; updated_count: number }>(
      "mark_booking_messages_read",
      {
        p_booking_id: bookingId,
      }
    );
  } catch (error) {
    reportApiError(error, { silentTransient: true });
    return { booking_id: bookingId, updated_count: 0 };
  }
};
