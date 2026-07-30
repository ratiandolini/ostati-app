import React from "react";
import { actionButton, adminCard } from "./adminUi";
import { paymentStatusShortLabel, statusLabel } from "./adminLabels";
import type { AdminPermission } from "./adminPermissions";
import type { CraftsmanBookingRequest } from "../../services/dataService";
import type { BookingStatus } from "../../types";
import type { Booking } from "../../screens/BookingsScreen";
import { formatGeorgianDate, formatGeorgianTime } from "../../utils/georgianDate";

type AdminPaymentStatus = NonNullable<Booking["paymentStatus"]>;

const statusTimingText = (request: CraftsmanBookingRequest) => {
  if (!request.statusUpdatedAt) return "";
  if (request.status === "started") {
    return `სამუშაო დაიწყო: ${formatGeorgianDate(request.statusUpdatedAt)} · ${formatGeorgianTime(request.statusUpdatedAt)}`;
  }
  if (["worker_completed", "client_confirmed", "closed", "completed"].includes(request.status)) {
    return `დასრულდა: ${formatGeorgianDate(request.statusUpdatedAt)} · ${formatGeorgianTime(request.statusUpdatedAt)}`;
  }
  if (request.status === "en_route") {
    return `გზაში მონიშნა: ${formatGeorgianDate(request.statusUpdatedAt)} · ${formatGeorgianTime(request.statusUpdatedAt)}`;
  }
  return "";
};

interface AdminBookingsTabProps {
  interventionRequests: CraftsmanBookingRequest[];
  activeBookings: Booking[];
  pendingRequests: CraftsmanBookingRequest[];
  visibleRegularRequests: CraftsmanBookingRequest[];
  getLinkedClientBooking: (bookingId: string) => Booking | undefined;
  can: (permission: AdminPermission) => boolean;
  adminApiLoading: boolean;
  updateBookingEverywhere: (
    bookingId: string,
    status: BookingStatus,
    paymentStatus?: "released" | "refunded" | "disputed"
  ) => void;
  setBookingPaymentStatus: (bookingId: string, paymentStatus: AdminPaymentStatus) => void;
}

