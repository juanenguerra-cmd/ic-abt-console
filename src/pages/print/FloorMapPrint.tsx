import React from "react";
import { PrintLayout } from "./PrintLayout";
import { buildPrintModel, validatePrintableContent } from "./printModel";
import { FloorMap } from "../../features/Heatmap/FloorMap";
import { PrintShell } from "../../print/PrintShell";

const FloorMapPrint: React.FC = () => (
  <PrintShell kind="floor-map">
    {(job) => {
      const payload = (job.payload || {}) as any;
      const facility = payload.facility || {};
      const layout = payload.layout;
      const roomStatuses = payload.roomStatuses || [];
      const symptomIndicators = payload.symptomIndicators || [];
      if (!layout) return <div className="p-8 text-red-600">Floor map payload missing</div>;

      const printModel = buildPrintModel({
        facilityName: facility?.name ?? "",
        reportTitle: "Floor Map",
        filtersSummary: `Layout=${layout.name || 'Floor Map'}`,
        sections: [{ key: 'rooms', label: 'Rooms', count: layout.rooms?.length || 0 }],
        payload,
      });
      const validationWarnings = validatePrintableContent(printModel);

      return (
        <PrintLayout title="Floor Map" facilityName={facility?.name ?? ""} facilityAddress={facility?.address} dohId={facility?.dohId} filtersSummary={printModel.filtersSummary} printBlockedReason={validationWarnings.join(" ") || undefined}>
          <div className="bg-white p-4 rounded border border-neutral-200">
            <FloorMap layout={layout} facilityId={facility?.id || ''} roomStatuses={roomStatuses} symptomIndicators={symptomIndicators} />
          </div>
        </PrintLayout>
      );
    }}
  </PrintShell>
);

export default FloorMapPrint;
