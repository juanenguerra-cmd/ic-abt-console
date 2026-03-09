import React from "react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = "",
}) => (
  <div
    role="status"
    aria-label={title}
    className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}
  >
    {icon && (
      <div className="mb-4 opacity-40" aria-hidden="true">
        {icon}
      </div>
    )}
    <h3 className="text-base font-semibold text-neutral-700 mb-1">{title}</h3>
    {description && (
      <p className="text-sm text-neutral-500 max-w-sm mb-4">{description}</p>
    )}
    {action && <div className="mt-2">{action}</div>}
  </div>
);
