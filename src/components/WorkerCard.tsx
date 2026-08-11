import React from "react";
import { Worker } from "../types";
import { Stars } from "./Stars";

interface WorkerCardProps {
  worker: Worker;
  onClick: () => void;
  delay?: number;
}

export const WorkerCard: React.FC<WorkerCardProps> = ({
  worker,
  onClick,
  delay = 0,
}) => {
  const professionText = worker.skills?.length
    ? worker.skills.join(" · ")
    : worker.role;

  return (
    <div
      className="fade-up"
      onClick={onClick}
      style={{
        background: "var(--bg2)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: "16px",
        cursor: "pointer",
        animationDelay: `${delay}ms`,
        boxShadow: "var(--shadow-sm)",
        transition: "all 0.2s",
      }}
      onTouchStart={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
      onTouchEnd={(e) => (e.currentTarget.style.transform = "scale(1)")}
    >
      <div style={{ display: "flex", gap: 14, alignItems: "center", minWidth: 0 }}>
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: "#eef3f9",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            fontWeight: 700,
            color: worker.avatarColor,
            flexShrink: 0,
          }}
        >
          {worker.avatar.startsWith("data:image") ||
          worker.avatar.startsWith("http") ? (
            <img
              src={worker.avatar}
              alt={worker.name}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                borderRadius: "50%",
              }}
            />
          ) : (
            worker.avatar
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 8,
              minWidth: 0,
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "var(--text)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {worker.name}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text2)",
                  marginTop: 2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {professionText} · {worker.city}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  minHeight: 28,
                  padding: "0 9px",
                  borderRadius: 999,
                  background: "#f8fafc",
                  border: "1px solid var(--border)",
                  fontSize: 10,
                  fontWeight: 900,
                  color: "var(--text)",
                  lineHeight: 1,
                  whiteSpace: "nowrap",
                  maxWidth: 92,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {worker.price}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 8,
              minWidth: 0,
              flexWrap: "wrap",
            }}
          >
            <Stars rating={worker.rating} size={12} />
            <span
              style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}
            >
              {worker.rating}
            </span>
            <span style={{ fontSize: 11, color: "var(--text3)" }}>
              ({worker.reviewCount})
            </span>
            <span style={{ fontSize: 12, color: "var(--text2)", fontWeight: 600 }}>
              {worker.exp} წ.
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
        {worker.skills.slice(0, 3).map((s) => (
          <span
            key={s}
            style={{
              fontSize: 11,
              padding: "4px 10px",
              borderRadius: 100,
              background: "var(--bg3)",
              color: "var(--text2)",
              border: "1px solid var(--border)",
              fontWeight: 500,
            }}
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
};
