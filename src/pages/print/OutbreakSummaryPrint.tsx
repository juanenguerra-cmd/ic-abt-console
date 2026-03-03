import React, { useMemo } from "react";
import { loadDB } from "../../storage/engine";
import { PrintLayout } from "./PrintLayout";
import { Outbreak, OutbreakCase, OutbreakExposure, OutbreakDailyStatus } from "../../domain/models";

const OutbreakSummaryPrint: React.FC = () => {
  const db = useMemo(() => loadDB(), []);
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const outbreakId = params.get("outbreakId");
  const facilityId = db.data.facilities.activeFacilityId;
  const facility = db.data.facilities.byId[facilityId];
  const store = db.data.facilityData[facilityId];
  
  const outbreak = useMemo(() => {
    return store.outbreaks?.[outbreakId || ""];
  }, [store.outbreaks, outbreakId]);

  const cases = useMemo(() => {
    return Object.values(store.outbreakCases || {})
      .filter(c => c.outbreakId === outbreakId)
      .sort((a, b) => new Date(b.symptomOnsetDate || "").getTime() - new Date(a.symptomOnsetDate || "").getTime());
  }, [store.outbreakCases, outbreakId]);

  const exposures = useMemo(() => {
    return Object.values(store.outbreakExposures || {})
      .filter(e => e.outbreakId === outbreakId);
  }, [store.outbreakExposures, outbreakId]);

  const dailyStatuses = useMemo(() => {
    return Object.values(store.outbreakDailyStatuses || {})
      .filter(s => s.outbreakId === outbreakId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [store.outbreakDailyStatuses, outbreakId]);

  const stats = useMemo(() => {
    return {
      confirmed: cases.filter(c => c.caseStatus === "confirmed").length,
      probable: cases.filter(c => c.caseStatus === "probable").length,
      ruledOut: cases.filter(c => c.caseStatus === "ruled_out").length,
      exposed: exposures.length,
      deceased: cases.filter(c => {
        if (c.residentRef.kind === 'mrn') {
          return store.residents[c.residentRef.id]?.status === 'Deceased';
        }
        return false;
      }).length,
    };
  }, [cases, exposures, store.residents]);

  const getResidentName = (ref: { kind: "mrn" | "quarantine"; id: string }) => {
    if (ref.kind === "mrn") return store.residents[ref.id]?.displayName || "Unknown";
    return store.quarantine[ref.id]?.displayName || "Unknown (Q)";
  };

  React.useEffect(() => {
    const timer = setTimeout(() => window.print(), 100);
    return () => clearTimeout(timer);
  }, []);

  if (!outbreak) return <div className="p-8 text-red-600">Outbreak not found</div>;

  return (
    <PrintLayout
      title={`Outbreak Summary: ${outbreak.title}`}
      facilityName={facility.name}
      facilityAddress={facility.address}
      dohId={facility.dohId}
    >
      <div className="space-y-6">
        {/* Outbreak Meta */}
        <section className="bg-neutral-50 border border-neutral-200 rounded-md p-4 text-sm grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <span className="block text-neutral-500 text-xs uppercase tracking-wider">Pathogen</span>
            <span className="font-bold text-lg">{outbreak.pathogen || "Unknown"}</span>
          </div>
          <div>
            <span className="block text-neutral-500 text-xs uppercase tracking-wider">Status</span>
            <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide mt-1 ${
              outbreak.status === "confirmed" ? "bg-red-100 text-red-800" :
              outbreak.status === "closed" ? "bg-neutral-200 text-neutral-600" :
              "bg-yellow-100 text-yellow-800"
            }`}>
              {outbreak.status}
            </span>
          </div>
          <div>
            <span className="block text-neutral-500 text-xs uppercase tracking-wider">Start Date</span>
            <span className="font-medium">{new Date(outbreak.startDate).toLocaleDateString()}</span>
          </div>
          <div>
            <span className="block text-neutral-500 text-xs uppercase tracking-wider">End Date</span>
            <span className="font-medium">{outbreak.endDate ? new Date(outbreak.endDate).toLocaleDateString() : "Ongoing"}</span>
          </div>
        </section>

        {/* Stats Grid */}
        <section className="grid grid-cols-6 gap-2 text-center">
          <div className="p-2 border bg-red-50 border-red-100 rounded">
            <div className="text-2xl font-bold text-red-700">{stats.confirmed}</div>
            <div className="text-[10px] uppercase text-red-800 font-semibold">Confirmed</div>
          </div>
          <div className="p-2 border bg-orange-50 border-orange-100 rounded">
            <div className="text-2xl font-bold text-orange-700">{stats.probable}</div>
            <div className="text-[10px] uppercase text-orange-800 font-semibold">Probable</div>
          </div>
          <div className="p-2 border bg-blue-50 border-blue-100 rounded">
            <div className="text-2xl font-bold text-blue-700">{stats.exposed}</div>
            <div className="text-[10px] uppercase text-blue-800 font-semibold">Exposed</div>
          </div>
          <div className="p-2 border bg-neutral-50 border-neutral-200 rounded">
            <div className="text-2xl font-bold text-neutral-700">{stats.ruledOut}</div>
            <div className="text-[10px] uppercase text-neutral-600 font-semibold">Ruled Out</div>
          </div>
          <div className="p-2 border bg-neutral-800 border-neutral-900 rounded col-span-2">
            <div className="text-2xl font-bold text-white">{stats.deceased}</div>
            <div className="text-[10px] uppercase text-neutral-400 font-semibold">Deceased</div>
          </div>
        </section>

        {/* Case Definition */}
        <section className="bg-white border border-neutral-200 p-4 rounded-md">
          <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500 mb-2">Case Definition</h3>
          <p className="text-sm text-neutral-800 italic">{outbreak.caseDefinition || "No case definition documented."}</p>
        </section>

        {/* Daily Trend Table (Mini) */}
        {dailyStatuses.length > 0 && (
          <section>
            <h3 className="font-semibold text-lg mb-2">Daily Status Log (Last 7 Days)</h3>
            <table className="w-full text-xs border-collapse mb-4">
              <thead>
                <tr className="bg-neutral-100 border-b">
                  <th className="p-1 text-left">Date</th>
                  <th className="p-1 text-center">New Cases</th>
                  <th className="p-1 text-center">Total Cases</th>
                  <th className="p-1 text-center">New Exposures</th>
                  <th className="p-1 text-center">Isolation Count</th>
                </tr>
              </thead>
              <tbody>
                {dailyStatuses.slice(-7).map(status => (
                  <tr key={status.id} className="border-b">
                    <td className="p-1 font-mono">{new Date(status.date).toLocaleDateString()}</td>
                    <td className="p-1 text-center font-bold text-red-600">+{status.newCases}</td>
                    <td className="p-1 text-center font-bold">{status.totalCases}</td>
                    <td className="p-1 text-center">{status.newExposures}</td>
                    <td className="p-1 text-center">{status.isolationCount || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Case List */}
        <section>
          <h3 className="font-semibold text-lg mb-3 border-b pb-2">Case Line List</h3>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-100 border-b-2 border-neutral-300">
                <th className="p-2 text-left">Resident</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Symptom Onset</th>
                <th className="p-2 text-left">Specimen Date</th>
                <th className="p-2 text-left">Result</th>
                <th className="p-2 text-left">Location</th>
              </tr>
            </thead>
            <tbody>
              {cases.map(c => (
                <tr key={c.id} className="border-b border-neutral-200 break-inside-avoid">
                  <td className="p-2 font-medium">{getResidentName(c.residentRef)}</td>
                  <td className="p-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                      c.caseStatus === "confirmed" ? "bg-red-100 text-red-800" :
                      c.caseStatus === "probable" ? "bg-orange-100 text-orange-800" :
                      "bg-neutral-100 text-neutral-600"
                    }`}>
                      {c.caseStatus.replace("_", " ")}
                    </span>
                  </td>
                  <td className="p-2 font-mono text-neutral-600">
                    {c.symptomOnsetDate ? new Date(c.symptomOnsetDate).toLocaleDateString() : "—"}
                  </td>
                  <td className="p-2 font-mono text-neutral-600">
                    {c.specimenCollectedDate ? new Date(c.specimenCollectedDate).toLocaleDateString() : "—"}
                  </td>
                  <td className="p-2 font-medium">{c.result || "Pending"}</td>
                  <td className="p-2 text-neutral-500">
                    {c.locationSnapshot?.unit || "—"} / {c.locationSnapshot?.room || "—"}
                  </td>
                </tr>
              ))}
              {cases.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-neutral-500 italic">No cases recorded.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </PrintLayout>
  );
};

export default OutbreakSummaryPrint;
