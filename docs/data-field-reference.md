# Data Field Reference Library (Data Dictionary)

This reference is the survey-grade canonical map of data fields in the IC ABT Console. It is aligned to:
- `src/domain/models.ts` (domain contracts)
- `src/storage/engine.ts` + storage keys (persistence contracts)

## How to use this reference
1. Find the entity/event section (Resident, IP Event, ABT, Vax, Line List, Staff, Outbreak, Audit, Notification, Shift Log, Survey Packet).
2. For each field, review data type, requiredness, default, UI location, business purpose, storage path, linkage role, and validation.
3. If adding/changing a field, update **this file**, migrations (`runMigrations`), and reports.

## Event Contract (cross-cutting expectations)
For all event-style records (ABTCourse, IPEvent, VaxEvent, LineListEvent, AppNotification, audit items/sessions, shift log):
- Required identifiers: `id` and one canonical join key (`residentRef` / `residentId` / `staffId` / `sessionId` / `outbreakId` as applicable).
- Temporal fields: `createdAt` + `updatedAt` (or `createdAtISO` in some event types).
- Facility context: `facilityId` is required where entity can cross facilities.
- Clinical event date: use event-specific field (`onsetDate`, `dateGiven`, `eventDate` equivalent).
- Referential integrity: references must exist in current facility store; `validateCommitGate()` enforces resident reference integrity.

## Coverage & Parity Rules
- **Primary join key:** `residentId`/`residentRef.kind=mrn` is canonical.
- **Legacy fallback:** `mrn` text fallback for old snapshots and migration flows.
- **Quarantine linkage:** use `residentRef.kind=quarantine` + `Q:<uuid>` IDs.
- **Report vs drill-down parity:** if report aggregates by MRN while drill-down uses `residentRef`, normalize before grouping.
- **Date parity:** vaccination readers must prefer `dateGiven ?? administeredDate`; fit tests must prefer `date ?? fitTestDate`.

## Storage Canonical Paths
- Main DB document key: `UNIFIED_DB_MAIN`.
- Backup and transactional keys: `UNIFIED_DB_PREV`, `UNIFIED_DB_TMP`.
- Canonical path format: `UNIFIED_DB.data.facilityData[facilityId].<collection>[id]`.

## Field Catalog Format
`Field Name | Entity | Type | Req | Default | Where to Find | What For | Source of Truth | Join Role | Stored Where | Used By | Validation | Deprecated + Replacement + Fallback | Notes`

---

## Resident (Entity)
- `mrn | Resident | string | R | none | Resident Board > Resident Profile | resident identity across app | Resident model | primary resident key | facilityData.residents[mrn] | all clinical modules/reports | unique, non-empty | N | legacy imports may create aliases`
- `displayName | Resident | string | R | none | Resident Profile, Dashboard cards | human-readable resident identity | Resident model | display-only | residents[mrn].displayName | UI, exports | non-empty recommended | N | may differ from first/last`
- `firstName,lastName | Resident | string | O | none | Resident Profile | structured naming for forms | Resident model | none | residents[mrn] | forms/reports | optional | N | derived from imports sometimes`
- `dob | Resident | date-string | O | none | Resident Profile | age/risk context | Resident model | none | residents[mrn].dob | reporting/clinical context | ISO-like expected | N | may be partial in legacy`
- `sex | Resident | enum-string | O | none | Resident Profile | stratification/reporting | Resident model | none | residents[mrn].sex | analytics | controlled by UI options | N | free-text legacy possible`
- `admissionDate | Resident | date-string | O | none | Resident Profile | admission timeline | Resident model | none | residents[mrn].admissionDate | census views/reports | valid date | N | used for deactivation snapshot`
- `attendingMD,currentUnit,currentRoom | Resident | string | O | none | Resident Profile / board rows | placement and responsibility | Resident model | none | residents[mrn] | dashboard, room/unit filters | optional | N | mirrored into location snapshots`
- `status | Resident | enum(Active/Discharged/Deceased) | O | Active in workflows | Resident Board | resident lifecycle | Resident model | none | residents[mrn].status | census/outcome reporting | enum constrained | N | legacy may omit`
- `payor,primaryDiagnosis,primaryDiagnosisText,cognitiveStatus,allergies | Resident | string/enum/array | O | none | Resident Profile | care planning and risk context | Resident model | none | residents[mrn] | profile views/reports | enum for cognitive status | N | free text highly variable`
- `identityAliases | Resident | Alias[] | O | none | Back Office/import reconciliation | identity reconciliation | Resident model | alias to legacy IDs | residents[mrn].identityAliases | migration/parity checks | alias source enum | N | used to match old records`
- `createdAt,updatedAt | Resident | ISO string | R | set on write | all resident CRUD | auditing/change tracking | write pipeline | none | residents[mrn] | sorting/audit | ISO required | N | always present post-migration`
- `isHistorical,backOfficeOnly,historicalSource | Resident | bool/enum | O | false/none | Back Office | distinguishes historical-only rows | Resident model | none | residents[mrn] | back-office filters | historicalSource enum manual/csv_import/csv-import | `historicalSource` supports deprecated `csv-import` fallback | union includes legacy hyphen variant`
- `lastKnownUnit,lastKnownRoom,lastKnownAttendingMD,dischargedAt,lastSeenOnCensusAt,deactivatedAt,dischargeReason,deactivationSnapshot | Resident | string/object/date | O | none | Resident Board + Settings workflows | preserve state at discharge/deactivation | Resident model | none | residents[mrn] | reconciliation/reporting | deactivation snapshot object requires unit/room/md/admissionDate when set | N | key for census drop-off handling`

