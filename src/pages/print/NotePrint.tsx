import React from "react";
import { PrintLayout } from "./PrintLayout";
import { buildPrintModel, validatePrintableContent } from "./printModel";
import { PrintShell } from "../../print/PrintShell";

const NotePrint: React.FC = () => (
  <PrintShell kind="note">
    {(job) => {
      const payload = (job.payload || {}) as any;
      const note = payload.note;
      const facility = payload.facility || {};
      if (!note) return <div className="p-8 text-red-600">Note payload not found</div>;

      const filtersSummary = `Note ID=${note.id ?? "N/A"}`;
      const printModel = buildPrintModel({ facilityName: facility?.name ?? "", reportTitle: "Shift Log Entry", filtersSummary, sections: [{ key: "noteBody", label: "Note Body", count: note.body?.trim() ? 1 : 0 }], payload: { note } });
      const validationWarnings = validatePrintableContent(printModel);

      return (
        <PrintLayout title="Shift Log Entry" facilityName={facility?.name ?? ""} facilityAddress={facility?.address} dohId={facility?.dohId} filtersSummary={printModel.filtersSummary} printBlockedReason={validationWarnings.join(" ") || undefined}>
          <div className="border border-neutral-200 rounded-lg p-6 bg-white">
            <div className="flex justify-between items-start mb-4 border-b border-neutral-100 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1"><span className="font-bold text-lg text-neutral-900">{note.shift} Shift</span></div>
                <div className="text-sm text-neutral-500">{new Date(note.createdAtISO).toLocaleString()}</div>
              </div>
            </div>
            <div className="text-base text-neutral-900 whitespace-pre-wrap leading-relaxed mb-6">{note.body}</div>
          </div>
        </PrintLayout>
      );
    }}
  </PrintShell>
);

export default NotePrint;
