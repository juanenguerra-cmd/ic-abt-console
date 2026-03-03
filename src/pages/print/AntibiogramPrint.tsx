import React, { useMemo, useState, useEffect } from "react";
import { loadDBAsync } from "../../storage/engine";
import { PrintLayout } from "./PrintLayout";
import { ABTCourse, UnifiedDB } from "../../domain/models";
import { buildPrintModel, validatePrintableContent } from "./printModel";

const AntibiogramPrint: React.FC = () => {
  const [db, setDb] = useState<UnifiedDB | null>(null);

  useEffect(() => {
    loadDBAsync().then(setDb);
  }, []);

  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const facilityId = params.get("facilityId") || db?.data.facilities.activeFacilityId || Object.keys(db?.data.facilities.byId || {})[0] || "";
  const facility = db?.data.facilities.byId[facilityId];
  const store = db?.data.facilityData[facilityId];
  
  // Optional filters
  const month = params.get("month"); // YYYY-MM
  
  const data = useMemo(() => {
    const allAbts = Object.values(store?.abts || {}) as ABTCourse[];
    
    // Filter by date range if month provided
    const filteredAbts = month 
      ? allAbts.filter(a => a.startDate.startsWith(month))
      : allAbts;

    // Aggregate Data: Organism -> Antibiotic -> { total, sensitive }
    const matrix: Record<string, Record<string, { total: number; sensitive: number }>> = {};
    const antibiotics = new Set<string>();

    filteredAbts.forEach(abt => {
      if (!abt.organismIdentified || !abt.sensitivitySummary) return;
      
      const organisms = abt.organismIdentified.split(",").map(s => s.trim());
      // sensitivitySummary format expected: "Cipro: S, Levo: R"
      const sensitivities = abt.sensitivitySummary.split(",").map(s => s.trim());

      organisms.forEach(org => {
        if (!matrix[org]) matrix[org] = {};
        
        sensitivities.forEach(sens => {
          const [drug, result] = sens.split(":").map(s => s.trim());
          if (!drug || !result) return;
          
          antibiotics.add(drug);
          if (!matrix[org][drug]) matrix[org][drug] = { total: 0, sensitive: 0 };
          
          matrix[org][drug].total++;
          if (result.toUpperCase() === "S" || result.toUpperCase() === "SENSITIVE") {
            matrix[org][drug].sensitive++;
          }
        });
      });
    });

    return { 
      matrix, 
      antibiotics: Array.from(antibiotics).sort(),
      organisms: Object.keys(matrix).sort() 
    };
  }, [store?.abts, month]);

  if (!db) return <div className="p-8 text-center text-neutral-500">Loading…</div>;
  if (!facility) return <div className="p-8 text-red-600">Facility not found</div>;

  const filtersSummary = month ? `Month=${month}` : "All dates";
  const printModel = buildPrintModel({ facilityName: facility.name, reportTitle: "Antibiogram Report", filtersSummary, sections: [{ key: "organisms", label: "Organisms", count: data.organisms.length }], payload: data });
  const validationWarnings = validatePrintableContent(printModel);

  return (
    <PrintLayout
      title={`Antibiogram Report ${month ? `(${month})` : "(All Time)"}`}
      facilityName={facility.name}
      facilityAddress={facility.address}
      dohId={facility.dohId}
      filtersSummary={printModel.filtersSummary}
      printBlockedReason={validationWarnings.join(" ") || undefined}
    >
      <div className="space-y-6">
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-md text-sm text-blue-800">
          <p><strong>Note:</strong> Values represent % Susceptibility. (n) = Total isolates tested.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="p-2 border bg-neutral-100 text-left font-bold min-w-[150px]">Organism (Isolates)</th>
                {data.antibiotics.map(abx => (
                  <th key={abx} className="p-2 border bg-neutral-100 text-center font-semibold w-24">
                    {abx}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.organisms.map(org => {
                // Calculate total isolates for this organism across all drugs (max observed)
                const maxIsolates = Math.max(...Object.values(data.matrix[org]).map(d => d.total));
                
                return (
                  <tr key={org}>
                    <td className="p-2 border font-medium bg-neutral-50">
                      {org} <span className="text-neutral-500 font-normal">({maxIsolates})</span>
                    </td>
                    {data.antibiotics.map(abx => {
                      const stat = data.matrix[org][abx];
                      if (!stat) return <td key={abx} className="p-2 border text-center text-neutral-300">—</td>;
                      
                      const percent = Math.round((stat.sensitive / stat.total) * 100);
                      const colorClass = percent >= 90 ? "text-emerald-700 font-bold" : percent < 70 ? "text-red-600" : "text-neutral-900";
                      
                      return (
                        <td key={abx} className={`p-2 border text-center ${colorClass}`}>
                          {percent}%
                          <div className="text-[9px] text-neutral-400 font-normal">n={stat.total}</div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {data.organisms.length === 0 && (
                <tr>
                  <td colSpan={data.antibiotics.length + 1} className="p-8 text-center text-neutral-500 italic">
                    No records match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PrintLayout>
  );
};

export default AntibiogramPrint;
