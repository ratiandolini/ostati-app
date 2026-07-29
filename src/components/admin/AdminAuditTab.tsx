import React from "react";
import { auditLabel } from "./adminLabels";
import { adminCard } from "./adminUi";
import { formatDate } from "./adminUtils";
import type { AdminAuditLog } from "../../services/dataService";

interface AdminAuditTabProps {
  filteredAuditLogs: AdminAuditLog[];
}

export const AdminAuditTab: React.FC<AdminAuditTabProps> = ({
  filteredAuditLogs,
}) => (
  <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    {filteredAuditLogs.length ? (
      filteredAuditLogs.map((log) => (
        <div key={log.id} style={{ ...adminCard, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <strong style={{ color: "var(--text)", fontSize: 14 }}>
              {auditLabel[log.action]}
            </strong>
            <span
              style={{
                color: "var(--text3)",
                fontSize: 11,
                fontWeight: 850,
                whiteSpace: "nowrap",
              }}
            >
              {formatDate(log.createdAt)}
            </span>
          </div>
          <div
            style={{
              marginTop: 6,
              color: "var(--text2)",
              fontSize: 12,
              lineHeight: 1.5,
              fontWeight: 750,
            }}
          >
            {log.summary}
          </div>
          <div
            style={{
              marginTop: 7,
              color: "var(--text3)",
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            {log.adminName} · {log.target}
          </div>
        </div>
      ))
    ) : (
      <div
        style={{
          ...adminCard,
          padding: 30,
          textAlign: "center",
          color: "var(--text3)",
          fontWeight: 800,
        }}
      >
        Admin ქმედება ამ ფილტრით არ მოიძებნა
      </div>
    )}
  </section>
);
