import React from "react";
import { WorkerStatus } from "../types";

interface StatusBadgeProps {
  status: WorkerStatus;
}

const config = {
  free: {
    label: "ხელმისაწვდომია",
    bg: "#DCFCE7",
    color: "#15803D",
    dot: "#22C55E",
  },
  busy: {
    label: "ნაწილობრივ",
    bg: "#FEF9C3",
    color: "#A16207",
    dot: "#EAB308",
  },
  booked: {
    label: "დაჯავშნულია",
    bg: "#FEE2E2",
    color: "#B91C1C",
    dot: "#EF4444",
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const c = config[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 10px",
        borderRadius: 100,
        background: c.bg,
        color: c.color,
        fontSize: 10,
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: c.dot,
          display: "block",
        }}
      />
      {c.label}
    </span>
  );
};
