import React from 'react';
import { Download } from 'lucide-react';
import { exportPdfDocument, type PdfSpec } from '../pdf/exportPdf';

interface ExportPdfButtonProps {
  buildSpec?: () => PdfSpec;
  buildPdfSpec?: () => PdfSpec;
  filename?: string;
  className?: string;
  label?: string;
}

export const ExportPdfButton: React.FC<ExportPdfButtonProps> = ({
  buildSpec,
  buildPdfSpec,
  filename,
  className,
  label = 'Export PDF',
}) => {
  const handleClick = () => {
    const specBuilder = buildSpec ?? buildPdfSpec;
    if (!specBuilder) {
      return;
    }
    const spec = specBuilder();
    exportPdfDocument({ ...spec, filename: filename ?? spec.filename });
  };

  return (
    <button
      onClick={handleClick}
      className={className ?? 'flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100'}
    >
      <Download className="w-4 h-4" />
      {label}
    </button>
  );
};
