import React, { useState } from "react";

const sections = [
  {
    title: "Dashboard",
    purpose: "Daily command center for infection-control priorities.",
    bullets: [
      "Review active precautions and outbreak indicators.",
      "Check antibiotic stewardship trends at a glance.",
      "Jump quickly to resident and outbreak follow-up.",
    ],
  },
  {
    title: "Resident Board",
    purpose: "Primary resident surveillance and event tracking workspace.",
    bullets: [
      "Track infection status and precautions.",
      "Document IP events, vaccines, and antibiotic courses.",
      "Open resident profile and printable forms.",
    ],
  },
  {
    title: "Staff",
    purpose: "Manage staff records used in IC operations.",
    bullets: ["Maintain staff records.", "Support operational coordination during outbreaks."],
  },
  {
    title: "Outbreaks",
    purpose: "Create and monitor outbreak episodes.",
    bullets: ["Track active outbreaks and statuses.", "Keep outbreak timeline context and updates."],
  },
  {
    title: "Quarantine Inbox",
    purpose: "Intake queue for quarantine-related actions.",
    bullets: ["Review incoming quarantine items.", "Edit records and move cases into line-list workflows."],
  },
  {
    title: "Notes",
    purpose: "Clinical and operational documentation tools.",
    bullets: ["Generate AI-assisted notes.", "Maintain resident chat context and shift logs."],
  },
  {
    title: "Reports",
    purpose: "Build, run, and manage reporting outputs.",
    bullets: ["Create custom report criteria.", "Browse saved reports and export deliverables."],
  },
  {
    title: "Audit Center",
    purpose: "Structured audit documentation and print-ready output.",
    bullets: ["Complete infection-control audits.", "Produce printable compliance reports."],
  },
  {
    title: "Back Office",
    purpose: "Historical data administration and correction workflows.",
    bullets: ["Upload historical CSVs.", "Review and edit historical records."],
  },
  {
    title: "Settings",
    purpose: "Facility configuration and data management.",
    bullets: ["Configure units/rooms and monthly metrics.", "Run migrations and backup/restore."],
  },
  {
    title: "Lock Screen",
    purpose: "Protect app access on shared workstations.",
    bullets: ["Lock when stepping away.", "Require PIN before resuming work."],
  },
];

/* ── Data Field Reference entity list (rendered inline) ── */

