import React from "react";
import { Resident, Unit, IPEvent, ABTCourse } from "../../domain/models";
import { Shield, Activity, AlertCircle } from "lucide-react";

interface ResidentBoardProps {
  units: Unit[];
  residents: Resident[];
  activeInfections: IPEvent[];
  activeABTs: ABTCourse[];
}

export const ResidentBoard: React.FC<ResidentBoardProps> = ({
  units,
  residents,
  activeInfections,
  activeABTs,
}) => {
  // Group residents by unit
  const residentsByUnit = units.reduce((acc, unit) => {
    acc[unit.id] = residents.filter((r) => r.currentUnit === unit.id);
    return acc;
  }, {} as Record<string, Resident[]>);

  const unassignedResidents = residents.filter((r) => !r.currentUnit);

  const renderResidentCard = (resident: Resident) => {
    const infections = activeInfections.filter(
      (i) => i.residentRef.kind === "mrn" && i.residentRef.id === resident.mrn
    );
    const abts = activeABTs.filter(
      (a) => a.residentRef.kind === "mrn" && a.residentRef.id === resident.mrn
    );

    const hasIsolation = infections.some((i) => i.isolationType);
    const hasEBP = infections.some((i) => i.ebp);
    const hasABT = abts.length > 0;

    return (
      <div
        key={resident.mrn}
        className="bg-white border border-neutral-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
      >
        <div className="flex justify-between items-start mb-2">
          <div>
            <h4 className="text-sm font-semibold text-neutral-900 truncate max-w-[150px]">
              {resident.displayName}
            </h4>
            <p className="text-xs text-neutral-500 font-mono">{resident.mrn}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-neutral-700">
              {resident.currentRoom || "No Room"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mt-3">
          {hasIsolation && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 uppercase tracking-wider">
              <AlertCircle className="w-3 h-3 mr-1" />
              Isolation
            </span>
          )}
          {hasEBP && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wider">
              <Shield className="w-3 h-3 mr-1" />
              EBP
            </span>
          )}
          {hasABT && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
              <Activity className="w-3 h-3 mr-1" />
              ABT
            </span>
          )}
          {!hasIsolation && !hasEBP && !hasABT && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-100 text-neutral-500 uppercase tracking-wider">
              No Active Risks
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {units.map((unit) => (
        <section key={unit.id} className="space-y-4">
          <div className="flex items-center gap-2 border-b border-neutral-200 pb-2">
            <h3 className="text-lg font-bold text-neutral-800">{unit.name}</h3>
            <span className="bg-neutral-200 text-neutral-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {residentsByUnit[unit.id]?.length || 0}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {residentsByUnit[unit.id]?.length > 0 ? (
              residentsByUnit[unit.id].map(renderResidentCard)
            ) : (
              <p className="text-sm text-neutral-400 italic col-span-full">
                No residents assigned to this unit.
              </p>
            )}
          </div>
        </section>
      ))}

      {unassignedResidents.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-neutral-200 pb-2">
            <h3 className="text-lg font-bold text-neutral-800">Unassigned</h3>
            <span className="bg-neutral-200 text-neutral-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {unassignedResidents.length}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {unassignedResidents.map(renderResidentCard)}
          </div>
        </section>
      )}
    </div>
  );
};
