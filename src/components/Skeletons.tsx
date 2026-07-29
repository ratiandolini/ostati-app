import React from "react";

interface WorkerCardSkeletonListProps {
  count?: number;
}

export const WorkerCardSkeletonList: React.FC<WorkerCardSkeletonListProps> = ({
  count = 3,
}) => (
  <div className="worker-card-skeleton-list" aria-busy="true" aria-live="polite">
    {Array.from({ length: count }).map((_, index) => (
      <div key={index} className="worker-card-skeleton">
        <div />
        <section>
          <span />
          <span />
          <span />
        </section>
      </div>
    ))}
  </div>
);
