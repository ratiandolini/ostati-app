import React from "react";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = "◌",
  title,
  description,
  actionLabel,
  onAction,
  compact = false,
}) => (
  <div className={`empty-state${compact ? " compact" : ""}`}>
    <div className="empty-state-icon">{icon}</div>
    <div className="empty-state-title">{title}</div>
    {description && <div className="empty-state-description">{description}</div>}
    {actionLabel && onAction && (
      <button type="button" className="empty-state-action" onClick={onAction}>
        {actionLabel}
      </button>
    )}
  </div>
);