const dataFieldEntities = [
  { entity: "Resident", storagePath: "facilityStore.residents[mrn]", keyField: "mrn", fieldCount: 28 },
  { entity: "QuarantineResident", storagePath: "facilityStore.quarantine[tempId]", keyField: "tempId (Q:<uuid>)", fieldCount: 10 },
  { entity: "ABTCourse", storagePath: "facilityStore.abts[id]", keyField: "id", fieldCount: 20 },
  { entity: "IPEvent", storagePath: "facilityStore.infections[id]", keyField: "id", fieldCount: 21 },
  { entity: "VaxEvent", storagePath: "facilityStore.vaxEvents[id]", keyField: "id", fieldCount: 18 },
  { entity: "ResidentNote", storagePath: "facilityStore.notes[id]", keyField: "id", fieldCount: 9 },
  { entity: "Staff", storagePath: "facilityStore.staff[id]", keyField: "id", fieldCount: 13 },
  { entity: "StaffVaxEvent", storagePath: "facilityStore.staffVaxEvents[id]", keyField: "id", fieldCount: 11 },
  { entity: "FitTestEvent", storagePath: "facilityStore.fitTestEvents[id]", keyField: "id", fieldCount: 15 },
  { entity: "Outbreak", storagePath: "facilityStore.outbreaks[id]", keyField: "id", fieldCount: 12 },
  { entity: "OutbreakCase", storagePath: "facilityStore.outbreakCases[id]", keyField: "id", fieldCount: 12 },
  { entity: "OutbreakExposure", storagePath: "facilityStore.outbreakExposures[id]", keyField: "id", fieldCount: 9 },
  { entity: "OutbreakDailyStatus", storagePath: "facilityStore.outbreakDailyStatuses[id]", keyField: "id", fieldCount: 12 },
  { entity: "AuditSession", storagePath: "facilityStore.auditSessions[id]", keyField: "id", fieldCount: 5 },
  { entity: "InfectionControlAuditSession", storagePath: "facilityStore.infectionControlAuditSessions[id]", keyField: "id", fieldCount: 10 },
  { entity: "InfectionControlAuditItem", storagePath: "facilityStore.infectionControlAuditItems[id]", keyField: "id", fieldCount: 11 },
  { entity: "LineListEvent", storagePath: "facilityStore.lineListEvents[id]", keyField: "id", fieldCount: 17 },
  { entity: "AppNotification", storagePath: "facilityStore.notifications[id]", keyField: "id", fieldCount: 17 },
  { entity: "ShiftLogEntry", storagePath: "facilityStore.shiftLog[id]", keyField: "id", fieldCount: 10 },
  { entity: "MutationLogEntry", storagePath: "facilityStore.mutationLog[]", keyField: "timestamp", fieldCount: 5 },
  { entity: "ExportProfile", storagePath: "facilityStore.exportProfiles[id]", keyField: "id", fieldCount: 9 },
  { entity: "SurveyPacket", storagePath: "facilityStore.surveyPackets[id]", keyField: "id", fieldCount: 8 },
  { entity: "Facility", storagePath: "facilities.byId[id]", keyField: "id", fieldCount: 14 },
];

