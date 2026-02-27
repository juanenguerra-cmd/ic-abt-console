import React, { useMemo } from "react";
import { loadDB } from "../../storage/engine";
import {
  InfectionControlAuditItem,
  InfectionControlAuditSession,
} from "../../domain/models";
import { AUDIT_CATEGORIES, InfectionControlAuditCategory } from "../../constants/infectionControlAuditTemplates";

const categoryLabel: Record<InfectionControlAuditCategory, string> = {
  HAND_HYGIENE: "Hand Hygiene",
  PPE: "PPE",
  ISOLATION: "Isolation",
  EBP: "EBP",
  ENV_CLEANING: "Environmental Cleaning",
  ANTIBIOTIC_STEWARDSHIP: "Antibiotic Stewardship",
  VACCINATION: "Vaccination",
  OUTBREAK_PREP: "Outbreak Preparedness",
};

const AuditReportPrint: React.FC = () => {
  const db = useMemo(() => loadDB(), []);
  const sessionId = useMemo(() => new URLSearchParams(window.location.search).get("sessionId") || "", []);
  const facilityId = db.data.facilities.activeFacilityId;
  const store = db.data.facilityData[facilityId];
  const session: InfectionControlAuditSession | undefined = sessionId
    ? store.infectionControlAuditSessions?.[sessionId]
    : undefined;
  const items: InfectionControlAuditItem[] = useMemo(() => {
    const all = Object.values(store.infectionControlAuditItems || {});
    return all.filter(i => i.sessionId === sessionId);
  }, [store.infectionControlAuditItems, sessionId]);

  const totals = useMemo(() => {
    const compliant = items.filter(i => i.response === "COMPLIANT").length;
    const nonCompliant = items.filter(i => i.response === "NON_COMPLIANT").length;
    const na = items.filter(i => i.response === "NA").length;
    const openCorrective = items.filter(i => i.response === "NON_COMPLIANT" && i.correctiveAction.trim() && !i.completedAt);
    return { compliant, nonCompliant, na, openCorrective };
  }, [items]);

  React.useEffect(() => {
    const timer = setTimeout(() => window.print(), 100);
    return () => clearTimeout(timer);
  }, []);

  if (!session) {
    return <div className="p-6 text-sm text-red-700">Audit session not found.</div>;
  }

  return (
    <div className="bg-white text-black p-8">
      <style>{`
        @media print {
          @page { size: letter; margin: 0.5in; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="max-w-5xl mx-auto space-y-4">
        <header className="border-b pb-3">
          <h1 className="text-2xl font-bold">Infection Control Audit Report</h1>
          <p className="text-sm">Date: {session.auditDateISO} • Unit: {session.unit} • Shift: {session.shift} • Auditor: {session.auditorName}</p>
        </header>

        <section className="grid grid-cols-4 gap-3 text-sm">
          <div className="border rounded p-2"><strong>Total Items:</strong> {items.length}</div>
          <div className="border rounded p-2"><strong>Compliant:</strong> {totals.compliant}</div>
          <div className="border rounded p-2"><strong>Non-compliant:</strong> {totals.nonCompliant}</div>
          <div className="border rounded p-2"><strong>N/A:</strong> {totals.na}</div>
        </section>

        <section>
          <h2 className="font-semibold mb-2">Open Corrective Actions</h2>
          {totals.openCorrective.length === 0 ? (
            <p className="text-sm">None</p>
          ) : (
            <ul className="list-disc pl-5 text-sm space-y-1">
              {totals.openCorrective.map(item => (
                <li key={item.id}>
                  [{categoryLabel[item.category]}] {item.questionText} — {item.correctiveAction} (Due: {item.dueDateISO || "N/A"}, Severity: {item.severity})
                </li>
              ))}
            </ul>
          )}
        </section>

        {AUDIT_CATEGORIES.map(category => {
          const rows = items.filter(i => i.category === category);
          if (!rows.length) return null;
          return (
            <section key={category}>
              <h3 className="font-semibold mt-4 mb-2">{categoryLabel[category]}</h3>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-neutral-100">
                    <th className="border p-1 text-left">Question</th>
                    <th className="border p-1 text-left">Response</th>
                    <th className="border p-1 text-left">Corrective Action</th>
                    <th className="border p-1 text-left">Due Date</th>
                    <th className="border p-1 text-left">Severity</th>
                    <th className="border p-1 text-left">Completed</th>
                    <th className="border p-1 text-left">Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(item => (
                    <tr key={item.id}>
                      <td className="border p-1">{item.questionText}</td>
                      <td className="border p-1">{item.response}</td>
                      <td className="border p-1">{item.correctiveAction || "—"}</td>
                      <td className="border p-1">{item.dueDateISO || "—"}</td>
                      <td className="border p-1">{item.severity}</td>
                      <td className="border p-1">{item.completedAt || "—"}</td>
                      <td className="border p-1">{item.evidenceNote || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default AuditReportPrint;
