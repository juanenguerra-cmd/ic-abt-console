import React, { useMemo, useState, useEffect } from "react";
import { loadDBAsync } from "../../storage/engine";
import { PrintLayout } from "./PrintLayout";
import { FloorMap } from "../../features/Heatmap/FloorMap";
import { useFloorMapData } from "../../features/FloorMapPage/useFloorMapData";
import { UnifiedDB } from "../../domain/models";
import { buildPrintModel, validatePrintableContent } from "./printModel";

const FloorMapPrint: React.FC = () => {
  const [db, setDb] = useState<UnifiedDB | null>(null);

  useEffect(() => {
    loadDBAsync().then(setDb);
  }, []);

  const facilityId = db?.data.facilities.activeFacilityId ?? "";
  const facility = db?.data.facilities.byId[facilityId];
  
  const layout = facility?.floorLayouts?.[0] ?? {
    id: 'floor-map-default',
    facilityId: facilityId,
    name: 'Floor Map',
    version: 1,
    updatedAt: new Date().toISOString(),
    rooms: [],
  };

  // We need to mock the hook or use it carefully. 
  // useFloorMapData uses useFacilityData which requires context.
  // But here we are loading DB directly via loadDB().
  // So we can't use useFloorMapData directly if it relies on context that might not be initialized if we were outside AppProviders.
  // BUT, App.tsx wraps everything in AppProviders.
  // So we CAN use useFloorMapData if we are inside AppProviders.
  // The print routes are rendered inside AppShell which is inside AppProviders.
  // So it should be fine.
  
  const { roomStatuses, symptomIndicators } = useFloorMapData(layout);

  if (!db) return <div className="p-8 text-center text-neutral-500">Loading…</div>;

  const filtersSummary = `Layout=${layout.name}`;
  const printModel = buildPrintModel({ facilityName: facility?.name ?? "", reportTitle: "Facility Floor Map", filtersSummary, sections: [{ key: "rooms", label: "Rooms", count: layout.rooms.length }], payload: { layout } });
  const validationWarnings = validatePrintableContent(printModel);

  return (
    <PrintLayout
      title="Facility Floor Map"
      facilityName={facility?.name ?? ""}
      facilityAddress={facility?.address}
      dohId={facility?.dohId}
      filtersSummary={printModel.filtersSummary}
      printBlockedReason={validationWarnings.join(" ") || undefined}
    >
      <div className="flex justify-center items-center p-4 border border-neutral-200 rounded-xl bg-white min-h-[600px]">
         <FloorMap
            layout={layout}
            facilityId={facilityId}
            roomStatuses={roomStatuses}
            symptomIndicators={symptomIndicators}
          />
      </div>
      <div className="mt-8 grid grid-cols-2 gap-4 text-sm">
        <div className="border p-4 rounded bg-neutral-50">
          <h3 className="font-bold mb-2">Legend</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 bg-red-500 rounded-full opacity-20"></span>
              <span>Outbreak / Confirmed Case</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 bg-amber-500 rounded-full opacity-20"></span>
              <span>Isolation (Contact/Droplet)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 bg-blue-500 rounded-full opacity-20"></span>
              <span>Enhanced Barrier Precautions (EBP)</span>
            </div>
          </div>
        </div>
        <div className="border p-4 rounded bg-neutral-50">
          <h3 className="font-bold mb-2">Symptom Indicators</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 bg-orange-500 rounded-full"></span>
              <span>Respiratory Symptoms (Last 96h)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 bg-purple-500 rounded-full"></span>
              <span>GI Symptoms (Last 96h)</span>
            </div>
          </div>
        </div>
      </div>
    </PrintLayout>
  );
};

export default FloorMapPrint;
