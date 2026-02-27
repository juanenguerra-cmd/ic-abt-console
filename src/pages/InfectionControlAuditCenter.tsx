import React, { useMemo, useState } from "react";
import { CheckCircle2, ClipboardCopy, FileDown, Printer } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { useDatabase, useFacilityData } from "../app/providers";
import { InfectionControlAuditItem, InfectionControlAuditResponse, InfectionControlAuditSession } from "../domain/models";
import { AUDIT_CATEGORIES, infectionControlAuditTemplates, InfectionControlAuditCategory } from "../constants/infectionControlAuditTemplates";

const todayISO = () => new Date().toISOString().slice(0, 10);
const RESPONSE_OPTIONS: InfectionControlAuditResponse[] = ["COMPLIANT", "NON_COMPLIANT", "NA"];

const CATEGORY_LABEL: Record<InfectionControlAuditCategory, string> = {
  HAND_HYGIENE: "Hand Hygiene",
  PPE: "PPE",
  ISOLATION: "Isolation",
  EBP: "EBP",
  ENV_CLEANING: "Environmental Cleaning",
  ANTIBIOTIC_STEWARDSHIP: "Antibiotic Stewardship",
  VACCINATION: "Vaccination",
  OUTBREAK_PREP: "Outbreak Preparedness",
};

const isClipboardAvailable = () => typeof navigator !== "undefined" && !!navigator.clipboard?.writeText;

const normalizeSeverity = (value: string): InfectionControlAuditItem["severity"] => {
  if (value === "HIGH") return "HIGH";
  if (value === "MED") return "MED";
  return "LOW";
};

