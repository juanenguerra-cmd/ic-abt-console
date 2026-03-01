# IC Nurse Console — Guard-Rail & Enhancement Report

> **Scope:** IC Nurse Console v0 (UNIFIED\_DB\_V2 schema, single-facility, browser-only build)
> **Date:** 2026-02-27
> **Audience:** Lead developer, clinical informatics reviewer, facility administrator

---

## 1. GUARD-RAIL PRIORITY TABLE

| # | Risk | Severity | Current State | Recommended Fix | File / Component |
|---|------|----------|---------------|-----------------|-----------------|
| G1 | Duplicate active ABT for same resident + medication | **CRITICAL** | No duplicate check; identical courses can co-exist silently | Warn (soft block) when saving an ABT if a same-medication active course already exists for the resident | `AbtCourseModal.tsx` |
| G2 | ABT prescribed to resident with a documented allergy | **CRITICAL** | Resident `allergies[]` field is captured but never checked against `medication` or `medicationClass` | Cross-check `medication` / `medicationClass` against `resident.allergies` on save; render a red banner and require an explicit override checkbox | `AbtCourseModal.tsx` |
| G3 | Active ABT with no clinical indication or syndrome category | **HIGH** | `indication` and `syndromeCategory` are optional; a complete AB course can be saved with no documented rationale | Warn on save when both `indication` and `syndromeCategory` are blank; add yellow banner | `AbtCourseModal.tsx` |
| G4 | Active ABT running > 14 days without clinical reassessment note | **HIGH** | Detection pipeline only fires a LINE\_LIST\_REVIEW at day 7; no escalation step | Add `ABT_STEWARDSHIP` escalation rule at 14-day mark; distinct from the existing 48–72 h time-out rule | `detectionPipeline.ts` |
| G5 | Active IP event with no isolation type assigned | **HIGH** | `isolationType` is optional; contact/droplet/airborne precautions may never be ordered | Detection pipeline should fire `LINE_LIST_REVIEW` when an IP event has been active > 4 h without `isolationType` | `detectionPipeline.ts` |
| G6 | No PHI access control / role-based access | **HIGH** | Any browser user can read, edit, and export all PHI; no auth layer exists | Implement a role model (Viewer, Nurse, IC Lead, Admin) with per-route guards; at minimum enforce the existing PIN lock on every route change | `app/` routing layer |
| G7 | Single-point storage failure (IndexedDB only) | **MEDIUM** | IndexedDB data is ephemeral on many managed browsers/kiosks; a cleared cache loses all data | Enforce daily automated JSON snapshot export and surface a prominent "last backup" badge in the header | `engine.ts`, `Settings` |
| G8 | No audit trail for data mutations | **MEDIUM** | `updateDB` in-memory immer patches are never logged; edits are invisible post-fact | Append a lightweight mutation log `{ who, action, entityType, entityId, timestamp }` to `FacilityStore` | `engine.ts`, `app/providers` |
| G9 | Unvalidated freetext injected into AI prompt | **MEDIUM** | Note body and resident fields are interpolated directly into Gemini prompts without sanitisation | Strip/escape HTML and truncate inputs before building prompts; add max-length guards | `services/gemini*` |
| G10 | Census import accepts arbitrary MRN values without dedup check | **LOW** | CSV parser does not flag when an MRN already exists; silently overwrites resident data | Detect collisions during import and surface a confirmation diff before applying | `parsers/`, `CensusParserModal.tsx` |

---

## 2. TOP 5 GUARD-RAIL FIXES (PRIORITY ORDER)

### G1 — Duplicate Active ABT Detection
**What breaks today?**  
A nurse can accidentally create two identical active antibiotic courses for the same resident (e.g., after a double-click or a confusion between shifts). There is no deduplication check, so duplicate ABTs silently inflate stewardship metrics and may cause double-dosing if the console is used as a reference.

**The fix:**  
In `AbtCourseModal.tsx → handleSave()`, before persisting, compare `medication.trim().toLowerCase()` against every *active* ABT already recorded for `residentId` (excluding the record being edited). If a match is found, display an inline yellow banner: *"An active course of [Drug] already exists. Confirm this is intentional before saving."* The user must tick an acknowledge checkbox to proceed.

**Effort:** ~2 h (UI banner + checkbox state + one comparison loop)

---

### G2 — Allergy/ABT Conflict Check
**What breaks today?**  
`Resident.allergies[]` is populated during admission screening but is never cross-referenced when a new ABT is prescribed. A resident documented as allergic to penicillin could receive Amoxicillin without any system warning.

