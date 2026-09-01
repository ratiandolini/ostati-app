import React from "react";
import { BookingStatus } from "../../types";
import {
  Booking,
  archivedWorkStatuses,
  formatBookingDateTime,
  getWorkStatusTone,
  getWorkerDisputeMeta,
  getWorkerPaymentMeta,
  statusMeta,
} from "../../screens/craftsman/craftsmanHome.helpers";

interface JobCardProps {
  booking: Booking;
  bookingFee: number;
  expandedArchiveIds: string[];
  bookingActionId: string | null;
  onExpand: (bookingId: string) => void;
  onCollapse: (bookingId: string) => void;
  onShowDetails: (booking: Booking) => void;
  onUpdateStatus: (id: string, status: BookingStatus) => void;
  onOpenReasonAction: (
    booking: Booking,
    kind: "decline" | "cannot_complete"
  ) => void;
  onCompleteBooking: (booking: Booking) => void;
}

export const JobCard: React.FC<JobCardProps> = ({
  booking,
  bookingFee,
  expandedArchiveIds,
  bookingActionId,
  onExpand,
  onCollapse,
  onShowDetails,
  onUpdateStatus,
  onOpenReasonAction,
  onCompleteBooking,
}) => {
  const meta = statusMeta[booking.status];
  const tone = getWorkStatusTone(booking.status);
  const isArchived = archivedWorkStatuses.includes(booking.status);
  const expanded = !isArchived || expandedArchiveIds.includes(booking.id);
  const actionLoading = bookingActionId === booking.id;
  const clientShortName = booking.clientName.replace(
    /^(\S+)\s+(\S).*/,
    "$1 $2."
  );
  const paymentMeta = getWorkerPaymentMeta(booking, bookingFee);
  const disputeMeta = getWorkerDisputeMeta(booking);

  if (isArchived && !expanded) {
    return (
      <button
        type="button"
        className="fade-up"
        onClick={() => onExpand(booking.id)}
        style={{
          width: "100%",
          padding: 14,
          borderRadius: 14,
          background: "white",
          border: `1px solid ${tone.border}`,
          boxShadow: "var(--shadow-sm)",
          textAlign: "left",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: "var(--text)", fontSize: 14, fontWeight: 950, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {clientShortName} · {booking.service}
            </div>
            <div style={{ marginTop: 4, color: "var(--text2)", fontSize: 12, fontWeight: 750 }}>
              {formatBookingDateTime(booking)}
            </div>
          </div>
          <span
            style={{
              flexShrink: 0,
              padding: "6px 9px",
              borderRadius: 999,
              background: tone.bg,
              color: tone.color,
              border: `1px solid ${tone.border}`,
              fontSize: 11,
              fontWeight: 950,
              whiteSpace: "nowrap",
            }}
          >
            {meta.label}
          </span>
        </div>
      </button>
    );
  }

  return (
    <div
      className="fade-up"
      style={{
        background: "white",
        border: `1px solid ${tone.border}`,
        borderTop: `3px solid ${tone.color}`,
        borderRadius: 16,
        padding: 16,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "var(--text)" }}>
            {clientShortName}
          </div>
          <div style={{ marginTop: 3, fontSize: 13, color: "var(--text2)" }}>
            {booking.service}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: meta.color }}>
            {formatBookingDateTime(booking)}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: "var(--text3)" }}>
        📍 {booking.address}
      </div>

      <div
        style={{
          display: "inline-flex",
          marginTop: 12,
          padding: "6px 11px",
          borderRadius: 999,
          background: tone.bg,
          color: tone.color,
          border: `1px solid ${tone.border}`,
          fontSize: 11,
          fontWeight: 900,
        }}
      >
        {meta.label}
      </div>

      <div
        style={{
          marginTop: 10,
          padding: 10,
          borderRadius: 12,
          background: paymentMeta.bg,
          border: `1px solid ${paymentMeta.border}`,
          color: paymentMeta.color,
          fontSize: 11,
          fontWeight: 850,
          lineHeight: 1.45,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 950 }}>{paymentMeta.label}</div>
        <div style={{ marginTop: 3 }}>{paymentMeta.detail}</div>
      </div>

      {booking.cancellationReason && (
        <div
          style={{
            marginTop: 10,
            padding: 10,
            borderRadius: 12,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            fontSize: 12,
            fontWeight: 850,
            lineHeight: 1.45,
          }}
        >
          გაუქმების მიზეზი: {booking.cancellationReason}
        </div>
      )}

      {booking.disputeReason && (
        <div
          style={{
            marginTop: 10,
            padding: 10,
            borderRadius: 12,
            background: disputeMeta.bg,
            border: `1px solid ${disputeMeta.border}`,
            color: disputeMeta.color,
            fontSize: 12,
            fontWeight: 850,
            lineHeight: 1.45,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 950 }}>{disputeMeta.label}</div>
          <div style={{ marginTop: 4 }}>{disputeMeta.detail}</div>
          <div style={{ marginTop: 7, fontWeight: 900 }}>
            მიზეზი: {booking.disputeReason}
          </div>
          {booking.disputeDetails && (
            <div style={{ marginTop: 5, color: "inherit", fontWeight: 750 }}>
              {booking.disputeDetails}
            </div>
          )}
        </div>
      )}

      {booking.status === "pending" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
          <button
            type="button"
            onClick={() => onShowDetails(booking)}
            style={{
              minHeight: 42,
              borderRadius: 10,
              background: "#f8fafc",
              color: "var(--text)",
              border: "1px solid var(--border)",
              fontSize: 13,
              fontWeight: 900,
            }}
          >
            დეტალები
          </button>
          <button
            type="button"
            onClick={() => onUpdateStatus(booking.id, "confirmed")}
            disabled={actionLoading}
            style={{
              minHeight: 42,
              borderRadius: 10,
              background: actionLoading ? "#94a3b8" : "var(--primary)",
              color: "white",
              fontSize: 13,
              fontWeight: 900,
            }}
          >
            {actionLoading ? "იცვლება..." : "დადასტურება"}
          </button>
          <button
            type="button"
            onClick={() => onOpenReasonAction(booking, "decline")}
            disabled={actionLoading}
            style={{
              gridColumn: "1 / -1",
              minHeight: 40,
              borderRadius: 10,
              background: actionLoading ? "#f1f5f9" : "#fef2f2",
              color: "#b91c1c",
              border: "1px solid #fecaca",
              fontSize: 13,
              fontWeight: 900,
            }}
          >
            უარყოფა
          </button>
        </div>
      )}
      {booking.status === "confirmed" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
          <button
            type="button"
            onClick={() => onUpdateStatus(booking.id, "en_route")}
            disabled={actionLoading}
            style={{
              minHeight: 42,
              borderRadius: 10,
              background: actionLoading ? "#94a3b8" : "var(--primary)",
              color: "white",
              fontSize: 13,
              fontWeight: 900,
            }}
          >
            {actionLoading ? "იცვლება..." : "გზაში ვარ"}
          </button>
          <button
            type="button"
            onClick={() => onOpenReasonAction(booking, "cannot_complete")}
            disabled={actionLoading}
            style={{
              minHeight: 42,
              borderRadius: 10,
              background: "#fff7ed",
              color: "#c2410c",
              border: "1px solid #fed7aa",
              fontSize: 12,
              fontWeight: 900,
            }}
          >
            ვერ ვასრულებ
          </button>
        </div>
      )}
      {booking.status === "en_route" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
          <button
            type="button"
            onClick={() => onUpdateStatus(booking.id, "started")}
            disabled={actionLoading}
            style={{
              minHeight: 42,
              borderRadius: 10,
              background: actionLoading ? "#94a3b8" : "#0891b2",
              color: "white",
              fontSize: 13,
              fontWeight: 900,
            }}
          >
            {actionLoading ? "იცვლება..." : "სამუშაო დაიწყო"}
          </button>
          <button
            type="button"
            onClick={() => onOpenReasonAction(booking, "cannot_complete")}
            disabled={actionLoading}
            style={{
              minHeight: 42,
              borderRadius: 10,
              background: "#fff7ed",
              color: "#c2410c",
              border: "1px solid #fed7aa",
              fontSize: 12,
              fontWeight: 900,
            }}
          >
            ვერ ვასრულებ
          </button>
        </div>
      )}
      {booking.status === "started" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
          <button
            type="button"
            onClick={() => onCompleteBooking(booking)}
            disabled={actionLoading}
            style={{
              minHeight: 42,
              borderRadius: 10,
              background: actionLoading ? "#94a3b8" : "#10b981",
              color: "white",
              fontSize: 13,
              fontWeight: 900,
            }}
          >
            ჩემი მხრიდან დასრულდა
          </button>
          <button
            type="button"
            onClick={() => onOpenReasonAction(booking, "cannot_complete")}
            disabled={actionLoading}
            style={{
              minHeight: 42,
              borderRadius: 10,
              background: "#fff7ed",
              color: "#c2410c",
              border: "1px solid #fed7aa",
              fontSize: 12,
              fontWeight: 900,
            }}
          >
            ვერ ვასრულებ
          </button>
        </div>
      )}
      {isArchived && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
          <button
            type="button"
            onClick={() => onShowDetails(booking)}
            style={{
              minHeight: 40,
              borderRadius: 10,
              background: "#f8fafc",
              color: "var(--text)",
              border: "1px solid var(--border)",
              fontSize: 13,
              fontWeight: 900,
            }}
          >
            დეტალების ნახვა
          </button>
          <button
            type="button"
            onClick={() => onCollapse(booking.id)}
            style={{
              minHeight: 40,
              borderRadius: 10,
              background: "#eef3f9",
              color: "var(--text2)",
              border: "1px solid var(--border)",
              fontSize: 13,
              fontWeight: 900,
            }}
          >
            აკეცვა
          </button>
        </div>
      )}
    </div>
  );
};
