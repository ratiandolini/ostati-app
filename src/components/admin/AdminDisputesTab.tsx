import React from "react";
import { actionButton, adminCard } from "./adminUi";
import {
  paymentStatusShortLabel,
} from "./adminLabels";
import {
  disputePriorityScore,
  disputeStatusUi,
  formatDate,
  hoursSince,
  money,
} from "./adminUtils";
import type { DisputeView } from "./adminTypes";
import type { BookingDispute, CraftsmanBookingRequest } from "../../services/dataService";
import type { AdminPermission } from "./adminPermissions";
import type { AdminDisputeResolution } from "../../services/adminApiService";
import type { PlatformSettings } from "../../services/dataService";
import type { Booking } from "../../screens/BookingsScreen";

interface AdminDisputesTabProps {
  disputeViewCounts: Record<DisputeView, number>;
  disputeView: DisputeView;
  setDisputeView: (view: DisputeView) => void;
  filteredDisputes: BookingDispute[];
  selectedDispute?: BookingDispute;
  setSelectedDisputeId: (id: string) => void;
  platformSettings: PlatformSettings;
  clientBookings: Booking[];
  requests: CraftsmanBookingRequest[];
  signedDisputeEvidenceUrls: Record<string, string>;
  adminActionId: string | null;
  adminApiLoading: boolean;
  markDisputeReviewing: (dispute: BookingDispute) => void;
  resolveDispute: (dispute: BookingDispute, resolution: AdminDisputeResolution) => void;
  can: (permission: AdminPermission) => boolean;
}