**The fix:**  
In `AbtCourseModal.tsx`, derive `allergyWarning` by checking whether the lowercase `medication` or `medicationClass` contains any token from `resident.allergies`. Display a red `AlertTriangle` banner: *"⚠ Possible allergy conflict: [allergen]. Verify with prescriber before saving."* Require an explicit override checkbox to unlock the Save button.

**Effort:** ~2 h (string tokenisation + hard-block banner + override checkbox)

---

### G3 — Missing Indication / Syndrome Category Warning
**What breaks today?**  
Antibiotic courses are routinely saved without a documented clinical indication, making stewardship review and line-list reporting unreliable. The detection pipeline's outbreak-clustering engine also relies on `syndromeCategory`, so undocumented courses are invisible to cluster detection.

**The fix:**  
In `AbtCourseModal.tsx → handleSave()`, if both `indication` and `syndromeCategory` are empty, show a soft-block yellow banner and require confirmation before saving. Additionally surface the banner inline next to the Indication field during form fill-in (computed from state, not only on submit).

**Effort:** ~1 h (state check + inline banner component)

---

### G4 — ABT 14-Day Hard Timeout Escalation
**What breaks today?**  
The detection pipeline fires a LINE\_LIST\_REVIEW at 7 days but there is no further escalation. An antibiotic left active for 14+ days without a clinical reassessment note represents a significant stewardship and QAPI gap, and goes unnoticed by the existing rules.

**The fix:**  
In `detectionPipeline.ts`, add a new rule below the 48–72 h timeout block: if `hoursElapsed >= 336` (14 days) and `abt.status === 'active'`, emit an `ABT_STEWARDSHIP` notification with rule id `abt_14day_timeout_rule` and message *"[Name] has been on [Drug] for ≥14 days with no end date. Escalate to prescribing provider."* Use the same idempotency pattern (date-bucket ID).

**Effort:** ~1 h (one additional `if` block in the pipeline)

---

### G5 — Active IP Event Without Isolation Type
**What breaks today?**  
Infection events with pathogens that require contact/droplet/airborne precautions (MRSA, C. diff, TB, influenza, COVID-19) can remain in the system indefinitely without an isolation type assigned. No alert fires, so the care team may fail to implement precautions.

**The fix:**  
In `detectionPipeline.ts`, iterate active IP events. If `isolationType` is blank and the event has been `active` for > 4 hours, emit a `LINE_LIST_REVIEW` notification with rule id `ip_no_isolation_rule`: *"[Name] has an active [Category] infection but no isolation type is documented. Assign precautions."*

**Effort:** ~1 h (one new loop / rule block in the pipeline)

---

## 3. ENHANCEMENT PRIORITY TABLE

| # | Feature | Clinical Value | Gap / Covered | Min Data Required | Effort |
|---|---------|---------------|---------------|-------------------|--------|
| E1 | Days-of-Therapy (DOT) calculator with benchmark comparison | HIGH | **Gap** — no DOT metric visible anywhere | Active ABTs with `startDate` (already captured) | S (< 1 day) |
| E2 | Vaccination coverage % dashboard tile (residents + staff) | HIGH | Partial — VAX\_GAP alert fires per-resident but no aggregate tile | `vaxEvents` + `staffVaxEvents` (already captured) | S |
| E3 | NHSN surveillance criteria auto-checker (CAUTI, CLABSI, C. diff LabID) | HIGH | **Gap** — no structured criteria engine; only free-text notes | IP events, device flags, organism field (already captured) | M (2–3 days) |
| E4 | Antibiogram summary view (facility-level organism/sensitivity trends) | HIGH | **Gap** — raw culture data exists but is never aggregated | `cultureSource`, `organismIdentified`, `sensitivitySummary` on ABTs | M |
| E5 | Automated weekly QAPI summary email / PDF export | HIGH | Partial — QAPI rollup tab exists but must be manually triggered | Aggregate metrics already computed; needs scheduler/export | M |
| E6 | Line list auto-generation (export active syndromes to CSV/PDF) | MEDIUM | Partial — detection pipeline clusters syndromes but no export path | `infections` + `abts` with syndrome categories | S |
| E7 | Audit corrective-action tracker with due-date follow-up alerts | MEDIUM | Partial — `InfectionControlAuditItem` has `correctiveAction` + `dueDateISO` but no alert fires | Existing audit schema | S |
| E8 | Multi-facility view / consolidated dashboard | MEDIUM | **Gap** — `UnifiedDB` supports multiple facilities but no cross-facility summary UI | `facilities.byId` (already in schema) | L |
| E9 | NHSN export file generation (CSV or XML) | MEDIUM | **Gap** — export profiles exist but no NHSN mapping template | IP events, device events, organism/sensitivity | L |
| E10 | AI-assisted note template selection based on active IP/ABT context | LOW | Partial — Note Generator exists; context is passed manually | Active ABT + IP data | M |

