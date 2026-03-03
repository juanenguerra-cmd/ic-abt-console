import React, { useMemo } from "react";
import { loadDB } from "../../storage/engine";
import { PrintLayout } from "./PrintLayout";
import { LineListEvent, Resident } from "../../domain/models";

const LineListPrint: React.FC = () => {
  const db = useMemo(() => loadDB(), []);
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const facilityId = params.get("facilityId") || db.data.facilities.activeFacilityId;
  const facility = db.data.facilities.byId[facilityId];
  const store = db.data.facilityData[facilityId];
  
  const events = useMemo(() => {
    return Object.values(store.lineListEvents || {})
      .filter(e => e.disposition !== "ruled_out")
      .sort((a, b) => new Date(b.onsetDateISO).getTime() - new Date(a.onsetDateISO).getTime());
  }, [store.lineListEvents]);

  const getResident = (ref: { kind: "mrn" | "quarantine"; id: string }) => {
    if (ref.kind === "mrn") return store.residents[ref.id];
    return store.quarantine[ref.id];
  };

  React.useEffect(() => {
    const timer = setTimeout(() => window.print(), 100);
    return () => clearTimeout(timer);
  }, []);

  if (!facility) return <div className="p-8 text-red-600">Facility not found</div>;

  return (
    <PrintLayout
      title="Active Line List Report"
      facilityName={facility.name}
      facilityAddress={facility.address}
      dohId={facility.dohId}
    >
      <div className="space-y-6">
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-md text-sm text-amber-900">
          <p><strong>Summary:</strong> {events.length} active surveillance events requiring monitoring.</p>
        </div>

        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-neutral-100 border-b-2 border-neutral-300">
              <th className="p-2 text-left w-24">Onset Date</th>
              <th className="p-2 text-left w-40">Resident</th>
              <th className="p-2 text-left w-20">Unit/Room</th>
              <th className="p-2 text-left w-24">Class</th>
              <th className="p-2 text-left">Symptoms</th>
              <th className="p-2 text-center w-16">Fever?</th>
              <th className="p-2 text-center w-20">Isolation?</th>
              <th className="p-2 text-center w-20">Test?</th>
              <th className="p-2 text-left w-24">Status</th>
            </tr>
          </thead>
          <tbody>
            {events.map(event => {
              const resident = store.residents[event.residentId];
              return (
                <tr key={event.id} className="border-b border-neutral-200 break-inside-avoid">
                  <td className="p-2 align-top font-mono text-neutral-600">
                    {new Date(event.onsetDateISO).toLocaleDateString()}
                  </td>
                  <td className="p-2 align-top font-medium">
                    {resident?.displayName || "Unknown"}
                    <div className="text-[10px] text-neutral-500">MRN: {resident?.mrn || event.residentId}</div>
                  </td>
                  <td className="p-2 align-top">
                    {resident?.currentUnit || "—"} / {resident?.currentRoom || "—"}
                  </td>
                  <td className="p-2 align-top">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide ${
                      event.symptomClass === "resp" ? "bg-blue-100 text-blue-800" : "bg-orange-100 text-orange-800"
                    }`}>
                      {event.symptomClass === "resp" ? "Respiratory" : "GI"}
                    </span>
                  </td>
                  <td className="p-2 align-top text-neutral-700">
                    {event.symptoms.join(", ")}
                  </td>
                  <td className="p-2 align-top text-center font-bold text-red-600">
                    {event.fever ? "YES" : <span className="text-neutral-300 font-normal">—</span>}
                  </td>
                  <td className="p-2 align-top text-center">
                    {event.isolationInitiated ? (
                      <span className="text-emerald-700 font-bold">YES</span>
                    ) : (
                      <span className="text-red-600 font-bold">NO</span>
                    )}
                  </td>
                  <td className="p-2 align-top text-center">
                    {event.testOrdered ? "Ordered" : "—"}
                  </td>
                  <td className="p-2 align-top">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide ${
                      event.disposition === "confirmed_case" ? "bg-red-100 text-red-800" :
                      event.disposition === "monitoring" ? "bg-yellow-100 text-yellow-800" :
                      "bg-neutral-100 text-neutral-600"
                    }`}>
                      {event.disposition.replace("_", " ")}
                    </span>
                  </td>
                </tr>
              );
            })}
            {events.length === 0 && (
              <tr>
                <td colSpan={9} className="p-8 text-center text-neutral-500 italic">
                  No active line list events found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </PrintLayout>
  );
};

export default LineListPrint;
