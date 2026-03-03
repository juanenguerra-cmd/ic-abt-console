import React, { useMemo, useState, useEffect } from "react";
import { loadDBAsync } from "../../storage/engine";
import { PrintLayout } from "./PrintLayout";
import { UnifiedDB, Resident, ABTCourse, IPEvent, VaxEvent } from "../../domain/models";
import { getActiveABT, getVaxDue, isActiveCensusResident, normalizeStatus } from "../../utils/countCardDataHelpers";
import { computeResidentSignals } from "../../utils/residentSignals";
import { computeSymptomIndicators } from "../../utils/symptomIndicators";

const ResidentCensusPrint: React.FC = () => {
  const [db, setDb] = useState<UnifiedDB | null>(null);

  useEffect(() => {
    loadDBAsync().then(setDb);
  }, []);

  useEffect(() => {
    if (!db) return;
    const timer = setTimeout(() => window.print(), 500); // Slightly longer delay for signals to compute
    return () => clearTimeout(timer);
  }, [db]);

  const facilityId = db?.data.facilities.activeFacilityId ?? "";
  const facility = db?.data.facilities.byId[facilityId];
  const store = db?.data.facilityData[facilityId];

  const residents = useMemo(() => Object.values(store?.residents || {}) as Resident[], [store]);
  const activeABTs = useMemo(() => getActiveABT(Object.values(store?.abts || {})) as ABTCourse[], [store]);
  const activeInfections = useMemo(() => (Object.values(store?.infections || {}) as IPEvent[]).filter(i => i.status === 'active'), [store]);
  const vaxEvents = useMemo(() => Object.values(store?.vaxEvents || {}) as VaxEvent[], [store]);

  // Pre-compute symptom map + signal map
  const symptomMap = useMemo(() => store ? computeSymptomIndicators(store, Date.now()) : {}, [store]);
  const signalMap = useMemo(() => {
    const nowMs = Date.now();
    const map: Record<string, any> = {};
    residents.forEach(r => {
      if (store) map[r.mrn] = computeResidentSignals(r.mrn, store, nowMs, symptomMap);
    });
    return map;
  }, [store, residents, symptomMap]);

  const filteredResidents = useMemo(() => {
    return residents.filter(r => isActiveCensusResident(r));
  }, [residents]);

  const units = useMemo(() => {
    const groups: Record<string, Resident[]> = {};
    filteredResidents.forEach(r => {
      let unit = r.currentUnit || "Unassigned";
      unit = unit.replace(/\s*\(continued\)\s*/i, '').trim();
      if (!groups[unit]) groups[unit] = [];
      groups[unit].push(r);
    });
    
    // Sort each unit by room
    Object.keys(groups).forEach(unit => {
      groups[unit].sort((a, b) => (a.currentRoom || "").localeCompare(b.currentRoom || ""));
    });
    
    return groups;
  }, [filteredResidents]);

  if (!db) {
    return <div className="p-8 text-center text-neutral-500">Loading census data…</div>;
  }

  return (
    <PrintLayout
      title="Resident Census & Status Report"
      facilityName={facility?.name ?? ""}
      facilityAddress={facility?.address}
      dohId={facility?.dohId}
    >
      <div className="space-y-8">
        {Object.entries(units)
          .sort(([unitNameA], [unitNameB]) => unitNameA.localeCompare(unitNameB))
          .map(([unitName, unitResidents]) => (
          <section key={unitName} className="break-inside-avoid">
            <h2 className="text-lg font-bold border-b-2 border-neutral-800 mb-2 pb-1">{unitName} ({unitResidents.length})</h2>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-neutral-100 border-b border-neutral-300">
                  <th className="p-2 text-left w-16">Room</th>
                  <th className="p-2 text-left w-48">Resident</th>
                  <th className="p-2 text-left w-24">MRN</th>
                  <th className="p-2 text-left w-24">Status</th>
                  <th className="p-2 text-left">Active Signals / Precautions</th>
                  <th className="p-2 text-left w-32">Notes</th>
                </tr>
              </thead>
              <tbody>
                {unitResidents.map((r, idx) => {
                  const sigs = signalMap[r.mrn] || {};
                  const activeIps = activeInfections.filter(i => i.residentRef.kind === 'mrn' && i.residentRef.id === r.mrn);
                  const activeAbtsForRes = activeABTs.filter(a => a.residentRef.kind === 'mrn' && a.residentRef.id === r.mrn);
                  
                  return (
                    <tr key={r.mrn} className={`border-b border-neutral-200 break-inside-avoid ${idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}`}>
                      <td className="p-2 font-bold">{r.currentRoom}</td>
                      <td className="p-2 font-medium">{r.displayName}</td>
                      <td className="p-2 font-mono text-neutral-600">{r.mrn}</td>
                      <td className="p-2">{r.status}</td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1">
                          {sigs.hasActivePrecaution && (
                            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-bold uppercase text-[10px] border border-amber-200">
                              Isolation
                            </span>
                          )}
                          {sigs.hasEbp && (
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-bold uppercase text-[10px] border border-blue-200">
                              EBP
                            </span>
                          )}
                          {sigs.hasActiveAbt && (
                            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold uppercase text-[10px] border border-emerald-200">
                              ABT
                            </span>
                          )}
                          {sigs.hasDueVax && (
                            <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded font-bold uppercase text-[10px] border border-purple-200">
                              Vax Due
                            </span>
                          )}
                          {sigs.hasRecentSymptoms96h && (
                            <span className="px-1.5 py-0.5 bg-orange-100 text-orange-800 rounded font-bold uppercase text-[10px] border border-orange-200">
                              Symptoms
                            </span>
                          )}
                          
                          {/* Details */}
                          {activeIps.map(ip => (
                            <div key={ip.id} className="w-full text-[10px] text-neutral-600 mt-0.5">
                              • IP: {ip.infectionSite} ({ip.organism || 'No Org'}) - {ip.isolationType}
                            </div>
                          ))}
                          {activeAbtsForRes.map(abt => (
                            <div key={abt.id} className="w-full text-[10px] text-neutral-600 mt-0.5">
                              • ABT: {abt.medication} ({abt.indication})
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="p-2">
                        {/* Space for handwritten notes */}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </PrintLayout>
  );
};

export default ResidentCensusPrint;
