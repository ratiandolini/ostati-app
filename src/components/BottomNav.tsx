import React from "react";
import { Screen } from "../types";

interface NavItem {
  id: Screen;
  icon: "home" | "search" | "bookings" | "messages" | "profile";
  label: string;
}

const navItems: NavItem[] = [
  { id: "home", icon: "home", label: "მთავარი" },
  { id: "search", icon: "search", label: "ძიება" },
  { id: "bookings", icon: "bookings", label: "ჯავშნები" },
  { id: "messages", icon: "messages", label: "მესიჯები" },
  { id: "user-profile", icon: "profile", label: "პროფილი" },
];

const NavIcon: React.FC<{ name: NavItem["icon"] }> = ({ name }) => {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2.2,
  };

  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      {name === "home" && (
        <>
          <path {...common} d="M4 11.5 12 5l8 6.5" />
          <path {...common} d="M6.5 10.5V19h4v-5h3v5h4v-8.5" />
        </>
      )}
      {name === "search" && (
        <>
          <circle {...common} cx="10.5" cy="10.5" r="5.5" />
          <path {...common} d="m15 15 4 4" />
        </>
      )}
      {name === "bookings" && (
        <>
          <rect {...common} x="5" y="4.5" width="14" height="16" rx="2.5" />
          <path {...common} d="M8 8h8M8 12h8M8 16h5" />
        </>
      )}
      {name === "messages" && (
        <>
          <path {...common} d="M5 7.5A3.5 3.5 0 0 1 8.5 4h7A3.5 3.5 0 0 1 19 7.5v5A3.5 3.5 0 0 1 15.5 16H11l-4.5 3v-3A3.5 3.5 0 0 1 5 12.5z" />
          <path {...common} d="M9 9h6M9 12h4" />
        </>
      )}
      {name === "profile" && (
        <>
          <circle {...common} cx="12" cy="8.5" r="3.5" />
          <path {...common} d="M5.5 19c1.2-3 3.4-4.5 6.5-4.5s5.3 1.5 6.5 4.5" />
        </>
      )}
    </svg>
  );
};

interface BottomNavProps {
  active: Screen;
  onNavigate: (s: Screen) => void;
  bookingCount: number;
  messageCount?: number;
  showProfile?: boolean;
  searchLabel?: string;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  active,
  onNavigate,
  bookingCount,
  messageCount = 0,
  showProfile = true,
  searchLabel = "ძიება",
}) => {
  const visibleItems = showProfile
    ? navItems
    : navItems.filter((item) => item.id !== "user-profile");

  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        background: "rgba(255,255,255,0.98)",
        backdropFilter: "blur(16px)",
        borderTop: "1px solid var(--border)",
        paddingBottom: "var(--safe-bottom)",
        display: "flex",
        zIndex: 50,
        boxShadow: "none",
      }}
    >
      {visibleItems.map((item) => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            style={{
              flex: 1,
              padding: "10px 0 9px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              background: "transparent",
              transition: "all 0.2s",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "relative",
                width: 28,
                height: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  color: isActive ? "var(--primary)" : "var(--text3)",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <NavIcon name={item.icon} />
              </span>
              {item.id === "bookings" && bookingCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -6,
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: "var(--accent)",
                    color: "white",
                    fontSize: 9,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {bookingCount > 9 ? "9+" : bookingCount}
                </span>
              )}
              {item.id === "messages" && messageCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -6,
                    minWidth: 16,
                    height: 16,
                    padding: "0 4px",
                    borderRadius: 999,
                    background: "#ef4444",
                    color: "white",
                    fontSize: 9,
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {messageCount > 9 ? "9+" : messageCount}
                </span>
              )}
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: isActive ? 700 : 400,
                color: isActive ? "var(--accent)" : "var(--text3)",
                transition: "all 0.2s",
              }}
            >
              {item.id === "search" ? searchLabel : item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