## Quarantine Resident
- `tempId,source,createdAt,updatedAt | QuarantineResident | string/enum/ISO | R | source none | Quarantine Inbox | tracks temporary resident before MRN resolution | Quarantine model | `tempId` key | facilityData.quarantine[tempId] | quarantine workflows | `tempId` must start with `Q:` | N | commit gate validates quarantine refs`
- `displayName,dob,unitSnapshot,roomSnapshot,rawHint,resolvedToMrn | QuarantineResident | string | O | none | Quarantine Inbox edit modal | triage and later linking | Quarantine model | `resolvedToMrn` join to resident | quarantine[tempId] | handoff/import cleanup | resolvedToMrn should reference existing resident when populated | N | legacy import often sets rawHint`

## ABT / Antibiotic Course
- `id,residentRef,status,medication,createdAt,updatedAt | ABTCourse | string/object/enum/ISO | R | none | Resident Board > ABT modal | antimicrobial stewardship record | ABTCourse | `id` + `residentRef` | facilityData.abts[id] | Dashboard ABT trends, reports, alerts | residentRef must pass commit gate; status enum active/completed/discontinued | N | residentRef supports quarantine`
- `medicationClass,dose,route,frequency,indication,infectionSource,syndromeCategory,startDate,endDate | ABTCourse | string/date | O | none | ABT modal | regimen details and stewardship analysis | ABTCourse | none | abts[id] | stewardship analytics/report filters | date consistency expected | N | historical imports may be sparse`
- `cultureCollected,cultureCollectionDate,cultureSource,organismIdentified,sensitivitySummary,diagnostics,prescriber,notes | ABTCourse | bool/string/object | O | none | ABT modal | microbiology context + rationale | ABTCourse | none | abts[id] | case review and reporting | optional, no strict schema for diagnostics object | N | free-text diagnostics supported`
- `locationSnapshot | ABTCourse | object(unit/room/attendingMD/capturedAt) | O | none | auto-captured on create | preserves resident location at event time | ABTCourse | none | abts[id].locationSnapshot | outbreak tracing | capturedAt should be ISO if present | N | snapshot decouples from later room moves`

