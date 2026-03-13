export type PdfOrientation = 'landscape' | 'portrait';
export type PdfTemplate = 'LANDSCAPE_TEMPLATE_V1' | 'PORTRAIT_TEMPLATE_V1' | 'ACTIVE_PRECAUTIONS_TEMPLATE_V1' | 'RESIDENT_BOARD_TEMPLATE_V1';

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
  showSignatureLines?: boolean;
}

export const DEFAULT_FACILITY = 'Long Beach Nursing & Rehabilitation Center';

const escapePdfText = (value: string): string =>
  value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');

const wrap = (text: string, maxChars: number): string[] => {
  const limit = Math.max(1, maxChars);
  if (text.length <= limit) return [text];
  
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  
  words.forEach((word) => {
    if (word.length > limit) {
      if (current) lines.push(current);
      let remaining = word;
      while (remaining.length > limit) {
        lines.push(remaining.slice(0, limit));
        remaining = remaining.slice(limit);
      }
      current = remaining;
      return;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= limit) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  });
  if (current) lines.push(current);
  return lines;
};

const buildMultiPageGraphicalPdf = (spec: PdfSpec): Blob => {
  const isLandscape = spec.orientation === 'landscape';
  const width = isLandscape ? 792 : 612;
  const height = isLandscape ? 612 : 792;
  const margin = 36;
  const topY = height - 36;
  const footerY = 24;

  const objects: string[] = [];
  const xref: number[] = [0];
  const addObject = (content: string) => {
    xref.push(0);
    objects.push(content);
    return objects.length;
  };

  const fontRegularId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const fontBoldId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const fontMonoId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');

  const drawText = (x: number, y: number, text: string, size = 9, font = 'F1') => {
    const safe = escapePdfText(text);
    return `BT 0 g /${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${safe}) Tj ET`;
  };

  const pageData: { pageId: number; contentId: number }[] = [];
  let currentLines: string[] = [];
  let currentY = topY;
  let pageNumber = 1;

  const startPage = () => {
    currentLines = [];
    currentY = topY;
    
    // Facility Name
    currentLines.push(drawText(margin, currentY, spec.facilityName || DEFAULT_FACILITY, 14, 'F2'));
    currentY -= 18;
    
    // Report Title
    currentLines.push(drawText(margin, currentY, spec.title.toUpperCase(), 11, 'F2'));
    currentY -= 14;

    // Subtitles
    spec.subtitleLines.forEach(line => {
      currentLines.push(drawText(margin, currentY, line, 9, 'F1'));
      currentY -= 11;
    });

    currentY -= 10;
    // Header Line
    currentLines.push(`0.5 G 0.5 w ${margin} ${currentY} m ${width - margin} ${currentY} l S`);
    currentY -= 20;
  };

  // Placeholder for total pages — fixed width so stream length stays constant after replacement
  const TOTAL_PAGES_PLACEHOLDER = 'TOTALPG';

  const finishPage = () => {
    // Footer Line
    currentLines.push(`0.5 G 0.5 w ${margin} ${footerY + 12} m ${width - margin} ${footerY + 12} l S`);
    currentLines.push(drawText(margin, footerY, `Page ${pageNumber} of ${TOTAL_PAGES_PLACEHOLDER}`, 8, 'F1'));
    
    const contentStream = currentLines.join('\n');
    const contentId = addObject(`<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`);
    const pageId = addObject(`<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R /F3 ${fontMonoId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageData.push({ pageId, contentId });
    pageNumber++;
  };

  startPage();

  spec.sections.forEach((section) => {
    if (section.type === 'text') {
      if (section.title) {
        if (currentY < margin + 40) { finishPage(); startPage(); }
        currentLines.push(drawText(margin, currentY, section.title, 10, 'F2'));
        currentY -= 14;
      }
      section.lines.forEach(line => {
        const wrapped = wrap(line, isLandscape ? 110 : 80);
        wrapped.forEach(w => {
          if (currentY < margin + 20) { finishPage(); startPage(); }
          currentLines.push(drawText(margin, currentY, w, 9, 'F1'));
          currentY -= 11;
        });
      });
      currentY -= 10;
    } else if (section.type === 'table') {
      if (section.title) {
        if (currentY < margin + 60) { finishPage(); startPage(); }
        currentLines.push(drawText(margin, currentY, section.title, 10, 'F2'));
        currentY -= 14;
      }

      const numCols = section.columns.length;
      const availableWidth = width - margin * 2;
      
      // Calculate column widths
      const colMaxLengths = section.columns.map((col, i) => {
        let max = col.length;
        section.rows.forEach((row) => {
          const val = String(row[i] ?? '');
          if (val.length > max) max = val.length;
        });
        return Math.max(max, col.length);
      });
      
      const totalChars = colMaxLengths.reduce((a, b) => a + b, 0) || 1;
      
      // Initial widths based on characters
      let colWidths = colMaxLengths.map((len) => (len / totalChars) * availableWidth);
      
      // Ensure a minimum width for each column (e.g. 45 points)
      const minColWidth = 45;
      let adjustedTotal = 0;
      colWidths = colWidths.map((w) => {
        const adjusted = Math.max(minColWidth, w);
        adjustedTotal += adjusted;
        return adjusted;
      });

      // If we exceeded available width due to minimums, we must scale back
      if (adjustedTotal > availableWidth) {
        const scale = availableWidth / adjustedTotal;
        colWidths = colWidths.map((w) => w * scale);
      }

      const renderHeader = () => {
        currentLines.push('0.9 g'); // Light gray background
        currentLines.push(`${margin} ${currentY - 15} ${availableWidth} 15 re f`);
        currentLines.push('0 g 0 G 0.5 w'); // Reset fill to black, stroke to black
        currentLines.push(`${margin} ${currentY} m ${width - margin} ${currentY} l S`);
        currentLines.push(`${margin} ${currentY - 15} m ${width - margin} ${currentY - 15} l S`);
        
        let x = margin;
        section.columns.forEach((col, i) => {
          const headerMaxChars = Math.floor((colWidths[i] - 6) / 5.5);
          const headerText = col.length > headerMaxChars ? col.slice(0, headerMaxChars) : col;
          currentLines.push(drawText(x + 3, currentY - 11, headerText.toUpperCase(), 8, 'F2'));
          if (i > 0) currentLines.push(`${x} ${currentY} m ${x} ${currentY - 15} l S`);
          x += colWidths[i];
        });
        currentLines.push(`${margin} ${currentY} m ${margin} ${currentY - 15} l S`);
        currentLines.push(`${width - margin} ${currentY} m ${width - margin} ${currentY - 15} l S`);
        currentY -= 15;
      };

      renderHeader();

      section.rows.forEach((row) => {
        const wrappedCells = row.map((cell, i) => {
          const charsPerLine = Math.floor((colWidths[i] - 6) / 5.2);
          return wrap(String(cell ?? ''), charsPerLine);
        });
        const rowHeight = Math.max(1, ...wrappedCells.map((c) => c.length)) * 12;

        if (currentY - rowHeight < margin + 20) {
          // Close table on current page
          currentLines.push(`${margin} ${currentY} m ${width - margin} ${currentY} l S`);
          finishPage();
          startPage();
          renderHeader();
        }

        let x = margin;
        wrappedCells.forEach((cellLines, i) => {
          cellLines.forEach((line, lineIdx) => {
            currentLines.push(drawText(x + 3, currentY - 10 - lineIdx * 12, line, 8, 'F1'));
          });
          if (i > 0) currentLines.push(`${x} ${currentY} m ${x} ${currentY - rowHeight} l S`);
          x += colWidths[i];
        });
        
        currentLines.push(`${margin} ${currentY} m ${margin} ${currentY - rowHeight} l S`);
        currentLines.push(`${width - margin} ${currentY} m ${width - margin} ${currentY - rowHeight} l S`);
        currentLines.push(`${margin} ${currentY - rowHeight} m ${width - margin} ${currentY - rowHeight} l S`);
        
        currentY -= rowHeight;
      });

      currentY -= 15;
    }

    if (section.pageBreakAfter) {
      finishPage();
      startPage();
    }
  });

  finishPage();

  const totalPages = pageData.length;
  const pagesId = addObject(`<< /Type /Pages /Kids [${pageData.map(({ pageId }) => `${pageId} 0 R`).join(' ')}] /Count ${totalPages} >>`);
  pageData.forEach(({ pageId, contentId }) => {
    // Fix parent reference in the page dictionary
    objects[pageId - 1] = objects[pageId - 1].replace('/Parent 0 0 R', `/Parent ${pagesId} 0 R`);
    // Replace the placeholder in the content stream so footer shows the real page total
    objects[contentId - 1] = objects[contentId - 1].replace('TOTALPG', String(totalPages));
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
    return `BT 0 g /${bold ? 'F2' : 'F1'} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${safe}) Tj ET`;
  };

  const lines: string[] = [];
  const pdfLines = lines; // Alias for consistency
  lines.push('0.5 g');
  lines.push(`${margin} ${tableTop - headerHeight} ${width - margin * 2} ${headerHeight} re f`);
  lines.push('0 g 0 G');
  lines.push('1 w');
  // Removed pre-drawn table border as we draw it dynamically
  // lines.push(`${margin} ${tableBottom} ${width - margin * 2} ${tableHeight} re S`);

  // Removed pre-drawn vertical lines
  // let cursorX = margin;
  // for (let i = 0; i < colWidths.length - 1; i += 1) {
  //   cursorX += colWidths[i];
  //   lines.push(`${cursorX} ${tableBottom} m ${cursorX} ${tableTop} l S`);
  // }
  
  lines.push(`${margin} ${tableTop - headerHeight} m ${width - margin} ${tableTop - headerHeight} l S`);

  // Removed pre-drawn row dividers
  // for (let i = 1; i < rowLimit; i += 1) {
  //   const y = tableTop - headerHeight - i * rowHeight;
  //   lines.push(`${margin} ${y} m ${width - margin} ${y} l S`);
  // }

  lines.push(drawText(width / 2 - 150, titleY, spec.facilityName || DEFAULT_FACILITY, 14, true));
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

  let cursorX = margin;
  columns.forEach((header, i) => {
    const approxCenter = cursorX + colWidths[i] / 2 - Math.min(20, header.length * 2.5);
    lines.push(drawText(approxCenter, tableTop - 24, header, 10, true));
    if (i < colWidths.length - 1) {
       lines.push(`${cursorX + colWidths[i]} ${tableTop} m ${cursorX + colWidths[i]} ${tableTop - headerHeight} l S`);
    }
    cursorX += colWidths[i];
  });
  
  // Draw top border
  lines.push(`${margin} ${tableTop} m ${width - margin} ${tableTop} l S`);
  lines.push(`${margin} ${tableTop} m ${margin} ${tableTop - headerHeight} l S`);
  lines.push(`${width - margin} ${tableTop} m ${width - margin} ${tableTop - headerHeight} l S`);

  let currentY = tableTop - headerHeight;

  rows.forEach((row) => {
    const wrappedCells = row.map((val, i) => {
      const charsPerLine = Math.floor((colWidths[i] - 6) / 5.5);
      return wrap(String(val ?? ''), charsPerLine);
    });
    const rowHeight = Math.max(1, ...wrappedCells.map(c => c.length)) * 11 + 8;
    
    const yTop = currentY;
    let x = margin;
    
    wrappedCells.forEach((lines, i) => {
      lines.forEach((line, lineIdx) => {
        pdfLines.push(drawText(x + 4, yTop - 12 - lineIdx * 11, line, 9));
      });
      x += colWidths[i];
    });
    
    // Draw row lines
    pdfLines.push(`${margin} ${yTop - rowHeight} m ${width - margin} ${yTop - rowHeight} l S`);
    let cursorX = margin;
    for (let i = 0; i < colWidths.length - 1; i += 1) {
      cursorX += colWidths[i];
      pdfLines.push(`${cursorX} ${yTop} m ${cursorX} ${yTop - rowHeight} l S`);
    }
    
    currentY -= rowHeight;
  });

  const footerY = currentY - 34;
  if (spec.showSignatureLines) {
    lines.push(drawText(margin, footerY, 'Prepared by:', 11, true));
    lines.push(drawText(margin + 62, footerY, preparedBy, 11, true));
    lines.push(`${margin + 60} ${footerY - 2} m ${margin + 238} ${footerY - 2} l S`);

    lines.push(drawText(width / 2 + 8, footerY, 'Title:', 11, true));
    lines.push(`${width / 2 + 40} ${footerY - 2} m ${width - margin - 40} ${footerY - 2} l S`);

    lines.push(drawText(margin, footerY - 28, 'Signature:', 11, true));
    lines.push(`${margin + 60} ${footerY - 30} m ${margin + 238} ${footerY - 30} l S`);

    lines.push(drawText(width / 2 + 8, footerY - 28, 'Date/Time:', 11, true));
    lines.push(`${width / 2 + 72} ${footerY - 30} m ${width - margin - 40} ${footerY - 30} l S`);
  }

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
  const margin = 36; // Increased margin for safety
  const tableTop = 480;
  const headerHeight = 34;
  const rowHeight = 30;

  const primaryTable = spec.sections.find((section): section is PdfTableSection => section.type === 'table');
  const rows = primaryTable?.rows ?? [];
  const rowText = rows.length ? rows : [['', 'No active precautions', '', '', '']];

  const subtitleLookup = new Map(spec.subtitleLines.map((line) => {
    const idx = line.indexOf(':');
    return idx > -1 ? [line.slice(0, idx).trim().toUpperCase(), line.slice(idx + 1).trim()] : [line.trim().toUpperCase(), ''];
  }));

  const unit = subtitleLookup.get('UNIT') ?? 'All Units';
  const date = subtitleLookup.get('DATE') ?? new Date().toLocaleDateString();
  const shift = subtitleLookup.get('SHIFT') ?? 'Day';
  const preparedBy = subtitleLookup.get('PREPARED BY') ?? '';

  const availableWidth = width - margin * 2;
  // Adjusted colWidths to match photo proportions better
  const colWidths = [
    availableWidth * 0.10, // RM. #
    availableWidth * 0.30, // RESIDENT’S NAME
    availableWidth * 0.20, // PRECAUTION/ISOLATION
    availableWidth * 0.25, // INFECTED SOURCE
    availableWidth * 0.15, // DURATION
  ];
  const colHeaders = ['RM. #', "RESIDENT'S NAME", 'PRECAUTION/ISOLATION', 'INFECTED\nSOURCE', 'DURATION'];

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
    return `BT 0 g /${bold ? 'F2' : 'F1'} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${safe}) Tj ET`;
  };

  const pageIds: number[] = [];
  const contentIds: number[] = [];
  let currentRowIdx = 0;
  
  while (currentRowIdx < rowText.length) {
    const lines: string[] = [];

    // Titles (Centered)
    lines.push(drawText(width / 2 - (spec.facilityName || DEFAULT_FACILITY).length * 4.5, 576, spec.facilityName || DEFAULT_FACILITY, 16, true));
    lines.push(drawText(width / 2 - 138, 548, 'RESIDENTS ON PRECAUTIONS OR ISOLATION', 12, true));

    // Subtitles (Aligned with underlines)
    const subY = 520;
    lines.push(drawText(margin + 140, subY, 'UNIT:', 11, true));
    lines.push(drawText(margin + 180, subY, unit, 11, false));
    lines.push(`${margin + 175} ${subY - 2} m ${margin + 280} ${subY - 2} l S`);

    lines.push(drawText(width / 2 - 50, subY, 'DATE:', 11, true));
    lines.push(drawText(width / 2 - 10, subY, date, 11, false));
    lines.push(`${width / 2 - 15} ${subY - 2} m ${width / 2 + 100} ${subY - 2} l S`);

    lines.push(drawText(width - margin - 220, subY, 'SHIFT:', 11, true));
    lines.push(drawText(width - margin - 170, subY, shift, 11, false));
    lines.push(`${width - margin - 175} ${subY - 2} m ${width - margin - 60} ${subY - 2} l S`);

    // Header Background (Removed for this template)
    lines.push('0 g 0 G');
    lines.push('0.8 w');

    // Column Headers
    let cursorX = margin;
    colHeaders.forEach((header, i) => {
      const parts = header.split('\n');
      const cx = cursorX + colWidths[i] / 2;
      if (parts.length === 1) {
        lines.push(drawText(cx - (parts[0].length * 3.2), tableTop - 22, parts[0], 10, true));
      } else {
        lines.push(drawText(cx - (parts[0].length * 3.2), tableTop - 18, parts[0], 10, true));
        lines.push(drawText(cx - (parts[1].length * 3.2), tableTop - 30, parts[1], 10, true));
      }
      // Vertical lines for header
      lines.push(`${cursorX} ${tableTop} m ${cursorX} ${tableTop - headerHeight} l S`);
      cursorX += colWidths[i];
    });
    // Last vertical line
    lines.push(`${width - margin} ${tableTop} m ${width - margin} ${tableTop - headerHeight} l S`);
    // Horizontal lines for header
    lines.push(`${margin} ${tableTop} m ${width - margin} ${tableTop} l S`);
    lines.push(`${margin} ${tableTop - headerHeight} m ${width - margin} ${tableTop - headerHeight} l S`);

    let currentY = tableTop - headerHeight;
    
    // Rows
    while (currentRowIdx < rowText.length) {
      const row = rowText[currentRowIdx];
      const wrappedCells = row.slice(0, 5).map((val, i) => {
        const charsPerLine = Math.floor((colWidths[i] - 8) / 5.5);
        const text = String(val ?? '');
        const lines: string[] = [];
        text.split('\n').forEach(p => {
          lines.push(...wrap(p, charsPerLine));
        });
        return lines;
      });
      
      const rowHeight = Math.max(1, ...wrappedCells.map(c => c.length)) * 11 + 10;
      
      const footerThreshold = spec.showSignatureLines ? 160 : 80;
      if (currentY - rowHeight < footerThreshold) { // Leave space for footer
        break;
      }

      let x = margin;
      wrappedCells.forEach((cellLines, i) => {
        cellLines.forEach((line, lineIdx) => {
          lines.push(drawText(x + 4, currentY - 14 - lineIdx * 11, line, 9));
        });
        // Vertical line for cell
        lines.push(`${x} ${currentY} m ${x} ${currentY - rowHeight} l S`);
        x += colWidths[i];
      });
      // Last vertical line for row
      lines.push(`${width - margin} ${currentY} m ${width - margin} ${currentY - rowHeight} l S`);
      
      // Row bottom border
      lines.push(`${margin} ${currentY - rowHeight} m ${width - margin} ${currentY - rowHeight} l S`);

      currentY -= rowHeight;
      currentRowIdx++;
    }

    // Footer
    const footerY = 80;
    if (spec.showSignatureLines) {
      lines.push(drawText(margin, footerY, 'Prepared by:', 11, true));
      lines.push(drawText(margin + 72, footerY, preparedBy, 11, false));
      lines.push(`${margin + 70} ${footerY - 2} m ${margin + 240} ${footerY - 2} l S`);

      lines.push(drawText(width / 2 + 10, footerY, 'Title:', 11, true));
      lines.push(`${width / 2 + 45} ${footerY - 2} m ${width / 2 + 230} ${footerY - 2} l S`);

      lines.push(drawText(margin, footerY - 30, 'Signature:', 11, true));
      lines.push(`${margin + 70} ${footerY - 32} m ${margin + 240} ${footerY - 32} l S`);

      lines.push(drawText(width / 2 + 10, footerY - 30, 'Date/Time:', 11, true));
      lines.push(`${width / 2 + 75} ${footerY - 32} m ${width / 2 + 230} ${footerY - 32} l S`);

      // Footer Note
      const note = "* If the patient is known to have an MRSA, VRE or any Multidrug resistant infection or colonization, the health care worker should wear disposable gloves. Depending on the type of contact, a gown should also be worn. Patients must also wash their hands to avoid spreading the bacteria to others.";
      const wrappedNote = wrap(note, 160);
      wrappedNote.forEach((line, idx) => {
        lines.push(drawText(margin, footerY - 55 - idx * 10, line, 8, true));
      });
    }

    // Page Number
    lines.push(drawText(width - margin - 100, 20, `Page ${pageIds.length + 1} of {TOTAL_PAGES}`, 8));

    const contentStream = lines.join('\n');
    const contentId = addObject(`<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`);
    const pageId = addObject(`<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
    contentIds.push(contentId);
  }

  const pagesId = addObject(`<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
  pageIds.forEach(id => {
    objects[id - 1] = objects[id - 1].replace('/Parent 0 0 R', `/Parent ${pagesId} 0 R`);
  });
  contentIds.forEach(id => {
    objects[id - 1] = objects[id - 1].replace('{TOTAL_PAGES}', String(pageIds.length));
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

const buildResidentBoardPdf = (spec: PdfSpec): Blob => {
  const width = 792;
  const height = 612;
  const margin = 24;
  const tableTop = 500;
  const headerHeight = 34;

  const primaryTable = spec.sections.find((section): section is PdfTableSection => section.type === 'table');
  const rows = primaryTable?.rows ?? [];
  const rowText = rows.length ? rows : [['', 'No residents found', '', '', '', '', '', '']];

  const subtitleLookup = new Map(spec.subtitleLines.map((line) => {
    const idx = line.indexOf(':');
    return idx > -1 ? [line.slice(0, idx).trim().toUpperCase(), line.slice(idx + 1).trim()] : [line.trim().toUpperCase(), ''];
  }));

  const unit = subtitleLookup.get('UNIT') ?? 'All Units';
  const date = subtitleLookup.get('DATE') ?? new Date().toLocaleDateString();

  const availableWidth = width - margin * 2;
  const colWidths = [
    40,  // RM. #
    110, // RESIDENT'S NAME
    60,  // ADM. DATE
    80,  // ALLERGIES
    90,  // PRECAUTIONS
    110, // ABT / VAX DUE
    100, // DEVICES
    availableWidth - 40 - 110 - 60 - 80 - 90 - 110 - 100, // NOTES
  ];
  const colHeaders = ['RM. #', "RESIDENT'S NAME", 'ADM. DATE', 'ALLERGIES', 'PRECAUTIONS', 'ABT / VAX DUE', 'DEVICES', 'NOTES'];

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
    return `BT 0 g /${bold ? 'F2' : 'F1'} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${safe}) Tj ET`;
  };

  const pageIds: number[] = [];
  const contentIds: number[] = [];
  let currentRowIdx = 0;
  
  while (currentRowIdx < rowText.length) {
    const lines: string[] = [];

    // Titles (Centered)
    lines.push(drawText(width / 2 - (spec.facilityName || DEFAULT_FACILITY).length * 4.5, 576, spec.facilityName || DEFAULT_FACILITY, 16, true));
    lines.push(drawText(width / 2 - 60, 548, 'RESIDENT BOARD', 14, true));

    // Subtitles
    const subY = 520;
    lines.push(drawText(margin, subY, `UNIT: ${unit}`, 11, true));
    lines.push(drawText(width - margin - 120, subY, `DATE: ${date}`, 11, true));

    // Header Background
    lines.push('0.9 g');
    lines.push(`${margin} ${tableTop - headerHeight} ${availableWidth} ${headerHeight} re f`);
    lines.push('0 g 0 G');
    lines.push('0.5 w');

    // Column Headers
    let cursorX = margin;
    colHeaders.forEach((header, i) => {
      const parts = header.split('\n');
      const cx = cursorX + colWidths[i] / 2;
      if (parts.length === 1) {
        lines.push(drawText(cx - (parts[0].length * 2.8), tableTop - 22, parts[0], 8, true));
      } else {
        lines.push(drawText(cx - (parts[0].length * 2.8), tableTop - 18, parts[0], 8, true));
        lines.push(drawText(cx - (parts[1].length * 2.8), tableTop - 30, parts[1], 8, true));
      }
      lines.push(`${cursorX} ${tableTop} m ${cursorX} ${tableTop - headerHeight} l S`);
      cursorX += colWidths[i];
    });
    lines.push(`${width - margin} ${tableTop} m ${width - margin} ${tableTop - headerHeight} l S`);
    lines.push(`${margin} ${tableTop} m ${width - margin} ${tableTop} l S`);
    lines.push(`${margin} ${tableTop - headerHeight} m ${width - margin} ${tableTop - headerHeight} l S`);

    let currentY = tableTop - headerHeight;
    
    // Rows
    while (currentRowIdx < rowText.length) {
      const row = rowText[currentRowIdx];
      const wrappedCells = row.slice(0, 8).map((val, i) => {
        const charsPerLine = Math.floor((colWidths[i] - 6) / 4.5);
        const text = String(val ?? '');
        const cellLines: string[] = [];
        text.split('\n').forEach(p => {
          cellLines.push(...wrap(p, charsPerLine));
        });
        return cellLines;
      });
      
      const rowHeight = Math.max(1, ...wrappedCells.map(c => c.length)) * 9 + 8;
      
      if (currentY - rowHeight < 40) {
        break;
      }

      let x = margin;
      wrappedCells.forEach((cellLines, i) => {
        cellLines.forEach((line, lineIdx) => {
          lines.push(drawText(x + 3, currentY - 11 - lineIdx * 9, line, 7));
        });
        lines.push(`${x} ${currentY} m ${x} ${currentY - rowHeight} l S`);
        x += colWidths[i];
      });
      lines.push(`${width - margin} ${currentY} m ${width - margin} ${currentY - rowHeight} l S`);
      lines.push(`${margin} ${currentY - rowHeight} m ${width - margin} ${currentY - rowHeight} l S`);

      currentY -= rowHeight;
      currentRowIdx++;
    }

    lines.push(drawText(width - margin - 100, 20, `Page ${pageIds.length + 1} of {TOTAL_PAGES}`, 8));

    const contentStream = lines.join('\n');
    const contentId = addObject(`<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`);
    const pageId = addObject(`<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
    contentIds.push(contentId);
  }

  const pagesId = addObject(`<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
  pageIds.forEach(id => {
    objects[id - 1] = objects[id - 1].replace('/Parent 0 0 R', `/Parent ${pagesId} 0 R`);
  });
  contentIds.forEach(id => {
    objects[id - 1] = objects[id - 1].replace('{TOTAL_PAGES}', String(pageIds.length));
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
  let blob: Blob;

  if (spec.template === 'ACTIVE_PRECAUTIONS_TEMPLATE_V1') {
    blob = buildActivePrecautionsPdf(spec);
  } else if (spec.template === 'RESIDENT_BOARD_TEMPLATE_V1') {
    blob = buildResidentBoardPdf(spec);
  } else if (spec.template === 'LANDSCAPE_TEMPLATE_V1' || spec.template === 'PORTRAIT_TEMPLATE_V1') {
    blob = buildMultiPageGraphicalPdf(spec);
  } else {
    blob = buildStandardFormPdf(spec);
  }

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  const fallbackFilename = spec.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'report';
  link.download = `${spec.filename || fallbackFilename}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
};
