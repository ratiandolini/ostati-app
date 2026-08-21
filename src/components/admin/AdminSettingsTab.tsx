import React from "react";
import { actionButton, adminCard } from "./adminUi";
import { preflightStatusUi } from "./adminQaConfig";
import { formatDate } from "./adminUtils";
import {
  adminProviderFields,
  legalSettingFields,
  platformSettingNumberFields,
} from "./adminSettingsConfig";
import type { ProductionGuardItem } from "./adminProductionGuard";
import { isDemoDataMode } from "../../services/dataService";
import type { LegalSettings, PlatformSettings } from "../../services/dataService";
import type { SupabasePreflightCheck } from "../../services/supabasePreflightService";

interface PreflightSummary {
  ok: number;
  warning: number;
  error: number;
  requiredErrors: number;
}

interface AdminSettingsTabProps {
  settingsDraft: PlatformSettings;
  legalDraft: LegalSettings;
  setLegalDraft: React.Dispatch<React.SetStateAction<LegalSettings>>;
  updateSettingsDraft: (key: keyof PlatformSettings, value: string) => void;
  updateSettingsChoice: <Key extends keyof PlatformSettings>(
    key: Key,
    value: PlatformSettings[Key]
  ) => void;
  toggleProductionModeDraft: () => void;
  productionGuardItems: ProductionGuardItem[];
  preflightChecks: SupabasePreflightCheck[];
  preflightSummary: PreflightSummary;
  preflightFresh: boolean;
  preflightCheckedAt: string | null;
  preflightScope: string;
  preflightLoading: boolean;
  runPreflight: () => void;
  resetPreflightCache: () => void;
  resetSettingsDrafts: () => void;
  saveLegalSettings: () => void;
  adminApiLoading: boolean;
  adminApiError: string;
  settingsSaveMessage: string;
  settingsDirty: boolean;
}

