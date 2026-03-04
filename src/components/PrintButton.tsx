import React from 'react';
import { Printer } from 'lucide-react';
import { startPrint } from '../print/startPrint';

interface Props {
  contentRef: React.RefObject<HTMLElement | null>;
  title: string;
  className?: string;
  pageStyle?: string;
  disabled?: boolean;
}

export const PrintButton: React.FC<Props> = ({ contentRef, title, className = '', pageStyle, disabled }) => {
  const [isPrinting, setIsPrinting] = React.useState(false);

  const onPrint = async () => {
    const node = contentRef.current;
    if (!node) return;
    setIsPrinting(true);
    await startPrint('dom', title, () => ({
      title,
      html: node.innerHTML,
      pageStyle,
    }));
    setIsPrinting(false);
  };

  return (
    <button
      onClick={onPrint}
      disabled={disabled || isPrinting}
      className={`no-print inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-neutral-300 text-neutral-700 rounded-md text-sm font-medium hover:bg-neutral-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      <Printer className="w-4 h-4" />
      {isPrinting ? 'Preparing…' : 'Print'}
    </button>
  );
};