## IP Event
- `id,residentRef,status,createdAt,updatedAt | IPEvent | string/object/enum/ISO | R | none | Resident Board > IP Event modal | infection prevention event tracking | IPEvent | `id` + residentRef | facilityData.infections[id] | line-list cues, reports, outbreak logic | status enum active/resolved/historical; residentRef integrity enforced | N | core surveillance record`
- `onsetDate,infectionCategory,infectionSite,sourceOfInfection,isolationType,ebp,organism,specimenCollectedDate,labResultDate,notes | IPEvent | string/bool/date | O | none | IP modal | clinical characterization and isolation management | IPEvent | none | infections[id] | reports/NHSN checks | dates should be valid chronological entries | N | free-text site/category accepted`
- `outbreakId | IPEvent | string | O | none | IP modal / Outbreak linking | joins infection to outbreak episode | IPEvent | joins outbreaks | infections[id].outbreakId | outbreak dashboards/reports | should reference existing outbreak where used | N | optional until classified`
- `resolvedAt,deviceTypes,nhsnCautiMet,nhsnCdiffLabIdMet,locationSnapshot | IPEvent | ISO/array/bool|null/object | O | none | IP modal and automated checks | supports NHSN logic and context persistence | IPEvent | none | infections[id] | NHSN criteria panels/analytics | deviceTypes array strings; NHSN fields can be null | N | `nhsn*` fields are persisted verdicts`

## Vaccination Event (Resident)
- `id,residentRef,vaccine,status,createdAt,updatedAt | VaxEvent | string/object/enum/ISO | R | none | Resident Board > Vaccine modal | immunization tracking | VaxEvent | id + residentRef | facilityData.vaxEvents[id] | vaccine gap alerts/reports | status enum given/due/overdue/declined/scheduled/contraindicated/documented-historical | N | primary vaccination event contract`
- `dateGiven | VaxEvent | date-string | O | none | Vaccine modal | canonical administration date | VaxEvent | event-date join | vaxEvents[id].dateGiven | due/overdue analytics | valid date recommended | N | prefer over administeredDate`
- `administeredDate | VaxEvent | date-string | O | none | legacy records/import views | backward compatibility date field | VaxEvent | fallback only | vaxEvents[id].administeredDate | legacy report compatibility | if both exist, reader uses dateGiven first | Y -> `dateGiven`; fallback `dateGiven ?? administeredDate` | keep until full migration`
- `dose,lotNumber,administeredBy,administrationSite,source,dueDate,offerDate,declineReason,notes,locationSnapshot | VaxEvent | enum/string/date/object | O | none | Vaccine modal, Back Office | administration details + refusals + provenance | VaxEvent | none | vaxEvents[id] | reminders, compliance reports | enums for dose/administrationSite/source | N | source distinguishes manual-historical/csv/import`

## Line List
- `id,facilityId,residentId,symptomClass,onsetDateISO,symptoms,createdAt,updatedAt | LineListEvent | string/enum/ISO/array | R | none | Notifications > Add to Line List, Quarantine flows | suspected cluster tracking | LineListEvent | residentId + facilityId | facilityData.lineListEvents[id] | line list review, outbreak detection | symptomClass enum resp/gi; symptom tags must match class | N | residentId is canonical join key`
- `fever,isolationInitiated,isolationStatus,testOrdered,providerNotified,disposition,notes,sourceNotificationId,sourceEventId | LineListEvent | bool/string/enum | O | none | Line List entry editor (notification modal) | downstream triage and auditability | LineListEvent | links notification/event | lineListEvents[id] | notification closure, analytics | disposition enum monitoring/hospital_transfer/resolved/other | N | source ids enable traceability`
- `LineListNotificationPayload.residentId,symptomClass,detectedAt,sourceEventId,notesSnippet | LineListNotificationPayload | string/enum/ISO | residentId/symptomClass/detectedAt R | none | Notification detail | machine suggestion context | AppNotification.payload | resident + source linkage | notifications[id].payload | AddToLineList modal prefill | same enum constraints as line list | N | embedded payload contract`

