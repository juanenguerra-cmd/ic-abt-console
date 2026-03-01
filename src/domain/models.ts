// ═══════════════════════════════════════════════════════════════════════════════
// SINGLE SOURCE OF TRUTH for all domain types.
// Do NOT add types to src/types.ts — that file is a deprecated re-export shim.
// ═══════════════════════════════════════════════════════════════════════════════

export type ISO = string;

export type ResidentRef =
  | { kind: "mrn"; id: string }
  | { kind: "quarantine"; id: string };

export interface Alias {
  source: "legacy" | "census" | "manual";
  legacyId?: string;
  name?: string;
  dob?: string;
}

export interface Resident {
  mrn: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  dob?: string;
  sex?: string;
  admissionDate?: string;
  attendingMD?: string;
  currentUnit?: string;
  currentRoom?: string;
  status?: "Active" | "Discharged" | "Deceased";
  payor?: string;
  primaryDiagnosis?: string;
  /** Extended free-text description of primary diagnosis (from ADT / census import). */
  primaryDiagnosisText?: string;
  cognitiveStatus?: "Intact" | "Mildly Impaired" | "Severely Impaired" | "Unknown";
  allergies?: string[];
  identityAliases?: Alias[];
  createdAt: ISO;
  updatedAt: ISO;
  isHistorical?: boolean;
  backOfficeOnly?: boolean;
  /** Superset union: 'csv-import' (hyphenated) was used in an early schema version. */
  historicalSource?: 'manual' | 'csv_import' | 'csv-import';
  lastKnownUnit?: string;
  lastKnownRoom?: string;
  lastKnownAttendingMD?: string;
  dischargedAt?: ISO;
  /** ISO timestamp of the last census file in which this resident appeared. */
  lastSeenOnCensusAt?: ISO;
  /** Set when a resident is soft-deleted from the active census without a discharge event. */
  deactivatedAt?: ISO;
  dischargeReason?: string;
  /** Snapshot of location / MD at the time of deactivation. */
  deactivationSnapshot?: {
    unit: string;
    room: string;
    attendingMD: string;
    admissionDate: string;
  };
}

export interface QuarantineResident {
  tempId: string; // MUST be Q:<uuid>
  displayName?: string;
  dob?: string;
  unitSnapshot?: string;
  roomSnapshot?: string;
  source: "legacy_import" | "census_missing_mrn" | "manual_entry";
  rawHint?: string;
  createdAt: ISO;
  updatedAt: ISO;
  resolvedToMrn?: string;
}

export interface ABTCourse {
  id: string;
  residentRef: ResidentRef;
  status: "active" | "completed" | "discontinued";
  medication: string;
  medicationClass?: string;
  dose?: string;
  route?: string;
  frequency?: string;
  indication?: string;
  infectionSource?: string;
  syndromeCategory?: string;
  startDate?: string;
  endDate?: string;
  cultureCollected?: boolean;
  cultureCollectionDate?: string;
  cultureSource?: string;
  organismIdentified?: string;
  sensitivitySummary?: string;
  diagnostics?: object;
  /** Location snapshot captured at the time of record creation. */
  locationSnapshot?: { unit?: string; room?: string; attendingMD?: string; capturedAt?: ISO };
  prescriber?: string;
  notes?: string;
  createdAt: ISO;
  updatedAt: ISO;
}

export interface IPEvent {
  id: string;
  residentRef: ResidentRef;
  status: "active" | "resolved" | "historical";
  onsetDate?: string;
  infectionCategory?: string;
  infectionSite?: string;
  sourceOfInfection?: string;
  isolationType?: string;
  ebp?: boolean;
  organism?: string;
  specimenCollectedDate?: string;
  labResultDate?: string;
  outbreakId?: string;
  locationSnapshot?: { unit?: string; room?: string; attendingMD?: string; capturedAt?: ISO };
  notes?: string;
  createdAt: ISO;
  updatedAt: ISO;
  resolvedAt?: ISO;
}

