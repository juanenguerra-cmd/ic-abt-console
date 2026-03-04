/**
 * src/lib/printUtils.ts
 * Centralized print utility for ic-abt-console.
 * Fixes blank print output caused by:
 *   - visibility:hidden hiding the entire DOM in Chrome/Edge
 *   - window.print() called before React finishes rendering
 */

/**
 * Call this instead of window.print() everywhere in the app.
 * Adds 'app-printing' class to body, waits for React to flush,
 * then opens the print dialog. Cleans up after print closes.
 */
export function triggerPrint(onAfter?: () => void): void {
  document.body.classList.add('app-printing');

  requestAnimationFrame(() => {
    setTimeout(() => {
      window.print();

      const cleanup = () => {
        document.body.classList.remove('app-printing');
        onAfter?.();
        window.removeEventListener('afterprint', cleanup);
      };
      window.addEventListener('afterprint', cleanup);

      // Fallback cleanup in case afterprint never fires
      setTimeout(() => {
        document.body.classList.remove('app-printing');
      }, 2000);
    }, 150);
  });
}

/**
 * Include this inside a <style>{PrintStyles}</style> tag
 * in any component that has a print button.
 *
 * Rules:
 *  - Wrap printable content in:  <div className="print-root">
 *  - Wrap non-printable UI in:   <div className="no-print">
 *  - Add page breaks with:       <div className="print-page-break" />
 *  - Prevent breaks inside with: className="print-avoid-break"
 */
export const PrintStyles = `
@media print {
  body.app-printing #root > * {
    display: none !important;
  }

  body.app-printing .print-root {
    display: block !important;
    position: fixed !important;
    inset: 0 !important;
    z-index: 99999 !important;
    background: white !important;
    overflow: visible !important;
    padding: 16px !important;
  }

  body.app-printing .print-root * {
    visibility: visible !important;
  }

  html, body {
    height: auto !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: visible !important;
  }

  thead {
    display: table-header-group !important;
  }

  tfoot {
    display: table-footer-group !important;
  }

  .print-page-break {
    break-after: page !important;
    page-break-after: always !important;
    display: block !important;
    height: 0 !important;
  }

  .print-avoid-break {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }

  .no-print {
    display: none !important;
  }
}

@media screen {
  .print-root {
    all: unset;
    display: contents;
  }
}
`;
