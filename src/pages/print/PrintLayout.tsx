import React, { ReactNode } from "react";
import { X, Printer } from "lucide-react";

interface Props {
  title: string;
  facilityName: string;
  facilityAddress?: string;
  dohId?: string;
  auditorName?: string;
  filtersSummary?: string;
  printBlockedReason?: string;
  children: ReactNode;
}

export const PrintLayout: React.FC<Props> = ({
  title,
  facilityName,
  facilityAddress,
  dohId,
  auditorName,
  filtersSummary,
  printBlockedReason,
  children,
}) => {
  const printDate = new Date().toLocaleString();

  return (
    <div className="min-h-screen bg-white text-black font-sans">
      <style>{`
        @media print {
          @page {
            size: letter;
            margin: 0.5in;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            background: white;
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          }
          .no-print {
            display: none !important;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          thead {
            display: table-header-group;
          }
          tfoot {
            display: table-footer-group;
          }
          th, td {
            border: 1px solid #e5e7eb;
            padding: 0.5rem;
            text-align: left;
            font-size: 0.875rem;
          }
          th {
            background-color: #f3f4f6;
            font-weight: 600;
          }
          tr {
            page-break-inside: avoid;
          }
          section, .break-inside-avoid {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .page-break {
            page-break-before: always;
          }
          /* Page Numbers */
          body {
            counter-reset: page;
          }
          .page-footer::after {
            counter-increment: page;
            content: "Page " counter(page);
          }
        }
      `}</style>

      {/* Screen-only controls */}
      <div className="no-print fixed top-0 left-0 right-0 bg-neutral-900/90 text-white p-4 flex justify-between items-center z-50 shadow-md backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/10 rounded-full">
            <Printer className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-semibold text-lg">{title}</h1>
            <p className="text-sm text-neutral-400">Print Preview Mode</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md font-medium transition-colors flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Print Now
          </button>
          <button
            onClick={() => window.close()}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-md font-medium transition-colors flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Close
          </button>
        </div>
      </div>

      {/* Print Content */}
      <div className="max-w-[8.5in] mx-auto p-8 pt-24 print:p-0 print:pt-0">
        {/* Header */}
        <header className="border-b-2 border-neutral-800 pb-4 mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 uppercase tracking-tight">{facilityName}</h1>
            {facilityAddress && <p className="text-sm text-neutral-600 mt-1">{facilityAddress}</p>}
            {dohId && <p className="text-sm text-neutral-500 font-mono mt-0.5">Facility ID: {dohId}</p>}
          </div>
          <div className="text-right">
            <h2 className="text-xl font-semibold text-neutral-800">{title}</h2>
            <p className="text-sm text-neutral-500 mt-1">Generated: {printDate}</p>
            {filtersSummary && <p className="text-sm text-neutral-500">Filters: {filtersSummary}</p>}
            {auditorName && <p className="text-sm text-neutral-600 mt-0.5">Prepared by: {auditorName}</p>}
          </div>
        </header>

        {printBlockedReason && (
          <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <strong>Printable content validation warning:</strong> {printBlockedReason}
          </div>
        )}

        {/* Main Content */}
        <main>
          {children}
        </main>

        {/* Footer */}
        <footer className="fixed bottom-0 left-0 right-0 border-t border-neutral-200 pt-2 mt-8 flex justify-between items-center text-[10px] text-neutral-400 uppercase tracking-wider print:static print:mt-8">
          <span>Confidential – PHI – Do Not Distribute</span>
          <span className="page-footer"></span>
        </footer>
      </div>
    </div>
  );
};