export interface VaxEvent {
  id: string;
  residentRef: ResidentRef;
  vaccine: string;
  status: "given" | "due" | "overdue" | "declined" | "scheduled" | "contraindicated" | "documented-historical";
  /**
   * @deprecated Use dateGiven.
   * Both fields exist for backward compatibility with records written before the rename.
   * New records should write dateGiven only. Readers should prefer dateGiven ?? administeredDate.
   */
  administeredDate?: string;
  dateGiven?: string;
  dose?: "1st" | "2nd" | "Booster" | "Single";
  lotNumber?: string;
  administeredBy?: string;
  administrationSite?: "In-House" | "Outside Provider" | "Other";
  source?: "manual-historical" | "csv-import" | "in-app";
  dueDate?: string;
  offerDate?: string;
  declineReason?: string;
  locationSnapshot?: { unit?: string; room?: string; attendingMD?: string; capturedAt?: ISO };
  notes?: string;
  createdAt: ISO;
  updatedAt: ISO;
}

export interface ResidentNote {
  id: string;
  residentRef: ResidentRef;
  noteType: string;
  title?: string;
  body: string;
  derived?: boolean;
  generator?: { name: string; version: string };
  createdAt: ISO;
  updatedAt: ISO;
}

export interface Staff {
  id: string;
  facilityId: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  /** External HR / payroll employee identifier. */
  employeeId?: string;
  role?: string;
  department?: string;
  status: "active" | "inactive";
  hireDate?: string;
  terminationDate?: string;
  createdAt: ISO;
  updatedAt: ISO;
}

export interface StaffVaxEvent {
  id: string;
  staffId: string;
  vaccine: string;
  status: "given" | "due" | "overdue" | "declined" | "scheduled" | "contraindicated";
  dateGiven?: string;
  dueDate?: string;
  offerDate?: string;
  declineReason?: string;
  notes?: string;
  createdAt: ISO;
  updatedAt: ISO;
}

export interface FitTestEvent {
  id: string;
  staffId: string;
  /** Canonical date field. Readers should prefer date ?? fitTestDate. */
  date: string;
  maskType: string;
  maskSize: string;
  passed: boolean;
  nextDueDate: string;
  /**
   * @deprecated Use date.
   * Kept for backward compatibility with records written by the original fit-test schema.
   */
  fitTestDate?: string;
  respiratorType?: string;
  model?: string;
  method?: string;
  result?: string;
  notes?: string;
  createdAt: ISO;
  updatedAt: ISO;
}

export interface Outbreak {
  id: string;
  facilityId: string;
  title: string;
  pathogen?: string;
  syndromeCategory?: string;
  startDate: string;
  endDate?: string;
  status: "suspected" | "confirmed" | "contained" | "closed";
  caseDefinition?: string;
  notes?: string;
  createdAt: ISO;
  updatedAt: ISO;
}

export interface OutbreakCase {
  id: string;
  outbreakId: string;
  residentRef: ResidentRef;
  caseStatus: "probable" | "confirmed" | "ruled_out";
  symptomOnsetDate?: string;
  specimenCollectedDate?: string;
  labResultDate?: string;
  result?: string;
  locationSnapshot?: { unit?: string; room?: string };
  linkedIpEventId?: string;
  createdAt: ISO;
  updatedAt: ISO;
}

export interface OutbreakExposure {
  id: string;
  outbreakId: string;
  residentRef: ResidentRef;
  exposureDate?: string;
  exposureType?: string;
  monitoringUntil?: string;
  outcome?: "no_symptoms" | "became_case" | "unknown";
  createdAt: ISO;
  updatedAt: ISO;
}

export interface OutbreakDailyStatus {
  id: string;
  outbreakId: string;
  date: string;
  newCases: number;
  totalCases: number;
  newExposures: number;
  isolationCount?: number;
  staffingIssues?: string;
  suppliesIssues?: string;
  narrative?: string;
  createdAt: ISO;
  updatedAt: ISO;
}

export interface ExportColumn {
  header: string;
  fieldPath: string;
  transform?: string;
  required?: boolean;
}

export interface ExportProfile {
  id: string;
  name: string;
  facilityId: string;
  type: "csv" | "json" | "pdf";
  dataset: string;
  columns: ExportColumn[];
  includePHI: boolean;
  createdAt: ISO;
  updatedAt: ISO;
}

export interface SurveyPacketSection {
  id: string;
  type: "cover" | "toc" | "report" | "audit" | "outbreak" | "attachment";
  title: string;
  sourceRef?: { kind: string; id: string };
  options?: object;
  order: number;
}

