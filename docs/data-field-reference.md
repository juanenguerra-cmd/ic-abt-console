# Data Field Reference Library — IC-ABT Console

> **Canonical source of truth for types:** `src/domain/models.ts`
> **Storage layer:** `src/storage/engine.ts` → IndexedDB (`UNIFIED_DB` key) with localStorage fallback
> **Schema version:** `UNIFIED_DB_V2`

---

## How to Use This Reference

This document catalogues **every persisted data field** in the IC-ABT Console. Use it to:

- **Developers** — Understand field purpose, constraints, and storage location before modifying or extending the schema.
- **IC Nurses / Admins** — Trace where a value entered in the UI ends up and which reports consume it.
- **QA / Auditors** — Verify that data shown in reports matches the canonical stored value.

### Reading the Tables

| Column | Meaning |
|---|---|
| **Field** | Property name exactly as it appears in `src/domain/models.ts` |
| **Type** | TypeScript / runtime type (`string`, `number`, `boolean`, `ISO` = ISO-8601 string, `enum(…)`, `object`, `array`) |
| **Req** | **R** = required, **O** = optional |
| **Default** | Value assumed when absent; "—" = none |
| **UI Location** | Screen / modal / page where the field is entered or displayed |
| **Purpose** | Clinical or workflow meaning |
| **Source of Truth** | Where the value is authoritative |
| **Join / Linkage** | Foreign-key or cross-entity linkage role |
| **Stored At** | Path inside `UnifiedDB.data.facilityData[fid].*` |
| **Used By** | Reports, alerts, analytics, rules, or components that consume this field |
| **Validation** | Required enums, date constraints, referential integrity |
| **Deprecated?** | N = current; Y = deprecated (replacement + fallback noted) |
| **Notes** | Edge cases, backward-compat, special behavior |

---

## Table of Contents

