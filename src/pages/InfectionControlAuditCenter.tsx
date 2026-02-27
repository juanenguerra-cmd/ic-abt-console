import React, { useMemo, useState } from "react";
import { CheckCircle2, ClipboardCopy, FileDown, Plus, Printer } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { useDatabase, useFacilityData } from "../app/providers";
import {
  InfectionControlAuditItem,
  InfectionControlAuditResponse,
  InfectionControlAuditSession,
} from "../domain/models";
import {
  AUDIT_CATEGORIES,
  infectionControlAuditTemplates,
  InfectionControlAuditCategory,
} from "../constants/infectionControlAuditTemplates";

const todayISO = () => new Date().toISOString().slice(0, 10);
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

const RESPONSE_OPTIONS: InfectionControlAuditResponse[] = ["COMPLIANT", "NON_COMPLIANT", "NA"];

const isClipboardAvailable = () =>
  typeof navigator !== "undefined" && !!navigator.clipboard?.writeText;

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
  const [expandedByCategory, setExpandedByCategory] = useState<Record<InfectionControlAuditCategory, boolean>>({
    HAND_HYGIENE: true,
    PPE: true,
    ISOLATION: true,
    EBP: true,
    ENV_CLEANING: true,
    ANTIBIOTIC_STEWARDSHIP: true,
    VACCINATION: true,
    OUTBREAK_PREP: true,
  });

  const [form, setForm] = useState({
    auditDateISO: todayISO(),
    unit: "All Units",
    shift: "Day",
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
  const selectedItems = useMemo(
    () => allItems.filter(item => item.sessionId === selectedSessionId),
    [allItems, selectedSessionId]
  );
  const isReadOnly = !!selectedSession?.finalizedAt;

  const itemsByCategory = useMemo(() => {
    const grouped: Record<InfectionControlAuditCategory, InfectionControlAuditItem[]> = {
      HAND_HYGIENE: [],
      PPE: [],
      ISOLATION: [],
      EBP: [],
      ENV_CLEANING: [],
      ANTIBIOTIC_STEWARDSHIP: [],
      VACCINATION: [],
      OUTBREAK_PREP: [],
    };
    selectedItems.forEach(item => grouped[item.category].push(item));
    return grouped;
  }, [selectedItems]);

  const auditsLast30Days = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return sessions.filter(s => new Date(`${s.auditDateISO}T00:00:00`) >= thirtyDaysAgo).length;
  }, [sessions]);

  const openCorrectiveActions = useMemo(
    () =>
      allItems.filter(
        i => i.response === "NON_COMPLIANT" && i.correctiveAction.trim() && !i.completedAt
      ).length,
    [allItems]
  );

  const currentNonCompliant = selectedItems.filter(i => i.response === "NON_COMPLIANT").length;

  const categoryProgress = useMemo(
    () =>
      AUDIT_CATEGORIES.map(category => {
        const rows = itemsByCategory[category];
        const answered = rows.filter(r => r.response !== "UNKNOWN").length;
        const compliant = rows.filter(r => r.response === "COMPLIANT").length;
        const nonCompliant = rows.filter(r => r.response === "NON_COMPLIANT").length;
        const denominator = compliant + nonCompliant;
        const compliancePct = denominator > 0 ? Math.round((compliant / denominator) * 100) : 0;
        return { category, total: rows.length, answered, compliant, nonCompliant, compliancePct };
      }),
    [itemsByCategory]
  );

  const handleStartNewAudit = () => {
    const now = new Date().toISOString();
    const sessionId = uuidv4();
    const nextSession: InfectionControlAuditSession = {
      id: sessionId,
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

      AUDIT_CATEGORIES.forEach(category => {
        infectionControlAuditTemplates[category].forEach(question => {
          const itemId = uuidv4();
          facilityStore.infectionControlAuditItems[itemId] = {
            id: itemId,
            sessionId,
            category,
            questionId: question.id,
            questionText: question.text,
            response: "UNKNOWN",
            evidenceNote: "",
            severity: "Low",
            correctiveAction: "",
            dueDateISO: "",
            completedAt: "",
          };
        });
      });
    });

    setSelectedSessionId(sessionId);
  };

  const updateSession = (patch: Partial<InfectionControlAuditSession>) => {
    if (!selectedSession) return;
    updateDB(draft => {
      const facilityStore = draft.data.facilityData[activeFacilityId];
      facilityStore.infectionControlAuditSessions ||= {};
      const existing = facilityStore.infectionControlAuditSessions[selectedSession.id];
      if (!existing || existing.finalizedAt) return;
      facilityStore.infectionControlAuditSessions[selectedSession.id] = {
        ...existing,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
    });
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
        facilityStore.infectionControlAuditSessions[session.id] = {
          ...session,
          updatedAt: new Date().toISOString(),
        };
      }
    });
  };

  const finalizeAudit = () => {
    if (!selectedSession || selectedSession.finalizedAt) return;
    updateSession({ finalizedAt: new Date().toISOString() });
  };

  const openPrint = () => {
    if (!selectedSessionId) return;
    window.open(`/print/audit-report?sessionId=${encodeURIComponent(selectedSessionId)}`, "_blank", "noopener,noreferrer");
  };

  const handleCopySummary = async () => {
    if (!selectedSession) return;
    const summary = [
      `Infection Control Audit - ${selectedSession.auditDateISO}`,
      `Unit: ${selectedSession.unit} | Shift: ${selectedSession.shift}`,
      `Auditor: ${selectedSession.auditorName}`,
      `Current non-compliant items: ${currentNonCompliant}`,
      `Open corrective actions (all sessions): ${openCorrectiveActions}`,
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
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input type="date" value={form.auditDateISO} onChange={e => setForm({ ...form, auditDateISO: e.target.value })} className="border border-neutral-300 rounded-md px-3 py-2 text-sm" />
          <input type="text" placeholder="Unit" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className="border border-neutral-300 rounded-md px-3 py-2 text-sm" />
          <input type="text" placeholder="Shift" value={form.shift} onChange={e => setForm({ ...form, shift: e.target.value })} className="border border-neutral-300 rounded-md px-3 py-2 text-sm" />
          <input type="text" placeholder="Auditor name" value={form.auditorName} onChange={e => setForm({ ...form, auditorName: e.target.value })} className="border border-neutral-300 rounded-md px-3 py-2 text-sm" />
          <button onClick={handleStartNewAudit} className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">
            <Plus className="w-4 h-4" />
            Start new audit
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-neutral-200 rounded-xl p-4"><p className="text-xs text-neutral-500">Audits (last 30 days)</p><p className="text-2xl font-bold">{auditsLast30Days}</p></div>
        <div className="bg-white border border-neutral-200 rounded-xl p-4"><p className="text-xs text-neutral-500">Open corrective actions</p><p className="text-2xl font-bold">{openCorrectiveActions}</p></div>
        <div className="bg-white border border-neutral-200 rounded-xl p-4"><p className="text-xs text-neutral-500">Current non-compliant</p><p className="text-2xl font-bold">{currentNonCompliant}</p></div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl p-4">
        <div className="flex flex-wrap gap-3 items-center justify-between mb-3">
          <select
            value={selectedSessionId}
            onChange={e => setSelectedSessionId(e.target.value)}
            className="border border-neutral-300 rounded-md px-3 py-2 text-sm min-w-[280px]"
          >
            <option value="">Select audit session</option>
            {sessions.map(s => (
              <option key={s.id} value={s.id}>{s.auditDateISO} | {s.unit} | {s.shift} | {s.auditorName}</option>
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
          <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <input value={selectedSession.auditDateISO} onChange={e => updateSession({ auditDateISO: e.target.value })} disabled={isReadOnly} type="date" className="border border-neutral-300 rounded-md px-2 py-1.5 text-sm disabled:bg-neutral-100" />
            <input value={selectedSession.unit} onChange={e => updateSession({ unit: e.target.value })} disabled={isReadOnly} type="text" className="border border-neutral-300 rounded-md px-2 py-1.5 text-sm disabled:bg-neutral-100" />
            <input value={selectedSession.shift} onChange={e => updateSession({ shift: e.target.value })} disabled={isReadOnly} type="text" className="border border-neutral-300 rounded-md px-2 py-1.5 text-sm disabled:bg-neutral-100" />
            <input value={selectedSession.auditorName} onChange={e => updateSession({ auditorName: e.target.value })} disabled={isReadOnly} type="text" className="border border-neutral-300 rounded-md px-2 py-1.5 text-sm disabled:bg-neutral-100" />
          </div>
        )}

        <div className="space-y-3">
          {categoryProgress.map(progress => (
            <div key={progress.category} className="border border-neutral-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedByCategory(prev => ({ ...prev, [progress.category]: !prev[progress.category] }))}
                className="w-full px-4 py-3 bg-neutral-50 flex items-center justify-between text-left"
              >
                <div>
                  <p className="font-semibold text-neutral-900">{CATEGORY_LABEL[progress.category]}</p>
                  <p className="text-xs text-neutral-500">
                    Answered {progress.answered}/{progress.total} • Compliant {progress.compliant} • Non-compliant {progress.nonCompliant} • Compliance {progress.compliancePct}%
                  </p>
                </div>
                <span className="text-sm text-neutral-500">{expandedByCategory[progress.category] ? "Hide" : "Show"}</span>
              </button>
              {expandedByCategory[progress.category] && (
                <div className="divide-y divide-neutral-100">
                  {itemsByCategory[progress.category].map(item => (
                    <div key={item.id} className="p-4 space-y-3">
                      <p className="text-sm font-medium text-neutral-800">{item.questionText}</p>
                      <div className="flex flex-wrap gap-2">
                        {RESPONSE_OPTIONS.map(option => (
                          <button
                            key={option}
                            disabled={isReadOnly}
                            onClick={() => updateItem(item.id, { response: option })}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
                              item.response === option
                                ? "bg-indigo-600 border-indigo-600 text-white"
                                : "bg-white border-neutral-300 text-neutral-700"
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
                            value={item.severity}
                            onChange={e => updateItem(item.id, { severity: e.target.value as InfectionControlAuditItem["severity"] })}
                            disabled={isReadOnly}
                            className="border border-neutral-300 rounded-md px-2 py-1.5 text-sm disabled:bg-neutral-100"
                          >
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
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
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default InfectionControlAuditCenter;

