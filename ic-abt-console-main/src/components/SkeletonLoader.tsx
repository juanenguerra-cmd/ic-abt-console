import React from "react";

interface SkeletonRowProps {
  cols?: number;
  className?: string;
}

export const SkeletonRow: React.FC<SkeletonRowProps> = ({ cols = 5, className = "" }) => (
  <tr className={`animate-pulse ${className}`} aria-hidden="true">
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <div className="h-4 bg-neutral-200 rounded" style={{ width: `${60 + Math.random() * 40}%` }} />
      </td>
    ))}
  </tr>
);

export const SkeletonTable: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 5 }) => (
  <tbody aria-label="Loading data…" aria-busy="true">
    {Array.from({ length: rows }).map((_, i) => (
      <SkeletonRow key={i} cols={cols} />
    ))}
  </tbody>
);

export const SkeletonCard: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`animate-pulse bg-white border border-neutral-200 rounded-lg p-3 ${className}`} aria-hidden="true">
    <div className="h-4 bg-neutral-200 rounded w-3/4 mb-2" />
    <div className="h-3 bg-neutral-100 rounded w-1/2 mb-3" />
    <div className="flex gap-1">
      <div className="h-5 bg-neutral-100 rounded-full w-12" />
      <div className="h-5 bg-neutral-100 rounded-full w-10" />
    </div>
  </div>
);

export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({ lines = 3, className = "" }) => (
  <div className={`animate-pulse space-y-2 ${className}`} aria-hidden="true">
    {Array.from({ length: lines }).map((_, i) => (
      <div key={i} className="h-4 bg-neutral-200 rounded" style={{ width: i === lines - 1 ? "60%" : "100%" }} />
    ))}
  </div>
);
