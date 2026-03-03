import React, { useMemo } from "react";
import { loadDB } from "../../storage/engine";
import {
  InfectionControlAuditItem,
  InfectionControlAuditSession,
} from "../../domain/models";
import { InfectionControlAuditCategory } from "../../constants/infectionControlAuditTemplates";
import { PrintLayout } from "./PrintLayout";

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
  const facility = db.data.facilities.byId[facilityId];
  const store = db.data.facilityData[facilityId];
  const session: InfectionControlAuditSession | undefined = sessionId
    ? store.infectionControlAuditSessions?.[sessionId]
    : undefined;
  
  const items: InfectionControlAuditItem[] = useMemo(() => {
    if (!store.infectionControlAuditItems) return [];
    const all = Object.values(store.infectionControlAuditItems);
    return all.filter(i => i.sessionId === sessionId);
  }, [store.infectionControlAuditItems, sessionId]);

  const stats = useMemo(() => {
    const total = items.length;
    const compliant = items.filter(i => i.response === "COMPLIANT").length;
    const nonCompliant = items.filter(i => i.response === "NON_COMPLIANT").length;
    const na = items.filter(i => i.response === "NA").length;
    const applicable = total - na;
    const complianceRate = applicable > 0 ? Math.round((compliant / applicable) * 100) : 0;
    
    const openCorrectiveActions = items.filter(
      i => i.response === "NON_COMPLIANT" && !i.completedAt
    );

    return { total, compliant, nonCompliant, na, complianceRate, openCorrectiveActions };
  }, [items]);

  React.useEffect(() => {
    const timer = setTimeout(() => window.print(), 100);
    return () => clearTimeout(timer);
  }, []);

  if (!session) {
    return <div className="p-6 text-sm text-red-700">Audit session not found.</div>;
  }

  return (
    <PrintLayout
      title={`Audit Report: ${categoryLabel[session.auditType]}`}
      facilityName={facility?.name || "Unknown Facility"}
      facilityAddress={facility?.address}
      dohId={facility?.dohId}
      auditorName={session.auditorName}
    >
      <div className="space-y-6">
        {/* Session Meta */}
        <section className="bg-neutral-50 border border-neutral-200 rounded-md p-4 text-sm grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <span className="block text-neutral-500 text-xs uppercase tracking-wider">Date</span>
            <span className="font-medium">{new Date(session.auditDateISO).toLocaleDateString()}</span>
          </div>
          <div>
            <span className="block text-neutral-500 text-xs uppercase tracking-wider">Unit</span>
            <span className="font-medium">{session.unit}</span>
          </div>
          <div>
            <span className="block text-neutral-500 text-xs uppercase tracking-wider">Shift</span>
            <span className="font-medium">{session.shift}</span>
          </div>
          <div>
            <span className="block text-neutral-500 text-xs uppercase tracking-wider">Auditor</span>
            <span className="font-medium">{session.auditorName}</span>
          </div>
        </section>

        {/* Scorecard */}
        <section className="grid grid-cols-4 gap-4">
          <div className="p-4 border border-neutral-200 rounded-md text-center bg-white">
            <div className="text-3xl font-bold text-neutral-900">{stats.complianceRate}%</div>
            <div className="text-xs text-neutral-500 uppercase tracking-wider mt-1">Compliance Score</div>
          </div>
          <div className="p-4 border border-neutral-200 rounded-md text-center bg-white">
            <div className="text-3xl font-bold text-emerald-600">{stats.compliant}</div>
            <div className="text-xs text-neutral-500 uppercase tracking-wider mt-1">Compliant Items</div>
          </div>
          <div className="p-4 border border-neutral-200 rounded-md text-center bg-white">
            <div className="text-3xl font-bold text-red-600">{stats.nonCompliant}</div>
            <div className="text-xs text-neutral-500 uppercase tracking-wider mt-1">Non-Compliant</div>
          </div>
          <div className="p-4 border border-neutral-200 rounded-md text-center bg-white">
            <div className="text-3xl font-bold text-neutral-400">{stats.na}</div>
            <div className="text-xs text-neutral-500 uppercase tracking-wider mt-1">Not Applicable</div>
          </div>
        </section>

        {/* Open Corrective Actions */}
        {stats.openCorrectiveActions.length > 0 && (
          <section className="border border-red-200 bg-red-50 rounded-md p-4">
            <h3 className="text-red-800 font-semibold mb-3 flex items-center gap-2">
              ⚠️ Open Corrective Actions Required
            </h3>
            <ul className="space-y-2">
              {stats.openCorrectiveActions.map(item => (
                <li key={item.id} className="text-sm bg-white p-2 rounded border border-red-100">
                  <div className="font-medium text-neutral-900">{item.questionText}</div>
                  <div className="text-red-700 mt-1">
                    <span className="font-semibold">Action:</span> {item.correctiveAction || "No action documented"}
                  </div>
                  <div className="text-neutral-500 text-xs mt-1 flex gap-3">
                    <span>Due: {item.dueDateISO || "N/A"}</span>
                    <span>Severity: {item.severity}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Full Audit Table */}
        <section>
          <h3 className="font-semibold text-lg mb-3 border-b pb-2">Audit Details</h3>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="w-[40%]">Criteria</th>
                <th className="w-[10%]">Result</th>
                <th className="w-[25%]">Corrective Action</th>
                <th className="w-[25%]">Notes / Evidence</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className={item.response === "NON_COMPLIANT" ? "bg-red-50/50" : ""}>
                  <td className="align-top">
                    <div className="font-medium">{item.questionText}</div>
                  </td>
                  <td className="align-top">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                      item.response === "COMPLIANT" ? "bg-emerald-100 text-emerald-800" :
                      item.response === "NON_COMPLIANT" ? "bg-red-100 text-red-800" :
                      "bg-neutral-100 text-neutral-600"
                    }`}>
                      {item.response.replace("_", " ")}
                    </span>
                  </td>
                  <td className="align-top">
                    {item.response === "NON_COMPLIANT" ? (
                      <div className="space-y-1">
                        <div className="text-red-700">{item.correctiveAction || "None documented"}</div>
                        {item.dueDateISO && <div className="text-xs text-neutral-500">Due: {item.dueDateISO}</div>}
                        {item.completedAt && <div className="text-xs text-emerald-600">✓ Completed: {new Date(item.completedAt).toLocaleDateString()}</div>}
                      </div>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="align-top text-neutral-600 italic">
                    {item.evidenceNote || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Notes */}
        {session.notes && (
          <section className="mt-6 border-t pt-4">
            <h3 className="font-semibold mb-2">Session Notes</h3>
            <p className="text-sm text-neutral-700 whitespace-pre-wrap">{session.notes}</p>
          </section>
        )}
      </div>
    </PrintLayout>
  );
};

export default AuditReportPrint;