---

## 4. TOP 5 ENHANCEMENTS (HIGHEST CLINICAL VALUE + LOWEST EFFORT)

### E1 — Days-of-Therapy (DOT) Calculator
**Clinical benefit:** DOT per 1 000 patient-days is the standard antibiotic stewardship benchmark required by the Joint Commission and CMS for LTC facilities. Without it, the IC nurse cannot compare prescribing trends month-over-month or against national averages.

**What to build:** A computed value in the Active ABT modal and the Dashboard tile: `DOT = Σ (today − startDate) in days for all active ABTs`. Display a per-resident DOT badge and a facility-level DOT/1 000 resident-days widget on the Dashboard.

**Implementation hint:** Derive DOT inline from `Object.values(store.abts).filter(a => a.status === 'active')` using `startDate`; no schema changes required.

---

### E2 — Vaccination Coverage Dashboard Tile
**Clinical benefit:** Regulators and surveyors ask for current flu, pneumococcal, and COVID-19 coverage percentages at any moment. A real-time dashboard tile eliminates manual tally during surveys.

**What to build:** Two gauge tiles on the Dashboard: *Resident Vax Coverage* and *Staff Vax Coverage*, each showing `given / (given + due + overdue + declined)` per vaccine type with drill-down to the non-compliant list.

**Implementation hint:** Aggregate `store.vaxEvents` grouped by `vaccine` + `status`; render with a simple SVG arc or a Tailwind progress bar; reuse the existing `useNotifications` hook pattern.

---

### E6 — Line List Auto-Generation
**Clinical benefit:** During outbreaks or survey visits, the IC nurse must produce a line list (date, resident, syndrome, isolation status) within minutes. Currently this is a manual process.

**What to build:** A *Generate Line List* button in the Outbreaks and Reports pages that collects all active IP events + recently active ABTs with respiratory/GI/UTI syndromes, de-duplicates by resident, and exports to CSV or prints as a formatted table.

**Implementation hint:** Reuse the existing `generateCSV()` engine in `src/reports/engine.ts` with a pre-built "line list" dataset template; pipe the filtered events through the existing `ExportProfile` path.

---

### E7 — Audit Corrective-Action Follow-Up Alerts
**Clinical benefit:** Non-compliant audit findings with assigned corrective actions and due dates are already captured in `InfectionControlAuditItem`, but nothing fires when a due date passes. Missed corrective actions are a common survey deficiency.

**What to build:** In `detectionPipeline.ts`, add a rule that iterates `store.infectionControlAuditItems` where `response === 'NON_COMPLIANT'` and `dueDateISO` is in the past and `completedAt` is blank; emit a `LINE_LIST_REVIEW` or a new `AUDIT_OVERDUE` category notification.

**Implementation hint:** One new loop + one new `AppNotification` category (`AUDIT_OVERDUE`) added to the union type in `domain/models.ts` and surfaced in `Notifications/index.tsx` filter list.

---

### E3 — NHSN Surveillance Criteria Checker (CAUTI)
**Clinical benefit:** CAUTI is the most frequent HAI deficiency cited in LTC surveys. Having the app automatically check whether an IP event meets the NHSN CAUTI definition (UTI symptoms + device ≥ 2 days) surfaces criteria gaps before a surveyor does.

**What to build:** A *NHSN Criteria* side-panel on `IpEventModal.tsx` for CAUTI and C. diff LabID events. It evaluates the structured fields (device flag, symptom onset, lab result) against a hardcoded NHSN algorithm and shows a ✓ / ✗ / ❓ per criterion.

**Implementation hint:** Create `src/utils/nhsnCriteria.ts` with pure functions `checkCauti(ip, abts, residents)` and `checkCdiffLabId(ip)`; call from the modal and render a checklist panel; no new data capture needed for basic CAUTI.

---

## 5. ARCHITECTURE RISK SUMMARY