## Staff + Staff Events
- `id,facilityId,displayName,status,createdAt,updatedAt | Staff | string/enum/ISO | R | none | Staff page grid/form | workforce master record | Staff model | staffId key | facilityData.staff[id] | staffing and outbreak ops | status enum active/inactive | N | displayName required`
- `firstName,lastName,employeeId,role,department,hireDate,terminationDate | Staff | string/date | O | none | Staff edit modal/import | HR context and filtering | Staff model | employeeId secondary key | staff[id] | reports/coordination | optional; termination after hire recommended | N | imports may include custom `type` extension`
- `StaffVaxEvent.id,staffId,vaccine,status,createdAt,updatedAt | StaffVaxEvent | string/enum/ISO | R | none | Staff > Vaccine actions | staff immunization compliance | StaffVaxEvent | staffId join | facilityData.staffVaxEvents[id] | staff compliance reporting | status enum aligns resident vax subset | N | keyed separately from staff`
- `StaffVaxEvent.dateGiven,dueDate,offerDate,declineReason,notes | StaffVaxEvent | date/string | O | none | Staff vax modal | due/decline workflow | StaffVaxEvent | none | staffVaxEvents[id] | reminders/reports | valid date where present | N | optional details`
- `FitTestEvent.id,staffId,date,maskType,maskSize,passed,nextDueDate,createdAt,updatedAt | FitTestEvent | string/bool/date | R | none | Staff > Fit Test modal | respiratory protection compliance | FitTestEvent | staffId join | facilityData.fitTestEvents[id] | fit-test tracking | date + nextDueDate required | N | canonical date field is `date``
- `fitTestDate | FitTestEvent | date-string | O | none | legacy records | backward compatibility | FitTestEvent | fallback date | fitTestEvents[id].fitTestDate | legacy reports | prefer `date ?? fitTestDate` | Y -> `date`; fallback as documented | original schema support`
- `respiratorType,model,method,result,notes | FitTestEvent | string | O | none | fit test form | detailed PPE auditability | FitTestEvent | none | fitTestEvents[id] | audits/reports | optional | N | strings are free-form`

## Outbreaks
- `Outbreak.id,facilityId,title,startDate,status,createdAt,updatedAt | Outbreak | string/enum/date | R | none | Outbreaks page | outbreak episode master record | Outbreak model | outbreakId + facilityId | facilityData.outbreaks[id] | outbreak dashboards/reports | status enum suspected/confirmed/contained/closed; facilityId must match store key | N | commit gate enforces facility isolation`
- `pathogen,syndromeCategory,endDate,caseDefinition,notes | Outbreak | string/date | O | none | Outbreak detail | epidemiologic details | Outbreak model | none | outbreaks[id] | outbreak analytics | optional | N | close with endDate`
- `OutbreakCase.id,outbreakId,residentRef,caseStatus,createdAt,updatedAt | OutbreakCase | string/object/enum/ISO | R | none | Outbreak case table | resident case attribution | OutbreakCase | outbreak+resident join | facilityData.outbreakCases[id] | line listing/reports | residentRef integrity + caseStatus enum probable/confirmed/ruled_out | N | links infection events`
- `symptomOnsetDate,specimenCollectedDate,labResultDate,result,locationSnapshot,linkedIpEventId | OutbreakCase | date/string/object | O | none | outbreak case editor | evidence and provenance | OutbreakCase | linkedIpEventId join | outbreakCases[id] | analytics/drill-down | linkedIpEventId should exist if supplied | N | location snapshot optional`
- `OutbreakExposure.id,outbreakId,residentRef,createdAt,updatedAt | OutbreakExposure | string/object/ISO | R | none | outbreak exposures panel | contact tracing | OutbreakExposure | outbreak+resident join | facilityData.outbreakExposures[id] | exposure monitoring | residentRef integrity | N | minimal required contract`
- `exposureDate,exposureType,monitoringUntil,outcome | OutbreakExposure | date/string/enum | O | none | exposure editor | monitoring timeline and outcomes | OutbreakExposure | none | outbreakExposures[id] | monitoring reports | outcome enum no_symptoms/became_case/unknown | N | can convert to cases`
- `OutbreakDailyStatus.id,outbreakId,date,newCases,totalCases,newExposures,createdAt,updatedAt | OutbreakDailyStatus | string/number/date/ISO | R | none | outbreak daily status panel | daily surveillance metrics | OutbreakDailyStatus | outbreakId join | facilityData.outbreakDailyStatuses[id] | trend charts/reports | numeric non-negative | N | daily rollup record`
- `isolationCount,staffingIssues,suppliesIssues,narrative | OutbreakDailyStatus | number/string | O | none | daily status entry | operational risk communication | OutbreakDailyStatus | none | outbreakDailyStatuses[id] | dashboards/exports | optional text | N | supports command updates`

