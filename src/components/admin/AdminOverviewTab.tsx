import React from "react";
import { adminCard } from "./adminUi";
import type { AdminTab } from "./adminPermissions";
import {
  apiMigrationStatusUi,
  mobileQaTestGuide,
  qaAreaLabel,
} from "./adminQaConfig";
import type { ApiMigrationItem } from "../../services/apiMigrationService";
import type { ReadinessCheck } from "../../services/readinessService";
import type {
  MobileQaScenario,
  PrePaymentChecklistItem,
} from "../../services/dataService";

interface LaunchNextAction {
  tone: string;
  bg: string;
  border: string;
  label: string;
  detail: string;
  button: string;
  tab: AdminTab;
}

interface LaunchSmokeStep {
  id: string;
  label: string;
  detail: string;
  done: boolean;
  missing: string[];
  targetTab: AdminTab;
}

interface OperationalQueueItem {
  id: string;
  label: string;
  count: number;
  detail: string;
  tabId: AdminTab;
  priority: number;
  tone: string;
  bg: string;
}

interface ApiMigrationSummary {
  connected: number;
  partial: number;
  demo: number;
  total: number;
}

interface MobileQaProgressItem {
  area: MobileQaScenario["area"];
  label: string;
  done: number;
  total: number;
  complete: boolean;
}

interface MobileQaNoteItem {
  id: string;
  area: string;
  label: string;
  done: boolean;
  note: string;
}

interface AdminOverviewTabProps {
  readyCount: number;
  productionReadiness: ReadinessCheck[];
  canOpenTab: (tab: AdminTab) => boolean;
  setTab: (tab: AdminTab) => void;
  launchNextAction: LaunchNextAction;
  launchReportStatus: string;
  downloadAdminReport: () => void;
  launchSmokeDoneCount: number;
  launchSmokeSteps: LaunchSmokeStep[];
  nextLaunchSmokeStep?: LaunchSmokeStep;
  nextAdminAction?: OperationalQueueItem;
  operationalQueue: OperationalQueueItem[];
  systemReadinessChecks: ReadinessCheck[];
  blockingSystemChecks: ReadinessCheck[];
  apiMigrationSummary: ApiMigrationSummary;
  apiMigrationItems: ApiMigrationItem[];
  prePaymentDoneCount: number;
  prePaymentChecklist: PrePaymentChecklistItem[];
  togglePrePaymentChecklistItem: (item: PrePaymentChecklistItem) => void;
  adminApiLoading: boolean;
  mobileQaDoneCount: number;
  mobileQaScenarios: MobileQaScenario[];
  mobileQaNotes: MobileQaNoteItem[];
  mobileQaProgressByArea: MobileQaProgressItem[];
  nextMobileQaScenario?: MobileQaScenario;
  saveMobileQaScenarioNote: (item: MobileQaScenario, note: string) => void;
  toggleMobileQaScenario: (item: MobileQaScenario) => void;
}

