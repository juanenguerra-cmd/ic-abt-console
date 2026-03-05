export type PdfOrientation = 'landscape' | 'portrait';
export type PdfTemplate = 'LANDSCAPE_TEMPLATE_V1' | 'PORTRAIT_TEMPLATE_V1' | 'ACTIVE_PRECAUTIONS_TEMPLATE_V1';

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





const buildStandardFormPdf = (spec: PdfSpec): Blob => {
  const isLandscape = spec.orientation === 'landscape';
  const width = isLandscape ? 792 : 612;
  const height = isLandscape ? 612 : 792;
  const margin = 16;
  const titleY = height - 36;

  const subtitleLookup = new Map(spec.subtitleLines.map((line) => {
    const idx = line.indexOf(':');
    return idx > -1 ? [line.slice(0, idx).trim().toUpperCase(), line.slice(idx + 1).trim()] : [line.trim().toUpperCase(), ''];
  }));

  const unit = subtitleLookup.get('UNIT') || subtitleLookup.get('DATASET') || 'All Units';
  const date = subtitleLookup.get('DATE') || new Date().toLocaleDateString();
  const shift = subtitleLookup.get('SHIFT') || 'Day';
  const preparedBy = subtitleLookup.get('PREPARED BY') || '';

  const primaryTable = spec.sections.find((section): section is PdfTableSection => section.type === 'table');
  const columns = primaryTable?.columns?.length ? primaryTable.columns.map((c) => String(c || '').toUpperCase()) : ['DETAILS'];
  const rawRows = primaryTable?.rows?.length
    ? primaryTable.rows.map((row) => row.map((cell) => String(cell ?? '')))
    : spec.sections.flatMap((section) => section.type === 'text' ? section.lines.map((line) => [line]) : []);

  const rowLimit = Math.max(8, Math.min(rawRows.length || 8, isLandscape ? 12 : 16));
  const rows = rawRows.slice(0, rowLimit);
  while (rows.length < rowLimit) rows.push(Array(columns.length).fill(''));

  const tableTop = height - 148;
  const headerHeight = 42;
  const rowHeight = isLandscape ? 32 : 24;
  const tableHeight = headerHeight + rowLimit * rowHeight;
  const tableBottom = tableTop - tableHeight;

  const colWidth = (width - margin * 2) / columns.length;
  const colWidths = Array(columns.length).fill(colWidth);

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
  lines.push(`${margin} ${tableBottom} ${width - margin * 2} ${tableHeight} re S`);

  let cursorX = margin;
  for (let i = 0; i < colWidths.length - 1; i += 1) {
    cursorX += colWidths[i];
    lines.push(`${cursorX} ${tableBottom} m ${cursorX} ${tableTop} l S`);
  }
  lines.push(`${margin} ${tableTop - headerHeight} m ${width - margin} ${tableTop - headerHeight} l S`);

  for (let i = 1; i < rowLimit; i += 1) {
    const y = tableTop - headerHeight - i * rowHeight;
    lines.push(`${margin} ${y} m ${width - margin} ${y} l S`);
  }

  lines.push(drawText(width / 2 - 150, titleY, spec.facilityName || DEFAULT_FACILITY, 16, true));
  lines.push(drawText(width / 2 - Math.min(200, spec.title.length * 3.4), titleY - 30, spec.title.toUpperCase(), 12, true));

  lines.push(drawText(90, titleY - 56, 'UNIT:', 11, true));
  lines.push(drawText(138, titleY - 56, unit, 11, true));
  lines.push('125 ' + (titleY - 59) + ' m 240 ' + (titleY - 59) + ' l S');

  lines.push(drawText(width / 2 - 58, titleY - 56, 'DATE:', 11, true));
  lines.push(drawText(width / 2 - 10, titleY - 56, date, 11, true));
  lines.push((width / 2 - 26) + ' ' + (titleY - 59) + ' m ' + (width / 2 + 106) + ' ' + (titleY - 59) + ' l S');

  lines.push(drawText(width - 198, titleY - 56, 'SHIFT:', 11, true));
  lines.push(drawText(width - 144, titleY - 56, shift, 11, true));
  lines.push((width - 162) + ' ' + (titleY - 59) + ' m ' + (width - 42) + ' ' + (titleY - 59) + ' l S');

  cursorX = margin;
  columns.forEach((header, i) => {
    const approxCenter = cursorX + colWidths[i] / 2 - Math.min(20, header.length * 2.5);
    lines.push(drawText(approxCenter, tableTop - 24, header, 10, true));
    cursorX += colWidths[i];
  });

  rows.forEach((row, rowIdx) => {
    const y = tableTop - headerHeight - (rowIdx + 1) * rowHeight + Math.max(8, rowHeight / 2 - 3);
    let x = margin + 5;
    row.forEach((val, i) => {
      const clipped = String(val || '').slice(0, Math.max(8, Math.floor(colWidths[i] / 6)));
      lines.push(drawText(x, y, clipped, 9));
      x += colWidths[i];
    });
  });

  const footerY = tableBottom - 34;
  lines.push(drawText(margin, footerY, 'Prepared by:', 11, true));
  lines.push(drawText(margin + 62, footerY, preparedBy, 11, true));
  lines.push(`${margin + 60} ${footerY - 2} m ${margin + 238} ${footerY - 2} l S`);

  lines.push(drawText(width / 2 + 8, footerY, 'Title:', 11, true));
  lines.push(`${width / 2 + 40} ${footerY - 2} m ${width - margin - 40} ${footerY - 2} l S`);

  lines.push(drawText(margin, footerY - 28, 'Signature:', 11, true));
  lines.push(`${margin + 60} ${footerY - 30} m ${margin + 238} ${footerY - 30} l S`);

  lines.push(drawText(width / 2 + 8, footerY - 28, 'Date/Time:', 11, true));
  lines.push(`${width / 2 + 72} ${footerY - 30} m ${width - margin - 40} ${footerY - 30} l S`);

  lines.push(drawText(margin, footerY - 64, '* If the patient is known to have an MRSA, VRE or any multidrug resistant infection or colonization,', 8, true));
  lines.push(drawText(margin, footerY - 76, 'the health care worker should wear disposable gloves. Depending on the type of contact, a gown should also be', 8, true));
  lines.push(drawText(margin, footerY - 88, 'worn. Patients must also wash their hands to avoid spreading the bacteria to others.', 8, true));

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
  if (spec.template === 'ACTIVE_PRECAUTIONS_TEMPLATE_V1') {
    const blob = buildActivePrecautionsPdf(spec);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const fallbackFilename = spec.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'report';
    link.download = `${spec.filename || fallbackFilename}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
    return;
  }

  const blob = buildStandardFormPdf(spec);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  const fallbackFilename = spec.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'report';
  link.download = `${spec.filename || fallbackFilename}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
};
