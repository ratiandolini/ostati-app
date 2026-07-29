import React from "react";

interface StarsProps {
  rating: number;
  size?: number;
}

export const Stars: React.FC<StarsProps> = ({ rating, size = 14 }) => {
  return (
    <span style={{ display: "flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          style={{
            fontSize: size,
            color:
              i <= Math.round(rating) ? "#FBBF24" : "rgba(255,255,255,0.15)",
          }}
        >
          ★
        </span>
      ))}
    </span>
  );
};