export interface SurveyPacket {
  id: string;
  facilityId: string;
  title: string;
  createdAt: ISO;
  createdBy?: string;
  sections: SurveyPacketSection[];
  generatedAt?: string;
  notes?: string;
}

export interface AuditSession {
  id: string;
  templateId: string;
  status: "draft" | "in_progress" | "completed";
  startedAt: string;
  completedAt?: string;
}

export type InfectionControlAuditResponse = "UNKNOWN" | "COMPLIANT" | "NON_COMPLIANT" | "NA";
export type InfectionControlAuditSeverity = "LOW" | "MED" | "HIGH";

export interface InfectionControlAuditSession {
  id: string;
  auditType: "HAND_HYGIENE" | "PPE" | "ISOLATION" | "EBP" | "ENV_CLEANING" | "ANTIBIOTIC_STEWARDSHIP" | "VACCINATION" | "OUTBREAK_PREP";
  auditDateISO: string;
  unit: string;
  shift: string;
  auditorName: string;
  notes: string;
  createdAt: ISO;
  updatedAt: ISO;
  finalizedAt?: ISO;
}

export interface InfectionControlAuditItem {
  id: string;
  sessionId: string;
  category: "HAND_HYGIENE" | "PPE" | "ISOLATION" | "EBP" | "ENV_CLEANING" | "ANTIBIOTIC_STEWARDSHIP" | "VACCINATION" | "OUTBREAK_PREP";
  questionId: string;
  questionText: string;
  response: InfectionControlAuditResponse;
  evidenceNote: string;
  severity: InfectionControlAuditSeverity;
  correctiveAction: string;
  dueDateISO: string;
  completedAt: string;
}

export interface FloorRoom {
  roomId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
}

export interface FloorLayout {
  id: string;
  facilityId: string;
  unitId?: string;
  name: string;
  rooms: FloorRoom[];
  version: number;
  updatedAt: ISO;
}

export interface Unit {
  id: string;
  name: string;
  bedCapacity?: number;
  roomFormat?: string;
}

export interface Facility {
  id: string;
  name: string;
  dohId?: string;
  address?: string;
  timezone?: string;
  bedCapacity?: number;
  units: Unit[];
  floorLayouts?: FloorLayout[];
  hashtagCategories?: string[];
  customReports?: any[];
  createdAt: ISO;
  updatedAt: ISO;
}

export interface ShiftLogEntry {
  id: string;
  facilityId: string;
  createdAtISO: string;
  shift: 'Day' | 'Night';
  unit?: string;
  tags: Array<'Outbreak' | 'Isolation' | 'Lab' | 'ABT' | 'Supply' | 'Education'>;
  priority: 'FYI' | 'Action Needed';
  body: string;
  residentRefs?: Array<{ mrn: string; name: string }>;
  outbreakRef?: { id: string; name: string };
}

// ─── Line List enums & types ──────────────────────────────────────────────────

export type SymptomClass = 'resp' | 'gi';

export type RespSymptomTag =
  | 'cough'
  | 'fever'
  | 'shortness_of_breath'
  | 'sore_throat'
  | 'runny_nose'
  | 'congestion'
  | 'body_aches'
  | 'loss_of_smell_taste'
  | 'chills'
  | 'fatigue';

export type GISymptomTag =
  | 'diarrhea'
  | 'nausea'
  | 'vomiting'
  | 'stomach_cramping'
  | 'loss_of_appetite'
  | 'fever';

export type SymptomTag = RespSymptomTag | GISymptomTag;

export type LineListDisposition = 'monitoring' | 'hospital_transfer' | 'resolved' | 'other';

/** Structured payload carried on LINE_LIST_REVIEW notifications that recommend line listing. */
export interface LineListNotificationPayload {
  residentId: string;
  symptomClass: SymptomClass;
  detectedAt: ISO;
  sourceEventId?: string;
  notesSnippet?: string;
}

