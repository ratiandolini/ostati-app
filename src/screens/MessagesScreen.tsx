import React, { useEffect, useMemo, useRef, useState } from "react";
import { EmptyState } from "../components/EmptyState";
import { User } from "../types";
import { Booking } from "./BookingsScreen";
import {
  dataService,
  isDemoDataMode,
  BookingMessage,
  CraftsmanBookingRequest,
} from "../services/dataService";
import {
  loadBookingMessages,
  loadMessageThreads,
  markBookingMessagesRead,
  sendBookingAttachment,
  sendBookingMessage,
} from "../services/messageApiService";
import type { ApiMessageThread } from "../services/messageApiService";
import {
  uploadBookingSitePhoto,
  loadClientBookings,
  loadWorkerBookings,
} from "../services/bookingApiService";
import { openBookingDispute } from "../services/disputeApiService";

type Message = BookingMessage;
type MessageRole = "client" | "craftsman";

interface Thread {
  id: string;
  title: string;
  subtitle: string;
  status?: string;
  lastText: string;
  lastAt: string;
  unreadCount: number;
  archived: boolean;
}

interface MessagesScreenProps {
  user: User;
  bookings: Booking[];
  craftsmanBookings?: CraftsmanBookingRequest[];
  onUnreadChange?: (count: number) => void;
  accountStatus?: "active" | "limited" | "blocked";
  onProblemOpened?: (
    id: string,
    reason: string,
    details: string,
    evidence?: Booking["disputeEvidence"]
  ) => Promise<void> | void;
}

const archivedStatuses = [
  "client_confirmed",
  "closed",
  "completed",
  "declined",
  "cancelled",
];
const sortThreads = (items: Thread[]) =>
  [...items].sort(
    (a, b) =>
      Number(a.archived) - Number(b.archived) ||
      Number(b.unreadCount > 0) - Number(a.unreadCount > 0) ||
      b.lastAt.localeCompare(a.lastAt)
  );