## Audits (Legacy + Infection Control Audit Center)
- `AuditSession.id,templateId,status,startedAt,completedAt | AuditSession | string/enum/date | id/templateId/status/startedAt R | none | legacy audit flows | generic audit session tracking | AuditSession model | id key | facilityData.auditSessions[id] | legacy audit reports | status enum draft/in_progress/completed | N | retained for compatibility`
- `InfectionControlAuditSession.id,auditType,auditDateISO,unit,shift,auditorName,notes,createdAt,updatedAt,finalizedAt | InfectionControlAuditSession | string/enum/ISO | all except finalizedAt R | none | Infection Control Audit Center | structured compliance audit session | InfectionControlAuditSession | sessionId join | facilityData.infectionControlAuditSessions[id] | dashboard metrics, print reports | auditType enum set; finalizedAt optional | N | canonical modern audit session`
- `InfectionControlAuditItem.id,sessionId,category,questionId,questionText,response,evidenceNote,severity,correctiveAction,dueDateISO,completedAt | InfectionControlAuditItem | string/enum/date | all R | none | Audit Center question grid | item-level compliance response | InfectionControlAuditItem | sessionId join | facilityData.infectionControlAuditItems[id] | scoring/overdue actions | response enum UNKNOWN/COMPLIANT/NON_COMPLIANT/NA; severity LOW/MED/HIGH | N | completedAt currently string field`

## Notifications
- `id,facilityId,createdAtISO,status,category,message,ruleId | AppNotification | string/enum/ISO | R | none | Notifications page, dashboard cards | operational alerting | AppNotification | id + facility scope | facilityData.notifications[id] | notification center, line-list prompts, alerts | status enum unread/read/dismissed; category enum constrained | N | primary notification contract`
- `residentId,unit,room | AppNotification | string | O | none | notification detail | contextual routing/filtering | AppNotification | resident join | notifications[id] | filters/navigation | resident optional for cluster alerts | N | may be undefined for facility-wide alerts`
- `clusterDetails,refs | AppNotification | array/object | O | none | grouped notification UI | drill-down linkage to source records | AppNotification | refs to abt/ip/vax/note IDs | notifications[id] | drill-down modals | IDs should reference existing records where possible | N | clusterDetails used for grouped suggestions`
- `actedAt,lineListRecordId,action,payload | AppNotification | ISO/string/enum/object | O | none | Add to Line List workflow | action state tracking | AppNotification | lineListRecordId join | notifications[id] | action completion/reporting | action currently add_to_line_list only | N | payload follows LineListNotificationPayload`

## Shift Log
- `id,facilityId,createdAtISO,shift,tags,priority,body | ShiftLogEntry | string/enum/array | R | none | Notes > Shift Log | handoff communication | ShiftLogEntry | facilityId | facilityData.shiftLog[id] | shift reports | shift enum Day/Night; tags enum set; priority enum FYI/Action Needed | N | shiftLog store is optional in FacilityStore`
- `unit,residentRefs,outbreakRef | ShiftLogEntry | string/array/object | O | none | shift log entry form | links handoff to residents/outbreaks | ShiftLogEntry | resident/outbreak linkage | shiftLog[id] | continuity and investigations | residentRefs require mrn/name pairs | N | supports multi-resident entry`

