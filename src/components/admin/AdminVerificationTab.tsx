import React, { useState } from "react";
import { actionButton, adminCard } from "./adminUi";
import { verificationLabel } from "./adminLabels";
import type { VerificationFilter } from "./adminTypes";
import type { CraftsmanProfile } from "../../services/dataService";
import type {
  AdminVerificationItem,
  AdminVerificationStatus,
} from "../../services/adminApiService";

interface VerificationFlags {
  idFront: boolean;
  idBack: boolean;
  bankAccount: boolean;
}

type VerificationDocuments = AdminVerificationItem["documents"];

interface AdminVerificationTabProps {
  verificationQueue: AdminVerificationItem[];
  verificationFilter: VerificationFilter;
  setVerificationFilter: (filter: VerificationFilter) => void;
  filteredVerificationQueue: AdminVerificationItem[];
  verificationTarget?: AdminVerificationItem;
  setSelectedVerificationWorkerId: (workerId: string) => void;
  profile: CraftsmanProfile;
  verificationStatus: keyof typeof verificationLabel;
  verification: VerificationFlags;
  uploadedDocumentCount: number;
  verificationDocuments: VerificationDocuments;
  isDemoDataMode: boolean;
  signedVerificationUrls: Record<string, string>;
  adminApiLoading: boolean;
  setVerificationStatus: (status: AdminVerificationStatus, note: string) => void;
}