- **Single-node, ephemeral storage (HIGH):** All facility data lives in the browser's IndexedDB. A policy-driven cache clear, a browser update, or a hardware failure results in irreversible data loss with no offsite copy. The app must not be used in a real facility without an automatic, encrypted, off-site backup path or a server-side persistence layer.

- **No authentication or role-based access control (HIGH):** The PIN lock screen is the only access barrier and it is entirely client-side. Any user who bypasses or clears the PIN (e.g., via DevTools) gains full read/write access to all PHI. A production deployment requires server-side authentication (OAuth 2.0 / SAML) and per-role data access rules enforced on the API, not the UI.

- **No audit trail for data mutations (MEDIUM):** `updateDB()` applies immer patches but does not record who changed what or when. HIPAA and CMS COPs require an audit log for PHI modifications. A lightweight append-only mutation log (user, timestamp, entity type, entity ID, diff summary) must be added before any regulated use.

- **Unvalidated AI/LLM output rendered as HTML (MEDIUM):** AI-generated note content from the Gemini API is rendered inline. If the API returns HTML or script tags (prompt injection or model hallucination), it could execute in the browser (XSS). All LLM output must be escaped with `textContent` or a sanitisation library before display.

- **No offline-to-server sync or NHSN export path (LOW-for-now, HIGH at scale):** The architecture is intentionally local-first, but regulatory requirements (NHSN reporting, state DoH submissions) demand structured data exports. Building the export pipeline on the existing `ExportProfile` schema is feasible, but the data model should be locked before adding more free-text fields that would require manual mapping later.

---

## 6. ONE-PAGE UPGRADE ROADMAP

### Phase 1 — Now: Guard-Rails + Critical Blockers (Sprint 0)
_Target: safe for internal pilot use with one test facility_

- [x] **G1** Duplicate ABT detection warning (`AbtCourseModal.tsx`)
- [x] **G2** Allergy / ABT conflict check with override (`AbtCourseModal.tsx`)
- [x] **G3** Missing indication soft-block banner (`AbtCourseModal.tsx`)
- [x] **G4** 14-day ABT stewardship escalation rule (`detectionPipeline.ts`)
- [x] **G5** Active IP event without isolation type alert (`detectionPipeline.ts`)
- [x] **G7** Enforce daily auto-backup with "last backup" header badge
- [x] **G8** Lightweight mutation audit log (user, action, entity, timestamp)
- [x] **G9** Sanitise freetext before Gemini prompt construction

### Phase 2 — Next 30 Days: High-Value Clinical Enhancements
_Target: useful for daily IC workflow without manual spreadsheets_

- [x] **E1** Days-of-Therapy calculator + Dashboard DOT tile
- [x] **E2** Vaccination coverage dashboard gauges (resident + staff)
- [x] **E6** Line list auto-generation (CSV/print) from active IP events
- [x] **E7** Audit corrective-action overdue alert in detection pipeline
- [ ] Flu/COVID-19 season dashboard banner with coverage %
- [ ] DOT trend chart (rolling 30-day) in Reports → Analytics tab

### Phase 3 — 60–90 Days: Architecture Hardening + Multi-Facility
_Target: compliant with HIPAA technical safeguards and CMS CoP documentation requirements_

- [ ] **G6** Role-based access control (Viewer / Nurse / IC Lead / Admin)
- [ ] **G10** Census import collision detection and diff confirmation
- [ ] **E3** NHSN CAUTI / C. diff criteria checker in IP event modal
- [ ] **E4** Antibiogram summary view (organism/sensitivity trends)
- [ ] **E8** Multi-facility consolidated dashboard
- [ ] Server-side auth (OAuth 2.0 or local LDAP) + session tokens
- [ ] Encrypted automatic daily backup to configurable remote endpoint

### Phase 4 — Future: Backend Sync + NHSN Export + AI Proxy
_Target: production-grade, survey-ready, reportable to state health departments_

- [ ] **E9** NHSN CSV/XML export with pre-built mapping templates
- [ ] **E5** Scheduled QAPI summary email/PDF with configurable recipients
- [ ] **E10** AI-assisted note template pre-population from active context
- [ ] Server-side SQLite → PostgreSQL migration for multi-user concurrency
- [ ] AI proxy layer (server-side Gemini calls to protect API key; rate limiting; output sanitisation)
- [ ] HL7 FHIR R4 ADT feed connector for real-time admission/discharge/transfer sync
- [ ] State DoH electronic reporting adapter (facility-configurable endpoint mapping)
