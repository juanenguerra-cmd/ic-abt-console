import React from "react";
import { PrintLayout } from "./PrintLayout";
import { buildPrintModel, validatePrintableContent } from "./printModel";
import { PrintShell } from "../../print/PrintShell";

const resolvePath = (obj: any, path: string): any => {
  if (!obj) return undefined;
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

const ReportExportPrint: React.FC = () => (
  <PrintShell kind="report-export">
    {(job) => {
      const payload = (job.payload || {}) as any;
      const profile = payload.profile;
      const data: any[] = Array.isArray(payload.data) ? payload.data : [];
      const facility = payload.facility || {};

      if (!profile) return <div className="p-8 text-red-600">Report payload missing</div>;

      const filtersSummary = `Dataset=${profile.dataset}`;
      const printModel = buildPrintModel({ facilityName: facility?.name ?? "", reportTitle: `Report: ${profile.name}`, filtersSummary, sections: [{ key: "rows", label: "Rows", count: data.length }], payload: { profile, data } });
      const validationWarnings = validatePrintableContent(printModel);

      return (
        <PrintLayout
          title={`Report: ${profile.name}`}
          facilityName={facility?.name ?? ""}
          facilityAddress={facility?.address}
          dohId={facility?.dohId}
          filtersSummary={printModel.filtersSummary}
          printBlockedReason={validationWarnings.join(" ") || undefined}
        >
          <div className="space-y-6">
            <div className="bg-neutral-50 border border-neutral-200 p-4 rounded-md text-sm">
              <p><strong>Dataset:</strong> {profile.dataset}</p>
              <p><strong>Total Records:</strong> {data.length}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead><tr className="bg-neutral-100 border-b-2 border-neutral-300">{profile.columns.map((col: any, idx: number) => <th key={idx} className="p-2 text-left font-semibold border-r border-neutral-200 last:border-r-0">{col.header}</th>)}</tr></thead>
                <tbody>
                  {data.map((item, rowIdx) => (
                    <tr key={rowIdx} className="border-b border-neutral-200 break-inside-avoid">
                      {profile.columns.map((col: any, colIdx: number) => <td key={colIdx} className="p-2 align-top border-r border-neutral-200 last:border-r-0">{resolvePath(item, col.fieldPath) ?? "—"}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </PrintLayout>
      );
    }}
  </PrintShell>
);

export default ReportExportPrint;
