import React from "react";
import { PrintLayout } from "./PrintLayout";
import { buildPrintModel, validatePrintableContent } from "./printModel";
import { PrintShell } from "../../print/PrintShell";

const OutbreakSummaryPrint: React.FC = () => (
  <PrintShell kind="outbreak">
    {(job) => {
      const payload = (job.payload || {}) as any;
      const outbreak = payload.outbreak;
      const cases = payload.cases || [];
      const dailyStatuses = payload.dailyStatuses || [];
      const facility = payload.facility || {};
      if (!outbreak) return <div className="p-8 text-red-600">Outbreak payload missing</div>;
      const filtersSummary = `Outbreak=${outbreak.title}`;
      const printModel = buildPrintModel({ facilityName: facility?.name ?? "", reportTitle: `Outbreak Summary: ${outbreak.title}`, filtersSummary, sections: [{ key: "cases", label: "Cases", count: cases.length }], payload });
      const validationWarnings = validatePrintableContent(printModel);

      return (
        <PrintLayout title={`Outbreak Summary: ${outbreak.title}`} facilityName={facility?.name ?? ""} facilityAddress={facility?.address} dohId={facility?.dohId} filtersSummary={printModel.filtersSummary} printBlockedReason={validationWarnings.join(" ") || undefined}>
          <div className="space-y-6">
            <section className="bg-neutral-50 border border-neutral-200 rounded-md p-4 text-sm grid grid-cols-2 gap-4">
              <div><span className="block text-neutral-500 text-xs uppercase tracking-wider">Pathogen</span><span className="font-bold text-lg">{outbreak.pathogen || "Unknown"}</span></div>
              <div><span className="block text-neutral-500 text-xs uppercase tracking-wider">Status</span><span className="font-medium">{outbreak.status}</span></div>
            </section>
            {!!dailyStatuses.length && <div className="text-sm text-neutral-600">Daily statuses: {dailyStatuses.length}</div>}
            <table className="w-full text-xs border-collapse"><thead><tr className="bg-neutral-100 border-b-2 border-neutral-300"><th className="p-2 text-left">Resident</th><th className="p-2 text-left">Status</th></tr></thead><tbody>{cases.map((c: any) => <tr key={c.id} className="border-b border-neutral-200"><td className="p-2">{c.residentName || 'Unknown'}</td><td className="p-2">{c.caseStatus}</td></tr>)}</tbody></table>
          </div>
        </PrintLayout>
      );
    }}
  </PrintShell>
);

export default OutbreakSummaryPrint;
