# User Guide — Screen-by-Screen Walkthrough

This guide explains what each major screen does and when to use it.

> **In-app location:** Open the left sidebar and click **User Guide**.

## 1) Dashboard
**Purpose:** Daily command center for infection-control priorities.

**Use it to:**
- Review active precautions and current outbreak indicators.
- Spot antibiotic stewardship trends at a glance.
- Launch quick actions into resident, census, and outbreak details.

---

## 2) Resident Board
**Purpose:** Core resident surveillance and event tracking workspace.

**Use it to:**
- View resident infection status and isolation/precaution details.
- Document IP events, vaccines, and antibiotic courses.
- Open resident profile, shift report, and settings modals.
- Access printable forms (e.g., daily precautions, admission screening).

---

## 3) Staff
**Purpose:** Manage staff records relevant to infection-control operations.

**Use it to:**
- Maintain staff listing and related assignments.
- Support operational coordination during outbreaks.

---

## 4) Outbreaks
**Purpose:** Create and monitor outbreak episodes.

**Use it to:**
- Track active outbreaks and their status.
- Keep outbreak-specific notes and timeline context.

---

## 5) Quarantine Inbox
**Purpose:** Intake queue for quarantine-related actions.

**Use it to:**
- Review incoming quarantine notifications.
- Edit quarantine records and move cases into line-list workflows.

---

## 6) Notes
**Purpose:** Clinical and operational documentation support.

**Use it to:**
- Generate AI-assisted notes with the Note Generator.
- Maintain resident chat context and per-shift logs.

---

## 7) Reports
**Purpose:** Build, run, and manage report outputs.

**Use it to:**
- Assemble custom report criteria with Report Builder.
- Browse saved reports and export deliverables.

---

## 8) Infection Control Audit Center
**Purpose:** Structured audit documentation and print-ready reporting.

**Use it to:**
- Complete infection-control audit templates.
- Produce printable audit reports for compliance and review.

---

## 9) Back Office
**Purpose:** Historical data administration and data correction workflows.

**Use it to:**
- Upload historical CSVs for residents, IP events, vaccines, and antibiotics.
- Review and edit global historical records.

---

## 10) Settings
**Purpose:** Facility-level configuration and data management.

**Use it to:**
- Configure unit/room setup and monthly metrics.
- Run CSV migration tools.
- Perform backup/restore and manage preferences.

---

## 11) Lock Screen
**Purpose:** Protect access on shared workstations.

**Use it to:**
- Lock the app session when stepping away.
- Require PIN entry before workflow resumes.

---

## Recommended Daily Flow
1. Open **Dashboard** to identify urgent priorities.
2. Use **Resident Board** to update resident-specific events.
3. Process **Quarantine Inbox** items.
4. Capture documentation in **Notes**.
5. Generate outputs from **Reports** and **Audit Center** as needed.
6. Use **Settings** and **Back Office** for administrative maintenance.

## Quick Navigation Tip
If your deployment includes global search, use it to jump quickly to residents or records rather than navigating screen-by-screen.

---

## Data Field Walkthrough / Data Dictionary

For a complete reference of every data field in the system — including data types, validation rules, storage locations, join keys, and deprecation notes — see the **[Data Field Reference Library](./data-field-reference.md)**.

The Data Field Reference covers all entity types (Resident, IP Events, ABT/Antibiotics, Vax, Line List, Staff, Outbreaks, Audits, Notifications, Shift Log, Survey Packets, and more) and includes:

- Field-by-field metadata tables for every domain model
- Event contract (common required fields across all entities)
- Coverage & parity guidance (canonical join keys, report vs. drill-down mismatches)
- Developer checklist for adding or modifying fields
- Critical field examples with code snippets

> **In-app location:** Open the left sidebar → **User Guide** → scroll to the **Data Field Reference** section or click the **Data Field Reference** link at the top of the page.
