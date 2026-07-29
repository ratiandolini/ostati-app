import React from "react";
import { actionButton, adminCard } from "./adminUi";
import {
  accountLabel,
  adminAccountLabel,
  verificationLabel,
} from "./adminLabels";
import { money } from "./adminUtils";
import type { AdminPermission } from "./adminPermissions";
import type { AdminUserSummary } from "../../services/adminApiService";
import type { AdminMember, ClientProfile, CraftsmanProfile } from "../../services/dataService";

interface UserStats {
  total: number;
  active: number;
  disputed: number;
  cancelled: number;
  completed: number;
  amount: number;
  lastActivity?: string | null;
}

interface AdminUsersTabProps {
  can: (permission: AdminPermission) => boolean;
  adminMembers: AdminMember[];
  toggleAdminMember: (member: AdminMember) => void;
  adminApiLoading: boolean;
  adminUsersState: AdminUserSummary[] | null;
  filteredAdminCraftsmen: AdminUserSummary[];
  filteredAdminClients: AdminUserSummary[];
  profile: CraftsmanProfile;
  craftsmanUserStats: UserStats;
  filteredClients: string[];
  fallbackStorage: {
    getClientProfile: (phone: string) => ClientProfile;
  };
  getClientUserStats: (phone: string) => UserStats;
  setCraftsmanAccountStatus: (
    status: NonNullable<CraftsmanProfile["accountStatus"]>,
    targetPhone?: string
  ) => void;
  setClientAccountStatus: (
    phone: string,
    status: NonNullable<ClientProfile["accountStatus"]>
  ) => void;
}

