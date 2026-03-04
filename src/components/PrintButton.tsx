import React from 'react';
import { Printer } from 'lucide-react';
import { usePrint, BASE_PAGE_STYLE } from '../lib/usePrint';
import type { RefObject } from 'react';

interface PrintButtonProps {
  contentRef: RefObject<HTMLElement | null>;
  title?: string;
  pageStyle?: string;
  className?: string;
  label?: string;
  disabled?: boolean;
}

export const PrintButton: React.FC<PrintButtonProps> = ({
  contentRef,
  title = 'Report',
  pageStyle,
  className = '',
  label = 'Print / PDF',
  disabled = false,
}) => {
  const handlePrint = usePrint(contentRef, title, pageStyle ?? BASE_PAGE_STYLE);

  return (
    <button
      onClick={handlePrint}
      disabled={disabled}
      className={`no-print inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-neutral-300 text-neutral-700 rounded-md text-sm font-medium hover:bg-neutral-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      <Printer className="w-4 h-4" />
      {label}
    </button>
  );
};
