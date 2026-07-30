import React, { useEffect, useState } from "react";
import { Worker } from "../types";
import { normalizeGeorgianDateLabel } from "../utils/georgianDate";

interface SuccessScreenProps {
  worker: Worker;
  day: number;
  time: string;
  dateLabel: string;
  onDone: () => void;
}

export const SuccessScreen: React.FC<SuccessScreenProps> = ({
  worker,
  time,
  dateLabel,
  onDone,
}) => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setTimeout(() => setShow(true), 50);
  }, []);

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 24px",
        textAlign: "center",
        background: "var(--bg)",
      }}
    >
      {/* Check circle */}
      <div
        style={{
          width: 100,
          height: 100,
          borderRadius: "50%",
          background: "#DCFCE7",
          border: "2px solid #86EFAC",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 44,
          marginBottom: 24,
          color: "#16A34A",
          transform: show ? "scale(1)" : "scale(0)",
          transition: "transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        }}
      >
        ✓
      </div>

      <div
        style={{
          opacity: show ? 1 : 0,
          transform: show ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.4s ease 0.2s",
          width: "100%",
        }}
      >
        <h2
          style={{
            fontSize: 23,
            fontWeight: 900,
            color: "var(--text)",
            marginBottom: 8,
            lineHeight: 1.25,
          }}
        >
          მოთხოვნა გაიგზავნა
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "var(--text2)",
            lineHeight: 1.6,
            margin: "0 0 18px",
          }}
        >
          ხელოსანი დაადასტურებს დროს და პასუხს აპლიკაციაში მიიღებ.
        </p>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 999,
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            color: "#c2410c",
            fontSize: 12,
            fontWeight: 900,
            marginBottom: 18,
          }}
        >
          მოლოდინშია
        </div>

        <div
          style={{
            marginBottom: 18,
            color: "var(--text)",
            fontSize: 14,
            fontWeight: 850,
            lineHeight: 1.45,
          }}
        >
          {worker.name} · {worker.role}
          <div style={{ marginTop: 4 }}>
          <span style={{ color: "var(--accent)", fontWeight: 700 }}>
          {normalizeGeorgianDateLabel(dateLabel)} · {time}
          </span>
          </div>
        </div>

        {/* Worker card */}
        <div
          style={{
            background: "var(--bg2)",
            border: "1px solid var(--border)",
            borderRadius: 18,
            padding: "16px",
            marginBottom: 18,
            boxShadow: "var(--shadow)",
            textAlign: "left",
          }}
        >
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                overflow: "hidden",
                background: "#eef3f9",
                border: "1px solid var(--border)",
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
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                worker.avatar
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "var(--text)",
                  overflowWrap: "anywhere",
                }}
              >
                {worker.name}
              </div>
              <div
                style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}
              >
                {worker.role}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text2)",
                  marginTop: 4,
                  fontWeight: 750,
                  lineHeight: 1.45,
                }}
              >
                კომუნიკაცია მოხდება ჩატით. ტელეფონის ნომერი ჯერჯერობით არ გამოჩნდება.
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "#047857",
                  marginTop: 6,
                  fontWeight: 800,
                }}
              >
                15 ლარი დროებით გაყინულია
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 8,
            marginBottom: 20,
          }}
        >
          {[
            { label: "გაიგზავნა", done: true },
            { label: "დასტური", done: false },
            { label: "ჩატი", done: false },
          ].map((step) => (
            <div key={step.label} style={{ minWidth: 0, textAlign: "center" }}>
              <div
                style={{
                  height: 5,
                  borderRadius: 999,
                  background: step.done ? "#10b981" : "#dbe4ef",
                  marginBottom: 6,
                }}
              />
              <div
                style={{
                  color: step.done ? "#047857" : "var(--text3)",
                  fontSize: 10,
                  fontWeight: 900,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {step.label}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onDone}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: 14,
            fontSize: 15,
            fontWeight: 700,
            background: "var(--primary)",
            color: "white",
            border: "none",
            boxShadow: "0 4px 16px rgba(30,41,59,0.25)",
            transition: "all 0.2s",
          }}
        >
          ჩემი ჯავშნები
        </button>
      </div>
    </div>
  );
};
