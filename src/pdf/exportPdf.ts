export type PdfOrientation = 'landscape' | 'portrait';
export type PdfTemplate = 'LANDSCAPE_TEMPLATE_V1' | 'PORTRAIT_TEMPLATE_V1';

type CellValue = string | number | boolean | null | undefined;

export interface PdfTableSection {
  type: 'table';
  title?: string;
  columns: string[];
  rows: CellValue[][];
  pageBreakAfter?: boolean;
}

export interface PdfTextSection {
  type: 'text';
  title?: string;
  lines: string[];
  pageBreakAfter?: boolean;
}

export type PdfSection = PdfTableSection | PdfTextSection;

export interface PdfSpec {
  title: string;
  orientation: PdfOrientation;
  subtitleLines: string[];
  sections: PdfSection[];
  template: PdfTemplate;
  filename?: string;
  facilityName?: string;
}

const DEFAULT_FACILITY = 'Long Beach Nursing & Rehabilitation Center';
const PRODUCT_LINE = 'Infection Prevention & Antibiotic Stewardship Console';

const escapePdfText = (value: string): string =>
  value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');

const wrap = (text: string, maxChars: number): string[] => {
  if (text.length <= maxChars) return [text];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      return;
    }
    if (current) lines.push(current);
    current = word;
  });
  if (current) lines.push(current);
  return lines.length ? lines : [text.slice(0, maxChars)];
};

const tableToLines = (section: PdfTableSection, maxChars: number): string[] => {
  const lines: string[] = [];
  if (section.title) {
    lines.push(section.title);
  }
  const colWidth = Math.max(8, Math.floor((maxChars - (section.columns.length - 1) * 3) / Math.max(section.columns.length, 1)));
  const renderRow = (cells: string[]) => {
    const wrappedCells = cells.map((cell) => wrap(cell, colWidth));
    const rowHeight = Math.max(...wrappedCells.map((cell) => cell.length));
    for (let i = 0; i < rowHeight; i += 1) {
      lines.push(
        wrappedCells
          .map((cellLines) => (cellLines[i] ?? '').padEnd(colWidth, ' '))
          .join(' | '),
      );
    }
  };

  renderRow(section.columns);
  lines.push('-'.repeat(maxChars));
  section.rows.forEach((row) => renderRow(row.map((cell) => String(cell ?? '—'))));
  return lines;
};

const sectionsToLines = (spec: PdfSpec, maxChars: number): string[] => {
  const lines: string[] = [];
  spec.sections.forEach((section, idx) => {
    if (section.type === 'table') {
      lines.push(...tableToLines(section, maxChars));
    } else {
      if (section.title) lines.push(section.title);
      section.lines.forEach((line) => lines.push(...wrap(line, maxChars)));
    }

    if (section.pageBreakAfter && idx !== spec.sections.length - 1) {
      lines.push('__PAGE_BREAK__');
    } else {
      lines.push('');
    }
  });
  return lines;
};

const paginate = (lines: string[], linesPerPage: number): string[][] => {
  const pages: string[][] = [[]];
  lines.forEach((line) => {
    if (line === '__PAGE_BREAK__') {
      pages.push([]);
      return;
    }
    const current = pages[pages.length - 1];
    if (current.length >= linesPerPage) {
      pages.push([line]);
      return;
    }
    current.push(line);
  });
  return pages.filter((page) => page.length > 0);
};

const buildPdf = (pages: string[][], orientation: PdfOrientation, headerLines: string[]): Blob => {
  const isLandscape = orientation === 'landscape';
  const width = isLandscape ? 792 : 612;
  const height = isLandscape ? 612 : 792;
  const marginX = 36;
  const topY = height - 36;
  const lineHeight = 11;

  const objects: string[] = [];
  const xref: number[] = [0];
  const addObject = (content: string) => {
    xref.push(0);
    objects.push(content);
    return objects.length;
  };

  const fontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  const pageIds: number[] = [];

  pages.forEach((pageLines, index) => {
    const pageNumber = index + 1;
    const fullLines = [
      ...headerLines,
      '',
      ...pageLines,
      '',
      `Page ${pageNumber} of ${pages.length}`,
    ];

    const textCommands = fullLines
      .map((line, lineIndex) => {
        const y = topY - lineIndex * lineHeight;
        return `BT /F1 9 Tf ${marginX} ${Math.max(18, y)} Td (${escapePdfText(line)}) Tj ET`;
      })
      .join('\n');

    const content = `<< /Length ${textCommands.length} >>\nstream\n${textCommands}\nendstream`;
    const contentId = addObject(content);

    const pageId = addObject(
      `<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    pageIds.push(pageId);
  });

  const pagesId = addObject(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);

  pageIds.forEach((pageId) => {
    objects[pageId - 1] = objects[pageId - 1].replace('/Parent 0 0 R', `/Parent ${pagesId} 0 R`);
  });

  const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  let body = '%PDF-1.4\n';
  objects.forEach((obj, i) => {
    xref[i + 1] = body.length;
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });

  const xrefStart = body.length;
  body += `xref\n0 ${objects.length + 1}\n`;
  body += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i += 1) {
    body += `${String(xref[i]).padStart(10, '0')} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new Blob([body], { type: 'application/pdf' });
};

export const exportPdfDocument = (spec: PdfSpec): void => {
  const maxChars = spec.orientation === 'landscape' ? 130 : 88;
  const linesPerPage = spec.orientation === 'landscape' ? 44 : 62;
  const generated = new Date().toLocaleString();
  const filterLine = spec.subtitleLines.length > 0 ? spec.subtitleLines.join(' | ') : 'Filters Applied: None';
  const headerLines = [
    spec.facilityName || DEFAULT_FACILITY,
    PRODUCT_LINE,
    spec.title,
    `Generated: ${generated}`,
    filterLine,
  ];

  const bodyLines = sectionsToLines(spec, maxChars);
  const pages = paginate(bodyLines, linesPerPage - headerLines.length - 3);
  const blob = buildPdf(pages, spec.orientation, headerLines);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  const fallbackFilename = spec.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'report';
  link.download = `${spec.filename || fallbackFilename}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
};
