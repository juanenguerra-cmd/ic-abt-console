export type PdfOrientation = 'landscape' | 'portrait';
export type PdfTemplate = 'LANDSCAPE_TEMPLATE_V1' | 'PORTRAIT_TEMPLATE_V1' | 'ACTIVE_PRECAUTIONS_TEMPLATE_V1' | 'REPORT_TEMPLATE_V1';

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
const EMPTY_CELL_PLACEHOLDER = '\u2014';
const COL_HEADER_CHAR_WIDTH = 5;
const DATA_ROW_CHAR_WIDTH = 4.5;

const escapePdfText = (value: string): string =>
  value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');

type RenderItem =
  | { type: 'section-gap' }
  | { type: 'section-title'; text: string }
  | { type: 'col-header'; cells: string[]; colWidths: number[] }
  | { type: 'data-row'; cells: string[]; colWidths: number[]; isEven: boolean };

const buildReportPdf = (spec: PdfSpec): Blob => {
  const isLandscape = spec.orientation === 'landscape';
  const pageWidth = isLandscape ? 792 : 612;
  const pageHeight = isLandscape ? 612 : 792;
  const marginX = 36;
  const contentWidth = pageWidth - marginX * 2;

  const headerHeight = 66;
  const footerHeight = 28;
  const bodyTop = pageHeight - headerHeight;
  const bodyBottom = footerHeight;
  const availableHeight = bodyTop - bodyBottom;

  const sectionGapHeight = 10;
  const sectionTitleHeight = 18;
  const colHeaderHeight = 16;
  const dataRowHeight = 14;

  const items: RenderItem[] = [];

  spec.sections.forEach((section, sectionIdx) => {
    if (sectionIdx > 0) items.push({ type: 'section-gap' });

    if (section.type === 'table') {
      if (section.title) items.push({ type: 'section-title', text: section.title });

      const colCount = Math.max(section.columns.length, 1);
      const colWidths = section.columns.map(() => contentWidth / colCount);

      items.push({ type: 'col-header', cells: section.columns.map((c) => c.toUpperCase()), colWidths });

      if (section.rows.length === 0) {
        items.push({ type: 'data-row', cells: ['No data available'], colWidths: [contentWidth], isEven: false });
      } else {
        section.rows.forEach((row, rowIdx) => {
          items.push({
            type: 'data-row',
            cells: row.map((cell) => String(cell ?? EMPTY_CELL_PLACEHOLDER)),
            colWidths,
            isEven: rowIdx % 2 === 0,
          });
        });
      }
    } else {
      if (section.title) items.push({ type: 'section-title', text: section.title });
      section.lines.forEach((line, lineIdx) => {
        items.push({ type: 'data-row', cells: [line], colWidths: [contentWidth], isEven: lineIdx % 2 === 0 });
      });
    }
  });

  const getItemHeight = (item: RenderItem): number => {
    if (item.type === 'section-gap') return sectionGapHeight;
    if (item.type === 'section-title') return sectionTitleHeight;
    if (item.type === 'col-header') return colHeaderHeight;
    return dataRowHeight;
  };

  const pages: RenderItem[][] = [[]];
  let currentHeight = 0;

  items.forEach((item) => {
    const h = getItemHeight(item);
    if (currentHeight + h > availableHeight && pages[pages.length - 1].length > 0) {
      pages.push([]);
      currentHeight = 0;
    }
    pages[pages.length - 1].push(item);
    currentHeight += h;
  });

  const objects: string[] = [];
  const xref: number[] = [0];
  const addObject = (content: string) => {
    xref.push(0);
    objects.push(content);
    return objects.length;
  };

  const fontRegularId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const fontBoldId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  const dt = (x: number, y: number, text: string, size = 9, bold = false): string => {
    const safe = escapePdfText(String(text ?? ''));
    return `BT /${bold ? 'F2' : 'F1'} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${safe}) Tj ET`;
  };

  const totalPages = pages.length;
  const facilityName = spec.facilityName || DEFAULT_FACILITY;
  const subtitleText = spec.subtitleLines.join('   ');

  const pageIds: number[] = [];

  pages.forEach((pageItems, pageIndex) => {
    const sl: string[] = [];

    sl.push(dt(marginX, pageHeight - 28, facilityName, 13, true));
    sl.push(dt(marginX, pageHeight - 44, spec.title, 11, true));
    if (subtitleText) {
      sl.push(dt(marginX, pageHeight - 56, subtitleText, 8, false));
    }
    sl.push('0.75 g');
    sl.push(`${marginX} ${pageHeight - 62} ${contentWidth} 1 re f`);
    sl.push('0 g');

    sl.push(dt(pageWidth - marginX - 72, 16, `Page ${pageIndex + 1} of ${totalPages}`, 8, false));
    sl.push('0.75 g');
    sl.push(`${marginX} ${footerHeight - 4} ${contentWidth} 1 re f`);
    sl.push('0 g');

    let y = bodyTop;

    pageItems.forEach((item) => {
      if (item.type === 'section-gap') {
        y -= sectionGapHeight;
        return;
      }

      if (item.type === 'section-title') {
        y -= sectionTitleHeight;
        sl.push('0.93 g');
        sl.push(`${marginX} ${y} ${contentWidth} ${sectionTitleHeight - 2} re f`);
        sl.push('0 g');
        sl.push('0.5 G');
        sl.push('0.5 w');
        sl.push(`${marginX} ${y} ${contentWidth} ${sectionTitleHeight - 2} re S`);
        sl.push('0 G');
        sl.push(dt(marginX + 4, y + 5, item.text, 10, true));
        return;
      }

      if (item.type === 'col-header') {
        y -= colHeaderHeight;
        sl.push('0.82 g');
        sl.push(`${marginX} ${y} ${contentWidth} ${colHeaderHeight} re f`);
        sl.push('0 g');
        sl.push('0.5 G');
        sl.push('0.5 w');
        sl.push(`${marginX} ${y} ${contentWidth} ${colHeaderHeight} re S`);
        sl.push('0 G');
        let x = marginX;
        item.cells.forEach((cell, i) => {
          const colW = item.colWidths[i];
          const maxChars = Math.max(4, Math.floor(colW / COL_HEADER_CHAR_WIDTH));
          const clipped = cell.length > maxChars ? `${cell.slice(0, maxChars - 3)}...` : cell;
          sl.push(dt(x + 3, y + 4, clipped, 8, true));
          if (i < item.cells.length - 1) {
            sl.push('0.65 G');
            sl.push('0.3 w');
            sl.push(`${x + colW} ${y} m ${x + colW} ${y + colHeaderHeight} l S`);
            sl.push('0 G');
          }
          x += colW;
        });
        return;
      }

      if (item.type === 'data-row') {
        y -= dataRowHeight;
        if (item.isEven) {
          sl.push('0.97 g');
          sl.push(`${marginX} ${y} ${contentWidth} ${dataRowHeight} re f`);
          sl.push('0 g');
        }
        sl.push('0.85 G');
        sl.push('0.3 w');
        sl.push(`${marginX} ${y} m ${marginX + contentWidth} ${y} l S`);
        sl.push('0 G');
        let x = marginX;
        item.cells.forEach((cell, i) => {
          const colW = item.colWidths[i];
          const maxChars = Math.max(4, Math.floor(colW / DATA_ROW_CHAR_WIDTH));
          const clipped = cell.length > maxChars ? `${cell.slice(0, maxChars - 3)}...` : cell;
          sl.push(dt(x + 3, y + 3, clipped, 8, false));
          if (i < item.cells.length - 1) {
            sl.push('0.85 G');
            sl.push('0.3 w');
            sl.push(`${x + colW} ${y} m ${x + colW} ${y + dataRowHeight} l S`);
            sl.push('0 G');
          }
          x += colW;
        });
      }
    });

    sl.push('0.5 G');
    sl.push('0.5 w');
    sl.push(`${marginX} ${bodyBottom} ${contentWidth} ${availableHeight} re S`);
    sl.push('0 G');

    const cs = sl.join('\n');
    const contentId = addObject(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`);
    const pageId = addObject(
      `<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`,
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





const buildActivePrecautionsPdf = (spec: PdfSpec): Blob => {
  const width = 792;
  const height = 612;
  const margin = 12;
  const tableTop = 500;
  const headerHeight = 34;
  const rowHeight = 30;

  const primaryTable = spec.sections.find((section): section is PdfTableSection => section.type === 'table');
  const rows = primaryTable?.rows ?? [];

  const subtitleLookup = new Map(spec.subtitleLines.map((line) => {
    const idx = line.indexOf(':');
    return idx > -1 ? [line.slice(0, idx).trim().toUpperCase(), line.slice(idx + 1).trim()] : [line.trim().toUpperCase(), ''];
  }));

  const unit = subtitleLookup.get('UNIT') ?? 'All Units';
  const date = subtitleLookup.get('DATE') ?? new Date().toLocaleDateString();
  const shift = subtitleLookup.get('SHIFT') ?? 'Day';
  const preparedBy = subtitleLookup.get('PREPARED BY') ?? '';

  const colWidths = [78, 220, 220, 132, 118];
  const colHeaders = ['RM. #', "RESIDENT’S NAME", 'PRECAUTION/ISOLATION', 'INFECTED\nSOURCE', 'DURATION'];

  const objects: string[] = [];
  const xref: number[] = [0];
  const addObject = (content: string) => {
    xref.push(0);
    objects.push(content);
    return objects.length;
  };

  const fontRegularId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const fontBoldId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  const drawText = (x: number, y: number, text: string, size = 10, bold = false) => {
    const safe = escapePdfText(text);
    return `BT /${bold ? 'F2' : 'F1'} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${safe}) Tj ET`;
  };

  const lines: string[] = [];
  lines.push('0.5 g');
  lines.push(`${margin} ${tableTop - headerHeight} ${width - margin * 2} ${headerHeight} re f`);
  lines.push('0 G');
  lines.push('1 w');

  const totalRows = Math.max(rows.length, 1);
  const tableHeight = headerHeight + totalRows * rowHeight;
  const tableBottom = tableTop - tableHeight;

  lines.push(`${margin} ${tableBottom} ${width - margin * 2} ${tableHeight} re S`);

  let cursorX = margin;
  for (let i = 0; i < colWidths.length - 1; i += 1) {
    cursorX += colWidths[i];
    lines.push(`${cursorX} ${tableBottom} m ${cursorX} ${tableTop} l S`);
  }
  lines.push(`${margin} ${tableTop - headerHeight} m ${width - margin} ${tableTop - headerHeight} l S`);

  for (let i = 1; i < totalRows; i += 1) {
    const y = tableTop - headerHeight - i * rowHeight;
    lines.push(`${margin} ${y} m ${width - margin} ${y} l S`);
  }

  lines.push(drawText(width / 2 - 150, 576, spec.facilityName || DEFAULT_FACILITY, 16, true));
  lines.push(drawText(width / 2 - 138, 548, 'RESIDENTS ON PRECAUTIONS OR ISOLATION', 12, true));

  lines.push(drawText(180, 525, 'UNIT:', 11, true));
  lines.push(drawText(255, 525, unit, 11, true));
  lines.push('150 522 m 290 522 l S');

  lines.push(drawText(325, 525, 'DATE:', 11, true));
  lines.push(drawText(390, 525, date, 11, true));
  lines.push('355 522 m 470 522 l S');

  lines.push(drawText(500, 525, 'SHIFT:', 11, true));
  lines.push(drawText(565, 525, shift, 11, true));
  lines.push('535 522 m 700 522 l S');

  cursorX = margin;
  colHeaders.forEach((header, i) => {
    const parts = header.split('\n');
    const cx = cursorX + colWidths[i] / 2;
    if (parts.length === 1) {
      lines.push(drawText(cx - (parts[0].length * 2.8), tableTop - 22, parts[0], 10, true));
    } else {
      lines.push(drawText(cx - (parts[0].length * 2.8), tableTop - 18, parts[0], 10, true));
      lines.push(drawText(cx - (parts[1].length * 2.8), tableTop - 30, parts[1], 10, true));
    }
    cursorX += colWidths[i];
  });

  const rowText = rows.length ? rows : [['', 'No active precautions', '', '', '']];
  rowText.slice(0, totalRows).forEach((row, rowIdx) => {
    const y = tableTop - headerHeight - (rowIdx + 1) * rowHeight + 10;
    const values = [
      String(row[0] ?? ''),
      String(row[1] ?? ''),
      String(row[2] ?? ''),
      String(row[3] ?? ''),
      String(row[4] ?? ''),
    ];
    let x = margin + 6;
    values.forEach((val, i) => {
      lines.push(drawText(x, y, val, 9));
      x += colWidths[i];
    });
  });

  const footerY = tableBottom - 42;
  lines.push(drawText(12, footerY, 'Prepared by:', 11, true));
  lines.push(drawText(72, footerY, preparedBy, 11, true));
  lines.push(`70 ${footerY - 2} m 240 ${footerY - 2} l S`);

  lines.push(drawText(400, footerY, 'Title:', 11, true));
  lines.push(`430 ${footerY - 2} m 610 ${footerY - 2} l S`);

  lines.push(drawText(12, footerY - 30, 'Signature:', 11, true));
  lines.push(`70 ${footerY - 32} m 240 ${footerY - 32} l S`);

  lines.push(drawText(400, footerY - 30, 'Date/Time:', 11, true));
  lines.push(`460 ${footerY - 32} m 610 ${footerY - 32} l S`);

  lines.push(drawText(12, footerY - 68, '* If the patient is known to have an MRSA, VRE or any multidrug resistant infection or colonization,', 8, true));
  lines.push(drawText(12, footerY - 80, 'the health care worker should wear disposable gloves. Depending on the type of contact, a gown should also be', 8, true));
  lines.push(drawText(12, footerY - 92, 'worn. Patients must also wash their hands to avoid spreading the bacteria to others.', 8, true));

  const contentStream = lines.join('\n');
  const contentId = addObject(`<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`);
  const pageId = addObject(`<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`);
  const pagesId = addObject(`<< /Type /Pages /Kids [${pageId} 0 R] /Count 1 >>`);
  objects[pageId - 1] = objects[pageId - 1].replace('/Parent 0 0 R', `/Parent ${pagesId} 0 R`);
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
  const blob =
    spec.template === 'ACTIVE_PRECAUTIONS_TEMPLATE_V1'
      ? buildActivePrecautionsPdf(spec)
      : buildReportPdf(spec);

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  const fallbackFilename =
    spec.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'report';
  link.download = `${spec.filename || fallbackFilename}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
};