const InfectionControlAuditCenter: React.FC = () => {
  const { activeFacilityId, store } = useFacilityData();
  const { updateDB } = useDatabase();

  const sessions = useMemo(
    () => Object.values(store.infectionControlAuditSessions || {}).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [store.infectionControlAuditSessions]
  );
  const allItems = useMemo(() => Object.values(store.infectionControlAuditItems || {}), [store.infectionControlAuditItems]);

  const [selectedSessionId, setSelectedSessionId] = useState<string>(sessions[0]?.id || "");
  const [showMore, setShowMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [form, setForm] = useState({
    auditType: "" as "" | InfectionControlAuditCategory,
    auditDateISO: todayISO(),
    unit: "",
    shift: "",
    auditorName: "",
    notes: "",
  });

  React.useEffect(() => {
    if (!sessions.length) {
      setSelectedSessionId("");
      return;
    }
    if (!selectedSessionId || !sessions.some(s => s.id === selectedSessionId)) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [sessions, selectedSessionId]);

  const selectedSession = sessions.find(s => s.id === selectedSessionId);
  const selectedItems = useMemo(() => allItems.filter(item => item.sessionId === selectedSessionId), [allItems, selectedSessionId]);
  const isReadOnly = !!selectedSession?.finalizedAt;

  const sessionMetrics = useMemo(() => {
    const total = selectedItems.length;
    const answered = selectedItems.filter(i => i.response !== "UNKNOWN").length;
    const compliant = selectedItems.filter(i => i.response === "COMPLIANT").length;
    const nonCompliant = selectedItems.filter(i => i.response === "NON_COMPLIANT").length;
    const openCorrective = selectedItems.filter(i => i.response === "NON_COMPLIANT" && i.correctiveAction.trim() && !i.completedAt).length;
    const compliancePct = compliant + nonCompliant > 0 ? Math.round((compliant / (compliant + nonCompliant)) * 100) : 0;
    return { total, answered, compliant, nonCompliant, openCorrective, compliancePct };
  }, [selectedItems]);

  const createSession = () => {
    if (!form.auditType) {
      setErrorMessage("Audit type is required.");
      return;
    }
    const auditType = form.auditType;

    const now = new Date().toISOString();
    const sessionId = uuidv4();
    const nextSession: InfectionControlAuditSession = {
      id: sessionId,
      auditType,
      auditDateISO: form.auditDateISO || todayISO(),
      unit: form.unit.trim() || "All Units",
      shift: form.shift.trim() || "Day",
      auditorName: form.auditorName.trim() || "Unknown",
      notes: form.notes,
      createdAt: now,
      updatedAt: now,
    };

    updateDB(draft => {
      const facilityStore = draft.data.facilityData[activeFacilityId];
      facilityStore.infectionControlAuditSessions ||= {};
      facilityStore.infectionControlAuditItems ||= {};
      facilityStore.infectionControlAuditSessions[sessionId] = nextSession;

      infectionControlAuditTemplates[auditType].forEach(question => {
        const itemId = uuidv4();
        facilityStore.infectionControlAuditItems[itemId] = {
          id: itemId,
          sessionId,
          category: auditType,
          questionId: question.id,
          questionText: question.text,
          response: "UNKNOWN",
          evidenceNote: "",
          severity: "LOW",
          correctiveAction: "",
          dueDateISO: "",
          completedAt: "",
        };
      });
    });

    setErrorMessage("");
    setSelectedSessionId(sessionId);
  };

  const updateItem = (itemId: string, patch: Partial<InfectionControlAuditItem>) => {
    if (isReadOnly) return;
    updateDB(draft => {
      const facilityStore = draft.data.facilityData[activeFacilityId];
      facilityStore.infectionControlAuditItems ||= {};
      facilityStore.infectionControlAuditSessions ||= {};
      const item = facilityStore.infectionControlAuditItems[itemId];
      if (!item) return;
      const session = facilityStore.infectionControlAuditSessions[item.sessionId];
      if (session?.finalizedAt) return;
      facilityStore.infectionControlAuditItems[itemId] = { ...item, ...patch };
      if (session) {
        facilityStore.infectionControlAuditSessions[session.id] = { ...session, updatedAt: new Date().toISOString() };
      }
    });
  };

  const finalizeAudit = () => {
    if (!selectedSession || selectedSession.finalizedAt) return;
    updateDB(draft => {
      const facilityStore = draft.data.facilityData[activeFacilityId];
      const existing = facilityStore.infectionControlAuditSessions?.[selectedSession.id];
      if (!existing || existing.finalizedAt) return;
      facilityStore.infectionControlAuditSessions[selectedSession.id] = {
        ...existing,
        finalizedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const openPrint = () => {
    if (!selectedSessionId) return;
    window.open(`/print/audit-report?sessionId=${encodeURIComponent(selectedSessionId)}`, "_blank", "noopener,noreferrer");
  };

  const handleCopySummary = async () => {
    if (!selectedSession) return;
    const summary = [
      `Infection Control Audit (${selectedSession.auditType}) - ${selectedSession.auditDateISO}`,
      `Unit: ${selectedSession.unit} | Shift: ${selectedSession.shift}`,
      `Auditor: ${selectedSession.auditorName}`,
      `Total: ${sessionMetrics.total} | Answered: ${sessionMetrics.answered}`,
      `Compliant: ${sessionMetrics.compliant} | Non-compliant: ${sessionMetrics.nonCompliant} | Compliance: ${sessionMetrics.compliancePct}%`,
      `Open corrective actions: ${sessionMetrics.openCorrective}`,
    ].join("\n");

    if (!isClipboardAvailable()) {
      setErrorMessage("Clipboard unavailable. Please copy manually.");
      return;
    }

    try {
      await navigator.clipboard.writeText(summary);
      setErrorMessage("");
    } catch {
      setErrorMessage("Unable to copy summary to clipboard. Please copy manually.");
    }
  };

  const handleCopyTable = async () => {
    if (!selectedItems.length) return;
    const header = ["Category", "Question", "Response", "CorrectiveAction", "DueDateISO", "Severity", "CompletedAt", "EvidenceNote"].join("\t");
    const rows = selectedItems.map(i =>
      [i.category, i.questionText, i.response, i.correctiveAction, i.dueDateISO, i.severity, i.completedAt, i.evidenceNote]
        .map(v => (v || "").replace(/\t/g, " ").replace(/\n/g, " "))
        .join("\t")
    );
    const tsv = [header, ...rows].join("\n");

    if (!isClipboardAvailable()) {
      setErrorMessage("Clipboard unavailable. Unable to copy table.");
      return;
    }

    try {
      await navigator.clipboard.writeText(tsv);
      setErrorMessage("");
    } catch {
      setErrorMessage("Unable to copy table to clipboard. Please try again.");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="bg-white border border-neutral-200 rounded-xl p-4">
        <h1 className="text-xl font-bold text-neutral-900 mb-4">Infection Control Audit Center</h1>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <select
            value={form.auditType}
            onChange={e => setForm({ ...form, auditType: e.target.value as "" | InfectionControlAuditCategory })}
            className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">Select Audit Type (required)</option>
            {AUDIT_CATEGORIES.map(category => (
              <option key={category} value={category}>{CATEGORY_LABEL[category]}</option>
            ))}
          </select>
          <input type="date" value={form.auditDateISO} onChange={e => setForm({ ...form, auditDateISO: e.target.value })} className="border border-neutral-300 rounded-md px-3 py-2 text-sm" />
          <input type="text" placeholder="Unit" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className="border border-neutral-300 rounded-md px-3 py-2 text-sm" />
          <input type="text" placeholder="Shift" value={form.shift} onChange={e => setForm({ ...form, shift: e.target.value })} className="border border-neutral-300 rounded-md px-3 py-2 text-sm" />
          <input type="text" placeholder="Auditor name" value={form.auditorName} onChange={e => setForm({ ...form, auditorName: e.target.value })} className="border border-neutral-300 rounded-md px-3 py-2 text-sm" />
          <button onClick={createSession} className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">
            Create Audit Session
          </button>
        </div>
        <textarea
          value={form.notes}
          onChange={e => setForm({ ...form, notes: e.target.value })}
          placeholder="Session notes"
          className="mt-3 w-full border border-neutral-300 rounded-md px-3 py-2 text-sm"
          rows={2}
        />
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl p-4">
        <div className="flex flex-wrap gap-3 items-center justify-between mb-3">
          <select
            value={selectedSessionId}
            onChange={e => setSelectedSessionId(e.target.value)}
            className="border border-neutral-300 rounded-md px-3 py-2 text-sm min-w-[340px]"
          >
            <option value="">Select audit session</option>
            {sessions.map(s => (
              <option key={s.id} value={s.id}>
                {`${s.auditDateISO} • ${s.unit} • ${CATEGORY_LABEL[s.auditType]} • ${s.shift}${s.finalizedAt ? " • Finalized ✓" : ""}`}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <button onClick={() => setShowMore(prev => !prev)} className="px-3 py-2 rounded-md border border-neutral-300 text-sm hover:bg-neutral-50">{showMore ? "Less" : "More"}</button>
            <button onClick={handleCopySummary} disabled={!selectedSession} className="inline-flex items-center gap-1 px-3 py-2 rounded-md border border-neutral-300 text-sm hover:bg-neutral-50 disabled:opacity-50">
              <ClipboardCopy className="w-4 h-4" /> Copy Summary
            </button>
            <button onClick={handleCopyTable} disabled={!selectedSession} className="inline-flex items-center gap-1 px-3 py-2 rounded-md border border-neutral-300 text-sm hover:bg-neutral-50 disabled:opacity-50">
              <FileDown className="w-4 h-4" /> Copy Table (TSV)
            </button>
            <button onClick={openPrint} disabled={!selectedSession} className="inline-flex items-center gap-1 px-3 py-2 rounded-md bg-neutral-900 text-white text-sm hover:bg-neutral-800 disabled:opacity-50">
              <Printer className="w-4 h-4" /> Print / Save PDF
            </button>
            <button onClick={finalizeAudit} disabled={!selectedSession || isReadOnly} className="inline-flex items-center gap-1 px-3 py-2 rounded-md bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50">
              <CheckCircle2 className="w-4 h-4" /> Finalize Audit
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</div>
        )}

        {selectedSession && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
            <div className="bg-neutral-50 border border-neutral-200 rounded-md p-3"><p className="text-xs text-neutral-500">Total Questions</p><p className="font-semibold">{sessionMetrics.total}</p></div>
            <div className="bg-neutral-50 border border-neutral-200 rounded-md p-3"><p className="text-xs text-neutral-500">Answered</p><p className="font-semibold">{sessionMetrics.answered}</p></div>
            <div className="bg-neutral-50 border border-neutral-200 rounded-md p-3"><p className="text-xs text-neutral-500">Compliant</p><p className="font-semibold">{sessionMetrics.compliant}</p></div>
            <div className="bg-neutral-50 border border-neutral-200 rounded-md p-3"><p className="text-xs text-neutral-500">Non-compliant</p><p className="font-semibold">{sessionMetrics.nonCompliant}</p></div>
            <div className="bg-neutral-50 border border-neutral-200 rounded-md p-3"><p className="text-xs text-neutral-500">Compliance %</p><p className="font-semibold">{sessionMetrics.compliancePct}%</p></div>
            <div className="bg-neutral-50 border border-neutral-200 rounded-md p-3"><p className="text-xs text-neutral-500">Open Corrective</p><p className="font-semibold">{sessionMetrics.openCorrective}</p></div>
          </div>
        )}

        {selectedSession && (
          <div className="border border-neutral-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-200">
              <p className="font-semibold text-neutral-900">{CATEGORY_LABEL[selectedSession.auditType]}</p>
              <p className="text-xs text-neutral-500">{selectedSession.auditDateISO} • {selectedSession.unit} • {selectedSession.shift} • {selectedSession.auditorName}</p>
            </div>
            <div className="divide-y divide-neutral-100">
              {selectedItems.map(item => (
                <div key={item.id} className="p-4 space-y-3">
                  <p className="text-sm font-medium text-neutral-800">{item.questionText}</p>
                  <div className="flex flex-wrap gap-2">
                    {RESPONSE_OPTIONS.map(option => (
                      <button
                        key={option}
                        disabled={isReadOnly}
                        onClick={() => updateItem(item.id, { response: option })}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
                          item.response === option ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-neutral-300 text-neutral-700"
                        } disabled:opacity-50`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>

                  {showMore && (
                    <textarea
                      value={item.evidenceNote}
                      onChange={e => updateItem(item.id, { evidenceNote: e.target.value })}
                      disabled={isReadOnly}
                      placeholder="Evidence / notes"
                      className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm disabled:bg-neutral-100"
                      rows={2}
                    />
                  )}

                  {item.response === "NON_COMPLIANT" && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 border border-amber-200 bg-amber-50 rounded-md">
                      <select
                        value={normalizeSeverity(item.severity)}
                        onChange={e => updateItem(item.id, { severity: e.target.value as InfectionControlAuditItem["severity"] })}
                        disabled={isReadOnly}
                        className="border border-neutral-300 rounded-md px-2 py-1.5 text-sm disabled:bg-neutral-100"
                      >
                        <option value="LOW">LOW</option>
                        <option value="MED">MED</option>
                        <option value="HIGH">HIGH</option>
                      </select>
                      <input
                        type="date"
                        value={item.dueDateISO}
                        onChange={e => updateItem(item.id, { dueDateISO: e.target.value })}
                        disabled={isReadOnly}
                        className="border border-neutral-300 rounded-md px-2 py-1.5 text-sm disabled:bg-neutral-100"
                      />
                      <input
                        type="date"
                        value={item.completedAt}
                        onChange={e => updateItem(item.id, { completedAt: e.target.value })}
                        disabled={isReadOnly}
                        className="border border-neutral-300 rounded-md px-2 py-1.5 text-sm disabled:bg-neutral-100"
                      />
                      <input
                        type="text"
                        value={item.correctiveAction}
                        onChange={e => updateItem(item.id, { correctiveAction: e.target.value })}
                        disabled={isReadOnly}
                        placeholder="Corrective action"
                        className="border border-neutral-300 rounded-md px-2 py-1.5 text-sm md:col-span-4 disabled:bg-neutral-100"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InfectionControlAuditCenter;
