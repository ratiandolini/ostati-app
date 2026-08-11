import React from "react";
import { actionButton, adminCard } from "./adminUi";
import { paymentStatusHelp, statusLabel } from "./adminLabels";
import { money, parseFirstAmount, penaltyAmountForBooking } from "./adminUtils";
import type { PlatformSettings } from "../../services/dataService";
import type { Booking } from "../../screens/BookingsScreen";
import { normalizeGeorgianDateLabel } from "../../utils/georgianDate";

type AdminPaymentStatus = NonNullable<Booking["paymentStatus"]>;

interface FinancialSummary {
  held: number;
  released: number;
  refunded: number;
  disputed: number;
}

interface AdminFinanceTabProps {
  filteredFinancialSummary: FinancialSummary;
  platformSettings: PlatformSettings;
  financeReviewBookings: Booking[];
  financeRefundQueue: Booking[];
  financeReleaseQueue: Booking[];
  filteredClientBookings: Booking[];
  lateCancellationPenaltyTotal: number;
  estimatedServiceTotal: number;
  estimatedCommission: number;
  adminActionId: string | null;
  adminApiLoading: boolean;
  setBookingPaymentStatus: (bookingId: string, paymentStatus: AdminPaymentStatus) => void;
}

export const AdminFinanceTab: React.FC<AdminFinanceTabProps> = ({
  filteredFinancialSummary,
  platformSettings,
  financeReviewBookings,
  financeRefundQueue,
  financeReleaseQueue,
  filteredClientBookings,
  lateCancellationPenaltyTotal,
  estimatedServiceTotal,
  estimatedCommission,
  adminActionId,
  adminApiLoading,
  setBookingPaymentStatus,
}) => {
  return (
          <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
              {[
                { label: "გაყინულია", value: filteredFinancialSummary.held, color: "#1d4ed8", bg: "#eff6ff" },
                { label: "დადასტურდა", value: filteredFinancialSummary.released, color: "#047857", bg: "#ecfdf5" },
                { label: "დაბრუნებულია", value: filteredFinancialSummary.refunded, color: "#b91c1c", bg: "#fef2f2" },
                { label: "დავაშია", value: filteredFinancialSummary.disputed, color: "#c2410c", bg: "#fff7ed" },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    ...adminCard,
                    padding: 14,
                    background: item.bg,
                    borderColor: "transparent",
                  }}
                >
                  <div style={{ color: item.color, fontSize: 11, fontWeight: 900 }}>
                    {item.label}
                  </div>
                  <div style={{ marginTop: 7, color: item.color, fontSize: 22, fontWeight: 950 }}>
                    {money(item.value)}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ ...adminCard, padding: 14 }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 17, color: "var(--text)" }}>
                ფინანსური მოდელი
              </h2>
              <div style={{ color: "var(--text2)", fontSize: 12, lineHeight: 1.55 }}>
                ახლა დემოში კლიენტს ებლოკება დაჯავშნის საფასური. სამუშაოს დასრულების
                და კლიენტის დადასტურების შემდეგ საფასური იხურება. Admin ერევა
                მხოლოდ დავის, დაბრუნების ან გაჭედილი სტატუსის შემთხვევაში.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 12 }}>
                {[
                  {
                    label: "ჯავშნის საფასური",
                    value: money(platformSettings.bookingFee),
                    hint: "იყინება დაჯავშნისას",
                  },
                  {
                    label: "საკომისიო",
                    value: `${platformSettings.commissionPercent}%`,
                    hint: "სერვისის ფასიდან",
                  },
                  {
                    label: "დაგვიანებული გაუქმება",
                    value: `${platformSettings.lateCancellationFeePercent}%`,
                    hint: "სავარაუდო თანხის დაკავება",
                  },
                  {
                    label: "თვიური",
                    value: money(platformSettings.craftsmanMonthlyFee),
                    hint: "ხელოსნის პაკეტი",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      background: "#f8fafc",
                      border: "1px solid var(--border)",
                      minWidth: 0,
                    }}
                  >
                    <div style={{ color: "var(--text)", fontSize: 15, fontWeight: 950, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.value}
                    </div>
                    <div style={{ marginTop: 3, color: "var(--text2)", fontSize: 10, fontWeight: 900 }}>
                      {item.label}
                    </div>
                    <div style={{ marginTop: 3, color: "var(--text3)", fontSize: 10, fontWeight: 750, lineHeight: 1.25 }}>
                      {item.hint}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ ...adminCard, padding: 14 }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 17, color: "var(--text)" }}>
                Admin-ის ფინანსური რიგი
              </h2>
              <div style={{ color: "var(--text2)", fontSize: 12, lineHeight: 1.5 }}>
                აქ ჩანს მხოლოდ ის, რაზეც Admin-ს გადაწყვეტილება შეიძლება დასჭირდეს:
                თანხის დაბრუნება, თანხის გაშვება ან დაგვიანებული გაუქმების გადამოწმება.
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 8,
                  marginTop: 12,
                }}
              >
                {[
                  {
                    label: "გადამოწმება",
                    value: financeReviewBookings.length,
                    hint: `სავარაუდო თანხის დაკავება ${money(lateCancellationPenaltyTotal)}`,
                    bg: "#fff7ed",
                    color: "#c2410c",
                  },
                  {
                    label: "დასაბრუნებელი",
                    value: financeRefundQueue.length,
                    hint: "უფასო გაუქმება ან უარყოფილი ჯავშანი",
                    bg: "#fef2f2",
                    color: "#b91c1c",
                  },
                  {
                    label: "გასაშვები თანხა",
                    value: financeReleaseQueue.length,
                    hint: "კლიენტმა დაადასტურა, თანხა ჯერ გაყინულია",
                    bg: "#ecfdf5",
                    color: "#047857",
                  },
                  {
                    label: "აქტიური hold",
                    value: filteredClientBookings.filter(
                      (booking) => (booking.paymentStatus || "held") === "held"
                    ).length,
                    hint: "ჩვეულებრივი მიმდინარე ჯავშნები",
                    bg: "#eff6ff",
                    color: "#1d4ed8",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      padding: 11,
                      borderRadius: 12,
                      background: item.bg,
                      border: "1px solid rgba(148,163,184,0.2)",
                      minWidth: 0,
                    }}
                  >
                    <div style={{ color: item.color, fontSize: 20, fontWeight: 950 }}>
                      {item.value}
                    </div>
                    <div style={{ marginTop: 2, color: item.color, fontSize: 11, fontWeight: 950 }}>
                      {item.label}
                    </div>
                    <div style={{ marginTop: 3, color: item.color, fontSize: 10, fontWeight: 750, lineHeight: 1.3 }}>
                      {item.hint}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ ...adminCard, padding: 14 }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 17, color: "var(--text)" }}>
                სავარაუდო საკომისიო
              </h2>
              <div style={{ color: "var(--text2)", fontSize: 12, lineHeight: 1.5 }}>
                სერვისის ფასებში ვიღებთ პირველ რიცხვს როგორც საწყის შეფასებას.
                საბოლოო თანხა რეალურ აპში დადასტურდება ხელოსნის შეთავაზებით და
                კლიენტის თანხმობით.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
                <div style={{ padding: 11, borderRadius: 12, background: "#f8fafc", border: "1px solid var(--border)" }}>
                  <div style={{ color: "var(--text)", fontSize: 18, fontWeight: 950 }}>
                    {money(estimatedServiceTotal)}
                  </div>
                  <div style={{ color: "var(--text3)", fontSize: 10, fontWeight: 850 }}>
                    სამუშაოების საწყისი ჯამი
                  </div>
                </div>
                <div style={{ padding: 11, borderRadius: 12, background: "#ecfdf5", border: "1px solid #bbf7d0" }}>
                  <div style={{ color: "#047857", fontSize: 18, fontWeight: 950 }}>
                    {money(estimatedCommission)}
                  </div>
                  <div style={{ color: "#047857", fontSize: 10, fontWeight: 850 }}>
                    აპის სავარაუდო წილი
                  </div>
                </div>
              </div>
            </div>

            {filteredClientBookings.length ? (
              filteredClientBookings.map((booking) => {
                const paymentStatus = booking.paymentStatus || "held";
                const amount = booking.bookingFee || platformSettings.bookingFee;
                const statusColor =
                  paymentStatus === "released"
                    ? "#047857"
                    : paymentStatus === "refunded"
                      ? "#b91c1c"
                      : paymentStatus === "disputed"
                        ? "#c2410c"
                        : "#1d4ed8";
                const statusText =
                  paymentStatus === "released"
                    ? "დადასტურდა"
                    : paymentStatus === "refunded"
                      ? "დაბრუნდა"
                      : paymentStatus === "disputed"
                        ? "დავაშია"
                        : "გაყინულია";
                const isLateCancellationReview =
                  booking.cancellationPolicy === "late_review" &&
                  paymentStatus !== "refunded" &&
                  paymentStatus !== "released";
                const isRefundCandidate =
                  booking.status === "cancelled" ||
                  booking.status === "declined" ||
                  paymentStatus === "refunded";
                const isReleaseCandidate =
                  booking.status === "client_confirmed" ||
                  booking.status === "closed" ||
                  paymentStatus === "released";
                const primaryFinanceAction =
                  isLateCancellationReview || isRefundCandidate
                    ? ({ status: "refunded" as const, label: "თანხის დაბრუნება", bg: "#ef4444" })
                    : isReleaseCandidate
                      ? ({ status: "released" as const, label: "თანხის გაშვება", bg: "#10b981" })
                      : null;
                const secondaryFinanceActions = [
                  ...(isLateCancellationReview
                    ? [{ status: "disputed" as const, label: "დავაში გადატანა", bg: "#f97316" }]
                    : []),
                  ...(paymentStatus === "disputed"
                    ? [
                        { status: "refunded" as const, label: "დაბრუნება", bg: "#ef4444" },
                        { status: "released" as const, label: "გაშვება", bg: "#10b981" },
                      ]
                    : []),
                  ...(paymentStatus !== "held" && paymentStatus !== "released" && paymentStatus !== "refunded"
                    ? [{ status: "held" as const, label: "გაყინულზე დაბრუნება", bg: "#1d4ed8" }]
                    : []),
                ];
                const financeActions = [
                  ...(primaryFinanceAction ? [primaryFinanceAction] : []),
                  ...secondaryFinanceActions.filter(
                    (action, index, list) =>
                      action.status !== primaryFinanceAction?.status &&
                      list.findIndex((item) => item.status === action.status) === index
                  ),
                ];
                return (
                  <div key={booking.id} style={{ ...adminCard, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ color: "var(--text)", fontSize: 14 }}>
                          {booking.worker.name}
                        </strong>
                        <div style={{ marginTop: 3, color: "var(--text2)", fontSize: 12 }}>
                          {booking.worker.role} · {normalizeGeorgianDateLabel(booking.dateLabel)} · {booking.time}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ color: statusColor, fontSize: 14, fontWeight: 950 }}>
                          {money(amount)}
                        </div>
                        <div style={{ marginTop: 2, color: statusColor, fontSize: 11, fontWeight: 900 }}>
                          {statusText}
                        </div>
                      </div>
                    </div>
                    <div style={{ marginTop: 8, color: "var(--text3)", fontSize: 11, fontWeight: 800 }}>
                      #{booking.id.slice(-8)} · {statusLabel[booking.status || "pending"]}
                    </div>
                    <div style={{ marginTop: 8, padding: 10, borderRadius: 12, background: "#f8fafc", color: "var(--text2)", fontSize: 11, fontWeight: 800, lineHeight: 1.45 }}>
                      {paymentStatusHelp[paymentStatus]}
                    </div>
                    {booking.cancellationPolicy === "late_review" && (
                      <div
                        style={{
                          marginTop: 8,
                          padding: 10,
                          borderRadius: 12,
                          background: "#fff7ed",
                          border: "1px solid #fed7aa",
                          color: "#9a3412",
                          fontSize: 11,
                          fontWeight: 850,
                          lineHeight: 1.45,
                        }}
                      >
                        დაგვიანებული გაუქმება. Admin-მა უნდა გადაამოწმოს მიზეზი და
                        გადაწყვიტოს დაბრუნება თუ დაკავება. სავარაუდო თანხის დაკავება:{" "}
                        {money(penaltyAmountForBooking(booking, platformSettings))}.
                      </div>
                    )}
                    <div style={{ marginTop: 5, color: "var(--text3)", fontSize: 10, fontWeight: 850, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      ტექნიკური ჩანაწერი: {booking.paymentProvider || platformSettings.paymentProvider} ·{" "}
                      {booking.paymentCurrency || platformSettings.paymentCurrency} ·{" "}
                      {booking.paymentTransactionId || "transaction pending"}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 7, marginTop: 10 }}>
                      {[
                        ["დაჯავშნა", money(amount)],
                        ["საწყისი ფასი", money(parseFirstAmount(booking.worker.price))],
                        [
                          "საკომისიო",
                          money(
                            Math.round(
                              (parseFirstAmount(booking.worker.price) *
                                platformSettings.commissionPercent) /
                                100
                            )
                          ),
                        ],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          style={{
                            padding: 8,
                            borderRadius: 11,
                            background: "#f8fafc",
                            border: "1px solid var(--border)",
                            minWidth: 0,
                          }}
                        >
                          <div style={{ color: "var(--text)", fontSize: 12, fontWeight: 950, overflow: "hidden", textOverflow: "ellipsis" }}>
                            {value}
                          </div>
                          <div style={{ marginTop: 2, color: "var(--text3)", fontSize: 9, fontWeight: 850 }}>
                            {label}
                          </div>
                        </div>
                      ))}
                    </div>
                    {booking.adminNote && (
                      <div style={{ marginTop: 9, padding: 10, borderRadius: 12, background: "#f8fafc", color: "var(--text2)", fontSize: 12, lineHeight: 1.45 }}>
                        Admin ჩანაწერი: {booking.adminNote}
                      </div>
                    )}
                    <div style={{ marginTop: 12, color: "var(--text)", fontSize: 12, fontWeight: 950 }}>
                      ფინანსური გადაწყვეტილება
                    </div>
                    <div style={{ marginTop: 3, color: "var(--text3)", fontSize: 10, fontWeight: 800, lineHeight: 1.35 }}>
                      ღილაკი ჩანს მხოლოდ მაშინ, როცა Admin-ის ჩარევა საჭიროა. ჩვეულებრივი მიმდინარე hold არ იხურება ხელით.
                    </div>
                    {financeActions.length ? (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: financeActions.length === 1 ? "1fr" : "repeat(2, 1fr)",
                          gap: 8,
                          marginTop: 9,
                        }}
                      >
                        {financeActions.map((item) => {
                          const loading =
                            adminActionId === `payment:${booking.id}:${item.status}` ||
                            adminActionId ===
                              `booking:${booking.id}:${
                                item.status === "refunded" ? "cancelled" : "closed"
                              }`;
                          return (
                            <button
                              key={item.status}
                              type="button"
                              disabled={adminApiLoading || paymentStatus === item.status}
                              onClick={() => setBookingPaymentStatus(booking.id, item.status)}
                              style={{
                                ...actionButton(
                                  paymentStatus === item.status ? "#e2e8f0" : item.bg,
                                  paymentStatus === item.status ? "var(--text3)" : "white"
                                ),
                              }}
                            >
                              {loading ? "მიმდინარეობს..." : item.label}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ marginTop: 9, padding: 10, borderRadius: 12, background: "#f8fafc", color: "var(--text3)", fontSize: 11, fontWeight: 850, lineHeight: 1.4 }}>
                        ამ ჯავშანზე ფინანსური action ჯერ არ არის საჭირო.
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div style={{ ...adminCard, padding: 30, textAlign: "center", color: "var(--text3)", fontWeight: 800 }}>
                ფინანსური ჩანაწერი ამ ფილტრით არ მოიძებნა
              </div>
            )}
          </section>
  );
};
