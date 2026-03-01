# Information Collected Library (Data Field Walkthrough)

This is a plain-language guide to the information the app collects and why it is collected.

## How to use this guide
1. Pick the category you are working in (Resident, IP Events, ABT, Vaccines, etc.).
2. Read what information is collected, where staff enter it, and how it supports care workflows.
3. Use this before changing forms, reports, or exports.
4. For a printable/open-in-new-window table version, use **Data Field Walkthrough Table (New Window)** in the User Guide.

## Resident Information
| Information Collected | What it means | Where staff enter/view it | Why it is collected |
|---|---|---|---|
| Resident ID and name (MRN, display name, first/last) | Who the record belongs to | Resident Board, Profile modal | Correct resident matching across all screens |
| Demographics (DOB, sex) | Resident background details | Resident Profile | Clinical context, risk review, reporting |
| Admission and location (admission date, unit, room, attending MD) | Current care location and provider | Resident Board/Profile | Daily rounding, unit-based follow-up, tracing |
| Resident status (Active/Discharged/Deceased) | Current resident lifecycle status | Resident Board | Census accuracy and outcome tracking |
| Clinical profile (diagnosis, cognitive status, allergies, payor) | Baseline care context | Resident Profile/Back Office | Care planning and review conversations |
| Historical flags and discharge snapshots | Resident historical/deactivated state | Back Office + census workflows | Preserve history and prevent data loss |

## IP Events (Infection Prevention)
| Information Collected | What it means | Where staff enter/view it | Why it is collected |
|---|---|---|---|
| Infection event identity and resident link | Which resident had the event | IP Event modal | Accurate event timeline |
| Event status and onset/resolution dates | Progress of infection event | IP Event modal | Active case monitoring |
| Infection details (category/site/source/isolation type/organism) | Clinical description of infection | IP Event modal | Intervention planning and trend review |
| Lab and specimen dates | Testing timeline | IP Event modal | Clinical follow-through and audit trail |
| Outbreak linkage | Whether event is part of an outbreak | IP Event + Outbreak workflows | Case grouping and response coordination |
| Device/NHSN indicators | Surveillance criteria flags | IP Event/NHSN panel | Quality and regulatory checks |

## ABT / Antibiotic Courses
| Information Collected | What it means | Where staff enter/view it | Why it is collected |
|---|---|---|---|
| Course identity and resident link | Which resident/course | ABT Course modal | Stewardship tracking |
| Medication plan (drug/class/dose/route/frequency/start/end) | Active treatment details | ABT Course modal | Medication review and duration monitoring |
| Indication and infection source | Why antibiotic is being used | ABT Course modal | Stewardship appropriateness checks |
| Culture/organism/sensitivity details | Microbiology support info | ABT Course modal | De-escalation/optimization decisions |
| Prescriber and notes | Care-team context | ABT Course modal | Team communication and chart review |

## Vaccination (Resident)
| Information Collected | What it means | Where staff enter/view it | Why it is collected |
|---|---|---|---|
| Vaccine event identity and resident link | Who got/offered vaccine | Vaccine modal | Resident-level immunization timeline |
| Vaccine name and status | Current vaccine state (given/due/declined/etc.) | Vaccine modal + dashboard indicators | Gap closure and outreach |
| Date given and due/offer dates | Administration and due schedule | Vaccine modal | Timely follow-up and reminder workflows |
| Dose/lot/administered by/site/source | Administration details | Vaccine modal/Back Office | Documentation quality and traceability |
| Decline reason and notes | Why vaccine not accepted/other context | Vaccine modal | Re-offer planning and compliance evidence |

## Line List (Resp/GI Tracking)
| Information Collected | What it means | Where staff enter/view it | Why it is collected |
|---|---|---|---|
| Line-list record and resident/facility link | Resident symptom surveillance record | Notifications + Add to Line List modal | Cluster monitoring |
| Symptom class and symptom tags | Respiratory or GI symptom details | Line-list workflow | Early outbreak detection |
| Onset date and fever/isolation/test/provider flags | Urgency and response actions | Line-list workflow | Escalation and triage |
| Disposition and notes | Current handling/outcome summary | Line-list workflow | Team handoff and review |
| Notification/source links | Which alert or source event generated entry | Notifications workflow | Auditability and traceability |

## Staff and Staff Health
| Information Collected | What it means | Where staff enter/view it | Why it is collected |
|---|---|---|---|
| Staff identity and status | Employee active/inactive and profile | Staff page | Workforce coordination |
| Staff role/department/employee ID | Assignment context | Staff page/import | Operational planning |
| Staff vaccine events | Staff immunization status timeline | Staff page vaccine actions | Compliance and protection |
| Fit test records | Respirator fit testing details and due dates | Staff page fit test actions | PPE readiness and safety |

## Outbreaks
| Information Collected | What it means | Where staff enter/view it | Why it is collected |
|---|---|---|---|
| Outbreak master record (title, status, dates, pathogen) | Outbreak episode definition | Outbreaks page | Organize response activities |
| Outbreak cases (resident linkage, case status, dates/results) | Who is counted as a case | Outbreak case panel | Case count and confirmation tracking |
| Outbreak exposures | Contacts under monitoring | Outbreak exposure panel | Follow-up and conversion monitoring |
| Daily outbreak status (new/total cases, narrative, issues) | Daily command update | Outbreak daily status panel | Leadership briefings and action planning |

## Audits
| Information Collected | What it means | Where staff enter/view it | Why it is collected |
|---|---|---|---|
| Audit sessions (type/date/unit/shift/auditor/status) | Audit visit context | Infection Control Audit Center | Compliance tracking |
| Audit item responses (question/response/severity/action/due date) | Item-level findings and corrective actions | Infection Control Audit Center | Improvement planning and accountability |

## Notifications
| Information Collected | What it means | Where staff enter/view it | Why it is collected |
|---|---|---|---|
| Alert identity, category, status, timestamp | Notification lifecycle state | Notifications page + Dashboard widgets | Prioritize actions |
| Resident/unit/room context | Where and whom alert relates to | Notifications page | Fast routing to the right case |
| Message and rule source | Why alert fired | Notifications page | Transparency and trust in alerts |
| Action tracking (actedAt, line list action result) | Whether action was completed | Add to Line List workflow | Operational accountability |

## Shift Log
| Information Collected | What it means | Where staff enter/view it | Why it is collected |
|---|---|---|---|
| Shift entry basics (date/time, shift, unit, priority, tags, body) | Shift handoff communication | Notes > Shift Log | Continuity between day/night teams |
| Optional resident and outbreak references | Who/what this handoff concerns | Notes > Shift Log | Faster investigation follow-up |

## Survey Packets
| Information Collected | What it means | Where staff enter/view it | Why it is collected |
|---|---|---|---|
| Packet title/facility/created by/date | Packet identity | Survey Packet Builder | Survey readiness organization |
| Packet sections (type/title/order/source) | What is included in the packet | Survey Packet Builder | Structured survey documentation |
| Generated date and notes | Finalization context | Survey Packet Builder | Audit-ready history |

## Quick examples (plain language)
- **residentId / MRN:** Used to tie all resident-related records back to one resident profile.
- **outbreakId:** Used to place cases and exposures under one outbreak response episode.
- **dateGiven/administeredDate:** Vaccine administration date fields used for due/overdue tracking.

## Developer checklist before adding or changing fields
- [ ] Update this Information Collected Library.
- [ ] Update models and forms.
- [ ] Update migrations if existing records need backfill.
- [ ] Update reports/exports/alerts that depend on the field.
- [ ] Validate User Guide links and new-window walkthrough table.
