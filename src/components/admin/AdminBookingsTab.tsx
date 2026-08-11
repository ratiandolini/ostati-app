import React, { useState } from "react";
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

const canAdminCloseBooking = (status: BookingStatus) =>
  !["cancelled", "declined", "closed", "completed"].includes(status);

const canAdminRefundBooking = (status: BookingStatus) =>
  !["cancelled", "declined", "closed", "completed"].includes(status);

interface AdminBookingsTabProps {
  interventionRequests: CraftsmanBookingRequest[];
  activeBookings: Booking[];
  pendingRequests: CraftsmanBookingRequest[];
  visibleRegularRequests: CraftsmanBookingRequest[];
  getLinkedClientBooking: (bookingId: string) => Booking | undefined;
  can: (permission: AdminPermission) => boolean;
  adminApiLoading: boolean;
  adminMessageSendingId: string | null;
  updateBookingEverywhere: (
    bookingId: string,
    status: BookingStatus,
    paymentStatus?: "released" | "refunded" | "disputed"
  ) => void;
  setBookingPaymentStatus: (bookingId: string, paymentStatus: AdminPaymentStatus) => void;
  sendMessageToWorker: (bookingId: string) => void;
}

export const AdminBookingsTab: React.FC<AdminBookingsTabProps> = ({
  interventionRequests,
  activeBookings,
  pendingRequests,
  visibleRegularRequests,
  getLinkedClientBooking,
  can,
  adminApiLoading,
  adminMessageSendingId,
  updateBookingEverywhere,
  setBookingPaymentStatus,
  sendMessageToWorker,
}) => {
  const [showRegularBookings, setShowRegularBookings] = useState(false);
  const [regularBookingsPage, setRegularBookingsPage] = useState(0);
  const regularBookingsPageSize = 10;
  const regularBookingsPageCount = Math.max(
    1,
    Math.ceil(visibleRegularRequests.length / regularBookingsPageSize)
  );
  const pagedRegularRequests = visibleRegularRequests.slice(
    regularBookingsPage * regularBookingsPageSize,
    (regularBookingsPage + 1) * regularBookingsPageSize
  );

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
                    {can("bookings") && (
                      <button
                        type="button"
                        disabled={adminApiLoading || adminMessageSendingId === request.id}
                        onClick={() => sendMessageToWorker(request.id)}
                        style={actionButton("#2563eb")}
                      >
                        {adminMessageSendingId === request.id
                          ? "იგზავნება..."
                          : "ხელოსანთან მიწერა"}
                      </button>
                    )}
                    {can("finance") && (
                      <button
                        type="button"
                        disabled={adminApiLoading || !canAdminCloseBooking(request.status)}
                        onClick={() => updateBookingEverywhere(request.id, "closed", "released")}
                        style={actionButton(canAdminCloseBooking(request.status) ? "#10b981" : "#dbe4ef", canAdminCloseBooking(request.status) ? "white" : "var(--text3)")}
                      >
                        Admin-ით დახურვა
                      </button>
                    )}
                    {can("finance") && (
                      <button
                        type="button"
                        disabled={adminApiLoading || !canAdminRefundBooking(request.status)}
                        onClick={() => updateBookingEverywhere(request.id, "cancelled", "refunded")}
                        style={actionButton(canAdminRefundBooking(request.status) ? "#ef4444" : "#dbe4ef", canAdminRefundBooking(request.status) ? "white" : "var(--text3)")}
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

            <div style={{ ...adminCard, padding: 12, marginTop: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ color: "var(--text)", fontSize: 14, fontWeight: 950 }}>
                    ყველა ჯავშანი
                  </div>
                  <div style={{ marginTop: 3, color: "var(--text3)", fontSize: 11, fontWeight: 800 }}>
                    {visibleRegularRequests.length} ჩვეულებრივი პროცესი
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRegularBookings((current) => !current)}
                  style={actionButton(showRegularBookings ? "#f1f5f9" : "var(--primary)", showRegularBookings ? "var(--text)" : "white")}
                >
                  {showRegularBookings ? "დამალვა" : "სიის გახსნა"}
                </button>
              </div>
            </div>
            {showRegularBookings && (visibleRegularRequests.length ? (
              pagedRegularRequests.map((request) => {
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
                  {can("bookings") && (
                    <button
                      type="button"
                      disabled={adminApiLoading || adminMessageSendingId === request.id}
                      onClick={() => sendMessageToWorker(request.id)}
                      style={{ ...actionButton("#2563eb"), marginTop: 10 }}
                    >
                      {adminMessageSendingId === request.id
                        ? "იგზავნება..."
                        : "ხელოსანთან მიწერა"}
                    </button>
                  )}
                </div>
                );
              })
            ) : (
              <div style={{ ...adminCard, padding: 24, textAlign: "center", color: "var(--text3)", fontWeight: 800 }}>
                ჩვეულებრივი ჯავშანი ამ ფილტრით არ მოიძებნა
              </div>
            ))}
            {showRegularBookings && visibleRegularRequests.length > regularBookingsPageSize && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <span style={{ color: "var(--text3)", fontSize: 11, fontWeight: 850 }}>
                  გვერდი {regularBookingsPage + 1} / {regularBookingsPageCount}
                </span>
                <div style={{ display: "flex", gap: 7 }}>
                  <button
                    type="button"
                    disabled={regularBookingsPage === 0}
                    onClick={() => setRegularBookingsPage((page) => Math.max(0, page - 1))}
                    style={actionButton(regularBookingsPage === 0 ? "#dbe4ef" : "#f1f5f9", regularBookingsPage === 0 ? "#94a3b8" : "var(--text)")}
                  >
                    წინა
                  </button>
                  <button
                    type="button"
                    disabled={regularBookingsPage >= regularBookingsPageCount - 1}
                    onClick={() => setRegularBookingsPage((page) => Math.min(regularBookingsPageCount - 1, page + 1))}
                    style={actionButton(regularBookingsPage >= regularBookingsPageCount - 1 ? "#dbe4ef" : "var(--primary)", regularBookingsPage >= regularBookingsPageCount - 1 ? "#94a3b8" : "white")}
                  >
                    შემდეგი
                  </button>
                </div>
              </div>
            )}
          </section>
  );
};