export default function UserGuidePage() {
  const [activeTab, setActiveTab] = useState<"screens" | "data-fields">("screens");

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-neutral-900">User Guide</h1>
        <p className="text-neutral-600">
          Screen-by-screen walkthrough and data field reference for the IC Nurse Console.
        </p>
      </header>

      {/* Tab Navigation */}
      <nav className="flex gap-2 border-b border-neutral-200">
        <button
          onClick={() => setActiveTab("screens")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "screens"
              ? "border-indigo-600 text-indigo-700"
              : "border-transparent text-neutral-500 hover:text-neutral-700"
          }`}
        >
          Screen Walkthrough
        </button>
        <button
          onClick={() => setActiveTab("data-fields")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "data-fields"
              ? "border-indigo-600 text-indigo-700"
              : "border-transparent text-neutral-500 hover:text-neutral-700"
          }`}
        >
          Data Field Reference
        </button>
      </nav>

      {/* Screen Walkthrough Tab */}
      {activeTab === "screens" && (
        <>
          <section className="bg-indigo-50 border border-indigo-100 rounded-lg p-4">
            <h2 className="font-semibold text-indigo-900">Where to find this guide in the UI</h2>
            <p className="text-indigo-900/90 mt-1">
              Open the left sidebar and click <strong>User Guide</strong>.
            </p>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            {sections.map((section) => (
              <article key={section.title} className="bg-white border border-neutral-200 rounded-lg p-4">
                <h3 className="font-semibold text-neutral-900">{section.title}</h3>
                <p className="text-sm text-neutral-600 mt-1">{section.purpose}</p>
                <ul className="list-disc pl-5 mt-3 text-sm text-neutral-700 space-y-1">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </article>
            ))}
          </section>
        </>
      )}

      {/* Data Field Reference Tab */}
      {activeTab === "data-fields" && (
        <>
          <section className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h2 className="font-semibold text-amber-900">Data Field Reference (Data Dictionary)</h2>
            <p className="text-amber-900/90 mt-1 text-sm">
              Complete reference for every persisted data field in the system. Each entity type
              below links to the full documentation in{" "}
              <code className="bg-amber-100 px-1 rounded text-xs">docs/data-field-reference.md</code>.
              Field definitions are sourced from{" "}
              <code className="bg-amber-100 px-1 rounded text-xs">src/domain/models.ts</code>.
            </p>
          </section>

          {/* Event Contract Summary */}
          <section className="bg-white border border-neutral-200 rounded-lg p-4">
            <h3 className="font-semibold text-neutral-900 mb-2">Event Contract — Common Required Fields</h3>
            <p className="text-sm text-neutral-600 mb-3">
              All event/entity types follow a common contract. When creating a new entity, ensure these fields are present:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-neutral-50">
                    <th className="text-left px-3 py-2 border border-neutral-200 font-medium">Field</th>
                    <th className="text-left px-3 py-2 border border-neutral-200 font-medium">Type</th>
                    <th className="text-left px-3 py-2 border border-neutral-200 font-medium">Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td className="px-3 py-1.5 border border-neutral-200 font-mono text-xs">id</td><td className="px-3 py-1.5 border border-neutral-200">string (UUID)</td><td className="px-3 py-1.5 border border-neutral-200">Unique primary key (Resident uses mrn; QuarantineResident uses tempId)</td></tr>
                  <tr><td className="px-3 py-1.5 border border-neutral-200 font-mono text-xs">residentRef / residentId</td><td className="px-3 py-1.5 border border-neutral-200">ResidentRef or string</td><td className="px-3 py-1.5 border border-neutral-200">Links event to a resident</td></tr>
                  <tr><td className="px-3 py-1.5 border border-neutral-200 font-mono text-xs">createdAt</td><td className="px-3 py-1.5 border border-neutral-200">ISO</td><td className="px-3 py-1.5 border border-neutral-200">Record creation timestamp</td></tr>
                  <tr><td className="px-3 py-1.5 border border-neutral-200 font-mono text-xs">updatedAt</td><td className="px-3 py-1.5 border border-neutral-200">ISO</td><td className="px-3 py-1.5 border border-neutral-200">Last modification timestamp</td></tr>
                  <tr><td className="px-3 py-1.5 border border-neutral-200 font-mono text-xs">facilityId</td><td className="px-3 py-1.5 border border-neutral-200">string</td><td className="px-3 py-1.5 border border-neutral-200">Multi-facility isolation (where applicable)</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Canonical Join Keys */}
          <section className="bg-white border border-neutral-200 rounded-lg p-4">
            <h3 className="font-semibold text-neutral-900 mb-2">Coverage & Parity — Canonical Join Keys</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-neutral-50">
                    <th className="text-left px-3 py-2 border border-neutral-200 font-medium">Join Key</th>
                    <th className="text-left px-3 py-2 border border-neutral-200 font-medium">Primary Use</th>
                    <th className="text-left px-3 py-2 border border-neutral-200 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td className="px-3 py-1.5 border border-neutral-200 font-mono text-xs">residentRef.id</td><td className="px-3 py-1.5 border border-neutral-200">Primary resident linkage (ABT, IP, Vax, Notes, OutbreakCase, OutbreakExposure)</td><td className="px-3 py-1.5 border border-neutral-200">Discriminated union: mrn or quarantine</td></tr>
                  <tr><td className="px-3 py-1.5 border border-neutral-200 font-mono text-xs">mrn / residentId</td><td className="px-3 py-1.5 border border-neutral-200">Resident primary key; used directly by LineListEvent, AppNotification</td><td className="px-3 py-1.5 border border-neutral-200">MRN fallback for legacy systems</td></tr>
                  <tr><td className="px-3 py-1.5 border border-neutral-200 font-mono text-xs">staffId</td><td className="px-3 py-1.5 border border-neutral-200">Staff linkage (StaffVaxEvent, FitTestEvent)</td><td className="px-3 py-1.5 border border-neutral-200">—</td></tr>
                  <tr><td className="px-3 py-1.5 border border-neutral-200 font-mono text-xs">outbreakId</td><td className="px-3 py-1.5 border border-neutral-200">Outbreak linkage (Case, Exposure, DailyStatus, IPEvent)</td><td className="px-3 py-1.5 border border-neutral-200">—</td></tr>
                  <tr><td className="px-3 py-1.5 border border-neutral-200 font-mono text-xs">sessionId</td><td className="px-3 py-1.5 border border-neutral-200">IC Audit session linkage (AuditItem)</td><td className="px-3 py-1.5 border border-neutral-200">—</td></tr>
                  <tr><td className="px-3 py-1.5 border border-neutral-200 font-mono text-xs">facilityId</td><td className="px-3 py-1.5 border border-neutral-200">Facility scoping for multi-tenant isolation</td><td className="px-3 py-1.5 border border-neutral-200">Validated by commit gate</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Entity Listing */}
          <section className="space-y-3">
            <h3 className="font-semibold text-neutral-900">All Entity Types ({dataFieldEntities.length})</h3>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {dataFieldEntities.map((e) => (
                <article key={e.entity} className="bg-white border border-neutral-200 rounded-lg p-3">
                  <h4 className="font-semibold text-neutral-900 text-sm">{e.entity}</h4>
                  <p className="text-xs text-neutral-500 mt-1 font-mono">{e.storagePath}</p>
                  <p className="text-xs text-neutral-600 mt-1">
                    Key: <span className="font-mono">{e.keyField}</span> · {e.fieldCount} fields
                  </p>
                </article>
              ))}
            </div>
          </section>

          {/* Deprecated Fields Warning */}
          <section className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="font-semibold text-red-900 mb-2">Deprecated Fields</h3>
            <ul className="text-sm text-red-800 space-y-1 list-disc pl-5">
              <li><code className="bg-red-100 px-1 rounded text-xs">VaxEvent.administeredDate</code> → use <code className="bg-red-100 px-1 rounded text-xs">dateGiven</code>. Coalesce: <code className="bg-red-100 px-1 rounded text-xs">dateGiven ?? administeredDate</code></li>
              <li><code className="bg-red-100 px-1 rounded text-xs">FitTestEvent.fitTestDate</code> → use <code className="bg-red-100 px-1 rounded text-xs">date</code>. Coalesce: <code className="bg-red-100 px-1 rounded text-xs">date ?? fitTestDate</code></li>
            </ul>
          </section>

          {/* Developer Checklist */}
          <section className="bg-white border border-neutral-200 rounded-lg p-4">
            <h3 className="font-semibold text-neutral-900 mb-2">Developer Checklist — Before Adding a Field</h3>
            <ul className="text-sm text-neutral-700 space-y-1">
              <li className="flex gap-2"><span>☐</span> Update <code className="bg-neutral-100 px-1 rounded text-xs">src/domain/models.ts</code></li>
              <li className="flex gap-2"><span>☐</span> Update <code className="bg-neutral-100 px-1 rounded text-xs">docs/data-field-reference.md</code></li>
              <li className="flex gap-2"><span>☐</span> Update storage migrations (<code className="bg-neutral-100 px-1 rounded text-xs">src/storage/engine.ts</code>)</li>
              <li className="flex gap-2"><span>☐</span> Update FacilityStore + emptyFacilityStore() if new entity</li>
              <li className="flex gap-2"><span>☐</span> Update commit gate if field has residentRef or facilityId</li>
              <li className="flex gap-2"><span>☐</span> Update affected reports and notifications</li>
              <li className="flex gap-2"><span>☐</span> Verify backward compatibility for renamed fields</li>
              <li className="flex gap-2"><span>☐</span> Run lint and build</li>
            </ul>
          </section>

          <p className="text-xs text-neutral-400 text-center">
            Full field-by-field tables with validation rules, data types, and edge cases are in{" "}
            <code>docs/data-field-reference.md</code>. Source of truth: <code>src/domain/models.ts</code>.
          </p>
        </>
      )}
    </div>
  );
}