## Survey Packets + Export Profiles
- `SurveyPacket.id,facilityId,title,createdAt,sections | SurveyPacket | string/ISO/array | R | none | Survey Packet builder | packet assembly and archival | SurveyPacket | packetId + facilityId | facilityData.surveyPackets[id] | survey prep and exports | sections ordered list required | N | generatedAt optional`
- `createdBy,generatedAt,notes | SurveyPacket | string/date | O | none | packet metadata panel | provenance and context | SurveyPacket | none | surveyPackets[id] | review workflows | optional | N | generatedAt marks output generation`
- `SurveyPacketSection.id,type,title,order,sourceRef,options | SurveyPacketSection | string/enum/number/object | id/type/title/order R | none | Packet Builder section editor | composable packet content | SurveyPacketSection | sourceRef links section source | surveyPackets[id].sections[] | packet rendering | type enum cover/toc/report/audit/outbreak/attachment | N | options is free-form object`
- `ExportProfile.id,name,facilityId,type,dataset,columns,includePHI,createdAt,updatedAt | ExportProfile | string/enum/array/bool/ISO | R | none | Reports/export profile flows | reusable export configuration | ExportProfile | profileId + facilityId | facilityData.exportProfiles[id] | exports/report pipelines | type enum csv/json/pdf; facilityId must match store key | N | commit gate validates facilityId`
- `ExportColumn.header,fieldPath,transform,required | ExportColumn | string/bool | header+fieldPath R | none | export profile column config | maps exported fields | ExportProfile columns | none | exportProfiles[id].columns[] | export engine | fieldPath should resolve on dataset rows | N | transform is optional function key`

## Storage Schema Types (authoritative persistence)
- `FacilityStore.currentRole | FacilityStore | UserRole enum | O | defaults to Nurse when absent | app providers/role context | persisted RBAC state | FacilityStore contract | none | UNIFIED_DB.data.facilityData[facilityId].currentRole | guards/sidebar permissions | fallback to Nurse on read | N | role key also persisted separately`
- `FacilityStore collections (residents/quarantine/abts/infections/vaxEvents/notes/staff/staffVaxEvents/fitTestEvents/auditSessions/outbreaks/outbreakCases/outbreakExposures/outbreakDailyStatuses/exportProfiles/surveyPackets/infectionControlAuditSessions/infectionControlAuditItems/notifications/lineListEvents/shiftLog) | FacilityStore | Record<string,T> | mostly R except optional lineListEvents/shiftLog | empty object on init/backfill | all module pages | facility-scoped entity stores | FacilityStore | each record keyed by id/mrn/tempId | UNIFIED_DB.data.facilityData[facilityId].* | all app modules | migration back-fills missing stores | N | emptyFacilityStore + migratePreV2toV2 enforce defaults`
- `dismissedRuleKeys,mutationLog,notificationMeta | FacilityStore | array/object | O | none | notifications + provider mutation logger | dedupe and audit metadata | FacilityStore | mutationLog references entityId | facilityData[facilityId].* | notifications/undo/audit | mutationLog capped to 500 entries in providers | N | append-only mutation trail`
- `UnifiedDB.schemaName,schemaVersion,createdAt,updatedAt,integrity,data | UnifiedDB | string/ISO/object | R | schemaName UNIFIED_DB; schemaVersion UNIFIED_DB_V2 | storage engine bootstrap | top-level DB envelope | UnifiedDB contract | none | UNIFIED_DB_MAIN value | global load/save/migrations | schemaVersion must be UNIFIED_DB_V2 post migration | N | migration upgrades pre-V2`
- `data.facilities.byId,activeFacilityId | UnifiedDB | Record + string | R | default fac-default created if missing | Settings/facility context | facility registry and active scope | UnifiedDB | facilityId join root | UNIFIED_DB.data.facilities | multi-facility routing | active facility must exist in byId | N | default facility auto-created`

## Critical Field Examples
- `residentId` example: `lineListEvents[evt-1].residentId = "MRN12345"`; joins to `residents[MRN12345]`.
- `mrn` example: `residents["MRN12345"].mrn = "MRN12345"`; canonical resident key.
- `outbreakId` example: `ipEvent.outbreakId = "ob-2026-03"` then `outbreaks["ob-2026-03"]`.
- `administeredDate/dateGiven` example read: `const administeredOn = vax.dateGiven ?? vax.administeredDate`.

## Developer Checklist (required before merging field changes)
- [ ] Update `docs/data-field-reference.md` with new/changed field metadata.
- [ ] Update `src/domain/models.ts` type definitions.
- [ ] Update storage migrations (`runMigrations` / backfills) if schema changes.
- [ ] Update write/read fallbacks for deprecated fields.
- [ ] Update reports, exports, and notification rules that consume the field.
- [ ] Validate routing and UI docs if field impacts user workflows.