/** A single resident line list event (resp or GI). */
export interface LineListEvent {
  id: string;
  facilityId: string;
  residentId: string;
  symptomClass: SymptomClass;
  /** ISO timestamp of symptom onset (user-confirmed). */
  onsetDateISO: ISO;
  symptoms: SymptomTag[];
  fever?: boolean;
  isolationInitiated?: boolean;
  isolationStatus?: string;
  testOrdered?: boolean;
  providerNotified?: boolean;
  disposition?: LineListDisposition;
  notes?: string;
  /** References the notification that triggered this entry. */
  sourceNotificationId?: string;
  /** References the ABT or IP event that drove detection. */
  sourceEventId?: string;
  createdAt: ISO;
  updatedAt: ISO;
}

// ─── Notifications ───────────────────────────────────────────────────────────

export interface AppNotification {
  id: string;
  facilityId: string;
  createdAtISO: string;
  status: 'unread' | 'read' | 'dismissed';
  category: 'LINE_LIST_REVIEW' | 'OUTBREAK_SUGGESTION' | 'VAX_GAP' | 'DEVICE_LINK' | 'ADMISSION_SCREENING' | 'SYMPTOM_WATCH' | 'ABT_STEWARDSHIP' | 'DEVICE_REVIEW' | 'VAX_REOFFER' | 'AUDIT_OVERDUE';
  residentId?: string;
  unit?: string;
  room?: string;
  message: string;
  clusterDetails?: { residentId: string; residentName: string; refType: 'note' | 'abt'; refId: string }[];
  refs?: {
    abtId?: string;
    ipId?: string;
    vaxId?: string;
    noteId?: string;
  };
  ruleId: string;

  /** Present on LINE_LIST_REVIEW notifications that recommend line listing. */
  action?: 'add_to_line_list';
  /** Structured context for the recommended line list action. */
  payload?: LineListNotificationPayload;
  /** ISO timestamp set when the user completes the recommended action. */
  actedAt?: ISO;
  /** ID of the LineListEvent (IP event) created/updated as a result of acting on this notification. */
  lineListEventId?: string;

}

export interface MutationLogEntry {
  /** ISO timestamp of the mutation. */
  timestamp: ISO;
  /** Identifier for the user/session performing the mutation (e.g. PIN-unlocked user label). */
  who: string;
  /** High-level action verb: 'create' | 'update' | 'delete'. */
  action: 'create' | 'update' | 'delete';
  /** Domain entity type, e.g. 'ABTCourse', 'IPEvent', 'Resident'. */
  entityType: string;
  /** Entity primary key (id, mrn, etc.). */
  entityId: string;
}

export interface FacilityStore {
  residents: Record<string, Resident>;
  quarantine: Record<string, QuarantineResident>;
  abts: Record<string, ABTCourse>;
  infections: Record<string, IPEvent>;
  vaxEvents: Record<string, VaxEvent>;
  notes: Record<string, ResidentNote>;
  staff: Record<string, Staff>;
  staffVaxEvents: Record<string, StaffVaxEvent>;
  fitTestEvents: Record<string, FitTestEvent>;
  auditSessions: Record<string, AuditSession>;
  outbreaks: Record<string, Outbreak>;
  outbreakCases: Record<string, OutbreakCase>;
  outbreakExposures: Record<string, OutbreakExposure>;
  outbreakDailyStatuses: Record<string, OutbreakDailyStatus>;
  exportProfiles: Record<string, ExportProfile>;
  surveyPackets: Record<string, SurveyPacket>;
  infectionControlAuditSessions: Record<string, InfectionControlAuditSession>;
  infectionControlAuditItems: Record<string, InfectionControlAuditItem>;
  notifications: Record<string, AppNotification>;
  lineListEvents?: Record<string, LineListEvent>;
  shiftLog?: Record<string, ShiftLogEntry>;
  dismissedRuleKeys?: string[];
  /** Append-only audit log of data mutations. Capped at 500 most-recent entries. */
  mutationLog?: MutationLogEntry[];
  notificationMeta?: {
    lastDetectionRunAtISO?: string;
    lastSeenEventAtISO?: string;
  };
}

export interface UnifiedDB {
  schemaName: "UNIFIED_DB";
  schemaVersion: "UNIFIED_DB_V2";
  createdAt: ISO;
  updatedAt: ISO;
  integrity: { lastGoodWriteAt?: ISO; lastGoodBytes?: number };
  data: {
    facilities: { byId: Record<string, Facility>; activeFacilityId: string };
    facilityData: Record<string, FacilityStore>;
  };
}
