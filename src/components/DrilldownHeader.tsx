import React from 'react';

export function DrilldownHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-xl font-bold text-neutral-900">{title}</div>
        {subtitle ? <div className="mt-0.5 text-xs text-neutral-500">{subtitle}</div> : null}
      </div>
      <div className="flex items-center gap-2">{right}</div>
    </div>
  );
}