export const AdminDisputesTab: React.FC<AdminDisputesTabProps> = ({
  disputeViewCounts,
  disputeView,
  setDisputeView,
  filteredDisputes,
  selectedDispute,
  setSelectedDisputeId,
  platformSettings,
  clientBookings,
  requests,
  signedDisputeEvidenceUrls,
  adminActionId,
  adminApiLoading,
  markDisputeReviewing,
  resolveDispute,
  can,
}) => {
  return (
          <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ ...adminCard, padding: 14 }}>
              <h2 style={{ margin: "0 0 6px", fontSize: 18, color: "var(--text)" }}>
                დავების სამუშაო მაგიდა
              </h2>
              <div style={{ color: "var(--text2)", fontSize: 12, lineHeight: 1.5 }}>
                აქტიური დავები აქ ჩანს სამუშაო რიგად. დახურული შემთხვევები არქივში გადადის,
                ხოლო სასწრაფოებში 24 საათზე ძველი ღია დავებია.
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
              {[
                ["აქტიური", disputeViewCounts.active, "#1d4ed8", "#eff6ff"],
                ["სასწრაფო", disputeViewCounts.urgent, "#b91c1c", "#fef2f2"],
                ["განხილვაში", disputeViewCounts.reviewing, "#c2410c", "#fff7ed"],
                ["არქივი", disputeViewCounts.archive, "#64748b", "#f8fafc"],
              ].map(([label, value, color, bg]) => (
                <div key={label} style={{ ...adminCard, padding: 10, background: String(bg) }}>
                  <div style={{ color: String(color), fontSize: 19, fontWeight: 950 }}>
                    {value}
                  </div>
                  <div style={{ marginTop: 2, color: "var(--text2)", fontSize: 10, fontWeight: 900 }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 2 }}>
              {[
                ["active", "აქტიური"],
                ["urgent", "სასწრაფო"],
                ["reviewing", "განხილვაში"],
                ["archive", "დახურული არქივი"],
              ].map(([value, label]) => {
                const active = disputeView === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDisputeView(value as DisputeView)}
                    style={{
                      flex: "0 0 auto",
                      minHeight: 36,
                      padding: "0 12px",
                      borderRadius: 999,
                      background: active ? "var(--primary)" : "white",
                      color: active ? "white" : "var(--text2)",
                      border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
                      fontSize: 11,
                      fontWeight: 950,
                    }}
                  >
                    {label} · {disputeViewCounts[value as DisputeView]}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {filteredDisputes.length ? (
                filteredDisputes.map((dispute) => {
                  const disputeUi = disputeStatusUi(dispute.status);
                  const disputeAge = hoursSince(dispute.createdAt);
                  const isUrgentDispute = disputePriorityScore(dispute) >= 3;
                  const selected = selectedDispute?.id === dispute.id;
                  const amount = dispute.amount || platformSettings.bookingFee;
                  const paymentStatus = dispute.paymentStatus || "held";
                  return (
                    <button
                      key={dispute.id}
                      type="button"
                      onClick={() => setSelectedDisputeId(dispute.id)}
                      style={{
                        width: "100%",
                        padding: 12,
                        borderRadius: 14,
                        textAlign: "left",
                        background: selected ? "#eff6ff" : "white",
                        border: `1px solid ${selected ? "#bfdbfe" : "var(--border)"}`,
                        boxShadow: selected ? "0 10px 24px rgba(30,64,175,.08)" : "none",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <strong style={{ display: "block", color: "var(--text)", fontSize: 14 }}>
                            {dispute.reason}
                          </strong>
                          <div style={{ marginTop: 4, color: "var(--text2)", fontSize: 12, fontWeight: 800 }}>
                            {dispute.clientName || "კლიენტი"} {"->"} {dispute.workerName || "ხელოსანი"}
                          </div>
                        </div>
                        <span
                          style={{
                            flexShrink: 0,
                            padding: "5px 8px",
                            borderRadius: 999,
                            background: disputeUi.bg,
                            color: disputeUi.color,
                            fontSize: 10,
                            fontWeight: 950,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {disputeUi.label}
                        </span>
                      </div>
                      <div style={{ marginTop: 7, color: "var(--text3)", fontSize: 11, fontWeight: 850 }}>
                        {dispute.service || "სერვისი"} · {dispute.dateLabel || "თარიღი"} ·{" "}
                        {dispute.time || "დრო"} · {money(amount)}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                        <span style={{ padding: "4px 8px", borderRadius: 999, background: "#f8fafc", color: "var(--text2)", fontSize: 10, fontWeight: 900 }}>
                          {disputeAge} სთ გახსნილია
                        </span>
                        <span style={{ padding: "4px 8px", borderRadius: 999, background: "#f8fafc", color: "var(--text2)", fontSize: 10, fontWeight: 900 }}>
                          {paymentStatusShortLabel[paymentStatus]}
                        </span>
                        {(dispute.evidence || []).length > 0 && (
                          <span style={{ padding: "4px 8px", borderRadius: 999, background: "#fff7ed", color: "#c2410c", fontSize: 10, fontWeight: 950 }}>
                            {(dispute.evidence || []).length} ფოტო
                          </span>
                        )}
                        {isUrgentDispute && (
                          <span style={{ padding: "4px 8px", borderRadius: 999, background: "#fef2f2", color: "#b91c1c", fontSize: 10, fontWeight: 950 }}>
                            სასწრაფო
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div style={{ ...adminCard, padding: 30, textAlign: "center", color: "var(--text3)", fontWeight: 850 }}>
                  ამ ხედში დავა არ მოიძებნა
                </div>
              )}
            </div>

            {selectedDispute && (
              (() => {
                const dispute = selectedDispute;
                const disputeUi = disputeStatusUi(dispute.status);
                const linkedBooking = clientBookings.find(
                  (booking) => booking.id === dispute.bookingId
                );
                const linkedRequest = requests.find(
                  (request) => request.id === dispute.bookingId
                );
                const disputeEvidence = dispute.evidence || [];
                const paymentStatus = dispute.paymentStatus || linkedBooking?.paymentStatus || "held";
                const amount =
                  dispute.amount || linkedBooking?.bookingFee || platformSettings.bookingFee;
                const reviewingLoading =
                  adminActionId === `dispute:${dispute.id}:reviewing`;
                const refundLoading =
                  adminActionId === `dispute:${dispute.id}:refund_client`;
                const releaseLoading =
                  adminActionId === `dispute:${dispute.id}:release_worker`;
                const warningLoading =
                  adminActionId === `dispute:${dispute.id}:warning`;
                return (
                  <div style={{ ...adminCard, padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <h2 style={{ margin: 0, color: "var(--text)", fontSize: 18 }}>
                          დავის დეტალები
                        </h2>
                        <div style={{ marginTop: 4, color: "var(--text3)", fontSize: 11, fontWeight: 850 }}>
                          #{dispute.bookingId.slice(-8)} · {formatDate(dispute.createdAt)} ·{" "}
                          {hoursSince(dispute.createdAt)} სთ
                        </div>
                      </div>
                      <span
                        style={{
                          alignSelf: "flex-start",
                          padding: "6px 9px",
                          borderRadius: 999,
                          background: disputeUi.bg,
                          color: disputeUi.color,
                          fontSize: 11,
                          fontWeight: 950,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {disputeUi.label}
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
                      {[
                        ["კლიენტი", dispute.clientName || linkedRequest?.clientName || "კლიენტი"],
                        ["ხელოსანი", dispute.workerName || linkedBooking?.worker.name || "ხელოსანი"],
                        ["სერვისი", dispute.service || linkedBooking?.worker.role || linkedRequest?.service || "სერვისი"],
                        ["თანხა", `${money(amount)} · ${paymentStatusShortLabel[paymentStatus]}`],
                      ].map(([label, value]) => (
                        <div key={label} style={{ padding: 10, borderRadius: 12, background: "#f8fafc", border: "1px solid var(--border)" }}>
                          <div style={{ color: "var(--text3)", fontSize: 10, fontWeight: 900 }}>{label}</div>
                          <div style={{ marginTop: 4, color: "var(--text)", fontSize: 12, fontWeight: 950, lineHeight: 1.35 }}>
                            {value}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "#fff7ed", border: "1px solid #fed7aa" }}>
                      <div style={{ color: "#9a3412", fontSize: 13, fontWeight: 950 }}>
                        {dispute.reason}
                      </div>
                      <div style={{ marginTop: 6, color: "#7c2d12", fontSize: 12, lineHeight: 1.5, fontWeight: 800 }}>
                        {dispute.details || "კლიენტს დამატებითი აღწერა არ დაუწერია."}
                      </div>
                    </div>

                    {disputeEvidence.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ color: "var(--text)", fontSize: 13, fontWeight: 950, marginBottom: 8 }}>
                          მტკიცებულებები
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                          {disputeEvidence.map((item, index) => {
                            const signedUrl =
                              signedDisputeEvidenceUrls[`${dispute.id}:${index}`] ||
                              item.url;
                            return (
                              <a
                                key={`${item.url}-${index}`}
                                href={signedUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{ aspectRatio: "1 / 1", borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)", background: "#f8fafc" }}
                              >
                                {signedUrl ? (
                                  <img src={signedUrl} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                ) : (
                                  <span style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--text3)", fontSize: 10, fontWeight: 850 }}>
                                    ვერ გაიხსნა
                                  </span>
                                )}
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {dispute.adminNote && (
                      <div style={{ marginTop: 12, padding: 10, borderRadius: 12, background: "#f8fafc", color: "var(--text2)", fontSize: 12, lineHeight: 1.45, fontWeight: 800 }}>
                        Admin ჩანაწერი: {dispute.adminNote}
                      </div>
                    )}

                    {dispute.status !== "resolved" ? (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
                        <button
                          type="button"
                          disabled={adminApiLoading || dispute.status === "reviewing"}
                          onClick={() => markDisputeReviewing(dispute)}
                          style={{
                            ...actionButton(dispute.status === "reviewing" ? "#e2e8f0" : "#f97316", dispute.status === "reviewing" ? "var(--text3)" : "white"),
                            gridColumn: "1 / -1",
                          }}
                        >
                          {reviewingLoading ? "ინიშნება..." : "განხილვაში გადაყვანა"}
                        </button>
                        {can("finance") && (
                          <button type="button" disabled={adminApiLoading} onClick={() => resolveDispute(dispute, "refund_client")} style={actionButton("#ef4444")}>
                            {refundLoading ? "ბრუნდება..." : "კლიენტისთვის თანხის დაბრუნება"}
                          </button>
                        )}
                        {can("finance") && (
                          <button type="button" disabled={adminApiLoading} onClick={() => resolveDispute(dispute, "release_worker")} style={actionButton("#10b981")}>
                            {releaseLoading ? "იხურება..." : "ხელოსნის მხარეს დახურვა"}
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={adminApiLoading}
                          onClick={() => resolveDispute(dispute, "warning")}
                          style={{ ...actionButton("#fff7ed", "#c2410c"), gridColumn: "1 / -1", border: "1px solid #fed7aa" }}
                        >
                          {warningLoading ? "იხურება..." : "გაფრთხილებით დახურვა"}
                        </button>
                      </div>
                    ) : (
                      <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: "#f8fafc", border: "1px solid var(--border)", color: "var(--text2)", fontSize: 12, fontWeight: 850 }}>
                        დავა დახურულია · {dispute.resolvedAt ? formatDate(dispute.resolvedAt) : "თარიღი არ არის"}
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </section>
  );
};
