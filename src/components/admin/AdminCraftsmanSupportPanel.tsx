import React, { useEffect, useMemo, useState } from "react";
import type {
  AdminUserSummary,
  AdminWorkerSupportMessage,
} from "../../services/adminApiService";
import {
  loadAdminWorkerSupportConversation,
  loadAdminWorkerSupportMessages,
  markAdminWorkerSupportRead,
  sendAdminWorkerSupportMessage,
} from "../../services/adminApiService";
import { formatGeorgianDate, formatGeorgianTime } from "../../utils/georgianDate";

interface AdminCraftsmanSupportPanelProps {
  craftsman: AdminUserSummary;
  onClose: () => void;
}

const formatName = (craftsman: AdminUserSummary) =>
  [craftsman.firstName, craftsman.lastName].filter(Boolean).join(" ") ||
  `+995 ${craftsman.phone}`;

export const AdminCraftsmanSupportPanel: React.FC<
  AdminCraftsmanSupportPanelProps
> = ({ craftsman, onClose }) => {
  const [messages, setMessages] = useState<AdminWorkerSupportMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const workerId = craftsman.workerId || "";
  const title = useMemo(() => formatName(craftsman), [craftsman]);

  const load = async () => {
    if (!workerId) return;
    setLoading(true);
    setError("");
    try {
      const [conversation, nextMessages] = await Promise.all([
        loadAdminWorkerSupportConversation(workerId),
        loadAdminWorkerSupportMessages(workerId),
      ]);
      setMessages(nextMessages);
      setUnreadCount(conversation.unreadCount);
      if (conversation.conversationId) {
        await markAdminWorkerSupportRead(workerId);
        setUnreadCount(0);
      }
    } catch {
      setError("მხარდაჭერის მიმოწერის ჩატვირთვა ვერ მოხერხდა. სცადეთ თავიდან.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [workerId]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !workerId || sending) return;
    if (text.length > 4000) {
      setError("მხარდაჭერის შეტყობინება მაქსიმუმ 4000 სიმბოლო უნდა იყოს.");
      return;
    }
    setSending(true);
    setError("");
    try {
      await sendAdminWorkerSupportMessage(workerId, text);
      setDraft("");
      await load();
    } catch {
      setError("შეტყობინების გაგზავნა ვერ მოხერხდა. სცადეთ თავიდან.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Shenage მხარდაჭერა"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 220,
        display: "flex",
        alignItems: "flex-end",
        background: "rgba(15,23,42,0.45)",
      }}
    >
      <section
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 430,
          maxHeight: "min(88dvh, 720px)",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          borderRadius: "20px 20px 0 0",
          background: "var(--bg)",
          boxShadow: "0 -16px 48px rgba(15,23,42,0.24)",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            padding: "18px 18px 12px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ color: "var(--text)", fontSize: 15, fontWeight: 950 }}>
              Shenage მხარდაჭერა
            </div>
            <div style={{ marginTop: 3, color: "var(--text2)", fontSize: 12, fontWeight: 750 }}>
              {title}
            </div>
            {unreadCount > 0 && (
              <div style={{ marginTop: 5, color: "#b45309", fontSize: 11, fontWeight: 900 }}>
                ახალი შეტყობინება: {unreadCount}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="დახურვა"
            style={{ width: 38, height: 38, borderRadius: "50%", background: "#f1f5f9", color: "var(--text)", fontSize: 22 }}
          >
            ×
          </button>
        </header>

        <div style={{ flex: 1, minHeight: 160, overflowY: "auto", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
          {loading ? (
            <div style={{ color: "var(--text3)", textAlign: "center", padding: 24, fontWeight: 800 }}>მიმოწერა იტვირთება</div>
          ) : error ? (
            <div style={{ display: "grid", gap: 8, padding: 12, borderRadius: 12, background: "#fef2f2", color: "#991b1b", fontSize: 12, fontWeight: 800 }}>
              {error}
              <button type="button" onClick={() => void load()} style={{ justifySelf: "start", minHeight: 36, padding: "0 11px", borderRadius: 9, background: "white", color: "#991b1b", border: "1px solid #fecaca", fontWeight: 900 }}>ხელახლა ცდა</button>
            </div>
          ) : messages.length ? (
            messages.map((message) => {
              const mine = message.sender === "admin";
              return (
                <div key={message.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "82%", padding: "10px 12px", borderRadius: mine ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: mine ? "var(--primary)" : "white", color: mine ? "white" : "var(--text)", border: mine ? "none" : "1px solid var(--border)", fontSize: 13, lineHeight: 1.5, overflowWrap: "anywhere" }}>
                  <div>{message.text}</div>
                  <div style={{ marginTop: 4, textAlign: mine ? "right" : "left", fontSize: 10, fontWeight: 800, opacity: 0.72 }}>
                    {formatGeorgianDate(message.createdAt)} · {formatGeorgianTime(message.createdAt)}
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ color: "var(--text3)", textAlign: "center", padding: 28, fontSize: 13, lineHeight: 1.5 }}>დაიწყეთ პირადი მიმოწერა ხელოსანთან.</div>
          )}
        </div>

        <footer style={{ display: "flex", gap: 8, padding: "10px 14px calc(10px + var(--safe-bottom))", borderTop: "1px solid var(--border)", background: "rgba(250,250,250,0.98)" }}>
          <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="დაწერეთ შეტყობინება..." disabled={sending || !workerId} style={{ flex: 1, minWidth: 0, height: 46, padding: "0 14px", borderRadius: 999, border: "1px solid var(--border)", background: "white", color: "var(--text)", fontSize: 13, fontWeight: 700 }} />
          <button type="button" onClick={() => void send()} disabled={!draft.trim() || sending || !workerId} style={{ flex: "0 0 46px", width: 46, height: 46, borderRadius: "50%", background: draft.trim() && !sending && workerId ? "var(--primary)" : "#dbe4ef", color: "white", fontSize: 20, fontWeight: 900 }}>›</button>
        </footer>
      </section>
    </div>
  );
};