export const AdminVerificationTab: React.FC<AdminVerificationTabProps> = ({
  verificationQueue,
  verificationFilter,
  setVerificationFilter,
  filteredVerificationQueue,
  verificationTarget,
  setSelectedVerificationWorkerId,
  profile,
  verificationStatus,
  verification,
  uploadedDocumentCount,
  verificationDocuments,
  isDemoDataMode,
  signedVerificationUrls,
  adminApiLoading,
  setVerificationStatus,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [queuePage, setQueuePage] = useState(0);
  const queuePageSize = 10;
  const queuePageCount = Math.max(1, Math.ceil(filteredVerificationQueue.length / queuePageSize));
  const visibleVerificationQueue = filteredVerificationQueue.slice(
    queuePage * queuePageSize,
    (queuePage + 1) * queuePageSize
  );

  return (
          <section style={{ ...adminCard, padding: 16 }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18, color: "var(--text)" }}>
                    ვერიფიკაციის რიგი
                  </h2>
                  <p style={{ margin: "5px 0 0", color: "var(--text2)", fontSize: 12, lineHeight: 1.45 }}>
                    ბევრი ხელოსანი აქ მოკლე სიად გამოჩნდება. დოკუმენტები გაიხსნება მხოლოდ არჩეულ ქარდზე.
                  </p>
                </div>
                <span
                  style={{
                    flexShrink: 0,
                    padding: "7px 10px",
                    borderRadius: 999,
                    background: verificationQueue.length ? "#eff6ff" : "#f8fafc",
                    color: verificationQueue.length ? "#1d4ed8" : "var(--text3)",
                    border: `1px solid ${verificationQueue.length ? "#bfdbfe" : "var(--border)"}`,
                    fontSize: 11,
                    fontWeight: 950,
                  }}
                >
                  {verificationQueue.length} ხელოსანი
                </span>
              </div>

              {verificationQueue.length > 0 && (
                <>
                  <div style={{ display: "flex", gap: 7, overflowX: "auto", padding: "12px 0 4px" }}>
                    {[
                      ["all", "ყველა"],
                      ["pending", "შესამოწმებელი"],
                      ["verified", "დადასტურებული"],
                      ["rejected", "უარყოფილი"],
                    ].map(([value, label]) => {
                      const active = verificationFilter === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            setVerificationFilter(value as VerificationFilter);
                            setQueuePage(0);
                          }}
                          style={{
                            flex: "0 0 auto",
                            minHeight: 34,
                            padding: "0 11px",
                            borderRadius: 999,
                            background: active ? "var(--primary)" : "#f8fafc",
                            color: active ? "white" : "var(--text2)",
                            border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
                            fontSize: 11,
                            fontWeight: 950,
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                    {visibleVerificationQueue.map((item) => {
                      const selected = verificationTarget?.workerId === item.workerId;
                      const docs = [
                        item.documents.idFront,
                        item.documents.idBack,
                        item.documents.bankAccount,
                      ].filter(Boolean).length;
                      const pending = item.verificationStatus === "pending";
                      const verified = item.verificationStatus === "verified";
                      return (
                        <button
                          key={item.workerId}
                          type="button"
                          onClick={() => {
                            setSelectedVerificationWorkerId(item.workerId);
                            setShowDetails(true);
                          }}
                          style={{
                            width: "100%",
                            padding: 11,
                            borderRadius: 14,
                            background: selected ? "#eff6ff" : "white",
                            border: `1px solid ${selected ? "#bfdbfe" : "var(--border)"}`,
                            textAlign: "left",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                            <div style={{ minWidth: 0 }}>
                              <strong style={{ display: "block", color: "var(--text)", fontSize: 13, lineHeight: 1.25 }}>
                                {item.name || "ხელოსანი"}
                              </strong>
                              <span style={{ display: "block", marginTop: 3, color: "var(--text2)", fontSize: 11, fontWeight: 800 }}>
                                {item.phone} · {item.city || "ქალაქი არაა"} · {docs}/3 დოკ.
                              </span>
                            </div>
                            <span
                              style={{
                                flexShrink: 0,
                                padding: "5px 8px",
                                borderRadius: 999,
                                background: verified ? "#dcfce7" : pending ? "#fff7ed" : "#fef2f2",
                                color: verified ? "#047857" : pending ? "#c2410c" : "#b91c1c",
                                fontSize: 10,
                                fontWeight: 950,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {verificationLabel[
                                item.verificationStatus === "not_started"
                                  ? "not_submitted"
                                  : item.verificationStatus
                              ]}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                    {!filteredVerificationQueue.length && (
                      <div
                        style={{
                          padding: 18,
                          borderRadius: 14,
                          background: "#f8fafc",
                          border: "1px solid var(--border)",
                          color: "var(--text3)",
                          fontSize: 12,
                          fontWeight: 850,
                          textAlign: "center",
                        }}
                      >
                        ამ ფილტრით ხელოსანი არ მოიძებნა.
                      </div>
                    )}
                  </div>
                  {filteredVerificationQueue.length > queuePageSize && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 12 }}>
                      <span style={{ color: "var(--text3)", fontSize: 11, fontWeight: 850 }}>
                        გვერდი {queuePage + 1} / {queuePageCount}
                      </span>
                      <div style={{ display: "flex", gap: 7 }}>
                        <button
                          type="button"
                          disabled={queuePage === 0}
                          onClick={() => setQueuePage((page) => Math.max(0, page - 1))}
                          style={actionButton(queuePage === 0 ? "#dbe4ef" : "#f1f5f9", queuePage === 0 ? "#94a3b8" : "var(--text)")}
                        >
                          წინა
                        </button>
                        <button
                          type="button"
                          disabled={queuePage >= queuePageCount - 1}
                          onClick={() => setQueuePage((page) => Math.min(queuePageCount - 1, page + 1))}
                          style={actionButton(queuePage >= queuePageCount - 1 ? "#dbe4ef" : "var(--primary)", queuePage >= queuePageCount - 1 ? "#94a3b8" : "white")}
                        >
                          შემდეგი
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {showDetails && (
              <>
            {verificationQueue.length > 0 && <div style={{ height: 1, background: "var(--border)", margin: "8px 0 14px" }} />}

            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, color: "var(--text)" }}>
                  არჩეული ხელოსნის ვერიფიკაცია
                </h2>
                <p style={{ margin: "5px 0 0", color: "var(--text2)", fontSize: 12 }}>
                  {verificationTarget?.name || profile.name || "ხელოსანი"} ·{" "}
                  {verificationTarget?.phone || profile.phone || "ნომერი არ არის"}
                </p>
              </div>
              <span
                style={{
                  alignSelf: "flex-start",
                  padding: "6px 9px",
                  borderRadius: 999,
                  background: verificationStatus === "verified" ? "#dcfce7" : "#fff7ed",
                  color: verificationStatus === "verified" ? "#047857" : "#c2410c",
                  fontSize: 11,
                  fontWeight: 900,
                  whiteSpace: "nowrap",
                }}
              >
                {verificationLabel[verificationStatus]}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowDetails(false)}
              style={{ ...actionButton("#f1f5f9", "var(--text)"), marginTop: 12 }}
            >
              დეტალების დამალვა
            </button>
            <div
              style={{
                marginTop: 12,
                padding: 10,
                borderRadius: 14,
                background: "#f8fafc",
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ color: "var(--text)", fontSize: 12, fontWeight: 950 }}>
                პროფილის ფოტო
              </div>
              {verificationTarget?.photoUrl ? (
                <img
                  src={verificationTarget.photoUrl}
                  alt="ხელოსნის პროფილის ფოტო"
                  style={{
                    width: 112,
                    height: 112,
                    marginTop: 8,
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "1px solid var(--border)",
                    display: "block",
                  }}
                />
              ) : (
                <div style={{ marginTop: 7, color: "var(--text3)", fontSize: 12, fontWeight: 850 }}>
                  პროფილის ფოტო ჯერ არ აქვს ატვირთული
                </div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 14 }}>
              {[
                { label: "პირადობა 1", uploaded: verification.idFront },
                { label: "პირადობა 2", uploaded: verification.idBack },
                { label: "ანგარიში", uploaded: verification.bankAccount },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    padding: 10,
                    borderRadius: 12,
                    background: item.uploaded ? "#ecfdf5" : "#f8fafc",
                    border: `1px solid ${item.uploaded ? "#bbf7d0" : "var(--border)"}`,
                    color: item.uploaded ? "#047857" : "var(--text3)",
                    fontSize: 11,
                    fontWeight: 900,
                    textAlign: "center",
                  }}
                >
                  {item.label}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, color: "var(--text2)", fontSize: 12, lineHeight: 1.5 }}>
              ატვირთულია {uploadedDocumentCount}/3 დოკუმენტი. Admin-ის დადასტურების შემდეგ
              ხელოსანი გამოჩნდება როგორც ვერიფიცირებული.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, marginTop: 12 }}>
              {[
                { key: "idFront" as const, label: "პირადობის წინა მხარე" },
                { key: "idBack" as const, label: "პირადობის უკანა მხარე" },
                { key: "bankAccount" as const, label: "ანგარიში ჩარიცხვისთვის" },
              ].map((item) => {
                const documentValue = verificationDocuments[item.key];
                const isBankAccount = item.key === "bankAccount";
                const documentUrl =
                  documentValue && !isBankAccount
                    ? isDemoDataMode
                      ? documentValue
                      : signedVerificationUrls[item.key] || ""
                    : "";
                const hasImage =
                  documentUrl.startsWith("data:image/") ||
                  /\.(png|jpe?g|webp)$/i.test(documentUrl.split("?")[0]);
                const hasOpenableFile = Boolean(documentUrl);
                return (
                  <div
                    key={item.key}
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      background: "#f8fafc",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div style={{ color: "var(--text)", fontSize: 12, fontWeight: 950 }}>
                      {item.label}
                    </div>
                    {isBankAccount && documentValue ? (
                      <div
                        style={{
                          marginTop: 8,
                          padding: 10,
                          borderRadius: 10,
                          background: "white",
                          border: "1px solid var(--border)",
                          color: "var(--text)",
                          fontSize: 12,
                          lineHeight: 1.45,
                          fontWeight: 850,
                          wordBreak: "break-word",
                        }}
                      >
                        {documentValue}
                      </div>
                    ) : hasImage ? (
                      <img
                        src={documentUrl}
                        alt={item.label}
                        style={{
                          width: "100%",
                          maxHeight: 170,
                          marginTop: 8,
                          borderRadius: 10,
                          objectFit: "cover",
                          border: "1px solid var(--border)",
                        }}
                      />
                    ) : (
                      <div style={{ marginTop: 7, color: "var(--text3)", fontSize: 12, fontWeight: 850 }}>
                        {verification[item.key] ? (
                          hasOpenableFile ? (
                            <a
                              href={documentUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: "var(--primary)", fontWeight: 950 }}
                            >
                              ფაილის გახსნა
                            </a>
                          ) : (
                            `ფაილი ატვირთულია: ${documentValue}`
                          )
                        ) : (
                          "ფაილი ჯერ არ არის ატვირთული"
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {(profile.verificationNote || profile.adminNote) && (
              <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "#f8fafc", color: "var(--text2)", fontSize: 12, lineHeight: 1.45 }}>
                Admin ჩანაწერი: {profile.verificationNote || profile.adminNote}
              </div>
            )}
            {verificationStatus === "verified" ? (
              <div
                style={{
                  marginTop: 14,
                  padding: 12,
                  borderRadius: 12,
                  background: "#ecfdf5",
                  border: "1px solid #bbf7d0",
                  color: "#047857",
                  fontSize: 13,
                  lineHeight: 1.45,
                  fontWeight: 900,
                }}
              >
                ვერიფიკაცია დასრულებულია. ხელოსნის სამუშაო ადგილი გახსნილია და
                პროფილი კლიენტებთან გამოჩნდება.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
                <button
                  type="button"
                  disabled={adminApiLoading || uploadedDocumentCount < 3}
                  onClick={() => setVerificationStatus("verified", "დადასტურდა admin-ის მიერ")}
                  style={{
                    ...actionButton(uploadedDocumentCount < 3 ? "#dbe4ef" : "#10b981"),
                  }}
                >
                  დადასტურება
                </button>
                <button
                  type="button"
                  disabled={adminApiLoading}
                  onClick={() => {
                    const note = window.prompt(
                      "მიუთითე მიზეზი, რატომ ვერ გაიარა ხელოსანმა ვერიფიკაცია:",
                      "პროფილის ფოტო ან დოკუმენტები ხელახლაა გადასამოწმებელი"
                    );
                    if (note === null) return;
                    setVerificationStatus(
                      "rejected",
                      note.trim() || "პროფილის ფოტო ან დოკუმენტები ხელახლაა გადასამოწმებელი"
                    );
                  }}
                  style={actionButton("#ef4444")}
                >
                  უარყოფა
                </button>
              </div>
            )}
              </>
            )}
          </section>
  );
};