export const AdminBookingsTab: React.FC<AdminBookingsTabProps> = ({
  interventionRequests,
  activeBookings,
  pendingRequests,
  visibleRegularRequests,
  getLinkedClientBooking,
  can,
  adminApiLoading,
  updateBookingEverywhere,
  setBookingPaymentStatus,
}) => {
  return (
          <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ ...adminCard, padding: 14 }}>
              <h2 style={{ margin: "0 0 7px", fontSize: 17, color: "var(--text)" }}>
                Admin ჩარევა
              </h2>
              <div style={{ color: "var(--text2)", fontSize: 12, lineHeight: 1.5 }}>
                ეს ნაწილი არ არის ჩვეულებრივი ჯავშნის სამართავად. გამოიყენე მაშინ,
                როცა დავა, თანხის დაბრუნება ან ხელით დახურვაა საჭირო. ჩვეულებრივ
                პროცესს კლიენტი და ხელოსანი თვითონ ასრულებენ. Admin ქმედება
                ინახება ლოგში და ცვლის თანხის სტატუსსაც.
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
              {[
                ["ჩარევა", interventionRequests.length],
                ["აქტიური", activeBookings.length],
                ["მოლოდინი", pendingRequests.length],
              ].map(([label, value]) => (
                <div key={label} style={{ ...adminCard, padding: 11 }}>
                  <div style={{ color: "var(--text)", fontSize: 17, fontWeight: 950 }}>
                    {value}
                  </div>
                  <div style={{ marginTop: 2, color: "var(--text3)", fontSize: 10, fontWeight: 850 }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ color: "var(--text)", fontSize: 14, fontWeight: 950, marginTop: 2 }}>
              გადასაწყვეტი შემთხვევები
            </div>
            {interventionRequests.length ? (
              interventionRequests.map((request) => {
                const linkedBooking = getLinkedClientBooking(request.id);
                const paymentStatus = linkedBooking?.paymentStatus || "held";
                const timingText = statusTimingText(request);
                return (
                <div key={request.id} style={{ ...adminCard, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <strong
                        style={{
                          display: "block",
                          color: "var(--text)",
                          fontSize: 14,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {request.clientName}
                      </strong>
                      <div style={{ marginTop: 3, color: "var(--text2)", fontSize: 12 }}>
                        {request.service} · {request.date} · {request.time}
                      </div>
                    </div>
                    <span
                      style={{
                        alignSelf: "flex-start",
                        padding: "5px 8px",
                        borderRadius: 999,
                        background: "#fff7ed",
                        color: "#c2410c",
                        fontSize: 11,
                        fontWeight: 900,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {statusLabel[request.status]}
                    </span>
                  </div>
                  <div style={{ marginTop: 8, color: "var(--text3)", fontSize: 12 }}>
                    {request.address}
                  </div>
                  <div style={{ marginTop: 6, color: "var(--text3)", fontSize: 11, fontWeight: 850 }}>
                    {paymentStatusShortLabel[paymentStatus]} · #{request.id.slice(-8)}
                  </div>
                  {timingText && (
                    <div style={{ marginTop: 6, color: "var(--text2)", fontSize: 11, fontWeight: 850 }}>
                      {timingText}
                    </div>
                  )}
                  {(request.cancellationReason || request.disputeReason) && (
                    <div style={{ marginTop: 8, color: "#9a3412", fontSize: 12, fontWeight: 850 }}>
                      {request.cancellationReason || request.disputeReason}
                    </div>
                  )}
                  {request.adminNote && (
                    <div style={{ marginTop: 9, padding: 10, borderRadius: 12, background: "#f8fafc", color: "var(--text2)", fontSize: 12, lineHeight: 1.45 }}>
                      Admin ჩანაწერი: {request.adminNote}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    {can("finance") && (
                      <button
                        type="button"
                        disabled={adminApiLoading}
                        onClick={() => updateBookingEverywhere(request.id, "closed", "released")}
                        style={actionButton("#10b981")}
                      >
                        Admin-ით დახურვა
                      </button>
                    )}
                    {can("finance") && (
                      <button
                        type="button"
                        disabled={adminApiLoading}
                        onClick={() => updateBookingEverywhere(request.id, "cancelled", "refunded")}
                        style={actionButton("#ef4444")}
                      >
                        Admin-ით დაბრუნება
                      </button>
                    )}
                    {can("disputes") && (
                      <button
                        type="button"
                        disabled={adminApiLoading}
                        onClick={() => setBookingPaymentStatus(request.id, "disputed")}
                        style={actionButton("#f97316")}
                      >
                        დავაში დატოვება
                      </button>
                    )}
                  </div>
                </div>
                );
              })
            ) : (
              <div style={{ ...adminCard, padding: 30, textAlign: "center", color: "var(--text3)", fontWeight: 800 }}>
                ამ ეტაპზე Admin ჩარევა არც ერთ ჯავშანს არ სჭირდება
              </div>
            )}

            <div style={{ color: "var(--text)", fontSize: 14, fontWeight: 950, marginTop: 8 }}>
              ჩვეულებრივი ჯავშნები
            </div>
            {visibleRegularRequests.length ? (
              visibleRegularRequests.map((request) => {
                const timingText = statusTimingText(request);
                return (
                <div key={request.id} style={{ ...adminCard, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <strong
                        style={{
                          display: "block",
                          color: "var(--text)",
                          fontSize: 14,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {request.clientName}
                      </strong>
                      <div style={{ marginTop: 3, color: "var(--text2)", fontSize: 12 }}>
                        {request.service} · {request.date} · {request.time}
                      </div>
                    </div>
                    <span style={{ color: "var(--primary)", fontSize: 11, fontWeight: 900, whiteSpace: "nowrap" }}>
                      {statusLabel[request.status]}
                    </span>
                  </div>
                  <div style={{ marginTop: 8, color: "var(--text3)", fontSize: 12 }}>
                    {request.address || "მისამართი არ არის მითითებული"}
                  </div>
                  {timingText && (
                    <div style={{ marginTop: 6, color: "var(--text2)", fontSize: 11, fontWeight: 850 }}>
                      {timingText}
                    </div>
                  )}
                  <div
                    style={{
                      marginTop: 10,
                      padding: "8px 10px",
                      borderRadius: 12,
                      background: "#f8fafc",
                      color: "var(--text3)",
                      fontSize: 11,
                      fontWeight: 850,
                      lineHeight: 1.4,
                    }}
                  >
                    ჩვეულებრივი პროცესი: სტატუსებს კლიენტი და ხელოსანი ცვლიან.
                    Admin ღილაკები გამოჩნდება მხოლოდ დავაზე ან დაბრუნებაზე.
                  </div>
                </div>
                );
              })
            ) : (
              <div style={{ ...adminCard, padding: 24, textAlign: "center", color: "var(--text3)", fontWeight: 800 }}>
                ჩვეულებრივი ჯავშანი ამ ფილტრით არ მოიძებნა
              </div>
            )}
          </section>
  );
};