1. [Resident](#1-resident)
2. [QuarantineResident](#2-quarantineresident)
3. [ABTCourse](#3-abtcourse)
4. [IPEvent](#4-ipevent)
5. [VaxEvent](#5-vaxevent)
6. [ResidentNote](#6-residentnote)
7. [Staff](#7-staff)
8. [StaffVaxEvent](#8-staffvaxevent)
9. [FitTestEvent](#9-fittestevent)
10. [Outbreak](#10-outbreak)
11. [OutbreakCase](#11-outbreakcase)
12. [OutbreakExposure](#12-outbreakexposure)
13. [OutbreakDailyStatus](#13-outbreakdailystatus)
14. [AuditSession](#14-auditsession)
15. [InfectionControlAuditSession](#15-infectioncontrolauditsession)
16. [InfectionControlAuditItem](#16-infectioncontrolaudititem)
17. [LineListEvent](#17-linelistevent)
18. [AppNotification](#18-appnotification)
19. [ShiftLogEntry](#19-shiftlogentry)
20. [MutationLogEntry](#20-mutationlogentry)
21. [ExportProfile](#21-exportprofile)
22. [SurveyPacket](#22-surveypacket)
23. [Facility, Unit, FloorLayout, FloorRoom](#23-facility-unit-floorlayout-floorroom)
24. [Event Contract](#event-contract)
25. [Coverage & Parity](#coverage--parity)
26. [Developer Checklist](#developer-checklist)
27. [Critical Field Examples](#critical-field-examples)

---

## 1) Resident

**Storage path:** `facilityStore.residents[mrn]`

| Field | Type | Req | Default | UI Location | Purpose | Source of Truth | Join / Linkage | Stored At | Used By | Validation | Deprecated? | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mrn | string | R | — | Resident Board, Census Import | Medical Record Number; primary resident identifier | Census / ADT feed | **Primary key**; used by `ResidentRef { kind:"mrn" }` across all events | `residents[mrn]` | All resident-linked events, reports, dashboard | Must be unique within facility | N | Also used as the Record key in the store |
| displayName | string | R | — | Resident Board card, Profile modal | Human-readable name shown in UI | Census / manual entry | — | `residents[mrn]` | Dashboard, Reports, Shift Report, Print forms | Non-empty string | N | |
| firstName | string | O | — | Resident Profile modal | Given name (parsed) | Census / manual | — | `residents[mrn]` | Note Generator, Print forms | — | N | |
| lastName | string | O | — | Resident Profile modal | Family name (parsed) | Census / manual | — | `residents[mrn]` | Note Generator, Print forms | — | N | |
| dob | string | O | — | Resident Profile modal | Date of birth | Census / manual | — | `residents[mrn]` | Age calculation, Print forms | ISO date or date string | N | |
| sex | string | O | — | Resident Profile modal | Biological sex | Census / manual | — | `residents[mrn]` | Print forms, clinical context | — | N | |
| admissionDate | string | O | — | Resident Board, Profile modal | Date of facility admission | Census / manual | — | `residents[mrn]` | Admission Screening alerts, Reports | Date string | N | |
| attendingMD | string | O | — | Resident Profile modal | Current attending physician | Census / manual | — | `residents[mrn]` | Print forms, Shift Report | — | N | |
| currentUnit | string | O | — | Resident Board filter, Profile | Current unit assignment | Census / manual | Links to Facility.units | `residents[mrn]` | Dashboard, Heatmap, Reports, Notifications | — | N | |
| currentRoom | string | O | — | Resident Board, Profile modal | Current room assignment | Census / manual | — | `residents[mrn]` | Dashboard, Heatmap, Notifications | — | N | |
| status | enum | O | — | Resident Board, Profile modal | Active / Discharged / Deceased | Census / manual | — | `residents[mrn]` | Resident Board filtering, Reports | `"Active" \| "Discharged" \| "Deceased"` | N | |
| payor | string | O | — | Profile modal | Insurance / payment source | Census / manual | — | `residents[mrn]` | Reports | — | N | |
| primaryDiagnosis | string | O | — | Profile modal | Primary diagnosis code or short label | Census / manual | — | `residents[mrn]` | Clinical context | — | N | |
| primaryDiagnosisText | string | O | — | Profile modal | Extended free-text primary diagnosis | Census / ADT import | — | `residents[mrn]` | Clinical context, Notes | — | N | |
| cognitiveStatus | enum | O | — | Profile modal | Cognitive function level | Manual entry | — | `residents[mrn]` | Clinical context | `"Intact" \| "Mildly Impaired" \| "Severely Impaired" \| "Unknown"` | N | |
| allergies | string[] | O | — | Profile modal | Known allergies | Manual entry | — | `residents[mrn]` | ABT prescribing context, Print forms | Array of strings | N | |
| identityAliases | Alias[] | O | — | Profile modal, Back Office | Legacy name / ID aliases for matching | Census, legacy import | — | `residents[mrn]` | Quarantine resolution, dedup | Each Alias: `{ source, legacyId?, name?, dob? }` | N | |
| createdAt | ISO | R | — | — | Record creation timestamp | System-generated | — | `residents[mrn]` | Audit log | ISO-8601 | N | |
| updatedAt | ISO | R | — | — | Last modification timestamp | System-generated | — | `residents[mrn]` | Audit log, sync | ISO-8601 | N | |
| isHistorical | boolean | O | false | Back Office | Marks record as historical import | Back Office import | — | `residents[mrn]` | Resident Board display (Historical tag) | — | N | |
| backOfficeOnly | boolean | O | false | Back Office | Record originated from Back Office | Back Office import | — | `residents[mrn]` | Resident Board display (Historical tag) | — | N | |
| historicalSource | enum | O | — | Back Office | How the historical record was created | Back Office import | — | `residents[mrn]` | Import tracking | `"manual" \| "csv_import" \| "csv-import"` | N | `csv-import` is legacy hyphenated form; prefer `csv_import` |
| lastKnownUnit | string | O | — | — | Last unit before discharge / deactivation | System snapshot | — | `residents[mrn]` | Historical context | — | N | |
| lastKnownRoom | string | O | — | — | Last room before discharge / deactivation | System snapshot | — | `residents[mrn]` | Historical context | — | N | |
| lastKnownAttendingMD | string | O | — | — | Last attending before discharge / deactivation | System snapshot | — | `residents[mrn]` | Historical context | — | N | |
| dischargedAt | ISO | O | — | Resident Board | Discharge timestamp | Census / manual | — | `residents[mrn]` | Reports, filtering | ISO-8601 | N | |
| lastSeenOnCensusAt | ISO | O | — | — | Last census file where resident appeared | Census import | — | `residents[mrn]` | Deactivation logic | ISO-8601 | N | |
| deactivatedAt | ISO | O | — | — | Soft-delete from active census timestamp | System-generated | — | `residents[mrn]` | Census reconciliation | ISO-8601 | N | Set when removed from census without explicit discharge |
| dischargeReason | string | O | — | Resident Board | Reason for discharge | Manual entry | — | `residents[mrn]` | Reports | — | N | |
| deactivationSnapshot | object | O | — | — | Location/MD at deactivation time | System snapshot | — | `residents[mrn]` | Audit trail | `{ unit, room, attendingMD, admissionDate }` | N | |

---

## 2) QuarantineResident

**Storage path:** `facilityStore.quarantine[tempId]`

| Field | Type | Req | Default | UI Location | Purpose | Source of Truth | Join / Linkage | Stored At | Used By | Validation | Deprecated? | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| tempId | string | R | — | Quarantine Inbox | Temporary ID; **must** start with `Q:` | System-generated | **Primary key**; used by `ResidentRef { kind:"quarantine" }` | `quarantine[tempId]` | Quarantine resolution workflow | Pattern: `Q:<uuid>` | N | Commit gate validates Q: prefix |
| displayName | string | O | — | Quarantine Inbox | Name as imported or entered | Import / manual | — | `quarantine[tempId]` | Quarantine Inbox display | — | N | |
| dob | string | O | — | Quarantine Inbox | Date of birth | Import / manual | — | `quarantine[tempId]` | Matching heuristics | — | N | |
| unitSnapshot | string | O | — | Quarantine Inbox | Unit at time of import | Import | — | `quarantine[tempId]` | Context for resolution | — | N | |
| roomSnapshot | string | O | — | Quarantine Inbox | Room at time of import | Import | — | `quarantine[tempId]` | Context for resolution | — | N | |
| source | enum | R | — | Quarantine Inbox | How the quarantine record was created | System | — | `quarantine[tempId]` | Workflow routing | `"legacy_import" \| "census_missing_mrn" \| "manual_entry"` | N | |
| rawHint | string | O | — | Quarantine Inbox | Raw text hint from import for matching | Import | — | `quarantine[tempId]` | Matching heuristics | — | N | |
| createdAt | ISO | R | — | — | Record creation timestamp | System-generated | — | `quarantine[tempId]` | Audit | ISO-8601 | N | |
| updatedAt | ISO | R | — | — | Last modification timestamp | System-generated | — | `quarantine[tempId]` | Audit | ISO-8601 | N | |
| resolvedToMrn | string | O | — | Quarantine Inbox | MRN this record was resolved to | User action | Links to `residents[mrn]` | `quarantine[tempId]` | Resolution tracking | Must match existing resident MRN | N | |

---

## 3) ABTCourse

**Storage path:** `facilityStore.abts[id]`

| Field | Type | Req | Default | UI Location | Purpose | Source of Truth | Join / Linkage | Stored At | Used By | Validation | Deprecated? | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| id | string | R | — | — | Unique course identifier | System-generated (uuid) | **Primary key** | `abts[id]` | All ABT references | UUID | N | |
| residentRef | ResidentRef | R | — | ABT Course Modal | Links course to resident | User selection | `residentRef.id` → `residents[mrn]` or `quarantine[tempId]` | `abts[id]` | Resident Board, Reports, Stewardship alerts | Commit gate validates referential integrity | N | |
| status | enum | R | — | ABT Course Modal | Course lifecycle state | User entry | — | `abts[id]` | Dashboard counts, Reports | `"active" \| "completed" \| "discontinued"` | N | |
| medication | string | R | — | ABT Course Modal | Antibiotic medication name | User entry | — | `abts[id]` | Antibiogram, Reports, Stewardship alerts | Non-empty | N | |
| medicationClass | string | O | — | ABT Course Modal | Drug class (e.g., fluoroquinolone) | User entry | — | `abts[id]` | Antibiogram, Reports | — | N | |
| dose | string | O | — | ABT Course Modal | Dose amount | User entry | — | `abts[id]` | Clinical context | — | N | |
| route | string | O | — | ABT Course Modal | Administration route (PO, IV, etc.) | User entry | — | `abts[id]` | Reports | — | N | |
| frequency | string | O | — | ABT Course Modal | Dosing frequency | User entry | — | `abts[id]` | Clinical context | — | N | |
| indication | string | O | — | ABT Course Modal | Clinical indication for prescribing | User entry | — | `abts[id]` | Stewardship analytics | — | N | |
| infectionSource | string | O | — | ABT Course Modal | Source of infection | User entry | — | `abts[id]` | Reports | — | N | |
| syndromeCategory | string | O | — | ABT Course Modal | Syndrome grouping | User entry | — | `abts[id]` | Reports, Line List detection | — | N | |
| startDate | string | O | — | ABT Course Modal | Course start date | User entry | — | `abts[id]` | Duration calculations, Reports | Date string | N | |
| endDate | string | O | — | ABT Course Modal | Course end date | User entry | — | `abts[id]` | Duration calculations, Reports | Date string | N | |
| cultureCollected | boolean | O | — | ABT Course Modal | Whether culture was collected | User entry | — | `abts[id]` | Stewardship metrics | — | N | |
| cultureCollectionDate | string | O | — | ABT Course Modal | Date culture collected | User entry | — | `abts[id]` | Stewardship timeline | Date string | N | |
| cultureSource | string | O | — | ABT Course Modal | Specimen source (urine, blood, etc.) | User entry | — | `abts[id]` | Reports | — | N | |
| organismIdentified | string | O | — | ABT Course Modal | Organism from culture | User entry | — | `abts[id]` | Antibiogram, Reports | — | N | |
| sensitivitySummary | string | O | — | ABT Course Modal | Sensitivity/resistance summary | User entry | — | `abts[id]` | Antibiogram | — | N | |
| diagnostics | object | O | — | ABT Course Modal | Free-form diagnostics data | User entry | — | `abts[id]` | Extended clinical context | — | N | Untyped object; future schema may tighten |
| locationSnapshot | object | O | — | — | Unit/room/MD at record creation | System snapshot | — | `abts[id]` | Audit trail | `{ unit?, room?, attendingMD?, capturedAt? }` | N | |
| prescriber | string | O | — | ABT Course Modal | Prescribing physician | User entry | — | `abts[id]` | Stewardship analytics | — | N | |
| notes | string | O | — | ABT Course Modal | Free-text notes | User entry | — | `abts[id]` | Clinical context | — | N | |
| createdAt | ISO | R | — | — | Record creation timestamp | System-generated | — | `abts[id]` | Audit log | ISO-8601 | N | |
| updatedAt | ISO | R | — | — | Last modification timestamp | System-generated | — | `abts[id]` | Audit log | ISO-8601 | N | |

---

## 4) IPEvent

**Storage path:** `facilityStore.infections[id]`

| Field | Type | Req | Default | UI Location | Purpose | Source of Truth | Join / Linkage | Stored At | Used By | Validation | Deprecated? | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| id | string | R | — | — | Unique event identifier | System-generated (uuid) | **Primary key** | `infections[id]` | All IP event references | UUID | N | |
| residentRef | ResidentRef | R | — | IP Event Modal | Links event to resident | User selection | `residentRef.id` → `residents[mrn]` or `quarantine[tempId]` | `infections[id]` | Resident Board, Reports, Dashboard | Commit gate validates | N | |
| status | enum | R | — | IP Event Modal | Event lifecycle state | User entry | — | `infections[id]` | Dashboard counts, Reports | `"active" \| "resolved" \| "historical"` | N | |
| onsetDate | string | O | — | IP Event Modal | Infection onset date | User entry | — | `infections[id]` | NHSN criteria, Reports, Timeline | Date string | N | |
| infectionCategory | string | O | — | IP Event Modal | Infection type (UTI, Pneumonia, etc.) | User entry | — | `infections[id]` | NHSN criteria, Reports, Dashboard | Free text; UI provides standard options | N | |
| infectionSite | string | O | — | IP Event Modal | Anatomical infection site | User entry | — | `infections[id]` | Reports | — | N | |
| sourceOfInfection | string | O | — | IP Event Modal | Community vs. healthcare-acquired | User entry | — | `infections[id]` | Reports | — | N | |
| isolationType | string | O | — | IP Event Modal | Isolation precaution type | User entry | — | `infections[id]` | Dashboard, Heatmap, Reports | — | N | May contain comma-separated values |
| ebp | boolean | O | — | IP Event Modal | Evidence-based practice indicator | User entry | — | `infections[id]` | Audit compliance | — | N | |
| organism | string | O | — | IP Event Modal | Identified organism(s) | User entry | — | `infections[id]` | NHSN C. diff check, Reports | — | N | May contain comma-separated tags |
| specimenCollectedDate | string | O | — | IP Event Modal | Specimen collection date | User entry | — | `infections[id]` | NHSN criteria, Reports | Date string | N | |
| labResultDate | string | O | — | IP Event Modal | Lab result date | User entry | — | `infections[id]` | NHSN criteria, Reports | Date string | N | |
| outbreakId | string | O | — | IP Event Modal | Associated outbreak | User selection | Links to `outbreaks[id]` | `infections[id]` | Outbreak reporting | Must match existing outbreak ID | N | |
| locationSnapshot | object | O | — | — | Unit/room/MD at record creation | System snapshot | — | `infections[id]` | Audit trail | `{ unit?, room?, attendingMD?, capturedAt? }` | N | |
| notes | string | O | — | IP Event Modal | Free-text notes | User entry | — | `infections[id]` | Clinical context, Line List detection | — | N | |
| createdAt | ISO | R | — | — | Record creation timestamp | System-generated | — | `infections[id]` | Audit log | ISO-8601 | N | |
| updatedAt | ISO | R | — | — | Last modification timestamp | System-generated | — | `infections[id]` | Audit log | ISO-8601 | N | |
| resolvedAt | ISO | O | — | IP Event Modal | Resolution timestamp | User action | — | `infections[id]` | Reports, Dashboard | ISO-8601 | N | |
| deviceTypes | string[] | O | — | IP Event Modal | Device types present at onset | User entry | — | `infections[id]` | NHSN CAUTI check, Device Link notifications | Array of strings | N | Stored top-level for NHSN checker |
| nhsnCautiMet | boolean \| null | O | — | IP Event Modal (NHSN panel) | NHSN LTC CAUTI surveillance verdict | System-calculated on save | — | `infections[id]` | NHSN reports | — | N | Persisted on save; `null` = not evaluated |
| nhsnCdiffLabIdMet | boolean \| null | O | — | IP Event Modal (NHSN panel) | NHSN LTC C. diff LabID verdict | System-calculated on save | — | `infections[id]` | NHSN reports | — | N | Persisted on save; `null` = not evaluated |

---

## 5) VaxEvent

**Storage path:** `facilityStore.vaxEvents[id]`

| Field | Type | Req | Default | UI Location | Purpose | Source of Truth | Join / Linkage | Stored At | Used By | Validation | Deprecated? | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| id | string | R | — | — | Unique event identifier | System-generated (uuid) | **Primary key** | `vaxEvents[id]` | All vax references | UUID | N | |
| residentRef | ResidentRef | R | — | Vax Event Modal | Links event to resident | User selection | `residentRef.id` → `residents[mrn]` or `quarantine[tempId]` | `vaxEvents[id]` | Resident Board, Reports, Vax Gap alerts | Commit gate validates | N | |
| vaccine | string | R | — | Vax Event Modal | Vaccine name | User entry | — | `vaxEvents[id]` | Reports, Vax compliance | Non-empty | N | |
| status | enum | R | — | Vax Event Modal | Vaccination status | User entry | — | `vaxEvents[id]` | Dashboard, Reports, Vax Gap alerts | `"given" \| "due" \| "overdue" \| "declined" \| "scheduled" \| "contraindicated" \| "documented-historical"` | N | |
| administeredDate | string | O | — | — | Date vaccine was administered | User entry | — | `vaxEvents[id]` | — | Date string | **Y** → use `dateGiven` | **Deprecated.** Readers: prefer `dateGiven ?? administeredDate` |
| dateGiven | string | O | — | Vax Event Modal | Date vaccine was given | User entry | — | `vaxEvents[id]` | Reports, Timeline | Date string | N | Canonical date field; replaces `administeredDate` |
| dose | enum | O | — | Vax Event Modal | Dose number in series | User entry | — | `vaxEvents[id]` | Reports | `"1st" \| "2nd" \| "Booster" \| "Single"` | N | |
| lotNumber | string | O | — | Vax Event Modal | Vaccine lot number | User entry | — | `vaxEvents[id]` | Compliance documentation | — | N | |
| administeredBy | string | O | — | Vax Event Modal | Person who administered vaccine | User entry | — | `vaxEvents[id]` | Compliance documentation | — | N | |
| administrationSite | enum | O | — | Vax Event Modal | Where vaccine was administered | User entry | — | `vaxEvents[id]` | Reports | `"In-House" \| "Outside Provider" \| "Other"` | N | |
| source | enum | O | — | Vax Event Modal | Record origin | System / user | — | `vaxEvents[id]` | Import tracking | `"manual-historical" \| "csv-import" \| "in-app"` | N | |
| dueDate | string | O | — | Vax Event Modal | Next due date | User entry | — | `vaxEvents[id]` | Vax Gap alerts, Reports | Date string | N | |
| offerDate | string | O | — | Vax Event Modal | Date vaccine was offered | User entry | — | `vaxEvents[id]` | Vax Reoffer alerts | Date string | N | |
| declineReason | string | O | — | Vax Event Modal | Reason for decline | User entry | — | `vaxEvents[id]` | Compliance documentation | — | N | |
| locationSnapshot | object | O | — | — | Unit/room/MD at record creation | System snapshot | — | `vaxEvents[id]` | Audit trail | `{ unit?, room?, attendingMD?, capturedAt? }` | N | |
| notes | string | O | — | Vax Event Modal | Free-text notes | User entry | — | `vaxEvents[id]` | Clinical context | — | N | |
| createdAt | ISO | R | — | — | Record creation timestamp | System-generated | — | `vaxEvents[id]` | Audit log | ISO-8601 | N | |
| updatedAt | ISO | R | — | — | Last modification timestamp | System-generated | — | `vaxEvents[id]` | Audit log | ISO-8601 | N | |

---

## 6) ResidentNote

**Storage path:** `facilityStore.notes[id]`

| Field | Type | Req | Default | UI Location | Purpose | Source of Truth | Join / Linkage | Stored At | Used By | Validation | Deprecated? | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| id | string | R | — | — | Unique note identifier | System-generated (uuid) | **Primary key** | `notes[id]` | Note references | UUID | N | |
| residentRef | ResidentRef | R | — | Note Generator | Links note to resident | User selection | `residentRef.id` → `residents[mrn]` or `quarantine[tempId]` | `notes[id]` | Resident Board, Notifications | Commit gate validates; legacy notes may have undefined ref | N | Legacy guard: older notes may lack ref |
| noteType | string | R | — | Note Generator | Category of note (e.g., ABT_STEWARDSHIP) | User / system | — | `notes[id]` | Note filtering | Non-empty | N | |
| title | string | O | — | Note Generator | Note title | User / system | — | `notes[id]` | Display | — | N | |
| body | string | R | — | Note Generator | Note content | User / AI-generated | — | `notes[id]` | Clinical documentation | Non-empty | N | |
| derived | boolean | O | — | — | Whether note was AI-generated | System | — | `notes[id]` | AI note tracking | — | N | |
| generator | object | O | — | — | AI generator metadata | System | — | `notes[id]` | Version tracking | `{ name: string, version: string }` | N | |
| createdAt | ISO | R | — | — | Record creation timestamp | System-generated | — | `notes[id]` | Audit log | ISO-8601 | N | |
| updatedAt | ISO | R | — | — | Last modification timestamp | System-generated | — | `notes[id]` | Audit log | ISO-8601 | N | |

---

## 7) Staff

**Storage path:** `facilityStore.staff[id]`

| Field | Type | Req | Default | UI Location | Purpose | Source of Truth | Join / Linkage | Stored At | Used By | Validation | Deprecated? | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| id | string | R | — | — | Unique staff identifier | System-generated (uuid) | **Primary key**; referenced by `StaffVaxEvent.staffId`, `FitTestEvent.staffId` | `staff[id]` | Staff Vax, Fit Test | UUID | N | |
| facilityId | string | R | — | — | Owning facility | System | Links to `facilities.byId[facilityId]` | `staff[id]` | Multi-facility scoping | Must match outer facility store key | N | |
| displayName | string | R | — | Staff page | Human-readable name | User entry | — | `staff[id]` | Staff listing, Reports | Non-empty | N | |
| firstName | string | O | — | Staff page | Given name | User entry | — | `staff[id]` | Display | — | N | |
| lastName | string | O | — | Staff page | Family name | User entry | — | `staff[id]` | Display | — | N | |
| employeeId | string | O | — | Staff page | External HR / payroll identifier | User entry | — | `staff[id]` | External system linkage | — | N | |
| role | string | O | — | Staff page | Staff role / title | User entry | — | `staff[id]` | Reports | — | N | |
| department | string | O | — | Staff page | Department assignment | User entry | — | `staff[id]` | Reports | — | N | |
| status | enum | R | — | Staff page | Active / inactive | User entry | — | `staff[id]` | Staff filtering | `"active" \| "inactive"` | N | |
| hireDate | string | O | — | Staff page | Hire date | User entry | — | `staff[id]` | Reports | Date string | N | |
| terminationDate | string | O | — | Staff page | Termination date | User entry | — | `staff[id]` | Reports | Date string | N | |
| createdAt | ISO | R | — | — | Record creation timestamp | System-generated | — | `staff[id]` | Audit log | ISO-8601 | N | |
| updatedAt | ISO | R | — | — | Last modification timestamp | System-generated | — | `staff[id]` | Audit log | ISO-8601 | N | |

---

## 8) StaffVaxEvent

**Storage path:** `facilityStore.staffVaxEvents[id]`

| Field | Type | Req | Default | UI Location | Purpose | Source of Truth | Join / Linkage | Stored At | Used By | Validation | Deprecated? | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| id | string | R | — | — | Unique event identifier | System-generated (uuid) | **Primary key** | `staffVaxEvents[id]` | Staff vax references | UUID | N | |
| staffId | string | R | — | Staff Vax modal | Links to staff member | User selection | Links to `staff[staffId]` | `staffVaxEvents[id]` | Staff compliance | Must match existing staff ID | N | |
| vaccine | string | R | — | Staff Vax modal | Vaccine name | User entry | — | `staffVaxEvents[id]` | Reports | Non-empty | N | |
| status | enum | R | — | Staff Vax modal | Vaccination status | User entry | — | `staffVaxEvents[id]` | Staff compliance | `"given" \| "due" \| "overdue" \| "declined" \| "scheduled" \| "contraindicated"` | N | |
| dateGiven | string | O | — | Staff Vax modal | Date vaccine was given | User entry | — | `staffVaxEvents[id]` | Reports | Date string | N | |
| dueDate | string | O | — | Staff Vax modal | Next due date | User entry | — | `staffVaxEvents[id]` | Compliance alerts | Date string | N | |
| offerDate | string | O | — | Staff Vax modal | Date vaccine was offered | User entry | — | `staffVaxEvents[id]` | Compliance | Date string | N | |
| declineReason | string | O | — | Staff Vax modal | Reason for decline | User entry | — | `staffVaxEvents[id]` | Compliance | — | N | |
| notes | string | O | — | Staff Vax modal | Free-text notes | User entry | — | `staffVaxEvents[id]` | Clinical context | — | N | |
| createdAt | ISO | R | — | — | Record creation timestamp | System-generated | — | `staffVaxEvents[id]` | Audit log | ISO-8601 | N | |
| updatedAt | ISO | R | — | — | Last modification timestamp | System-generated | — | `staffVaxEvents[id]` | Audit log | ISO-8601 | N | |

---

## 9) FitTestEvent

**Storage path:** `facilityStore.fitTestEvents[id]`

| Field | Type | Req | Default | UI Location | Purpose | Source of Truth | Join / Linkage | Stored At | Used By | Validation | Deprecated? | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| id | string | R | — | — | Unique event identifier | System-generated (uuid) | **Primary key** | `fitTestEvents[id]` | Fit test references | UUID | N | |
| staffId | string | R | — | Staff Fit Test modal | Links to staff member | User selection | Links to `staff[staffId]` | `fitTestEvents[id]` | Staff compliance | Must match existing staff ID | N | |
| date | string | R | — | Staff Fit Test modal | Canonical fit test date | User entry | — | `fitTestEvents[id]` | Reports, Compliance | Date string | N | Readers: prefer `date ?? fitTestDate` |
| maskType | string | R | — | Staff Fit Test modal | Type of mask tested | User entry | — | `fitTestEvents[id]` | Reports | Non-empty | N | |
| maskSize | string | R | — | Staff Fit Test modal | Mask size | User entry | — | `fitTestEvents[id]` | Reports | Non-empty | N | |
| passed | boolean | R | — | Staff Fit Test modal | Whether test was passed | User entry | — | `fitTestEvents[id]` | Compliance tracking | — | N | |
| nextDueDate | string | R | — | Staff Fit Test modal | Next fit test due date | User entry | — | `fitTestEvents[id]` | Compliance alerts | Date string | N | |
| fitTestDate | string | O | — | — | Original date field | — | — | `fitTestEvents[id]` | — | Date string | **Y** → use `date` | **Deprecated.** Kept for backward compat with original schema |
| respiratorType | string | O | — | Staff Fit Test modal | Respirator type | User entry | — | `fitTestEvents[id]` | Reports | — | N | |
| model | string | O | — | Staff Fit Test modal | Respirator model | User entry | — | `fitTestEvents[id]` | Reports | — | N | |
| method | string | O | — | Staff Fit Test modal | Test method | User entry | — | `fitTestEvents[id]` | Reports | — | N | |
| result | string | O | — | Staff Fit Test modal | Test result details | User entry | — | `fitTestEvents[id]` | Reports | — | N | |
| notes | string | O | — | Staff Fit Test modal | Free-text notes | User entry | — | `fitTestEvents[id]` | Clinical context | — | N | |
| createdAt | ISO | R | — | — | Record creation timestamp | System-generated | — | `fitTestEvents[id]` | Audit log | ISO-8601 | N | |
| updatedAt | ISO | R | — | — | Last modification timestamp | System-generated | — | `fitTestEvents[id]` | Audit log | ISO-8601 | N | |

---

## 10) Outbreak

**Storage path:** `facilityStore.outbreaks[id]`

| Field | Type | Req | Default | UI Location | Purpose | Source of Truth | Join / Linkage | Stored At | Used By | Validation | Deprecated? | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| id | string | R | — | — | Unique outbreak identifier | System-generated (uuid) | **Primary key**; referenced by `OutbreakCase.outbreakId`, `OutbreakExposure.outbreakId`, `OutbreakDailyStatus.outbreakId`, `IPEvent.outbreakId` | `outbreaks[id]` | Outbreak cases, exposures, daily statuses, IP events | UUID | N | |
| facilityId | string | R | — | — | Owning facility | System | Links to `facilities.byId[facilityId]` | `outbreaks[id]` | Multi-facility scoping | Commit gate: must match outer store key | N | |
| title | string | R | — | Outbreaks page | Outbreak name / title | User entry | — | `outbreaks[id]` | Display, Reports | Non-empty | N | |
| pathogen | string | O | — | Outbreaks page | Causative pathogen | User entry | — | `outbreaks[id]` | Reports | — | N | |
| syndromeCategory | string | O | — | Outbreaks page | Syndrome grouping | User entry | — | `outbreaks[id]` | Reports | — | N | |
| startDate | string | R | — | Outbreaks page | Outbreak start date | User entry | — | `outbreaks[id]` | Timeline, Reports | Date string | N | |
| endDate | string | O | — | Outbreaks page | Outbreak end date | User entry | — | `outbreaks[id]` | Timeline, Reports | Date string | N | |
| status | enum | R | — | Outbreaks page | Outbreak lifecycle state | User entry | — | `outbreaks[id]` | Dashboard, Reports | `"suspected" \| "confirmed" \| "contained" \| "closed"` | N | |
| caseDefinition | string | O | — | Outbreaks page | Clinical case definition | User entry | — | `outbreaks[id]` | Reference | — | N | |
| notes | string | O | — | Outbreaks page | Free-text notes | User entry | — | `outbreaks[id]` | Clinical context | — | N | |
| createdAt | ISO | R | — | — | Record creation timestamp | System-generated | — | `outbreaks[id]` | Audit log | ISO-8601 | N | |
| updatedAt | ISO | R | — | — | Last modification timestamp | System-generated | — | `outbreaks[id]` | Audit log | ISO-8601 | N | |

---

## 11) OutbreakCase

**Storage path:** `facilityStore.outbreakCases[id]`

| Field | Type | Req | Default | UI Location | Purpose | Source of Truth | Join / Linkage | Stored At | Used By | Validation | Deprecated? | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| id | string | R | — | — | Unique case identifier | System-generated (uuid) | **Primary key** | `outbreakCases[id]` | Case references | UUID | N | |
| outbreakId | string | R | — | Outbreaks page | Parent outbreak | User selection | Links to `outbreaks[outbreakId]` | `outbreakCases[id]` | Outbreak reporting | Must match existing outbreak ID | N | |
| residentRef | ResidentRef | R | — | Outbreaks page | Links case to resident | User selection | `residentRef.id` → `residents[mrn]` or `quarantine[tempId]` | `outbreakCases[id]` | Outbreak reporting | Commit gate validates | N | |
| caseStatus | enum | R | — | Outbreaks page | Case classification | User entry | — | `outbreakCases[id]` | Outbreak counts, Reports | `"probable" \| "confirmed" \| "ruled_out"` | N | |
| symptomOnsetDate | string | O | — | Outbreaks page | Symptom onset date | User entry | — | `outbreakCases[id]` | Epi curve, Reports | Date string | N | |
| specimenCollectedDate | string | O | — | Outbreaks page | Specimen collection date | User entry | — | `outbreakCases[id]` | Reports | Date string | N | |
| labResultDate | string | O | — | Outbreaks page | Lab result date | User entry | — | `outbreakCases[id]` | Reports | Date string | N | |
| result | string | O | — | Outbreaks page | Lab result | User entry | — | `outbreakCases[id]` | Reports | — | N | |
| locationSnapshot | object | O | — | — | Unit/room at time of case | System snapshot | — | `outbreakCases[id]` | Epi context | `{ unit?, room? }` | N | Simpler than other locationSnapshots (no MD) |
| linkedIpEventId | string | O | — | Outbreaks page | Associated IP event | User / system | Links to `infections[linkedIpEventId]` | `outbreakCases[id]` | Cross-reference | Must match existing IP event ID | N | |
| createdAt | ISO | R | — | — | Record creation timestamp | System-generated | — | `outbreakCases[id]` | Audit log | ISO-8601 | N | |
| updatedAt | ISO | R | — | — | Last modification timestamp | System-generated | — | `outbreakCases[id]` | Audit log | ISO-8601 | N | |

---

## 12) OutbreakExposure

**Storage path:** `facilityStore.outbreakExposures[id]`

| Field | Type | Req | Default | UI Location | Purpose | Source of Truth | Join / Linkage | Stored At | Used By | Validation | Deprecated? | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| id | string | R | — | — | Unique exposure identifier | System-generated (uuid) | **Primary key** | `outbreakExposures[id]` | Exposure references | UUID | N | |
| outbreakId | string | R | — | Outbreaks page | Parent outbreak | User selection | Links to `outbreaks[outbreakId]` | `outbreakExposures[id]` | Outbreak reporting | Must match existing outbreak ID | N | |
| residentRef | ResidentRef | R | — | Outbreaks page | Links exposure to resident | User selection | `residentRef.id` → `residents[mrn]` or `quarantine[tempId]` | `outbreakExposures[id]` | Outbreak reporting | Commit gate validates | N | |
| exposureDate | string | O | — | Outbreaks page | Date of exposure | User entry | — | `outbreakExposures[id]` | Reports | Date string | N | |
| exposureType | string | O | — | Outbreaks page | Type of exposure | User entry | — | `outbreakExposures[id]` | Reports | — | N | |
| monitoringUntil | string | O | — | Outbreaks page | End of monitoring period | User entry | — | `outbreakExposures[id]` | Reports | Date string | N | |
| outcome | enum | O | — | Outbreaks page | Monitoring outcome | User entry | — | `outbreakExposures[id]` | Reports | `"no_symptoms" \| "became_case" \| "unknown"` | N | |
| createdAt | ISO | R | — | — | Record creation timestamp | System-generated | — | `outbreakExposures[id]` | Audit log | ISO-8601 | N | |
| updatedAt | ISO | R | — | — | Last modification timestamp | System-generated | — | `outbreakExposures[id]` | Audit log | ISO-8601 | N | |

---

## 13) OutbreakDailyStatus

**Storage path:** `facilityStore.outbreakDailyStatuses[id]`

| Field | Type | Req | Default | UI Location | Purpose | Source of Truth | Join / Linkage | Stored At | Used By | Validation | Deprecated? | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| id | string | R | — | — | Unique status entry identifier | System-generated (uuid) | **Primary key** | `outbreakDailyStatuses[id]` | Daily status references | UUID | N | |
| outbreakId | string | R | — | Outbreaks page | Parent outbreak | User selection | Links to `outbreaks[outbreakId]` | `outbreakDailyStatuses[id]` | Outbreak reporting | Must match existing outbreak ID | N | |
| date | string | R | — | Outbreaks page | Status date | User entry | — | `outbreakDailyStatuses[id]` | Epi curve, Reports | Date string | N | |
| newCases | number | R | — | Outbreaks page | New cases today | User entry | — | `outbreakDailyStatuses[id]` | Epi curve, Reports | Non-negative integer | N | |
| totalCases | number | R | — | Outbreaks page | Cumulative case total | User entry | — | `outbreakDailyStatuses[id]` | Epi curve, Reports | Non-negative integer | N | |
| newExposures | number | R | — | Outbreaks page | New exposures today | User entry | — | `outbreakDailyStatuses[id]` | Reports | Non-negative integer | N | |
| isolationCount | number | O | — | Outbreaks page | Current isolation count | User entry | — | `outbreakDailyStatuses[id]` | Reports | Non-negative integer | N | |
| staffingIssues | string | O | — | Outbreaks page | Staffing issue notes | User entry | — | `outbreakDailyStatuses[id]` | Reports | — | N | |
| suppliesIssues | string | O | — | Outbreaks page | Supply issue notes | User entry | — | `outbreakDailyStatuses[id]` | Reports | — | N | |
| narrative | string | O | — | Outbreaks page | Daily narrative | User entry | — | `outbreakDailyStatuses[id]` | Reports | — | N | |
| createdAt | ISO | R | — | — | Record creation timestamp | System-generated | — | `outbreakDailyStatuses[id]` | Audit log | ISO-8601 | N | |
| updatedAt | ISO | R | — | — | Last modification timestamp | System-generated | — | `outbreakDailyStatuses[id]` | Audit log | ISO-8601 | N | |

---

## 14) AuditSession

**Storage path:** `facilityStore.auditSessions[id]`

| Field | Type | Req | Default | UI Location | Purpose | Source of Truth | Join / Linkage | Stored At | Used By | Validation | Deprecated? | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| id | string | R | — | — | Unique session identifier | System-generated (uuid) | **Primary key** | `auditSessions[id]` | Audit references | UUID | N | |
| templateId | string | R | — | Audit Center | Template used for audit | User selection | References template configuration | `auditSessions[id]` | Audit Center | Non-empty | N | |
| status | enum | R | — | Audit Center | Session lifecycle state | User action | — | `auditSessions[id]` | Audit tracking | `"draft" \| "in_progress" \| "completed"` | N | |
| startedAt | string | R | — | Audit Center | Session start timestamp | System-generated | — | `auditSessions[id]` | Audit timeline | Date/ISO string | N | |
| completedAt | string | O | — | Audit Center | Session completion timestamp | User action | — | `auditSessions[id]` | Audit timeline | Date/ISO string | N | |

---

## 15) InfectionControlAuditSession

**Storage path:** `facilityStore.infectionControlAuditSessions[id]`

| Field | Type | Req | Default | UI Location | Purpose | Source of Truth | Join / Linkage | Stored At | Used By | Validation | Deprecated? | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| id | string | R | — | — | Unique session identifier | System-generated (uuid) | **Primary key**; referenced by `InfectionControlAuditItem.sessionId` | `infectionControlAuditSessions[id]` | IC Audit items | UUID | N | |
| auditType | enum | R | — | IC Audit Center | Type of IC audit | User selection | — | `infectionControlAuditSessions[id]` | Audit filtering, Reports | `"HAND_HYGIENE" \| "PPE" \| "ISOLATION" \| "EBP" \| "ENV_CLEANING" \| "ANTIBIOTIC_STEWARDSHIP" \| "VACCINATION" \| "OUTBREAK_PREP"` | N | |
| auditDateISO | string | R | — | IC Audit Center | Date of audit | User entry | — | `infectionControlAuditSessions[id]` | Reports, Timeline | ISO-8601 | N | |
| unit | string | R | — | IC Audit Center | Unit being audited | User entry | — | `infectionControlAuditSessions[id]` | Reports | Non-empty | N | |
| shift | string | R | — | IC Audit Center | Shift being audited | User entry | — | `infectionControlAuditSessions[id]` | Reports | Non-empty | N | |
| auditorName | string | R | — | IC Audit Center | Name of auditor | User entry / Facility config | — | `infectionControlAuditSessions[id]` | Reports | Non-empty | N | |
| notes | string | R | — | IC Audit Center | Session-level notes | User entry | — | `infectionControlAuditSessions[id]` | Reports | — | N | Required in type but may be empty string |
| createdAt | ISO | R | — | — | Record creation timestamp | System-generated | — | `infectionControlAuditSessions[id]` | Audit log | ISO-8601 | N | |
| updatedAt | ISO | R | — | — | Last modification timestamp | System-generated | — | `infectionControlAuditSessions[id]` | Audit log | ISO-8601 | N | |
| finalizedAt | ISO | O | — | IC Audit Center | Finalization timestamp | User action | — | `infectionControlAuditSessions[id]` | Audit completion tracking | ISO-8601 | N | |

---

## 16) InfectionControlAuditItem

**Storage path:** `facilityStore.infectionControlAuditItems[id]`

| Field | Type | Req | Default | UI Location | Purpose | Source of Truth | Join / Linkage | Stored At | Used By | Validation | Deprecated? | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| id | string | R | — | — | Unique item identifier | System-generated (uuid) | **Primary key** | `infectionControlAuditItems[id]` | Item references | UUID | N | |
| sessionId | string | R | — | IC Audit Center | Parent audit session | System | Links to `infectionControlAuditSessions[sessionId]` | `infectionControlAuditItems[id]` | Session grouping | Must match existing session ID | N | |
| category | enum | R | — | IC Audit Center | Audit category | System / template | — | `infectionControlAuditItems[id]` | Reports | Same enum as `auditType` | N | |
| questionId | string | R | — | IC Audit Center | Template question identifier | System / template | — | `infectionControlAuditItems[id]` | Scoring | Non-empty | N | |
| questionText | string | R | — | IC Audit Center | Display text of question | System / template | — | `infectionControlAuditItems[id]` | Display | Non-empty | N | |
| response | enum | R | — | IC Audit Center | Auditor response | User entry | — | `infectionControlAuditItems[id]` | Scoring, Reports | `"UNKNOWN" \| "COMPLIANT" \| "NON_COMPLIANT" \| "NA"` | N | |
| evidenceNote | string | R | — | IC Audit Center | Evidence / observation note | User entry | — | `infectionControlAuditItems[id]` | Reports | — | N | Required in type but may be empty string |
| severity | enum | R | — | IC Audit Center | Finding severity | User entry | — | `infectionControlAuditItems[id]` | Reports, Prioritization | `"LOW" \| "MED" \| "HIGH"` | N | |
| correctiveAction | string | R | — | IC Audit Center | Corrective action plan | User entry | — | `infectionControlAuditItems[id]` | Reports | — | N | Required in type but may be empty string |
| dueDateISO | string | R | — | IC Audit Center | Corrective action due date | User entry | — | `infectionControlAuditItems[id]` | Alerts, Reports | ISO-8601 / date string | N | |
| completedAt | string | R | — | IC Audit Center | Corrective action completion date | User entry | — | `infectionControlAuditItems[id]` | Reports | Date/ISO string | N | Required in type but may be empty string |

---

## 17) LineListEvent

**Storage path:** `facilityStore.lineListEvents[id]`

| Field | Type | Req | Default | UI Location | Purpose | Source of Truth | Join / Linkage | Stored At | Used By | Validation | Deprecated? | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| id | string | R | — | — | Unique event identifier | System-generated (uuid) | **Primary key** | `lineListEvents[id]` | Line list references | UUID | N | |
| facilityId | string | R | — | — | Owning facility | System | Links to `facilities.byId[facilityId]` | `lineListEvents[id]` | Multi-facility scoping | — | N | |
| residentId | string | R | — | Line List UI | Links to resident MRN | User / notification | Links to `residents[residentId]` | `lineListEvents[id]` | Resident Board, Reports | Must match existing resident MRN | N | Uses `residentId` (string) not `residentRef` |
| symptomClass | enum | R | — | Line List UI | Respiratory or GI | User / system detection | — | `lineListEvents[id]` | Line List filtering | `"resp" \| "gi"` | N | |
| onsetDateISO | ISO | R | — | Line List UI | Symptom onset date | User-confirmed | — | `lineListEvents[id]` | Timeline, Reports | ISO-8601 | N | |
| symptoms | SymptomTag[] | R | — | Line List UI | Symptom tags | User entry | — | `lineListEvents[id]` | Symptom tracking, Reports | Array of valid SymptomTag values | N | Resp: cough, fever, shortness_of_breath, etc. GI: diarrhea, nausea, vomiting, etc. |
| fever | boolean | O | — | Line List UI | Fever present | User entry | — | `lineListEvents[id]` | Clinical context | — | N | |
| isolationInitiated | boolean | O | — | Line List UI | Whether isolation was initiated | User entry | — | `lineListEvents[id]` | Reports | — | N | |
| isolationStatus | string | O | — | Line List UI | Current isolation status | User entry | — | `lineListEvents[id]` | Reports | — | N | |
| testOrdered | boolean | O | — | Line List UI | Whether diagnostic test was ordered | User entry | — | `lineListEvents[id]` | Reports | — | N | |
| providerNotified | boolean | O | — | Line List UI | Whether provider was notified | User entry | — | `lineListEvents[id]` | Reports | — | N | |
| disposition | enum | O | — | Line List UI | Patient disposition | User entry | — | `lineListEvents[id]` | Reports | `"monitoring" \| "hospital_transfer" \| "resolved" \| "other"` | N | |
| notes | string | O | — | Line List UI | Free-text notes | User entry | — | `lineListEvents[id]` | Clinical context | — | N | |
| sourceNotificationId | string | O | — | — | Triggering notification | System | Links to `notifications[sourceNotificationId]` | `lineListEvents[id]` | Notification tracking | — | N | |
| sourceEventId | string | O | — | — | Triggering ABT or IP event | System | Links to `abts[id]` or `infections[id]` | `lineListEvents[id]` | Event cross-reference | — | N | |
| createdAt | ISO | R | — | — | Record creation timestamp | System-generated | — | `lineListEvents[id]` | Audit log | ISO-8601 | N | |
| updatedAt | ISO | R | — | — | Last modification timestamp | System-generated | — | `lineListEvents[id]` | Audit log | ISO-8601 | N | |

---

## 18) AppNotification

**Storage path:** `facilityStore.notifications[id]`

| Field | Type | Req | Default | UI Location | Purpose | Source of Truth | Join / Linkage | Stored At | Used By | Validation | Deprecated? | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| id | string | R | — | — | Unique notification identifier | System-generated (uuid) | **Primary key** | `notifications[id]` | Notification references | UUID | N | |
| facilityId | string | R | — | — | Owning facility | System | Links to `facilities.byId[facilityId]` | `notifications[id]` | Multi-facility scoping | — | N | |
| createdAtISO | string | R | — | Notifications page | Creation timestamp | System-generated | — | `notifications[id]` | Display, sorting | ISO-8601 | N | Named `createdAtISO` (not `createdAt`) |
| status | enum | R | — | Notifications page | Read state | User action | — | `notifications[id]` | Notification badge, filtering | `"unread" \| "read" \| "dismissed"` | N | |
| category | enum | R | — | Notifications page | Notification category | Detection rules | — | `notifications[id]` | Notification routing, filtering | `"LINE_LIST_REVIEW" \| "OUTBREAK_SUGGESTION" \| "VAX_GAP" \| "DEVICE_LINK" \| "ADMISSION_SCREENING" \| "SYMPTOM_WATCH" \| "ABT_STEWARDSHIP" \| "DEVICE_REVIEW" \| "VAX_REOFFER" \| "AUDIT_OVERDUE"` | N | |
| residentId | string | O | — | Notifications page | Related resident | Detection rules | Links to `residents[residentId]` | `notifications[id]` | Resident-scoped notifications | — | N | |
| unit | string | O | — | Notifications page | Related unit | Detection rules | — | `notifications[id]` | Unit-scoped filtering | — | N | |
| room | string | O | — | Notifications page | Related room | Detection rules | — | `notifications[id]` | Display context | — | N | |
| message | string | R | — | Notifications page | Human-readable message | Detection rules | — | `notifications[id]` | Display | Non-empty | N | |
| clusterDetails | array | O | — | Notifications page | Cluster residents for outbreak suggestion | Detection rules | Each entry links to resident + note/abt | `notifications[id]` | Outbreak suggestion display | `Array<{ residentId, residentName, refType, refId }>` | N | |
| refs | object | O | — | Notifications page | References to related events | Detection rules | Links to abts/infections/vaxEvents/notes | `notifications[id]` | Quick-navigation from notification | `{ abtId?, ipId?, vaxId?, noteId? }` | N | |
| ruleId | string | R | — | — | Detection rule that triggered notification | Detection engine | — | `notifications[id]` | Rule dedup, dismissal | Non-empty | N | |
| actedAt | ISO | O | — | Notifications page | When user acted on notification | User action | — | `notifications[id]` | Acted-on tracking | ISO-8601 | N | |
| lineListRecordId | string | O | — | — | Line list event created from this notification | User action | Links to `lineListEvents[lineListRecordId]` | `notifications[id]` | Cross-reference | — | N | |
| action | enum | O | — | Notifications page | Recommended action type | Detection rules | — | `notifications[id]` | Action button display | `"add_to_line_list"` | N | |
| payload | object | O | — | — | Structured context for line list action | Detection rules | payload.residentId links to resident | `notifications[id]` | Line list auto-fill | `LineListNotificationPayload` | N | |

---

## 19) ShiftLogEntry

**Storage path:** `facilityStore.shiftLog[id]`

| Field | Type | Req | Default | UI Location | Purpose | Source of Truth | Join / Linkage | Stored At | Used By | Validation | Deprecated? | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| id | string | R | — | — | Unique entry identifier | System-generated (uuid) | **Primary key** | `shiftLog[id]` | Shift log references | UUID | N | |
| facilityId | string | R | — | — | Owning facility | System | Links to `facilities.byId[facilityId]` | `shiftLog[id]` | Multi-facility scoping | — | N | |
| createdAtISO | string | R | — | Shift Log page | Creation timestamp | System-generated | — | `shiftLog[id]` | Display, sorting | ISO-8601 | N | Named `createdAtISO` (not `createdAt`) |
| shift | enum | R | — | Shift Log page | Day or night shift | User entry | — | `shiftLog[id]` | Shift filtering | `"Day" \| "Night"` | N | |
| unit | string | O | — | Shift Log page | Related unit | User entry | — | `shiftLog[id]` | Unit filtering | — | N | |
| tags | array | R | — | Shift Log page | Category tags | User entry | — | `shiftLog[id]` | Tag filtering | `Array<"Outbreak" \| "Isolation" \| "Lab" \| "ABT" \| "Supply" \| "Education">` | N | |
| priority | enum | R | — | Shift Log page | Priority level | User entry | — | `shiftLog[id]` | Priority filtering, display | `"FYI" \| "Action Needed"` | N | |
| body | string | R | — | Shift Log page | Log entry content | User entry | — | `shiftLog[id]` | Display | Non-empty | N | |
| residentRefs | array | O | — | Shift Log page | Referenced residents | User entry | Each entry links to `residents[mrn]` | `shiftLog[id]` | Resident context | `Array<{ mrn: string, name: string }>` | N | |
| outbreakRef | object | O | — | Shift Log page | Referenced outbreak | User entry | Links to `outbreaks[id]` | `shiftLog[id]` | Outbreak context | `{ id: string, name: string }` | N | |

---

## 20) MutationLogEntry

**Storage path:** `facilityStore.mutationLog[]` (append-only array, capped at 500)

| Field | Type | Req | Default | UI Location | Purpose | Source of Truth | Join / Linkage | Stored At | Used By | Validation | Deprecated? | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| timestamp | ISO | R | — | Settings (audit trail) | When the mutation occurred | System-generated | — | `mutationLog[]` | Audit trail | ISO-8601 | N | |
| who | string | R | — | Settings (audit trail) | User/session performing the mutation | PIN-unlock / session context | — | `mutationLog[]` | Audit trail | Non-empty | N | |
| action | enum | R | — | Settings (audit trail) | Mutation verb | System | — | `mutationLog[]` | Audit trail | `"create" \| "update" \| "delete"` | N | |
| entityType | string | R | — | Settings (audit trail) | Domain entity type name | System | — | `mutationLog[]` | Audit trail | e.g. `"ABTCourse"`, `"IPEvent"`, `"Resident"` | N | |
| entityId | string | R | — | Settings (audit trail) | Entity primary key | System | Links to the entity's primary key | `mutationLog[]` | Audit trail | Non-empty | N | |

---

## 21) ExportProfile

**Storage path:** `facilityStore.exportProfiles[id]`

| Field | Type | Req | Default | UI Location | Purpose | Source of Truth | Join / Linkage | Stored At | Used By | Validation | Deprecated? | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| id | string | R | — | — | Unique profile identifier | System-generated (uuid) | **Primary key** | `exportProfiles[id]` | Export references | UUID | N | |
| name | string | R | — | Reports / Export UI | Profile display name | User entry | — | `exportProfiles[id]` | Display | Non-empty | N | |
| facilityId | string | R | — | — | Owning facility | System | Links to `facilities.byId[facilityId]` | `exportProfiles[id]` | Multi-facility scoping | Commit gate: must match outer store key | N | |
| type | enum | R | — | Reports / Export UI | Export format | User entry | — | `exportProfiles[id]` | Export engine | `"csv" \| "json" \| "pdf"` | N | |
| dataset | string | R | — | Reports / Export UI | Target dataset | User entry | — | `exportProfiles[id]` | Export engine | Non-empty | N | |
| columns | ExportColumn[] | R | — | Reports / Export UI | Column definitions | User entry | — | `exportProfiles[id]` | Export engine | Each: `{ header, fieldPath, transform?, required? }` | N | |
| includePHI | boolean | R | — | Reports / Export UI | Whether to include PHI | User entry | — | `exportProfiles[id]` | PHI filtering | — | N | |
| createdAt | ISO | R | — | — | Record creation timestamp | System-generated | — | `exportProfiles[id]` | Audit log | ISO-8601 | N | |
| updatedAt | ISO | R | — | — | Last modification timestamp | System-generated | — | `exportProfiles[id]` | Audit log | ISO-8601 | N | |

---

## 22) SurveyPacket

**Storage path:** `facilityStore.surveyPackets[id]`

| Field | Type | Req | Default | UI Location | Purpose | Source of Truth | Join / Linkage | Stored At | Used By | Validation | Deprecated? | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| id | string | R | — | — | Unique packet identifier | System-generated (uuid) | **Primary key** | `surveyPackets[id]` | Survey references | UUID | N | |
| facilityId | string | R | — | — | Owning facility | System | Links to `facilities.byId[facilityId]` | `surveyPackets[id]` | Multi-facility scoping | Commit gate: must match outer store key | N | |
| title | string | R | — | Reports (Survey tab) | Packet title | User entry | — | `surveyPackets[id]` | Display | Non-empty | N | |
| createdAt | ISO | R | — | — | Record creation timestamp | System-generated | — | `surveyPackets[id]` | Audit log | ISO-8601 | N | |
| createdBy | string | O | — | — | User who created the packet | System | — | `surveyPackets[id]` | Audit trail | — | N | |
| sections | SurveyPacketSection[] | R | — | Reports (Survey tab) | Packet sections | User configuration | Each section may reference other entities via `sourceRef` | `surveyPackets[id]` | Survey assembly | Each: `{ id, type, title, sourceRef?, options?, order }` | N | |
| generatedAt | string | O | — | Reports (Survey tab) | When packet was generated | System | — | `surveyPackets[id]` | Display | Date/ISO string | N | |
| notes | string | O | — | Reports (Survey tab) | Packet-level notes | User entry | — | `surveyPackets[id]` | Display | — | N | |

---

## 23) Facility, Unit, FloorLayout, FloorRoom

### Facility

**Storage path:** `UnifiedDB.data.facilities.byId[id]`

| Field | Type | Req | Default | UI Location | Purpose | Source of Truth | Join / Linkage | Stored At | Used By | Validation | Deprecated? | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| id | string | R | — | — | Unique facility identifier | System-generated | **Primary key**; referenced by all facilityId fields | `facilities.byId[id]` | All facility-scoped entities | Non-empty | N | |
| name | string | R | — | Settings | Facility display name | User entry / setup | — | `facilities.byId[id]` | Header, Reports | Non-empty | N | |
| dohId | string | O | — | Settings | Department of Health identifier | User entry | — | `facilities.byId[id]` | Regulatory reports | — | N | |
| address | string | O | — | Settings | Facility address | User entry | — | `facilities.byId[id]` | Print forms | — | N | |
| timezone | string | O | — | Settings | IANA timezone | User entry | — | `facilities.byId[id]` | Time display | — | N | |
| bedCapacity | number | O | — | Settings | Total bed capacity | User entry | — | `facilities.byId[id]` | Reports, metrics | Non-negative integer | N | |
| auditorName | string | O | — | Settings | Default auditor name | User entry | — | `facilities.byId[id]` | IC Audit Center, Header avatar | — | N | |
| units | Unit[] | R | — | Settings | Facility units | User configuration | — | `facilities.byId[id]` | Unit dropdowns, Heatmap | Array of Unit objects | N | |
| floorLayouts | FloorLayout[] | O | — | Settings, Floor Plan | Floor plan layouts | User configuration | — | `facilities.byId[id]` | Floor Plan, Heatmap | Array of FloorLayout objects | N | |
| hashtagCategories | string[] | O | — | Settings | Custom hashtag categories | User configuration | — | `facilities.byId[id]` | Note categorization | Array of strings | N | |
| customReports | any[] | O | — | Settings | Custom report configurations | User configuration | — | `facilities.byId[id]` | Reports | — | N | Untyped; future schema may tighten |
| createdAt | ISO | R | — | — | Record creation timestamp | System-generated | — | `facilities.byId[id]` | Audit log | ISO-8601 | N | |
| updatedAt | ISO | R | — | — | Last modification timestamp | System-generated | — | `facilities.byId[id]` | Audit log | ISO-8601 | N | |

### Unit

**Storage path:** Embedded in `Facility.units[]`

| Field | Type | Req | Default | UI Location | Purpose | Source of Truth | Join / Linkage | Stored At | Used By | Validation | Deprecated? | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| id | string | R | — | Settings | Unit identifier | System / user | Referenced by `currentUnit`, `unit` fields across entities | `facilities.byId[fid].units[]` | Unit dropdowns | Non-empty | N | |
| name | string | R | — | Settings | Unit display name | User entry | — | `facilities.byId[fid].units[]` | Display | Non-empty | N | |
| bedCapacity | number | O | — | Settings | Unit bed capacity | User entry | — | `facilities.byId[fid].units[]` | Metrics | Non-negative integer | N | |
| roomFormat | string | O | — | Settings | Room naming format | User entry | — | `facilities.byId[fid].units[]` | Room generation | — | N | |

### FloorLayout

**Storage path:** Embedded in `Facility.floorLayouts[]`

| Field | Type | Req | Default | UI Location | Purpose | Source of Truth | Join / Linkage | Stored At | Used By | Validation | Deprecated? | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| id | string | R | — | — | Layout identifier | System-generated | **Primary key** | `facilities.byId[fid].floorLayouts[]` | Floor Plan references | Non-empty | N | |
| facilityId | string | R | — | — | Owning facility | System | Links to parent facility | `facilities.byId[fid].floorLayouts[]` | Scoping | — | N | |
| unitId | string | O | — | Floor Plan | Associated unit | User configuration | Links to `units[].id` | `facilities.byId[fid].floorLayouts[]` | Unit-specific layouts | — | N | |
| name | string | R | — | Floor Plan | Layout name | User entry | — | `facilities.byId[fid].floorLayouts[]` | Display | Non-empty | N | |
| rooms | FloorRoom[] | R | — | Floor Plan | Room positions | User configuration | — | `facilities.byId[fid].floorLayouts[]` | Floor plan rendering | Array of FloorRoom | N | |
| version | number | R | — | — | Layout version | System | — | `facilities.byId[fid].floorLayouts[]` | Version tracking | Positive integer | N | |
| updatedAt | ISO | R | — | — | Last modification timestamp | System-generated | — | `facilities.byId[fid].floorLayouts[]` | Audit | ISO-8601 | N | |

### FloorRoom

**Storage path:** Embedded in `FloorLayout.rooms[]`

| Field | Type | Req | Default | UI Location | Purpose | Source of Truth | Join / Linkage | Stored At | Used By | Validation | Deprecated? | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| roomId | string | R | — | Floor Plan | Room identifier | User configuration | Referenced by `currentRoom` fields | `floorLayouts[].rooms[]` | Floor plan rendering, Heatmap | Non-empty | N | |
| x | number | R | — | Floor Plan | X position | User configuration | — | `floorLayouts[].rooms[]` | Floor plan rendering | Numeric | N | |
| y | number | R | — | Floor Plan | Y position | User configuration | — | `floorLayouts[].rooms[]` | Floor plan rendering | Numeric | N | |
| w | number | R | — | Floor Plan | Width | User configuration | — | `floorLayouts[].rooms[]` | Floor plan rendering | Positive numeric | N | |
| h | number | R | — | Floor Plan | Height | User configuration | — | `floorLayouts[].rooms[]` | Floor plan rendering | Positive numeric | N | |
| label | string | O | — | Floor Plan | Display label | User configuration | — | `floorLayouts[].rooms[]` | Floor plan rendering | — | N | |

---

## Event Contract

All event/entity types in the system follow a common contract of **required common fields**. When creating a new entity type, ensure these fields are present:

| Field | Type | Required On | Purpose |
|---|---|---|---|
| `id` | string (UUID) | All entities except Resident (uses `mrn`) and QuarantineResident (uses `tempId`) | Unique primary key |
| `residentRef` / `residentId` | ResidentRef or string | All resident-linked events (ABTCourse, IPEvent, VaxEvent, ResidentNote, OutbreakCase, OutbreakExposure, LineListEvent, AppNotification) | Links event to a resident |
| `createdAt` | ISO | All entities | Record creation timestamp |
| `updatedAt` | ISO | All entities except AuditSession, MutationLogEntry, ShiftLogEntry | Last modification timestamp |
| `facilityId` | string | Entities scoped to a facility (Staff, Outbreak, ExportProfile, SurveyPacket, LineListEvent, AppNotification, ShiftLogEntry) | Multi-facility isolation |
| Event date | varies | Varies by type (`onsetDate`, `startDate`, `dateGiven`, `date`, `auditDateISO`, `onsetDateISO`, `createdAtISO`) | The clinically meaningful date of the event |

### Notes on Event Contract

- **Resident** uses `mrn` as primary key (not `id`).
- **QuarantineResident** uses `tempId` as primary key (must start with `Q:`).
- **LineListEvent** and **AppNotification** use `residentId` (plain string MRN) rather than the `ResidentRef` discriminated union.
- **ShiftLogEntry** and **AppNotification** use `createdAtISO` rather than `createdAt` for their creation timestamp.
- **MutationLogEntry** uses `timestamp` instead of `createdAt`.

---

## Coverage & Parity

### Canonical Join Keys

| Join Key | Primary Use | Fallback |
|---|---|---|
| `residentRef.id` (via `ResidentRef`) | Primary resident linkage for ABTCourse, IPEvent, VaxEvent, ResidentNote, OutbreakCase, OutbreakExposure | — |
| `mrn` (string) | Resident primary key; used directly by LineListEvent (`residentId`), AppNotification (`residentId`), ShiftLogEntry (`residentRefs[].mrn`) | Legacy systems may reference by display name; always prefer MRN |
| `staffId` | Staff linkage for StaffVaxEvent, FitTestEvent | — |
| `outbreakId` | Outbreak linkage for OutbreakCase, OutbreakExposure, OutbreakDailyStatus, IPEvent | — |
| `sessionId` | IC Audit session linkage for InfectionControlAuditItem | — |
| `facilityId` | Facility scoping for multi-tenant isolation | — |

### Report vs. Drill-Down Parity Warnings

1. **residentRef vs. residentId inconsistency** — `LineListEvent` and `AppNotification` use a plain `residentId: string` (MRN) while most other events use the `ResidentRef` discriminated union. When joining across entities, normalize to MRN: `ref.kind === "mrn" ? ref.id : null`.

2. **Quarantine residents** — Events linked to `ResidentRef { kind: "quarantine" }` will not appear in reports that filter by `residents[mrn]`. Ensure quarantine-linked events are either surfaced separately or resolved before reporting.

3. **Deprecated date fields** — `VaxEvent.administeredDate` and `FitTestEvent.fitTestDate` are deprecated. Reports must use the coalesce pattern: `dateGiven ?? administeredDate` and `date ?? fitTestDate`.

4. **createdAt vs. createdAtISO** — `ShiftLogEntry` and `AppNotification` use `createdAtISO` (not `createdAt`). Sorting/filtering logic must account for this naming difference.

5. **MutationLog capping** — `mutationLog` is capped at 500 entries. Long-running facilities will lose oldest entries; do not use mutation log as a complete audit trail for compliance.

---

## Developer Checklist

Before adding or modifying a data field:

- [ ] **Update `src/domain/models.ts`** — Add/modify the field in the appropriate interface.
- [ ] **Update this data dictionary** (`docs/data-field-reference.md`) — Add the field with all metadata columns filled in.
- [ ] **Update storage migrations** (`src/storage/engine.ts`) — If adding a new store or changing schema shape, add migration logic in `migratePreV2toV2` or create a new migration function.
- [ ] **Update FacilityStore** — If adding a new entity type, add the `Record<string, T>` entry to `FacilityStore` and `emptyFacilityStore()`.
- [ ] **Update commit gate** — If the new entity has a `residentRef` or `facilityId`, add validation in `validateCommitGate()`.
- [ ] **Update reports** — Ensure any report that should display the new field is updated.
- [ ] **Update notifications/detection rules** — If the field affects clinical alerting, update the detection engine.
- [ ] **Check backward compatibility** — If renaming a field, keep the old field as deprecated and document the coalesce/fallback pattern.
- [ ] **Test** — Verify lint (`tsc --noEmit`), build (`vite build`), and manual UI testing pass.

---

## Critical Field Examples

### `residentRef` (ResidentRef)

```typescript
// Discriminated union: identifies a resident by MRN or quarantine temp ID
type ResidentRef =
  | { kind: "mrn"; id: string }      // id = Resident.mrn
  | { kind: "quarantine"; id: string } // id = QuarantineResident.tempId (Q:<uuid>)

// Usage: reading the resident
const resident = ref.kind === "mrn"
  ? store.residents[ref.id]
  : store.quarantine[ref.id];
```

### `mrn` (Resident primary key)

```typescript
// MRN is the primary key for Resident records and the canonical join key
// across all resident-linked entities.
const resident = store.residents["MRN-001"];
const ipEvents = Object.values(store.infections)
  .filter(ip => ip.residentRef.kind === "mrn" && ip.residentRef.id === "MRN-001");
```

### `outbreakId` (cross-entity linkage)

```typescript
// Links IPEvent, OutbreakCase, OutbreakExposure, OutbreakDailyStatus to an Outbreak
const outbreak = store.outbreaks["outbreak-uuid"];
const cases = Object.values(store.outbreakCases)
  .filter(c => c.outbreakId === "outbreak-uuid");
```

### `administeredDate` / `dateGiven` (deprecated field migration)

```typescript
// VaxEvent: administeredDate is deprecated → use dateGiven
// Readers MUST coalesce:
const effectiveDate = vaxEvent.dateGiven ?? vaxEvent.administeredDate;

// Writers should only set dateGiven on new records.
```

### `fitTestDate` / `date` (deprecated field migration)

```typescript
// FitTestEvent: fitTestDate is deprecated → use date
// Readers MUST coalesce:
const effectiveDate = fitTestEvent.date ?? fitTestEvent.fitTestDate;

// Writers should only set date on new records.
```

### `historicalSource` (union with legacy variant)

```typescript
// Resident.historicalSource supports both 'csv_import' (canonical) and
// 'csv-import' (legacy hyphenated form from early schema).
// Readers should treat both as equivalent:
const isImported = resident.historicalSource === 'csv_import'
  || resident.historicalSource === 'csv-import';
```

---

*Last updated: 2026-03-01*
*Source of truth: `src/domain/models.ts` • Storage: `src/storage/engine.ts`*