export const AdminOverviewTab: React.FC<AdminOverviewTabProps> = ({
  readyCount,
  productionReadiness,
  canOpenTab,
  setTab,
  launchNextAction,
  launchReportStatus,
  downloadAdminReport,
  launchSmokeDoneCount,
  launchSmokeSteps,
  nextLaunchSmokeStep,
  nextAdminAction,
  operationalQueue,
  systemReadinessChecks,
  blockingSystemChecks,
  apiMigrationSummary,
  apiMigrationItems,
  prePaymentDoneCount,
  prePaymentChecklist,
  togglePrePaymentChecklistItem,
  adminApiLoading,
  mobileQaDoneCount,
  mobileQaScenarios,
  mobileQaNotes,
  mobileQaProgressByArea,
  nextMobileQaScenario,
  saveMobileQaScenarioNote,
  toggleMobileQaScenario,
}) => {
  return (
          <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ ...adminCard, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <div>
                  <h2 style={{ margin: "0 0 6px", fontSize: 17, color: "var(--text)" }}>
                    Production მზადყოფნა
                  </h2>
                  <div style={{ color: "var(--text2)", fontSize: 12, lineHeight: 1.5 }}>
                    4-9 ეტაპების საერთო მდგომარეობა: ავტორიზაცია, გადახდა,
                    Admin უფლებები, Supabase, დიზაინი და deploy.
                  </div>
                </div>
                <div
                  style={{
                    flexShrink: 0,
                    width: 54,
                    height: 54,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    background: readyCount === productionReadiness.length ? "#dcfce7" : "#eff6ff",
                    color: readyCount === productionReadiness.length ? "#047857" : "#1d4ed8",
                    fontSize: 15,
                    fontWeight: 950,
                  }}
                >
                  {readyCount}/{productionReadiness.length}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
                {productionReadiness.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      const targetTab = item.label === "Admin უფლებები" ? "users" : "settings";
                      if (canOpenTab(targetTab)) setTab(targetTab);
                    }}
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      background: item.ready ? "#ecfdf5" : "#fff7ed",
                      border: `1px solid ${item.ready ? "#bbf7d0" : "#fed7aa"}`,
                      textAlign: "left",
                      minWidth: 0,
                    }}
                  >
                    <div style={{ color: item.ready ? "#047857" : "#c2410c", fontSize: 11, fontWeight: 950 }}>
                      {item.ready ? "მზადაა" : "დასასრულებელია"}
                    </div>
                    <div style={{ marginTop: 3, color: "var(--text)", fontSize: 12, fontWeight: 950, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.label}
                    </div>
                    <div style={{ marginTop: 2, color: "var(--text3)", fontSize: 10, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.detail}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div
              style={{
                ...adminCard,
                padding: 14,
                background: launchNextAction.bg,
                borderColor: launchNextAction.border,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "flex-start",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      color: launchNextAction.tone,
                      fontSize: 11,
                      fontWeight: 950,
                    }}
                  >
                    Launch-ის შემდეგი მოქმედება
                  </div>
                  <h2
                    style={{
                      margin: "5px 0 4px",
                      color: "var(--text)",
                      fontSize: 16,
                      lineHeight: 1.25,
                    }}
                  >
                    {launchNextAction.label}
                  </h2>
                  <div
                    style={{
                      color: "var(--text2)",
                      fontSize: 11,
                      lineHeight: 1.45,
                      fontWeight: 800,
                    }}
                  >
                    {launchNextAction.detail}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (launchReportStatus === "launch_ready") {
                      downloadAdminReport();
                      return;
                    }
                    if (canOpenTab(launchNextAction.tab)) {
                      setTab(launchNextAction.tab);
                    }
                  }}
                  style={{
                    flexShrink: 0,
                    minHeight: 38,
                    padding: "0 12px",
                    borderRadius: 999,
                    background: launchNextAction.tone,
                    color: "white",
                    border: `1px solid ${launchNextAction.tone}`,
                    fontSize: 11,
                    fontWeight: 950,
                    whiteSpace: "nowrap",
                  }}
                >
                  {launchNextAction.button}
                </button>
              </div>
            </div>

            <div style={{ ...adminCard, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <h2 style={{ margin: "0 0 6px", fontSize: 17, color: "var(--text)" }}>
                    Launch smoke flow
                  </h2>
                  <div style={{ color: "var(--text2)", fontSize: 12, lineHeight: 1.5 }}>
                    ეს არის ბოლო ხელით გასავლელი გზა, რომ დავრწმუნდეთ კლიენტი,
                    ხელოსანი და Admin ერთად სწორად მუშაობენ.
                  </div>
                </div>
                <div
                  style={{
                    flexShrink: 0,
                    padding: "7px 10px",
                    borderRadius: 999,
                    background:
                      launchSmokeDoneCount === launchSmokeSteps.length
                        ? "#dcfce7"
                        : "#eff6ff",
                    color:
                      launchSmokeDoneCount === launchSmokeSteps.length
                        ? "#047857"
                        : "#1d4ed8",
                    border: `1px solid ${
                      launchSmokeDoneCount === launchSmokeSteps.length
                        ? "#bbf7d0"
                        : "#bfdbfe"
                    }`,
                    fontSize: 11,
                    fontWeight: 950,
                    height: 32,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  {launchSmokeDoneCount}/{launchSmokeSteps.length}
                </div>
              </div>
              {nextLaunchSmokeStep ? (
                <button
                  type="button"
                  onClick={() => {
                    if (canOpenTab(nextLaunchSmokeStep.targetTab)) {
                      setTab(nextLaunchSmokeStep.targetTab);
                    }
                  }}
                  style={{
                    width: "100%",
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 12,
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    color: "#1d4ed8",
                    textAlign: "left",
                  }}
                >
                  <span style={{ display: "block", fontSize: 10, fontWeight: 950 }}>
                    შემდეგი ნაბიჯი
                  </span>
                  <strong
                    style={{
                      display: "block",
                      marginTop: 3,
                      color: "var(--text)",
                      fontSize: 13,
                      lineHeight: 1.25,
                    }}
                  >
                    {nextLaunchSmokeStep.label}
                  </strong>
                  <span
                    style={{
                      display: "block",
                      marginTop: 4,
                      fontSize: 11,
                      fontWeight: 800,
                      lineHeight: 1.4,
                    }}
                  >
                    {nextLaunchSmokeStep.detail}
                  </span>
                  {nextLaunchSmokeStep.missing.length > 0 && (
                    <span
                      style={{
                        display: "block",
                        marginTop: 6,
                        color: "#1e40af",
                        fontSize: 10,
                        fontWeight: 900,
                        lineHeight: 1.35,
                      }}
                    >
                      აკლია: {nextLaunchSmokeStep.missing.slice(0, 3).join(", ")}
                      {nextLaunchSmokeStep.missing.length > 3 ? "..." : ""}
                    </span>
                  )}
                </button>
              ) : (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 12,
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    color: "#047857",
                    fontSize: 12,
                    fontWeight: 850,
                    lineHeight: 1.45,
                  }}
                >
                  Smoke flow სრულად გავლილია. ახლა report ჩამოტვირთე და production
                  blocker-ები გადაამოწმე.
                </div>
              )}
              <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                {launchSmokeSteps.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (canOpenTab(item.targetTab)) setTab(item.targetTab);
                    }}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "28px 1fr",
                      gap: 10,
                      alignItems: "center",
                      width: "100%",
                      padding: 10,
                      borderRadius: 12,
                      background: item.done ? "#f0fdf4" : "#f8fafc",
                      border: `1px solid ${item.done ? "#bbf7d0" : "var(--border)"}`,
                      textAlign: "left",
                    }}
                  >
                    <span
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        display: "grid",
                        placeItems: "center",
                        background: item.done ? "#10b981" : "white",
                        color: item.done ? "white" : "var(--text3)",
                        border: `1px solid ${item.done ? "#10b981" : "var(--border2)"}`,
                        fontSize: 11,
                        fontWeight: 950,
                      }}
                    >
                      {item.done ? "✓" : index + 1}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <strong style={{ display: "block", color: "var(--text)", fontSize: 13 }}>
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
                      {!item.done && item.missing.length > 0 && (
                        <span
                          style={{
                            display: "block",
                            marginTop: 5,
                            color: "#c2410c",
                            fontSize: 10,
                            fontWeight: 900,
                            lineHeight: 1.35,
                          }}
                        >
                          აკლია: {item.missing.slice(0, 3).join(", ")}
                          {item.missing.length > 3 ? "..." : ""}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ ...adminCard, padding: 16 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "flex-start",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <h2 style={{ margin: "0 0 6px", fontSize: 17, color: "var(--text)" }}>
                    Admin-ის დღევანდელი რიგი
                  </h2>
                  <div style={{ color: "var(--text2)", fontSize: 12, lineHeight: 1.5 }}>
                    ეს რიგი აერთიანებს ვერიფიკაციას, დავებს, ფინანსებს და პრობლემურ
                    ჯავშნებს. ზემოთ ჩანს ყველაზე სასწრაფო მოქმედება.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (nextAdminAction && canOpenTab(nextAdminAction.tabId)) {
                      setTab(nextAdminAction.tabId);
                    }
                  }}
                  style={{
                    flexShrink: 0,
                    minHeight: 38,
                    padding: "0 12px",
                    borderRadius: 999,
                    background: nextAdminAction?.count ? "var(--primary)" : "#f8fafc",
                    color: nextAdminAction?.count ? "white" : "var(--text2)",
                    border: `1px solid ${
                      nextAdminAction?.count ? "var(--primary)" : "var(--border)"
                    }`,
                    fontSize: 11,
                    fontWeight: 950,
                  }}
                >
                  {nextAdminAction?.count ? "პირველი მოქმედება" : "ყველაფერი სუფთაა"}
                </button>
              </div>
              {nextAdminAction && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 14,
                    background: nextAdminAction.bg,
                    border: "1px solid rgba(148,163,184,0.25)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          color: nextAdminAction.tone,
                          fontSize: 11,
                          fontWeight: 950,
                        }}
                      >
                        შემდეგი პრიორიტეტი
                      </div>
                      <div
                        style={{
                          marginTop: 3,
                          color: "var(--text)",
                          fontSize: 15,
                          fontWeight: 950,
                        }}
                      >
                        {nextAdminAction.label}
                      </div>
                      <div
                        style={{
                          marginTop: 4,
                          color: "var(--text2)",
                          fontSize: 11,
                          lineHeight: 1.4,
                          fontWeight: 800,
                        }}
                      >
                        {nextAdminAction.detail}
                      </div>
                    </div>
                    <div
                      style={{
                        flexShrink: 0,
                        minWidth: 44,
                        height: 44,
                        borderRadius: 14,
                        display: "grid",
                        placeItems: "center",
                        background: "white",
                        color: nextAdminAction.tone,
                        border: "1px solid rgba(148,163,184,0.25)",
                        fontSize: 18,
                        fontWeight: 950,
                      }}
                    >
                      {nextAdminAction.count}
                    </div>
                  </div>
                </div>
              )}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr",
                  gap: 8,
                  marginTop: 12,
                }}
              >
                {operationalQueue.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (canOpenTab(item.tabId)) setTab(item.tabId);
                    }}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "38px 1fr auto",
                      gap: 10,
                      alignItems: "center",
                      width: "100%",
                      padding: 10,
                      borderRadius: 12,
                      background: item.count ? item.bg : "#f8fafc",
                      border: `1px solid ${
                        item.count ? "rgba(148,163,184,0.25)" : "var(--border)"
                      }`,
                      textAlign: "left",
                    }}
                  >
                    <span
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 12,
                        display: "grid",
                        placeItems: "center",
                        background: item.count ? "white" : "#eef3f9",
                        color: item.count ? item.tone : "var(--text3)",
                        border: "1px solid rgba(148,163,184,0.28)",
                        fontSize: 14,
                        fontWeight: 950,
                      }}
                    >
                      {item.count}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <strong
                        style={{
                          display: "block",
                          color: "var(--text)",
                          fontSize: 13,
                          lineHeight: 1.25,
                        }}
                      >
                        {item.label}
                      </strong>
                      <span
                        style={{
                          display: "block",
                          marginTop: 3,
                          color: "var(--text2)",
                          fontSize: 10,
                          lineHeight: 1.35,
                          fontWeight: 780,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {item.detail}
                      </span>
                    </span>
                    <span
                      style={{
                        color: item.count ? item.tone : "var(--text3)",
                        fontSize: 10,
                        fontWeight: 950,
                      }}
                    >
                      გახსნა
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ ...adminCard, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div>
                  <h2 style={{ margin: "0 0 6px", fontSize: 17, color: "var(--text)" }}>
                    სისტემური შემოწმება
                  </h2>
                  <div style={{ color: "var(--text2)", fontSize: 12, lineHeight: 1.5 }}>
                    ეს ბლოკი ავტომატურად ამოწმებს გარემოს და გვაჩვენებს, რა
                    გვაკლია რეალურ რეჟიმამდე.
                  </div>
                </div>
                <div
                  style={{
                    flexShrink: 0,
                    padding: "7px 10px",
                    borderRadius: 999,
                    background: blockingSystemChecks.length ? "#fef2f2" : "#ecfdf5",
                    color: blockingSystemChecks.length ? "#b91c1c" : "#047857",
                    border: `1px solid ${
                      blockingSystemChecks.length ? "#fecaca" : "#bbf7d0"
                    }`,
                    fontSize: 11,
                    fontWeight: 950,
                  }}
                >
                  {blockingSystemChecks.length
                    ? `${blockingSystemChecks.length} blocker`
                    : "blocker არაა"}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                {systemReadinessChecks.map((item) => {
                  const ui =
                    item.severity === "ok"
                      ? { bg: "#f0fdf4", border: "#bbf7d0", color: "#047857", label: "მზადაა" }
                      : item.severity === "blocked"
                        ? { bg: "#fef2f2", border: "#fecaca", color: "#b91c1c", label: "ბლოკავს" }
                        : { bg: "#fff7ed", border: "#fed7aa", color: "#c2410c", label: "გასაკეთებელია" };
                  return (
                    <div
                      key={item.id}
                      style={{
                        padding: 11,
                        borderRadius: 12,
                        background: ui.bg,
                        border: `1px solid ${ui.border}`,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <strong style={{ color: "var(--text)", fontSize: 13 }}>
                          {item.label}
                        </strong>
                        <span style={{ color: ui.color, fontSize: 10, fontWeight: 950 }}>
                          {ui.label}
                        </span>
                      </div>
                      <div style={{ marginTop: 4, color: "var(--text2)", fontSize: 11, lineHeight: 1.45, fontWeight: 750 }}>
                        {item.detail}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ ...adminCard, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div>
                  <h2 style={{ margin: "0 0 6px", fontSize: 17, color: "var(--text)" }}>
                    API migration map
                  </h2>
                  <div style={{ color: "var(--text2)", fontSize: 12, lineHeight: 1.5 }}>
                    აქ ჩანს რომელი ფენა უკვე Supabase/API-სკენაა წაყვანილი და
                    რომელი ჯერ demo fallback-ზე რჩება.
                  </div>
                </div>
                <div
                  style={{
                    flexShrink: 0,
                    padding: "7px 10px",
                    borderRadius: 999,
                    background: "#eff6ff",
                    color: "#1d4ed8",
                    border: "1px solid #bfdbfe",
                    fontSize: 11,
                    fontWeight: 950,
                  }}
                >
                  {apiMigrationSummary.connected}/{apiMigrationSummary.total}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7, marginTop: 12 }}>
                {[
                  {
                    label: "მიერთ.",
                    value: apiMigrationSummary.connected,
                    color: "#047857",
                    bg: "#dcfce7",
                  },
                  {
                    label: "ნაწილ.",
                    value: apiMigrationSummary.partial,
                    color: "#c2410c",
                    bg: "#fff7ed",
                  },
                  {
                    label: "demo",
                    value: apiMigrationSummary.demo,
                    color: "#b91c1c",
                    bg: "#fef2f2",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      padding: 9,
                      borderRadius: 11,
                      background: item.bg,
                      border: "1px solid var(--border)",
                      minWidth: 0,
                    }}
                  >
                    <div style={{ color: item.color, fontSize: 16, fontWeight: 950 }}>
                      {item.value}
                    </div>
                    <div style={{ color: "var(--text3)", fontSize: 10, fontWeight: 850 }}>
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                {apiMigrationItems.map((item) => {
                  const ui = apiMigrationStatusUi[item.status];
                  return (
                    <div
                      key={item.id}
                      style={{
                        padding: 11,
                        borderRadius: 12,
                        background: ui.bg,
                        border: `1px solid ${ui.border}`,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                        <div style={{ minWidth: 0 }}>
                          <span style={{ display: "block", color: "var(--text3)", fontSize: 9, fontWeight: 950 }}>
                            {item.area}
                          </span>
                          <strong style={{ display: "block", marginTop: 2, color: "var(--text)", fontSize: 13, lineHeight: 1.25 }}>
                            {item.label}
                          </strong>
                        </div>
                        <span style={{ flexShrink: 0, color: ui.color, fontSize: 10, fontWeight: 950 }}>
                          {ui.label}
                        </span>
                      </div>
                      <div style={{ marginTop: 5, color: "var(--text2)", fontSize: 11, lineHeight: 1.45, fontWeight: 750 }}>
                        {item.detail}
                      </div>
                      <div style={{ marginTop: 4, color: "var(--text3)", fontSize: 10, lineHeight: 1.4, fontWeight: 800 }}>
                        შემდეგი: {item.nextStep}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ ...adminCard, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div>
                  <h2 style={{ margin: "0 0 6px", fontSize: 17, color: "var(--text)" }}>
                    გადახდამდე გასაკეთებელი
                  </h2>
                  <div style={{ color: "var(--text2)", fontSize: 12, lineHeight: 1.5 }}>
                    ეს არის ბოლო სამუშაო სია, სანამ რეალურ ბარათს, თანხის
                    დაბლოკვას და საკომისიოს ჩავრთავთ.
                  </div>
                </div>
                <div
                  style={{
                    flexShrink: 0,
                    padding: "7px 10px",
                    borderRadius: 999,
                    background:
                      prePaymentDoneCount === prePaymentChecklist.length
                        ? "#dcfce7"
                        : "#fff7ed",
                    color:
                      prePaymentDoneCount === prePaymentChecklist.length
                        ? "#047857"
                        : "#c2410c",
                    border: `1px solid ${
                      prePaymentDoneCount === prePaymentChecklist.length
                        ? "#bbf7d0"
                        : "#fed7aa"
                    }`,
                    fontSize: 11,
                    fontWeight: 950,
                  }}
                >
                  {prePaymentDoneCount}/{prePaymentChecklist.length}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                {prePaymentChecklist.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => togglePrePaymentChecklistItem(item)}
                    disabled={adminApiLoading}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      width: "100%",
                      padding: 11,
                      borderRadius: 12,
                      background: item.done ? "#f0fdf4" : "#f8fafc",
                      border: `1px solid ${item.done ? "#bbf7d0" : "var(--border)"}`,
                      textAlign: "left",
                    }}
                  >
                    <span
                      style={{
                        flexShrink: 0,
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        display: "grid",
                        placeItems: "center",
                        background: item.done ? "#10b981" : "white",
                        color: item.done ? "white" : "var(--text3)",
                        border: `1px solid ${item.done ? "#10b981" : "var(--border2)"}`,
                        fontSize: 12,
                        fontWeight: 950,
                      }}
                    >
                      {item.done ? "✓" : ""}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <strong style={{ display: "block", color: "var(--text)", fontSize: 13 }}>
                        {item.label}
                      </strong>
                      <span style={{ display: "block", marginTop: 3, color: "var(--text2)", fontSize: 11, lineHeight: 1.4, fontWeight: 750 }}>
                        {item.detail}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ ...adminCard, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div>
                  <h2 style={{ margin: "0 0 6px", fontSize: 17, color: "var(--text)" }}>
                    Mobile QA სცენარები
                  </h2>
                  <div style={{ color: "var(--text2)", fontSize: 12, lineHeight: 1.5 }}>
                    ეს სია გაიარე ტელეფონზე ან პატარა ეკრანზე. ყველა პუნქტის
                    დასრულებისას checklist-ის QA პუნქტი ავტომატურად დაიხურება.
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: 5,
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      padding: "7px 10px",
                      borderRadius: 999,
                      background:
                        mobileQaDoneCount === mobileQaScenarios.length
                          ? "#dcfce7"
                          : "#eff6ff",
                      color:
                        mobileQaDoneCount === mobileQaScenarios.length
                          ? "#047857"
                          : "#1d4ed8",
                      border: `1px solid ${
                        mobileQaDoneCount === mobileQaScenarios.length
                          ? "#bbf7d0"
                          : "#bfdbfe"
                      }`,
                      fontSize: 11,
                      fontWeight: 950,
                    }}
                  >
                    {mobileQaDoneCount}/{mobileQaScenarios.length}
                  </span>
                  {mobileQaNotes.length > 0 && (
                    <span
                      style={{
                        padding: "5px 8px",
                        borderRadius: 999,
                        background: "#fff7ed",
                        color: "#c2410c",
                        border: "1px solid #fed7aa",
                        fontSize: 10,
                        fontWeight: 950,
                      }}
                    >
                      {mobileQaNotes.length} შენიშვნა
                    </span>
                  )}
                </div>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  marginTop: 12,
                }}
              >
                {mobileQaProgressByArea.map((item) => (
                  <div
                    key={item.area}
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      background: item.complete ? "#f0fdf4" : "#f8fafc",
                      border: `1px solid ${
                        item.complete ? "#bbf7d0" : "var(--border)"
                      }`,
                    }}
                  >
                    <div
                      style={{
                        color: item.complete ? "#047857" : "var(--text)",
                        fontSize: 12,
                        fontWeight: 950,
                      }}
                    >
                      {item.label}
                    </div>
                    <div
                      style={{
                        marginTop: 5,
                        color: "var(--text2)",
                        fontSize: 11,
                        fontWeight: 850,
                      }}
                    >
                      {item.done}/{item.total || 0} დასრულებული
                    </div>
                  </div>
                ))}
              </div>
              {nextMobileQaScenario ? (
                <div
                  style={{
                    marginTop: 10,
                    padding: 11,
                    borderRadius: 12,
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    color: "#1d4ed8",
                    fontSize: 12,
                    lineHeight: 1.45,
                    fontWeight: 850,
                  }}
                >
                  შემდეგი შესამოწმებელი: {qaAreaLabel[nextMobileQaScenario.area]} ·{" "}
                  {nextMobileQaScenario.label}
                </div>
              ) : (
                <div
                  style={{
                    marginTop: 10,
                    padding: 11,
                    borderRadius: 12,
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    color: "#047857",
                    fontSize: 12,
                    lineHeight: 1.45,
                    fontWeight: 850,
                  }}
                >
                  Mobile QA სრულად გავლილია. ახლა შეიძლება report-ის ჩამოტვირთვა
                  და production blockers-ის გადამოწმება.
                </div>
              )}
              {mobileQaNotes.length > 0 && (
                <div
                  style={{
                    marginTop: 10,
                    padding: 11,
                    borderRadius: 12,
                    background: "#fff7ed",
                    border: "1px solid #fed7aa",
                  }}
                >
                  <div
                    style={{
                      color: "#c2410c",
                      fontSize: 11,
                      fontWeight: 950,
                      marginBottom: 7,
                    }}
                  >
                    ღია QA შენიშვნები
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    {mobileQaNotes.slice(0, 3).map((note) => (
                      <div
                        key={note.id}
                        style={{
                          color: "var(--text2)",
                          fontSize: 10,
                          lineHeight: 1.4,
                          fontWeight: 800,
                        }}
                      >
                        <strong style={{ color: "var(--text)" }}>
                          {note.area} · {note.label}
                        </strong>
                        : {note.note}
                      </div>
                    ))}
                    {mobileQaNotes.length > 3 && (
                      <div style={{ color: "#9a3412", fontSize: 10, fontWeight: 900 }}>
                        კიდევ {mobileQaNotes.length - 3} შენიშვნა ჩანს ქვემოთ card-ებში.
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                {mobileQaScenarios.map((item) => {
                  const guide = mobileQaTestGuide[item.id];
                  return (
                    <div
                      key={item.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "24px 1fr",
                        gap: 10,
                        width: "100%",
                        padding: 11,
                        borderRadius: 12,
                        background: item.done ? "#f0fdf4" : "#f8fafc",
                        border: `1px solid ${item.done ? "#bbf7d0" : "var(--border)"}`,
                        textAlign: "left",
                      }}
                    >
                      <span
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 7,
                          display: "grid",
                          placeItems: "center",
                          background: item.done ? "#10b981" : "white",
                          color: item.done ? "white" : "var(--text3)",
                          border: `1px solid ${item.done ? "#10b981" : "var(--border2)"}`,
                          fontSize: 12,
                          fontWeight: 950,
                        }}
                      >
                        {item.done ? "✓" : ""}
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <span
                          style={{
                            display: "inline-flex",
                            marginBottom: 4,
                            padding: "3px 7px",
                            borderRadius: 999,
                            background: "white",
                            color: "var(--text3)",
                            border: "1px solid var(--border)",
                            fontSize: 9,
                            fontWeight: 950,
                          }}
                        >
                          {qaAreaLabel[item.area]}
                        </span>
                        <strong style={{ display: "block", color: "var(--text)", fontSize: 13, lineHeight: 1.25 }}>
                          {item.label}
                        </strong>
                        <span style={{ display: "block", marginTop: 3, color: "var(--text2)", fontSize: 11, lineHeight: 1.4, fontWeight: 750 }}>
                          {item.detail}
                        </span>
                        {guide && (
                          <span
                            style={{
                              display: "block",
                              marginTop: 8,
                              padding: 9,
                              borderRadius: 10,
                              background: "rgba(255,255,255,.75)",
                              border: "1px solid rgba(148,163,184,.24)",
                            }}
                          >
                            <span
                              style={{
                                display: "block",
                                color: "var(--text3)",
                                fontSize: 9,
                                fontWeight: 950,
                                marginBottom: 4,
                              }}
                            >
                              გასავლელი ნაბიჯები
                            </span>
                            {guide.steps.map((step, index) => (
                              <span
                                key={step}
                                style={{
                                  display: "block",
                                  color: "var(--text2)",
                                  fontSize: 10,
                                  lineHeight: 1.45,
                                  fontWeight: 800,
                                }}
                              >
                                {index + 1}. {step}
                              </span>
                            ))}
                            <span
                              style={{
                                display: "block",
                                marginTop: 6,
                                color: item.done ? "#047857" : "#1d4ed8",
                                fontSize: 10,
                                lineHeight: 1.45,
                                fontWeight: 900,
                              }}
                            >
                              უნდა დადასტურდეს: {guide.expected}
                            </span>
                          </span>
                        )}
                        <textarea
                          defaultValue={item.note || ""}
                          onBlur={(event) =>
                            saveMobileQaScenarioNote(item, event.currentTarget.value.trim())
                          }
                          onClick={(event) => event.stopPropagation()}
                          placeholder="QA შენიშვნა: რა ნახე ტელეფონზე, რა არის გასასწორებელი..."
                          rows={2}
                          disabled={adminApiLoading}
                          style={{
                            width: "100%",
                            marginTop: 9,
                            padding: 10,
                            borderRadius: 10,
                            border: "1px solid var(--border)",
                            background: "white",
                            color: "var(--text)",
                            fontSize: 11,
                            lineHeight: 1.4,
                            fontWeight: 800,
                            resize: "vertical",
                          }}
                        />
                        {item.note?.trim() && (
                          <button
                            type="button"
                            onClick={() => saveMobileQaScenarioNote(item, "")}
                            disabled={adminApiLoading}
                            style={{
                              marginTop: 7,
                              minHeight: 30,
                              padding: "0 10px",
                              borderRadius: 999,
                              background: "#fff7ed",
                              color: "#c2410c",
                              border: "1px solid #fed7aa",
                              fontSize: 10,
                              fontWeight: 950,
                            }}
                          >
                            შენიშვნის გასუფთავება
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => toggleMobileQaScenario(item)}
                          disabled={adminApiLoading}
                          style={{
                            marginTop: 9,
                            minHeight: 34,
                            padding: "0 12px",
                            borderRadius: 999,
                            background: item.done ? "#dcfce7" : "var(--primary)",
                            color: item.done ? "#047857" : "white",
                            border: `1px solid ${item.done ? "#bbf7d0" : "var(--primary)"}`,
                            fontSize: 11,
                            fontWeight: 950,
                          }}
                        >
                          {item.done ? "მონიშვნის მოხსნა" : "შემოწმდა"}
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ ...adminCard, padding: 16 }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 17, color: "var(--text)" }}>
                Admin-ის წესები
              </h2>
              <div style={{ display: "grid", gap: 8 }}>
                {[
                  "ხელოსნის სამუშაო სივრცე იხსნება მხოლოდ ვერიფიკაციის დადასტურების შემდეგ.",
                  "ჯავშანს Admin არ მართავს ყოველდღიურად; Admin ერევა მხოლოდ დავაზე, დაბრუნებაზე ან გაჭედილ სტატუსზე.",
                  "უარყოფა, დაბრუნება, დავის გადაწყვეტა, შეზღუდვა და ბლოკი ყოველთვის უნდა იყოს მიზეზით.",
                  "ყველა მნიშვნელოვანი მოქმედება ინახება ლოგში, რომ მოგვიანებით გაირკვეს რა მოხდა.",
                ].map((rule) => (
                  <div
                    key={rule}
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      background: "#f8fafc",
                      border: "1px solid var(--border)",
                      color: "var(--text2)",
                      fontSize: 12,
                      lineHeight: 1.45,
                      fontWeight: 800,
                    }}
                  >
                    {rule}
                  </div>
                ))}
              </div>
            </div>
          </section>
  );
};