const statusLabels: Record<string, string> = {
  pending: "მოლოდინში",
  confirmed: "დადასტურებული",
  en_route: "გზაშია",
  started: "დაწყებულია",
  worker_completed: "დასრულდა ხელოსნის მიერ",
  client_confirmed: "დასრულებული",
  closed: "დახურული",
  declined: "უარყოფილი",
  cancelled: "გაუქმებული",
  disputed: "დავა გახსნილია",
};
const isRealThreadName = (name: string) => !/^კლიენტი(\s|$)/.test(name || "");
const formatMessageTime = (value: string) =>
  new Date(value).toLocaleTimeString("ka-GE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
const formatMessageDate = (value: string) => {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const key = date.toDateString();
  if (key === today.toDateString()) return "დღეს";
  if (key === yesterday.toDateString()) return "გუშინ";
  return date.toLocaleDateString("ka-GE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};
const maxChatAttachmentBytes = 10 * 1024 * 1024;
const problemReasons = [
  "ხელოსანი არ მოვიდა",
  "ხელოსანი აგვიანებს",
  "ფასი შეცვალა",
  "ხარისხი არ მომწონს",
  "კომუნიკაციის პრობლემა",
];
const formatChatUploadError = (error: unknown) => {
  const message = error instanceof Error ? error.message : "";
  if (/row-level security|Unauthorized|403/i.test(message)) {
    return "ფოტოს ატვირთვა ვერ მოხერხდა. Supabase Storage-ის წესები გადასამოწმებელია.";
  }
  if (/bucket|not found/i.test(message)) {
    return "ჩატის ფოტოებისთვის Storage bucket არ არის მზად. გაუშვი storage SQL და სცადე თავიდან.";
  }
  if (/mime|file size|payload|too large|413/i.test(message)) {
    return "ფოტო ძალიან დიდია ან ფორმატი არასწორია. გამოიყენე JPG, PNG ან WEBP მაქსიმუმ 10MB.";
  }
  return message || "ფოტოს გაგზავნა ვერ მოხერხდა";
};

const countUnreadMessages = (
  messages: Message[],
  threads: Thread[],
  role: MessageRole
) => {
  const readReceipts = dataService.getMessageReads(role);
  return threads.reduce((sum, thread) => {
    const lastReadAt = readReceipts[thread.id] || "";
    return (
      sum +
      messages.filter(
        (message) =>
          message.bookingId === thread.id &&
          message.sender !== role &&
          (!lastReadAt || message.createdAt > lastReadAt)
      ).length
    );
  }, 0);
};

const summarizeMessages = (items: Message[]) => {
  const sorted = [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const last = sorted[sorted.length - 1];
  const text =
    last?.text ||
    (last?.attachmentUrl ? "ფოტო" : "ჯერ მიმოწერა არ არის");
  return {
    lastText: text.replace(/\s+/g, " ").trim().slice(0, 80),
    lastAt: last?.createdAt || "",
  };
};

const fallbackThreadsFromClientBookings = (clientBookings: Booking[]): Thread[] =>
  clientBookings.map((booking) => ({
    id: booking.id,
    title: booking.worker.name,
    subtitle: `${booking.worker.role} · ${booking.dateLabel} · ${booking.time}`,
    status: booking.status || "pending",
    lastText: "ჯერ მიმოწერა არ არის",
    lastAt: "",
    unreadCount: 0,
    archived: archivedStatuses.includes(booking.status || ""),
  }));

const fallbackThreadsFromCraftsmanBookings = (
  workerBookings: CraftsmanBookingRequest[]
): Thread[] =>
  workerBookings
    .filter((booking) => isRealThreadName(booking.clientName))
    .map((booking) => ({
      id: booking.id,
      title: booking.clientName,
      subtitle: `${booking.service} · ${booking.date} · ${booking.time}`,
      status: booking.status || "pending",
      lastText: "ჯერ მიმოწერა არ არის",
      lastAt: "",
      unreadCount: 0,
      archived: archivedStatuses.includes(booking.status || ""),
    }));

export const MessagesScreen: React.FC<MessagesScreenProps> = ({
  user,
  bookings,
  craftsmanBookings = [],
  onUnreadChange,
  accountStatus = "active",
  onProblemOpened,
}) => {
  const role: MessageRole = user.role === "craftsman" ? "craftsman" : "client";
  const [messages, setMessages] = useState<Message[]>(
    () => (isDemoDataMode ? dataService.getBookingMessages() : [])
  );
  const [apiThreads, setApiThreads] = useState<Thread[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [messageError, setMessageError] = useState("");
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [problemOpen, setProblemOpen] = useState(false);
  const [problemReason, setProblemReason] = useState("");
  const [problemDetails, setProblemDetails] = useState("");
  const [problemEvidence, setProblemEvidence] = useState<Booking["disputeEvidence"]>([]);
  const [problemSubmitting, setProblemSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [readVersion, setReadVersion] = useState(0);
  const threads = useMemo<Thread[]>(() => {
    if (!isDemoDataMode) return apiThreads;

    const readReceipts = isDemoDataMode ? dataService.getMessageReads(role) : {};
    const enhance = (thread: Omit<Thread, "lastText" | "lastAt" | "unreadCount" | "archived">): Thread => {
      const threadMessages = messages
        .filter((message) => message.bookingId === thread.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const last = threadMessages[threadMessages.length - 1];
      const lastReadAt = readReceipts[thread.id] || "";
      return {
        ...thread,
        lastText:
          last?.text ||
          (last?.attachmentUrl ? "ფოტო" : "ჯერ მიმოწერა არ არის"),
        lastAt: last?.createdAt || "",
        unreadCount: threadMessages.filter(
          (message) =>
            message.sender !== role &&
            (!lastReadAt || message.createdAt > lastReadAt)
        ).length,
        archived: archivedStatuses.includes(thread.status || ""),
      };
    };

    if (role === "client") {
      return sortThreads(
        bookings.map((booking) =>
          enhance({
            id: booking.id,
            title: booking.worker.name,
            subtitle: `${booking.worker.role} · ${booking.dateLabel} · ${booking.time}`,
            status: booking.status || "pending",
          })
        )
      );
    }

    return isDemoDataMode
      ? sortThreads(
          dataService
            .getCraftsmanRequests()
            .filter((request) => isRealThreadName(request.clientName))
            .map((request) =>
              enhance({
                id: request.id,
                title: request.clientName,
                subtitle: `${request.service} · ${request.date} · ${request.time}`,
                status: request.status || "pending",
              })
            )
        )
      : sortThreads(
          bookings.map((booking) =>
            enhance({
              id: booking.id,
              title: booking.worker.name,
              subtitle: `${booking.worker.role} · ${booking.dateLabel} · ${booking.time}`,
              status: booking.status || "pending",
            })
          )
        );
  }, [apiThreads, bookings, messages, readVersion, role]);

  const [activeThreadId, setActiveThreadId] = useState(threads[0]?.id || "");
  const [draft, setDraft] = useState("");
  const activeThread =
    threads.find((thread) => thread.id === activeThreadId) || threads[0];
  const isThreadArchived = Boolean(activeThread?.archived);
  const messagingBlocked = accountStatus !== "active";
  const visibleMessages = activeThread
    ? messages.filter((message) => message.bookingId === activeThread.id)
    : [];

  const clearApiThreadUnread = (threadId: string) => {
    setApiThreads((prev) => {
      const next = prev.map((thread) =>
        thread.id === threadId ? { ...thread, unreadCount: 0 } : thread
      );
      onUnreadChange?.(
        next.reduce((sum, thread) => sum + thread.unreadCount, 0)
      );
      return next;
    });
  };

  const selectThread = (thread: Thread) => {
    setActiveThreadId(thread.id);
    if (isDemoDataMode) return;
    clearApiThreadUnread(thread.id);
    markBookingMessagesRead(thread.id).catch((error) => {
      console.error(error);
    });
  };

  const refreshApiThreads = async (signal?: AbortSignal) => {
    if (isDemoDataMode) return;
    setLoadingThreads(true);
    setMessageError("");
    try {
      let nextThreads: Thread[] = [];
      try {
        nextThreads = (await loadMessageThreads(signal)).map(
          (thread: ApiMessageThread): Thread => ({
            id: thread.id,
            title: thread.title,
            subtitle: thread.subtitle,
            status: thread.status,
            lastText: thread.lastText.replace(/\s+/g, " ").trim().slice(0, 80),
            lastAt: thread.lastAt,
            unreadCount: thread.unreadCount,
            archived: thread.archived,
          })
        );
      } catch (error) {
        if (role !== "craftsman" && !bookings.length) throw error;
        console.error(error);
      }
      if (!nextThreads.length && role === "client") {
        const clientBookings = bookings.length
          ? bookings
          : await loadClientBookings(signal);
        nextThreads = fallbackThreadsFromClientBookings(clientBookings);
      }
      if (!nextThreads.length && role === "craftsman") {
        const workerBookings = craftsmanBookings.length
          ? craftsmanBookings
          : await loadWorkerBookings(signal);
        nextThreads = fallbackThreadsFromCraftsmanBookings(workerBookings);
      }
      nextThreads = sortThreads(nextThreads);
      setApiThreads(nextThreads);
      onUnreadChange?.(
        nextThreads.reduce((sum, thread) => sum + thread.unreadCount, 0)
      );
      if (!activeThreadId && nextThreads[0]) {
        setActiveThreadId(nextThreads[0].id);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessageError(
        error instanceof Error ? error.message : "მესიჯების ჩატვირთვა ვერ მოხერხდა"
      );
    } finally {
      setLoadingThreads(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    refreshApiThreads(controller.signal);
    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isDemoDataMode || apiThreads.length) return;
    if (role === "client" && bookings.length) {
      setApiThreads(sortThreads(fallbackThreadsFromClientBookings(bookings)));
    }
    if (role === "craftsman" && craftsmanBookings.length) {
      setApiThreads(
        sortThreads(fallbackThreadsFromCraftsmanBookings(craftsmanBookings))
      );
    }
  }, [apiThreads.length, bookings, craftsmanBookings, role]);

  useEffect(() => {
    if (!threads.length) return;
    if (!activeThreadId || !threads.some((thread) => thread.id === activeThreadId)) {
      setActiveThreadId(threads[0].id);
    }
  }, [activeThreadId, threads]);

  useEffect(() => {
    if (isDemoDataMode || !activeThread) return;

    let cancelled = false;
    setMessageError("");
    loadBookingMessages(activeThread.id)
      .then((nextMessages) => {
        if (!cancelled) {
          setMessages(nextMessages);
          const summary = summarizeMessages(nextMessages);
          setApiThreads((prev) =>
            sortThreads(
              prev.map((thread) => {
                if (thread.id !== activeThread.id) return thread;
                if (
                  thread.lastText === summary.lastText &&
                  thread.lastAt === summary.lastAt
                ) {
                  return thread;
                }
                return { ...thread, ...summary };
              })
            )
          );
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setMessageError(
            error instanceof Error
              ? error.message
              : "მესიჯების ჩატვირთვა ვერ მოხერხდა"
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeThread]);

  useEffect(() => {
    if (!activeThread) return;
    const last = messages
      .filter((message) => message.bookingId === activeThread.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(-1)[0];
    if (!last) return;
    if (isDemoDataMode) {
      if (dataService.getMessageReads(role)[activeThread.id] === last.createdAt) {
        return;
      }
      dataService.markThreadRead(role, activeThread.id, last.createdAt);
      setReadVersion((version) => version + 1);
      onUnreadChange?.(countUnreadMessages(messages, threads, role));
      return;
    }
    markBookingMessagesRead(activeThread.id).catch((error) => {
      console.error(error);
    });
    setApiThreads((prev) => {
      const next = prev.map((thread) =>
        thread.id === activeThread.id ? { ...thread, unreadCount: 0 } : thread
      );
      onUnreadChange?.(
        next.reduce((sum, thread) => sum + thread.unreadCount, 0)
      );
      return next;
    });
  }, [activeThread, messages, role]);

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || !activeThread || isThreadArchived || messagingBlocked) return;
    if (!isDemoDataMode) {
      try {
        await sendBookingMessage(activeThread.id, text);
        const nextMessages = await loadBookingMessages(activeThread.id);
        setMessages(nextMessages);
        await refreshApiThreads();
        setDraft("");
        return;
      } catch (error) {
        setMessageError(
          error instanceof Error ? error.message : "მესიჯის გაგზავნა ვერ მოხერხდა"
        );
        return;
      }
    }
    const next = [
      ...messages,
      {
        id: `${activeThread.id}-${Date.now()}`,
        bookingId: activeThread.id,
        sender: role,
        text,
        createdAt: new Date().toISOString(),
      },
    ];
    setMessages(next);
    if (isDemoDataMode) {
      dataService.saveBookingMessages(next);
    }
    setDraft("");
  };

  const sendAttachment = async (file: File) => {
    if (!activeThread || isThreadArchived || messagingBlocked || attachmentUploading) return;
    if (!file.type.startsWith("image/")) {
      setMessageError("ჩატში ამ ეტაპზე მხოლოდ JPG, PNG ან WEBP ფოტოს გაგზავნაა შესაძლებელი.");
      return;
    }
    if (file.size > maxChatAttachmentBytes) {
      setMessageError("ფოტო 10MB-ზე დიდია. ატვირთე უფრო მცირე ზომის ფოტო.");
      return;
    }
    if (!isDemoDataMode) {
      try {
        setAttachmentUploading(true);
        setMessageError("");
        await sendBookingAttachment(activeThread.id, file);
        const nextMessages = await loadBookingMessages(activeThread.id);
        setMessages(nextMessages);
        await refreshApiThreads();
        setMessageError("");
      } catch (error) {
        setMessageError(formatChatUploadError(error));
      } finally {
        setAttachmentUploading(false);
      }
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const attachmentUrl = typeof reader.result === "string" ? reader.result : "";
      if (!attachmentUrl) return;
      const next = [
        ...messages,
        {
          id: `${activeThread.id}-photo-${Date.now()}`,
          bookingId: activeThread.id,
          sender: role,
          text: "ფოტო",
          createdAt: new Date().toISOString(),
          attachmentUrl,
          attachmentType: "image" as const,
          attachmentName: file.name,
        },
      ];
      setMessages(next);
      dataService.saveBookingMessages(next);
      setMessageError("");
    };
    reader.onerror = () => setMessageError("ფოტოს წაკითხვა ვერ მოხერხდა.");
    reader.readAsDataURL(file);
  };

  const addProblemEvidence = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessageError("დავაზე ამ ეტაპზე მხოლოდ ფოტოს დამატებაა შესაძლებელი.");
      return;
    }
    if (file.size > maxChatAttachmentBytes) {
      setMessageError("ფოტო 10MB-ზე დიდია. ატვირთე უფრო მცირე ზომის ფოტო.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === "string" ? reader.result : "";
      if (!url) return;
      setProblemEvidence((current = []) =>
        [
          ...current,
          {
            name: file.name || "evidence.jpg",
            url,
            type: "image" as const,
          },
        ].slice(0, 4)
      );
      setMessageError("");
    };
    reader.onerror = () => setMessageError("ფოტოს წაკითხვა ვერ მოხერხდა.");
    reader.readAsDataURL(file);
  };

  const appendLocalSystemMessage = (text: string) => {
    if (!activeThread) return;
    const next = [
      ...messages,
      {
        id: `${activeThread.id}-system-${Date.now()}`,
        bookingId: activeThread.id,
        sender: "system" as const,
        text,
        createdAt: new Date().toISOString(),
      },
    ];
    setMessages(next);
    dataService.saveBookingMessages(next);
  };

  const submitProblemFromChat = async () => {
    if (!activeThread || !problemReason || role !== "client" || problemSubmitting) return;
    setProblemSubmitting(true);
    setMessageError("");
    let evidence = problemEvidence || [];
    try {
      if (!isDemoDataMode) {
        evidence = await Promise.all(
          evidence.map(async (item, index) => ({
            ...item,
            url: await uploadBookingSitePhoto(
              item.url,
              `chat-dispute-${activeThread.id}-${index + 1}`
            ),
          }))
        );
        await openBookingDispute(
          activeThread.id,
          problemReason,
          problemDetails,
          evidence
        );
        setMessages(await loadBookingMessages(activeThread.id));
        await refreshApiThreads();
      } else {
        dataService.prependBookingDispute({
          id: `${activeThread.id}-${Date.now()}`,
          bookingId: activeThread.id,
          reason: problemReason,
          details: problemDetails,
          status: "open",
          createdAt: new Date().toISOString(),
          evidence,
          service: activeThread.subtitle.split(" · ")[0],
          dateLabel: activeThread.subtitle.split(" · ")[1],
          time: activeThread.subtitle.split(" · ")[2],
          paymentStatus: "disputed",
        });
        appendLocalSystemMessage(
          `დავა გაიხსნა. მიზეზი: ${problemReason}. Admin გადაამოწმებს საკითხს.`
        );
      }
      await onProblemOpened?.(activeThread.id, problemReason, problemDetails, evidence);
      setProblemOpen(false);
      setProblemReason("");
      setProblemDetails("");
      setProblemEvidence([]);
    } catch (error) {
      setMessageError(
        error instanceof Error ? error.message : "დავის გახსნა ვერ მოხერხდა"
      );
    } finally {
      setProblemSubmitting(false);
    }
  };

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg)",
      }}
    >
      <div
        style={{
          padding: "34px 24px 14px",
          paddingTop: "calc(34px + var(--safe-top))",
        }}
      >
        <h1 className="screen-title">მესიჯები</h1>
        <p className="screen-subtitle">
          კომუნიკაცია ჯავშანზე, ტელეფონის ნომრის გარეშე
        </p>
      </div>

      {threads.length === 0 ? (
        <div style={{ flex: 1, display: "grid", placeItems: "center", padding: 30 }}>
          <div style={{ width: "100%" }}>
            <EmptyState
              title={loadingThreads ? "მიმოწერა იტვირთება" : "ჯერ მიმოწერა არ გაქვთ"}
              description={
                loadingThreads
                  ? "ჩატებს ვამოწმებთ აქტიურ ჯავშნებზე."
                  : "ჩატი გამოჩნდება, როცა ჯავშანზე საუბარი დაიწყება."
              }
            />
            {messageError && (
              <div style={{ marginTop: 8, fontSize: 12, color: "#dc2626", fontWeight: 800 }}>
                {messageError}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: "0 24px 12px",
              maxHeight: 220,
              overflowY: "auto",
            }}
          >
            {threads.map((thread, index) => (
              <React.Fragment key={thread.id}>
              {thread.archived && (index === 0 || !threads[index - 1].archived) && (
                <div style={{ margin: "8px 0 2px", color: "var(--text3)", fontSize: 11, fontWeight: 900 }}>
                  არქივი
                </div>
              )}
              <button
                type="button"
                onClick={() => selectThread(thread)}
                style={{
                  width: "100%",
                  padding: "11px 12px",
                  borderRadius: 14,
                  background:
                    activeThread?.id === thread.id ? "var(--primary)" : "white",
                  color: activeThread?.id === thread.id ? "white" : "var(--text)",
                  border: `1px solid ${
                    activeThread?.id === thread.id
                      ? "var(--primary)"
                      : "var(--border)"
                  }`,
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {thread.unreadCount > 0 && (
                    <span style={{
                      minWidth: 18,
                      height: 18,
                      padding: "0 5px",
                      borderRadius: 999,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "#ef4444",
                      color: "white",
                      fontSize: 10,
                      fontWeight: 900,
                      flexShrink: 0,
                    }}>
                      {thread.unreadCount > 9 ? "9+" : thread.unreadCount}
                    </span>
                  )}
                  <div style={{ fontSize: 12, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {thread.title}
                  </div>
                  {thread.lastAt && (
                    <div
                      style={{
                        marginLeft: "auto",
                        fontSize: 10,
                        fontWeight: 900,
                        opacity: 0.72,
                        flexShrink: 0,
                      }}
                    >
                      {formatMessageTime(thread.lastAt)}
                    </div>
                  )}
                </div>
                <div style={{ marginTop: 3, fontSize: 10, opacity: 0.75, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {thread.subtitle}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    display: "inline-flex",
                    alignItems: "center",
                    maxWidth: "100%",
                    padding: "3px 8px",
                    borderRadius: 999,
                    background:
                      activeThread?.id === thread.id
                        ? "rgba(255,255,255,0.16)"
                        : thread.archived
                          ? "#eef3f9"
                          : "#ecfdf5",
                    color:
                      activeThread?.id === thread.id
                        ? "white"
                        : thread.archived
                          ? "var(--text3)"
                          : "#047857",
                    fontSize: 10,
                    fontWeight: 900,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {statusLabels[thread.status || ""] || "აქტიური"}
                </div>
                <div style={{ marginTop: 5, fontSize: 11, opacity: 0.9, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {thread.lastText}
                </div>
              </button>
              </React.Fragment>
            ))}
          </div>

          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "10px 24px 96px",
            }}
          >
            {activeThread && role === "client" && !isThreadArchived && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 10,
                  padding: 10,
                  borderRadius: 14,
                  background: activeThread.status === "disputed" ? "#fff7ed" : "white",
                  border: `1px solid ${
                    activeThread.status === "disputed" ? "#fed7aa" : "var(--border)"
                  }`,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      color: "var(--text)",
                      fontSize: 12,
                      fontWeight: 950,
                    }}
                  >
                    {activeThread.status === "disputed"
                      ? "დავა გახსნილია"
                      : "ჯავშანზე პრობლემა გაქვთ?"}
                  </div>
                  <div
                    style={{
                      marginTop: 3,
                      color: "var(--text2)",
                      fontSize: 11,
                      fontWeight: 750,
                      lineHeight: 1.35,
                    }}
                  >
                    {activeThread.status === "disputed"
                      ? "საკითხი უკვე Admin-ის რიგშია. გადაწყვეტილება notification-ში და ჯავშნის ბარათზე გამოჩნდება."
                      : "ჩატიდან გახსნილი დავა Admin-ის დავებში ჩავარდება."}
                  </div>
                </div>
                {activeThread.status !== "disputed" && (
                  <button
                    type="button"
                    onClick={() => {
                      setProblemOpen(true);
                      setProblemReason("");
                      setProblemDetails("");
                      setProblemEvidence([]);
                      setMessageError("");
                    }}
                    style={{
                      flex: "0 0 auto",
                      minHeight: 36,
                      padding: "0 12px",
                      borderRadius: 999,
                      background: "#fff7ed",
                      color: "#c2410c",
                      border: "1px solid #fed7aa",
                      fontSize: 11,
                      fontWeight: 950,
                    }}
                  >
                    პრობლემა მაქვს
                  </button>
                )}
              </div>
            )}
            {messageError && (
              <div style={{ marginBottom: 10, color: "#dc2626", fontSize: 12, fontWeight: 800 }}>
                {messageError}
              </div>
            )}
            {visibleMessages.length === 0 ? (
              <div
                style={{
                  padding: "42px 18px",
                  textAlign: "center",
                  color: "var(--text3)",
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                დაწერეთ პირველი შეტყობინება ამ ჯავშანზე
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {visibleMessages.map((message, index) => {
                  const mine = message.sender === role;
                  const isSystem =
                    message.sender === "system" || message.text.startsWith("სისტემა:");
                  const previous = visibleMessages[index - 1];
                  const showDate =
                    !previous ||
                    formatMessageDate(previous.createdAt) !==
                      formatMessageDate(message.createdAt);
                  return (
                    <React.Fragment key={message.id}>
                    {showDate && (
                      <div
                        style={{
                          alignSelf: "center",
                          padding: "5px 10px",
                          borderRadius: 999,
                          background: "#eef3f9",
                          color: "var(--text2)",
                          fontSize: 11,
                          fontWeight: 900,
                        }}
                      >
                        {formatMessageDate(message.createdAt)}
                      </div>
                    )}
                    <div
                      style={{
                        alignSelf: isSystem
                          ? "center"
                          : mine
                            ? "flex-end"
                            : "flex-start",
                        maxWidth: isSystem ? "94%" : "82%",
                        padding: "10px 12px",
                        borderRadius: isSystem
                          ? 14
                          : mine
                            ? "16px 16px 4px 16px"
                            : "16px 16px 16px 4px",
                        background: isSystem
                          ? "#fff7ed"
                          : mine
                            ? "var(--primary)"
                            : "white",
                        color: isSystem ? "#9a3412" : mine ? "white" : "var(--text)",
                        border: isSystem
                          ? "1px solid #fed7aa"
                          : mine
                            ? "none"
                            : "1px solid var(--border)",
                        fontSize: isSystem ? 12 : 13,
                        lineHeight: 1.5,
                        fontWeight: isSystem ? 850 : 700,
                      }}
                    >
                      {message.attachmentUrl && message.attachmentType === "image" && (
                        <img
                          src={message.attachmentUrl}
                          alt={message.attachmentName || "ჩატის ფოტო"}
                          style={{
                            width: "100%",
                            maxHeight: 220,
                            objectFit: "cover",
                            borderRadius: 12,
                            display: "block",
                            marginBottom: message.text ? 7 : 0,
                          }}
                        />
                      )}
                      {isSystem && (
                        <div
                          style={{
                            marginBottom: 3,
                            fontSize: 10,
                            fontWeight: 950,
                            letterSpacing: 0,
                            textAlign: "center",
                          }}
                        >
                          ნოტიფიკაცია
                        </div>
                      )}
                      <div>{isSystem ? message.text.replace(/^სისტემა:\s*/, "") : message.text}</div>
                      <div
                        style={{
                          marginTop: 4,
                          textAlign: isSystem ? "center" : mine ? "right" : "left",
                          opacity: 0.75,
                          fontSize: 10,
                          fontWeight: 800,
                        }}
                      >
                        {formatMessageTime(message.createdAt)}
                      </div>
                    </div>
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>

          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: "calc(72px + var(--safe-bottom))",
              display: "flex",
              gap: 8,
              padding: "10px 18px",
              background: "rgba(250,250,250,0.96)",
              borderTop: "1px solid var(--border)",
            }}
          >
            {isThreadArchived ? (
              <div
                style={{
                  width: "100%",
                  minHeight: 46,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 14px",
                  borderRadius: 999,
                  background: "#eef3f9",
                  border: "1px solid var(--border)",
                  color: "var(--text2)",
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                არქივში მიმოწერა დახურულია
              </div>
            ) : (
              <>
            {messagingBlocked && (
              <div
                style={{
                  position: "absolute",
                  left: 18,
                  right: 18,
                  bottom: 66,
                  padding: "8px 10px",
                  borderRadius: 12,
                  background: "#fff7ed",
                  color: "#c2410c",
                  border: "1px solid #fed7aa",
                  fontSize: 11,
                  fontWeight: 900,
                }}
              >
                ანგარიში შეზღუდულია. ახალი მესიჯის გაგზავნა დროებით შეუძლებელია.
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) sendAttachment(file);
              }}
              style={{ display: "none" }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isThreadArchived || messagingBlocked || attachmentUploading}
              style={{
                width: 46,
                height: 46,
                borderRadius: "50%",
                background: isThreadArchived || messagingBlocked || attachmentUploading ? "#dbe4ef" : "white",
                color: "var(--primary)",
                border: "1px solid var(--border)",
                fontSize: 18,
                fontWeight: 900,
              }}
            >
              +
            </button>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={isThreadArchived || messagingBlocked}
              placeholder={
                messagingBlocked
                  ? "მიმოწერა შეზღუდულია"
                  : isThreadArchived
                  ? "არქივში მიმოწერა დახურულია"
                  : attachmentUploading
                  ? "ფოტო იტვირთება..."
                  : "დაწერე შეტყობინება..."
              }
              style={{
                flex: 1,
                height: 46,
                padding: "0 14px",
                borderRadius: 999,
                border: "1px solid var(--border)",
                background: "white",
                color: "var(--text)",
                fontSize: 13,
                fontWeight: 700,
                opacity: isThreadArchived || messagingBlocked ? 0.7 : 1,
              }}
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={!draft.trim() || messagingBlocked || attachmentUploading}
              style={{
                width: 46,
                height: 46,
                borderRadius: "50%",
                background:
                  draft.trim() && !isThreadArchived && !messagingBlocked && !attachmentUploading
                    ? "var(--primary)"
                    : "#dbe4ef",
                color: "white",
                fontSize: 18,
                fontWeight: 900,
              }}
            >
              ›
            </button>
              </>
            )}
          </div>
        </>
      )}
      {problemOpen && activeThread && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 160,
            display: "flex",
            alignItems: "flex-end",
            background: "rgba(15,23,42,0.38)",
          }}
        >
          <div
            style={{
              width: "100%",
              maxHeight: "92vh",
              overflowY: "auto",
              padding: 22,
              paddingBottom: "calc(22px + var(--safe-bottom))",
              borderRadius: "22px 22px 0 0",
              background: "white",
            }}
          >
            <h2 style={{ margin: "0 0 8px", color: "var(--text)", fontSize: 22, fontWeight: 950 }}>
              პრობლემა გაქვთ?
            </h2>
            <p style={{ margin: "0 0 14px", color: "var(--text2)", fontSize: 13, lineHeight: 1.5 }}>
              ეს დავა მიებმება მიმდინარე ჩატსა და ჯავშანს. Admin დაინახავს მიზეზს,
              აღწერას და დამატებულ ფოტოებს.
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              {problemReasons.map((reason) => (
                <label
                  key={reason}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: `1px solid ${
                      problemReason === reason ? "#f97316" : "var(--border)"
                    }`,
                    background: problemReason === reason ? "#fff7ed" : "#f8fafc",
                    color: "var(--text)",
                    fontSize: 13,
                    fontWeight: 850,
                  }}
                >
                  <input
                    type="radio"
                    checked={problemReason === reason}
                    onChange={() => setProblemReason(reason)}
                    style={{ accentColor: "#f97316" }}
                  />
                  {reason}
                </label>
              ))}
            </div>
            <textarea
              value={problemDetails}
              onChange={(event) => setProblemDetails(event.target.value)}
              placeholder="დაწერეთ მოკლედ რა მოხდა..."
              rows={3}
              style={{
                width: "100%",
                marginTop: 12,
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "#f8fafc",
                color: "var(--text)",
                fontSize: 13,
                fontWeight: 750,
                resize: "vertical",
              }}
            />
            <label
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 46,
                marginTop: 12,
                borderRadius: 12,
                background: "#f8fafc",
                border: "1px dashed #cbd5e1",
                color: "var(--text)",
                fontSize: 13,
                fontWeight: 950,
              }}
            >
              ფოტოს დამატება
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  addProblemEvidence(event.target.files?.[0]);
                  event.currentTarget.value = "";
                }}
                style={{ display: "none" }}
              />
            </label>
            {!!problemEvidence?.length && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 8,
                  marginTop: 10,
                }}
              >
                {problemEvidence.map((item, index) => (
                  <button
                    key={`${item.url}-${index}`}
                    type="button"
                    onClick={() =>
                      setProblemEvidence((current = []) =>
                        current.filter((_, itemIndex) => itemIndex !== index)
                      )
                    }
                    style={{
                      position: "relative",
                      aspectRatio: "1 / 1",
                      borderRadius: 10,
                      overflow: "hidden",
                      border: "1px solid var(--border)",
                      background: "white",
                    }}
                  >
                    <img
                      src={item.url}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        top: 4,
                        right: 4,
                        width: 18,
                        height: 18,
                        borderRadius: 999,
                        background: "rgba(15,23,42,.85)",
                        color: "white",
                        fontSize: 12,
                        lineHeight: "18px",
                        fontWeight: 900,
                      }}
                    >
                      x
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => {
                  setProblemOpen(false);
                  setProblemReason("");
                  setProblemDetails("");
                  setProblemEvidence([]);
                }}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: 12,
                  background: "#f1f5f9",
                  color: "var(--text)",
                  fontWeight: 950,
                }}
              >
                დახურვა
              </button>
              <button
                type="button"
                onClick={submitProblemFromChat}
                disabled={!problemReason || problemSubmitting}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: 12,
                  background: problemReason && !problemSubmitting ? "#f97316" : "#dbe4ef",
                  color: "white",
                  fontWeight: 950,
                }}
              >
                {problemSubmitting ? "იგზავნება..." : "გაგზავნა"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