export const AdminSettingsTab: React.FC<AdminSettingsTabProps> = ({
  settingsDraft,
  legalDraft,
  setLegalDraft,
  updateSettingsDraft,
  updateSettingsChoice,
  toggleProductionModeDraft,
  productionGuardItems,
  preflightChecks,
  preflightSummary,
  preflightFresh,
  preflightCheckedAt,
  preflightScope,
  preflightLoading,
  runPreflight,
  resetPreflightCache,
  resetSettingsDrafts,
  saveLegalSettings,
  adminApiLoading,
  adminApiError,
  settingsSaveMessage,
  settingsDirty,
}) => (
          <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ ...adminCard, padding: 16 }}>
              <h2 style={{ margin: "0 0 6px", fontSize: 18, color: "var(--text)" }}>
                პლატფორმის პარამეტრები
              </h2>
              <div style={{ color: "var(--text2)", fontSize: 12, lineHeight: 1.5 }}>
                ეს მნიშვნელობები გამოიყენება demo ჯავშნებზე და მომავალში იგივე
                წესები გადავა backend/payment ლოგიკაში.
              </div>
            </div>

            <div style={{ ...adminCard, padding: 14, borderColor: "#bfdbfe", background: "#eff6ff" }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 17, color: "var(--text)" }}>
                ფასები და წესები
              </h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 8,
                }}
              >
                {[
                  ["ჯავშანი", `${settingsDraft.bookingFee} ლარი`],
                  ["საკომისიო", `${settingsDraft.commissionPercent}%`],
                  ["გაუქმება", `${settingsDraft.freeCancellationHours} სთ.`],
                  ["დაკავება", `${settingsDraft.lateCancellationFeePercent}%`],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      minWidth: 0,
                      padding: 10,
                      borderRadius: 12,
                      background: "white",
                      border: "1px solid #bfdbfe",
                    }}
                  >
                    <div style={{ color: "var(--text3)", fontSize: 10, fontWeight: 900 }}>
                      {label}
                    </div>
                    <div style={{ marginTop: 3, color: "var(--text)", fontSize: 14, fontWeight: 950 }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 9, color: "#1d4ed8", fontSize: 11, fontWeight: 850, lineHeight: 1.45 }}>
                შესაცვლელი ველები ამავე გვერდზეა ქვემოთ, სათაურებით: ჯავშნის საფასური,
                პლატფორმის საკომისიო და უფასო გაუქმება.
              </div>
            </div>

            <div style={{ ...adminCard, padding: 14 }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 17, color: "var(--text)" }}>
                Production providers
              </h2>
              <div style={{ display: "grid", gap: 10 }}>
                {adminProviderFields.map((item) => (
                  <label
                    key={item.key}
                    style={{ display: "block", color: "var(--text)", fontSize: 13, fontWeight: 950 }}
                  >
                    {item.label}
                    <select
                      value={String(settingsDraft[item.key])}
                      onChange={(event) =>
                        updateSettingsChoice(
                          item.key,
                          event.target.value as PlatformSettings[typeof item.key]
                        )
                      }
                      style={{
                        width: "100%",
                        height: 42,
                        marginTop: 7,
                        padding: "0 12px",
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        background: "#f8fafc",
                        color: "var(--text)",
                        fontSize: 13,
                        fontWeight: 900,
                      }}
                    >
                      {item.options.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                <button
                  type="button"
                  onClick={toggleProductionModeDraft}
                  style={{
                    minHeight: 42,
                    borderRadius: 12,
                    background: settingsDraft.productionMode ? "#dcfce7" : "#fff7ed",
                    color: settingsDraft.productionMode ? "#047857" : "#c2410c",
                    border: `1px solid ${
                      settingsDraft.productionMode ? "#bbf7d0" : "#fed7aa"
                    }`,
                    fontSize: 12,
                    fontWeight: 950,
                  }}
                >
                  {settingsDraft.productionMode
                    ? "Production mode მონიშნულია"
                    : "Production mode გამორთულია"}
                </button>
                <div style={{ color: "var(--text3)", fontSize: 11, lineHeight: 1.45, fontWeight: 750 }}>
                  ჩართვა დაიბლოკება, თუ Supabase/API ან ავტორიზაცია demo რეჟიმშია.
                  Manual MVP hold დროებით საკმარისია სატესტო/საპილოტე გაშვებისთვის,
                  საბანკო provider კი რეალური თანხის ჩამოჭრის ეტაპზე დაემატება.
                </div>
                {!isDemoDataMode && (
                  <div
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      background:
                        preflightChecks.length && preflightSummary.requiredErrors === 0
                          ? "#ecfdf5"
                          : "#fff7ed",
                      border: `1px solid ${
                        preflightChecks.length && preflightSummary.requiredErrors === 0
                          ? "#bbf7d0"
                          : "#fed7aa"
                      }`,
                      color:
                        preflightChecks.length && preflightSummary.requiredErrors === 0
                          ? "#047857"
                          : "#c2410c",
                      fontSize: 11,
                      lineHeight: 1.45,
                      fontWeight: 850,
                    }}
                    >
                      {preflightChecks.length
                      ? preflightSummary.requiredErrors === 0 && preflightFresh
                        ? `Supabase preflight ახალია და აუცილებელი შეცდომა არ დარჩა. ბოლო: ${formatDate(preflightCheckedAt || undefined)}`
                        : preflightSummary.requiredErrors === 0
                          ? `Supabase preflight მწვანეა, მაგრამ 24 საათზე ძველია. ბოლო: ${formatDate(preflightCheckedAt || undefined)}`
                          : `Supabase preflight-ში ${preflightSummary.requiredErrors} აუცილებელი შეცდომაა. ბოლო: ${formatDate(preflightCheckedAt || undefined)}`
                      : "Production-მდე ჯერ გაუშვი Supabase შემოწმება ამავე გვერდზე."}
                  </div>
                )}
              </div>
            </div>

            <div
              style={{
                ...adminCard,
                padding: 14,
                borderColor: productionGuardItems.length ? "#fed7aa" : "#bbf7d0",
                background: productionGuardItems.length ? "#fff7ed" : "#f0fdf4",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <h2 style={{ margin: "0 0 6px", fontSize: 17, color: "var(--text)" }}>
                    Production ბლოკერები
                  </h2>
                  <div
                    style={{
                      color: productionGuardItems.length ? "#9a3412" : "#047857",
                      fontSize: 12,
                      fontWeight: 850,
                      lineHeight: 1.45,
                    }}
                  >
                    {productionGuardItems.length
                      ? "ქვემოთ დარჩენილია ის პუნქტები, რომლებიც production mode-ს ბლოკავს."
                      : "ყველა აუცილებელი პუნქტი მზადაა. Production mode-ის მონიშვნა შეიძლება."}
                  </div>
                </div>
                <div
                  style={{
                    flexShrink: 0,
                    minWidth: 42,
                    height: 34,
                    borderRadius: 999,
                    display: "grid",
                    placeItems: "center",
                    background: productionGuardItems.length ? "#ffedd5" : "#dcfce7",
                    color: productionGuardItems.length ? "#c2410c" : "#047857",
                    border: `1px solid ${productionGuardItems.length ? "#fdba74" : "#86efac"}`,
                    fontSize: 13,
                    fontWeight: 950,
                  }}
                >
                  {productionGuardItems.length}
                </div>
              </div>
              {productionGuardItems.length > 0 && (
                <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                  {productionGuardItems.slice(0, 6).map((item) => (
                    <div
                      key={item.id}
                      style={{
                        padding: 10,
                        borderRadius: 12,
                        background: "rgba(255,255,255,.72)",
                        border: "1px solid rgba(251,146,60,.45)",
                      }}
                    >
                      <strong style={{ display: "block", color: "var(--text)", fontSize: 12 }}>
                        {item.label}
                      </strong>
                      <span
                        style={{
                          display: "block",
                          marginTop: 3,
                          color: "var(--text2)",
                          fontSize: 11,
                          fontWeight: 800,
                          lineHeight: 1.4,
                        }}
                      >
                        {item.detail}
                      </span>
                    </div>
                  ))}
                  {productionGuardItems.length > 6 && (
                    <div style={{ color: "#9a3412", fontSize: 11, fontWeight: 850 }}>
                      კიდევ {productionGuardItems.length - 6} პუნქტია readiness სიაში.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ ...adminCard, padding: 14 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <div>
                  <h2
                    style={{
                      margin: "0 0 6px",
                      fontSize: 17,
                      color: "var(--text)",
                    }}
                  >
                    Supabase შემოწმება
                  </h2>
                  <div
                    style={{
                      color: "var(--text2)",
                      fontSize: 12,
                      lineHeight: 1.5,
                    }}
                  >
                    ამით ვამოწმებთ, მართლა მუშაობს თუ არა მთავარი RPC-ები,
                    Admin უფლებები და private storage policy.
                    {preflightCheckedAt
                      ? ` ბოლო შემოწმება: ${formatDate(preflightCheckedAt)}.`
                      : ""}
                  </div>
                  {!isDemoDataMode && (
                    <div
                      style={{
                        marginTop: 6,
                        color: preflightFresh ? "#047857" : "var(--text3)",
                        fontSize: 11,
                        fontWeight: 850,
                        overflowWrap: "anywhere",
                      }}
                    >
                      Project: {preflightScope} ·{" "}
                      {preflightCheckedAt
                        ? preflightFresh
                          ? "შემოწმება ახალია"
                          : "შემოწმება დასაახლებელია"
                        : "ჯერ არ შემოწმებულა"}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  <button
                    type="button"
                    onClick={runPreflight}
                    disabled={preflightLoading}
                    style={{
                      ...actionButton("#17243a"),
                      minWidth: 112,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {preflightLoading ? "მოწმდება..." : "შემოწმება"}
                  </button>
                  {preflightChecks.length > 0 && (
                    <button
                      type="button"
                      onClick={resetPreflightCache}
                      disabled={preflightLoading}
                      style={{
                        ...actionButton("#f1f5f9", "var(--text2)"),
                        minWidth: 112,
                        whiteSpace: "nowrap",
                      }}
                    >
                      გასუფთავება
                    </button>
                  )}
                </div>
              </div>

              {preflightChecks.length > 0 && (
                <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                      gap: 8,
                    }}
                  >
                    {[
                      ["კარგია", preflightSummary.ok, "#047857", "#ecfdf5", "#bbf7d0"],
                      ["საყურადღებო", preflightSummary.warning, "#c2410c", "#fff7ed", "#fed7aa"],
                      ["შეცდომა", preflightSummary.error, "#b91c1c", "#fef2f2", "#fecaca"],
                    ].map(([label, value, color, bg, border]) => (
                      <div
                        key={label}
                        style={{
                          padding: 10,
                          borderRadius: 12,
                          background: String(bg),
                          border: `1px solid ${border}`,
                          minWidth: 0,
                        }}
                      >
                        <div style={{ color: String(color), fontSize: 19, fontWeight: 950 }}>
                          {value}
                        </div>
                        <div style={{ marginTop: 2, color: String(color), fontSize: 10, fontWeight: 900 }}>
                          {label}
                        </div>
                      </div>
                    ))}
                  </div>
                  {preflightSummary.requiredErrors > 0 && (
                    <div
                      style={{
                        padding: 11,
                        borderRadius: 12,
                        background: "#fef2f2",
                        border: "1px solid #fecaca",
                        color: "#991b1b",
                        fontSize: 12,
                        fontWeight: 850,
                        lineHeight: 1.45,
                      }}
                    >
                      Production-მდე ჯერ {preflightSummary.requiredErrors} აუცილებელი
                      Supabase შემოწმებაა გასასწორებელი.
                    </div>
                  )}
                  {preflightChecks.map((check) => {
                    const ui = preflightStatusUi[check.status];
                    return (
                      <div
                        key={check.id}
                        style={{
                          border: `1px solid ${ui.border}`,
                          background: ui.bg,
                          borderRadius: 12,
                          padding: 10,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 8,
                            alignItems: "center",
                          }}
                        >
                          <strong
                            style={{
                              color: "var(--text)",
                              fontSize: 13,
                              lineHeight: 1.25,
                            }}
                          >
                            {check.label}
                          </strong>
                          <span
                            style={{
                              flex: "0 0 auto",
                              color: ui.color,
                              fontSize: 10,
                              fontWeight: 950,
                              border: `1px solid ${ui.border}`,
                              background: "rgba(255,255,255,.68)",
                              borderRadius: 999,
                              padding: "4px 8px",
                            }}
                          >
                            {ui.label}
                          </span>
                        </div>
                        <div
                          style={{
                            marginTop: 6,
                            color: check.status === "error" ? "#b91c1c" : "var(--text2)",
                            fontSize: 11,
                            lineHeight: 1.45,
                            fontWeight: 750,
                            overflowWrap: "anywhere",
                          }}
                          >
                            {check.detail}
                          </div>
                        {check.nextAction && check.status !== "ok" && (
                          <div
                            style={{
                              marginTop: 7,
                              padding: 9,
                              borderRadius: 10,
                              background: "rgba(255,255,255,.62)",
                              color: ui.color,
                              fontSize: 10,
                              fontWeight: 850,
                              lineHeight: 1.4,
                              overflowWrap: "anywhere",
                            }}
                          >
                            შემდეგი ნაბიჯი: {check.nextAction}
                          </div>
                        )}
                        {check.sqlFile && check.status !== "ok" && (
                          <div
                            style={{
                              marginTop: 6,
                              color: "var(--text3)",
                              fontSize: 10,
                              fontWeight: 850,
                              overflowWrap: "anywhere",
                            }}
                          >
                            SQL: {check.sqlFile}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {platformSettingNumberFields.map((item) => (
              <div key={item.key} style={{ ...adminCard, padding: 14 }}>
                <label style={{ display: "block", color: "var(--text)", fontSize: 13, fontWeight: 950 }}>
                  {item.label}
                </label>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                  <input
                    type="number"
                    min={0}
                    value={settingsDraft[item.key]}
                    onChange={(event) => updateSettingsDraft(item.key, event.target.value)}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      height: 42,
                      padding: "0 12px",
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: "#f8fafc",
                      color: "var(--text)",
                      fontSize: 15,
                      fontWeight: 900,
                    }}
                  />
                  <span style={{ color: "var(--text2)", fontSize: 12, fontWeight: 900, minWidth: 45 }}>
                    {item.suffix}
                  </span>
                </div>
                <div style={{ marginTop: 7, color: "var(--text3)", fontSize: 11, lineHeight: 1.4, fontWeight: 750 }}>
                  {item.hint}
                </div>
              </div>
            ))}

            <div style={{ ...adminCard, padding: 14 }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 17, color: "var(--text)" }}>
                წესები და ტექსტები
              </h2>
              <div style={{ color: "var(--text2)", fontSize: 12, lineHeight: 1.5, marginBottom: 12 }}>
                ეს ტექსტები ჩანს დაჯავშნისას და გამოიყენება დახმარებისა და ადმინისტრირების პროცესში.
                გადახდის ჩართვამდე აქ უნდა იყოს საბოლოო, გასაგები ფორმულირება.
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {legalSettingFields.map((item) => (
                  <label
                    key={item.key}
                    style={{ display: "block", color: "var(--text)", fontSize: 12, fontWeight: 950 }}
                  >
                    {item.label}
                    <textarea
                      value={legalDraft[item.key]}
                      onChange={(event) =>
                        setLegalDraft((current) => ({
                          ...current,
                          [item.key]: event.target.value,
                        }))
                      }
                      rows={3}
                      style={{
                        width: "100%",
                        marginTop: 7,
                        padding: 10,
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        background: "#f8fafc",
                        color: "var(--text)",
                        fontSize: 12,
                        lineHeight: 1.45,
                        fontWeight: 750,
                        resize: "vertical",
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button
                type="button"
                onClick={resetSettingsDrafts}
                disabled={adminApiLoading || !settingsDirty}
                style={actionButton("#f1f5f9", "var(--text)")}
              >
                დაბრუნება
              </button>
              <button
                type="button"
                onClick={saveLegalSettings}
                disabled={adminApiLoading || !settingsDirty}
                style={{
                  ...actionButton(settingsDirty ? "#10b981" : "#dbe4ef"),
                  color: settingsDirty ? "white" : "var(--text3)",
                  opacity: adminApiLoading || !settingsDirty ? 0.75 : 1,
                }}
              >
                ყველაფრის შენახვა
              </button>
            </div>
            {(settingsSaveMessage || adminApiError) && (
              <div
                style={{
                  padding: 11,
                  borderRadius: 12,
                  background: adminApiError ? "#fef2f2" : "#f0fdf4",
                  border: `1px solid ${adminApiError ? "#fecaca" : "#bbf7d0"}`,
                  color: adminApiError ? "#b91c1c" : "#047857",
                  fontSize: 12,
                  lineHeight: 1.45,
                  fontWeight: 850,
                }}
              >
                {adminApiError || settingsSaveMessage}
              </div>
            )}
          </section>
);