export const AdminUsersTab: React.FC<AdminUsersTabProps> = ({
  can,
  adminMembers,
  toggleAdminMember,
  adminApiLoading,
  adminUsersState,
  filteredAdminCraftsmen,
  filteredAdminClients,
  profile,
  craftsmanUserStats,
  filteredClients,
  fallbackStorage,
  getClientUserStats,
  setCraftsmanAccountStatus,
  setClientAccountStatus,
}) => (
          <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {can("settings") && (
            <div style={{ ...adminCard, padding: 14 }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 17, color: "var(--text)" }}>
                Admin წევრები და უფლებები
              </h2>
              <div style={{ color: "var(--text2)", fontSize: 12, lineHeight: 1.5 }}>
                Production-ში აქ რეალური admin მომხმარებლები მიებმება. თითოეულს
                ექნება მხოლოდ თავისი უფლება: ვერიფიკაცია, support, ფინანსები ან სრული კონტროლი.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                {adminMembers.map((member) => (
                  <div
                    key={member.id}
                    style={{
                      padding: 11,
                      borderRadius: 12,
                      background: member.active ? "#f8fafc" : "#f1f5f9",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ display: "block", color: "var(--text)", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {member.name}
                        </strong>
                        <div style={{ marginTop: 3, color: "var(--text3)", fontSize: 10, fontWeight: 850 }}>
                          {member.role} · {member.permissions.join(", ")}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleAdminMember(member)}
                        disabled={adminApiLoading}
                        style={{
                          flexShrink: 0,
                          minHeight: 32,
                          padding: "0 10px",
                          borderRadius: 999,
                          background: member.active ? "#dcfce7" : "#fef2f2",
                          color: member.active ? "#047857" : "#b91c1c",
                          border: `1px solid ${member.active ? "#bbf7d0" : "#fecaca"}`,
                          fontSize: 10,
                          fontWeight: 950,
                        }}
                      >
                        {member.active ? "აქტიური" : "გამორთული"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            )}

            {adminUsersState && (
              <>
                <div style={{ ...adminCard, padding: 14 }}>
                  <h2 style={{ margin: "0 0 8px", fontSize: 17, color: "var(--text)" }}>
                    ხელოსნები
                  </h2>
                  <div style={{ color: "var(--text2)", fontSize: 12, lineHeight: 1.45 }}>
                    Supabase-იდან წამოსული ხელოსნები, ვერიფიკაცია და სამუშაო სტატისტიკა.
                  </div>
                </div>
                {filteredAdminCraftsmen.length ? (
                  filteredAdminCraftsmen.map((craftsman) => {
                    const displayName =
                      [craftsman.firstName, craftsman.lastName]
                        .filter(Boolean)
                        .join(" ") || `+995 ${craftsman.phone}`;
                    return (
                      <div key={craftsman.id} style={{ ...adminCard, padding: 14 }}>
                        <strong style={{ color: "var(--text)", fontSize: 14 }}>
                          {displayName}
                        </strong>
                        <div style={{ marginTop: 4, color: "var(--text2)", fontSize: 12, lineHeight: 1.45 }}>
                          +995 {craftsman.phone} · {craftsman.workerRole || "ხელოსანი"} ·{" "}
                          {adminAccountLabel(craftsman.status)} ·{" "}
                          {verificationLabel[
                            craftsman.verificationStatus === "not_started" || !craftsman.verificationStatus
                              ? "not_submitted"
                              : craftsman.verificationStatus
                          ]}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7, marginTop: 12 }}>
                          {[
                            ["ჯავშნები", craftsman.stats.total],
                            ["აქტიური", craftsman.stats.active],
                            ["დავაში", craftsman.stats.disputed],
                            ["გაუქმ.", craftsman.stats.cancelled],
                            ["დახურული", craftsman.stats.completed],
                            ["თანხა", money(craftsman.stats.amount)],
                          ].map(([label, value]) => (
                            <div key={label} style={{ padding: 9, borderRadius: 11, background: "#f8fafc", border: "1px solid var(--border)" }}>
                              <div style={{ color: "var(--text)", fontSize: 13, fontWeight: 950 }}>
                                {value}
                              </div>
                              <div style={{ marginTop: 2, color: "var(--text3)", fontSize: 10, fontWeight: 850 }}>
                                {label}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div style={{ marginTop: 8, color: "var(--text3)", fontSize: 11, fontWeight: 800 }}>
                          ბოლო აქტივობა:{" "}
                          {craftsman.stats.lastActivity
                            ? `${new Date(craftsman.stats.lastActivity).toLocaleDateString("ka-GE")} · ${new Date(craftsman.stats.lastActivity).toLocaleTimeString("ka-GE", { hour: "2-digit", minute: "2-digit" })}`
                            : "აქტივობა არ არის"}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginTop: 12 }}>
                          <button type="button" onClick={() => setCraftsmanAccountStatus("active", craftsman.phone)} disabled={adminApiLoading} style={actionButton("#10b981")}>
                            აქტიური
                          </button>
                          <button type="button" onClick={() => setCraftsmanAccountStatus("limited", craftsman.phone)} disabled={adminApiLoading} style={actionButton("#f97316")}>
                            შეზღუდვა
                          </button>
                          <button type="button" onClick={() => setCraftsmanAccountStatus("blocked", craftsman.phone)} disabled={adminApiLoading} style={actionButton("#ef4444")}>
                            ბლოკი
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ ...adminCard, padding: 22, textAlign: "center", color: "var(--text3)", fontWeight: 800 }}>
                    ხელოსანი ამ ფილტრით არ მოიძებნა
                  </div>
                )}

                <div style={{ ...adminCard, padding: 14 }}>
                  <h2 style={{ margin: "0 0 8px", fontSize: 17, color: "var(--text)" }}>
                    კლიენტები
                  </h2>
                  <div style={{ color: "var(--text2)", fontSize: 12, lineHeight: 1.45 }}>
                    Supabase მომხმარებლები ჯავშნების, დავების და თანხების სტატისტიკით.
                  </div>
                </div>
                {filteredAdminClients.length ? (
                  filteredAdminClients.map((client) => {
                    const displayName =
                      [client.firstName, client.lastName].filter(Boolean).join(" ") ||
                      `+995 ${client.phone}`;
                    return (
                      <div key={client.id} style={{ ...adminCard, padding: 14 }}>
                        <strong style={{ color: "var(--text)", fontSize: 14 }}>
                          {displayName}
                        </strong>
                        <div style={{ marginTop: 4, color: "var(--text2)", fontSize: 12 }}>
                          +995 {client.phone} · {adminAccountLabel(client.status)}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7, marginTop: 12 }}>
                          {[
                            ["ჯავშნები", client.stats.total],
                            ["აქტიური", client.stats.active],
                            ["დავაში", client.stats.disputed],
                            ["გაუქმ.", client.stats.cancelled],
                            ["დახურული", client.stats.completed],
                            ["თანხა", money(client.stats.amount)],
                          ].map(([label, value]) => (
                            <div key={label} style={{ padding: 9, borderRadius: 11, background: "#f8fafc", border: "1px solid var(--border)" }}>
                              <div style={{ color: "var(--text)", fontSize: 13, fontWeight: 950 }}>
                                {value}
                              </div>
                              <div style={{ marginTop: 2, color: "var(--text3)", fontSize: 10, fontWeight: 850 }}>
                                {label}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div style={{ marginTop: 8, color: "var(--text3)", fontSize: 11, fontWeight: 800 }}>
                          ბოლო აქტივობა:{" "}
                          {client.stats.lastActivity
                            ? `${new Date(client.stats.lastActivity).toLocaleDateString("ka-GE")} · ${new Date(client.stats.lastActivity).toLocaleTimeString("ka-GE", { hour: "2-digit", minute: "2-digit" })}`
                            : "აქტივობა არ არის"}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginTop: 12 }}>
                          <button type="button" onClick={() => setClientAccountStatus(client.phone, "active")} disabled={adminApiLoading} style={actionButton("#10b981")}>
                            აქტიური
                          </button>
                          <button type="button" onClick={() => setClientAccountStatus(client.phone, "limited")} disabled={adminApiLoading} style={actionButton("#f97316")}>
                            შეზღუდვა
                          </button>
                          <button type="button" onClick={() => setClientAccountStatus(client.phone, "blocked")} disabled={adminApiLoading} style={actionButton("#ef4444")}>
                            ბლოკი
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ ...adminCard, padding: 22, textAlign: "center", color: "var(--text3)", fontWeight: 800 }}>
                    კლიენტი ამ ფილტრით არ მოიძებნა
                  </div>
                )}
              </>
            )}

            {!adminUsersState && (
              <>
            <div style={{ ...adminCard, padding: 14 }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 17, color: "var(--text)" }}>
                ხელოსანი
              </h2>
              <div style={{ color: "var(--text2)", fontSize: 12 }}>
                {profile.name || "ხელოსანი"} · {accountLabel[profile.accountStatus || "active"]}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7, marginTop: 12 }}>
                {[
                  ["ჯავშნები", craftsmanUserStats.total],
                  ["აქტიური", craftsmanUserStats.active],
                  ["დავაში", craftsmanUserStats.disputed],
                  ["გაუქმ.", craftsmanUserStats.cancelled],
                  ["დახურული", craftsmanUserStats.completed],
                  ["თანხა", money(craftsmanUserStats.amount)],
                ].map(([label, value]) => (
                  <div key={label} style={{ padding: 9, borderRadius: 11, background: "#f8fafc", border: "1px solid var(--border)" }}>
                    <div style={{ color: "var(--text)", fontSize: 13, fontWeight: 950 }}>
                      {value}
                    </div>
                    <div style={{ marginTop: 2, color: "var(--text3)", fontSize: 10, fontWeight: 850 }}>
                      {label}
                    </div>
                  </div>
                ))}
              </div>
              {profile.adminNote && (
                <div style={{ marginTop: 9, padding: 10, borderRadius: 12, background: "#f8fafc", color: "var(--text2)", fontSize: 12, lineHeight: 1.45 }}>
                  Admin ჩანაწერი: {profile.adminNote}
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginTop: 12 }}>
                <button type="button" onClick={() => setCraftsmanAccountStatus("active")} disabled={adminApiLoading} style={actionButton("#10b981")}>
                  აქტიური
                </button>
                <button type="button" onClick={() => setCraftsmanAccountStatus("limited")} disabled={adminApiLoading} style={actionButton("#f97316")}>
                  შეზღუდვა
                </button>
                <button type="button" onClick={() => setCraftsmanAccountStatus("blocked")} disabled={adminApiLoading} style={actionButton("#ef4444")}>
                  ბლოკი
                </button>
              </div>
            </div>
            {filteredClients.length ? (
              filteredClients.map((phone) => {
                const client = fallbackStorage.getClientProfile(phone);
                const stats = getClientUserStats(phone);
                return (
                  <div key={phone} style={{ ...adminCard, padding: 14 }}>
                    <strong style={{ color: "var(--text)", fontSize: 14 }}>
                      {[client.firstName, client.lastName].filter(Boolean).join(" ") || `+995 ${phone}`}
                    </strong>
                    <div style={{ marginTop: 4, color: "var(--text2)", fontSize: 12 }}>
                      +995 {phone} · {accountLabel[client.accountStatus || "active"]}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7, marginTop: 12 }}>
                      {[
                        ["ჯავშნები", stats.total],
                        ["აქტიური", stats.active],
                        ["დავაში", stats.disputed],
                        ["გაუქმ.", stats.cancelled],
                        ["დახურული", stats.completed],
                        ["თანხა", money(stats.amount)],
                      ].map(([label, value]) => (
                        <div key={label} style={{ padding: 9, borderRadius: 11, background: "#f8fafc", border: "1px solid var(--border)" }}>
                          <div style={{ color: "var(--text)", fontSize: 13, fontWeight: 950 }}>
                            {value}
                          </div>
                          <div style={{ marginTop: 2, color: "var(--text3)", fontSize: 10, fontWeight: 850 }}>
                            {label}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 8, color: "var(--text3)", fontSize: 11, fontWeight: 800 }}>
                      ბოლო აქტივობა: {stats.lastActivity}
                    </div>
                    {client.adminNote && (
                      <div style={{ marginTop: 9, padding: 10, borderRadius: 12, background: "#f8fafc", color: "var(--text2)", fontSize: 12, lineHeight: 1.45 }}>
                        Admin ჩანაწერი: {client.adminNote}
                      </div>
                    )}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginTop: 12 }}>
                      <button type="button" onClick={() => setClientAccountStatus(phone, "active")} disabled={adminApiLoading} style={actionButton("#10b981")}>
                        აქტიური
                      </button>
                      <button type="button" onClick={() => setClientAccountStatus(phone, "limited")} disabled={adminApiLoading} style={actionButton("#f97316")}>
                        შეზღუდვა
                      </button>
                      <button type="button" onClick={() => setClientAccountStatus(phone, "blocked")} disabled={adminApiLoading} style={actionButton("#ef4444")}>
                        ბლოკი
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ ...adminCard, padding: 22, textAlign: "center", color: "var(--text3)", fontWeight: 800 }}>
                მომხმარებელი ამ ფილტრით არ მოიძებნა
              </div>
            )}
              </>
            )}
          </section>
);
