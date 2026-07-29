import type { CSSProperties } from "react";

export const adminCard: CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 16,
  background: "white",
  boxShadow: "var(--shadow-sm)",
};

export const actionButton = (
  bg: string,
  color = "white"
): CSSProperties => ({
  minHeight: 38,
  padding: "0 12px",
  borderRadius: 10,
  background: bg,
  color,
  fontSize: 12,
  fontWeight: 900,
});
