import { exportPdfDocument, type PdfOrientation, type PdfSection, type PdfTemplate } from '../pdf/exportPdf';

type CellValue = string | number | boolean | null | undefined;

export interface PdfTableSection {
  title?: string;
  columns: string[];
  rows: CellValue[][];
  pageBreakAfter?: boolean;
}

export interface ExportPdfOptions {
  title: string;
  orientation?: PdfOrientation;
  columns?: string[];
  rows?: CellValue[][];
  filters?: Record<string, string | number | boolean | null | undefined>;
  footerNote?: string;
  pageBreak?: boolean;
  tables?: PdfTableSection[];
}

const mapFiltersToSubtitle = (filters?: ExportPdfOptions['filters']): string[] => {
  const filterText = Object.entries(filters ?? {})
    .filter(([, value]) => value !== null && value !== undefined && value !== '' && value !== 'all')
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' | ');

  return [`Filters Applied: ${filterText || 'None'}`];
};

export const exportPDF = ({
  title,
  orientation = 'landscape',
  columns,
  rows,
  filters,
  footerNote,
  pageBreak,
  tables,
}: ExportPdfOptions): void => {
  const sections: PdfSection[] =
    tables && tables.length > 0
      ? tables.map((table) => ({
          type: 'table',
          title: table.title,
          columns: table.columns,
          rows: table.rows,
          pageBreakAfter: table.pageBreakAfter,
        }))
      : [
          {
            type: 'table',
            columns: columns ?? [],
            rows: rows ?? [],
            pageBreakAfter: pageBreak,
          },
        ];

  if (footerNote) {
    sections.push({ type: 'text', title: 'Notes', lines: [footerNote] });
  }

  const template: PdfTemplate = orientation === 'portrait' ? 'PORTRAIT_TEMPLATE_V1' : 'LANDSCAPE_TEMPLATE_V1';

  exportPdfDocument({
    title,
    orientation,
    subtitleLines: mapFiltersToSubtitle(filters),
    sections,
    template,
  });
};
