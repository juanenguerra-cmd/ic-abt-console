// ═══════════════════════════════════════════════════════════════════════════════
// SINGLE SOURCE OF TRUTH for all domain types.
// Do NOT add types to src/types.ts — that file is a deprecated re-export shim.
// ═══════════════════════════════════════════════════════════════════════════════

export type ISO = string;

import type { UserRole } from '../types/roles';
export type { UserRole } from '../types/roles';

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
  /**
   * Unified current location. Supersedes the legacy `currentUnit` / `currentRoom` pair.
   * Writers should populate this field. Readers should prefer `location.unit ?? currentUnit`.
   */
  location?: { unit?: string; room?: string };
  /** @deprecated Use location.unit instead. */
  currentUnit?: string;
  /** @deprecated Use location.room instead. */
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
  /** @deprecated Use location.unit (snapshot from deactivation). */
  lastKnownUnit?: string;
  /** @deprecated Use location.room (snapshot from deactivation). */
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
  clinicalDevices?: {
    oxygen: {
      enabled: boolean;
      mode: "PRN" | "Continuous" | null;
    };
    urinaryCatheter: {
      active: boolean;
      insertedDate: string | null;
    };
    indwellingCatheter: {
      active: boolean;
      insertedDate: string | null;
    };
    midline: {
      active: boolean;
      insertedDate: string | null;
    };
    picc: {
      active: boolean;
      insertedDate: string | null;
    };
    piv: {
      active: boolean;
      insertedDate: string | null;
    };
    centralLine: {
      active: boolean;
      insertedDate: string | null;
    };
    trach: {
      active: boolean;
      insertedDate: string | null;
    };
    peg: {
      active: boolean;
      insertedDate: string | null;
    };
    woundVac: {
      active: boolean;
      insertedDate: string | null;
    };
    dialysisAccess: {
      active: boolean;
      insertedDate: string | null;
    };
    ostomy: {
      active: boolean;
      insertedDate: string | null;
    };
  };
}

export interface QuarantineResident {
  tempId: string; // MUST be Q:<uuid>
  displayName?: string;
  dob?: string;
  /**
   * Unified location snapshot captured at the time of quarantine record creation.
   * Supersedes the legacy `unitSnapshot` / `roomSnapshot` pair.
   */
  location?: { unit?: string; room?: string };
  /** @deprecated Use location.unit instead. */
  unitSnapshot?: string;
  /** @deprecated Use location.room instead. */
  roomSnapshot?: string;
  source: "legacy_import" | "census_missing_mrn" | "manual_entry";
  rawHint?: string;
  createdAt: ISO;
  updatedAt: ISO;
  resolvedToMrn?: string;
}

/** Antibiotic sensitivity result for a specific agent in a culture. */
export interface SensitivityResult {
  antibiotic: string;
  /** S = Susceptible, I = Intermediate, R = Resistant */
  result: 'S' | 'I' | 'R';
  mic?: string;
}

/** A standalone culture result used in the Antibiogram Builder. */
export interface CultureResult {
  id: string;
  facilityId: string;
  collectionDate: string;
  /** Body site (e.g. "Urine", "Blood", "Wound"). */
  source: string;
  organism: string;
  sensitivities: SensitivityResult[];
  /** Optional link back to an ABT course. */
  linkedAbtId?: string;
  residentRef?: ResidentRef;
  notes?: string;
  createdAt: ISO;
  updatedAt: ISO;
}

/** A logged stewardship intervention on an ABT course. */
export interface AbtIntervention {
  date: ISO;
  type: 'De-escalation' | 'Discontinuation' | 'Guideline Compliance' | 'Timeout Review' | 'IV-to-PO' | 'Dose Optimization' | 'Other';
  note: string;
  loggedBy: string;
}

export interface ABTCourse {
  id: string;
  residentRef: ResidentRef;
  status: "active" | "completed" | "discontinued";
  medication: string;
  medicationId?: string;
  enteredMedicationText?: string;
  medicationClass?: string;
  dose?: string;
  doseUnit?: string;
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
  /** ISO date of the 72-hour antibiotic timeout review. */
  timeoutReviewDate?: string;
  /** Indicates if this is a broad-spectrum antibiotic course. */
  isBroadSpectrum?: boolean;
  /** Stewardship interventions logged against this course. */
  interventions?: AbtIntervention[];
  createdAt: ISO;
  updatedAt: ISO;
}

/** High-level category for an IP event indication / risk factor. */
export type IndicationCategory = 'Catheter' | 'Wound' | 'Respiratory' | 'MDRO' | 'Ostomy' | 'Other';

/**
 * A single structured indication (device, wound, or other risk factor) associated
 * with an IP event. Multiple indications can be tracked per event using the
 * `indications` array on `IPEvent`.
 */
export interface IPEventIndication {
  id: string;
  category: IndicationCategory;

  // --- Wound fields ---

  /** Populated when category === 'Wound' — anatomical location (e.g. "Left Heel") */
  woundSite?: string;
  /** Populated when category === 'Wound' — wound classification (e.g. "Pressure Ulcer Stage IV") */
  woundType?: string;

  // --- MDRO fields ---

  /** Populated when category === 'MDRO' — the specific organism type. */
  mdroType?: 'MRSA' | 'VRE' | 'ESBL' | 'CRE' | 'CRAB/CRPA' | 'Other';
  /** Free-text MDRO description used when mdroType === 'Other'. */
  mdroOtherText?: string;

  // --- Catheter fields (used by 'Catheter' category and optionally by 'MDRO') ---

  /**
   * High-level catheter category — e.g. "Urinary", "Feeding Tube", "Vascular Access", "Other".
   * Used to group and filter catheter type options.
   */
  catheterCategory?: string;
  /** Catheter type — e.g. "Indwelling (Foley)", "Suprapubic", "PICC Line", "Central Line", "Other". */
  catheterType?: string;
  /** Free-text catheter description used when catheterType === 'Other'. */
  catheterOtherText?: string;

  // --- Ostomy fields ---

  /** Populated when category === 'Ostomy' — the specific ostomy type (e.g. "Colostomy", "Ileostomy"). */
  ostomyType?: 'Colostomy' | 'Ileostomy' | 'Urostomy' | 'Other';
  /** Free-text ostomy description used when ostomyType === 'Other'. */
  ostomyOtherText?: string;

  /** Optional date the indication was first identified (YYYY-MM-DD). */
  dateIdentified?: string;
  /** Free-text notes specific to this indication. */
  notes?: string;
}

export interface IPEvent {
  id: string;
  residentRef: ResidentRef;
  status: "active" | "resolved" | "historical";
  onsetDate?: string;
  infectionCategory?: string;
  infectionSite?: string;
  sourceOfInfection?: string;
  /** Distinguishes the primary protocol type for display and reporting. */
  protocolType?: "EBP" | "Isolation";
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
  /** Device types present at onset (e.g. "Urinary Catheter"). Stored top-level for NHSN checker. */
  deviceTypes?: string[];
  /**
   * Structured indications / risk factors for this IP event.
   * Supersedes the legacy flat `deviceTypes` array for EBP events.
   * Multiple indications can be added (e.g. a Urinary Catheter and a Wound
   * on the same event). The legacy `deviceTypes` field is derived from this
   * array on save for backward-compatible NHSN checks.
   */
  indications?: IPEventIndication[];
  /** NHSN LTC CAUTI surveillance verdict persisted on save. */
  nhsnCautiMet?: boolean | null;
  /** NHSN LTC C. diff LabID surveillance verdict persisted on save. */
  nhsnCdiffLabIdMet?: boolean | null;
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
  auditorName?: string;
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
  type?: 'note' | 'sbar_handoff';
  /** Hashtags extracted from the note body (e.g. ["#Symptom", "#Fall"]). */
  hashtags?: string[];
  /** True when the entry was auto-generated by the hashtag sync hook. */
  autoGenerated?: boolean;
  /** The hashtag value that triggered auto-generation (e.g. "Symptomatic"). */
  sourceResidentHashtag?: string;
  /** Set when line list follow-up has been completed for this entry. */
  lineListClearedAtISO?: string;
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
  | 'loss_of_taste_smell'
  | 'headache'
  | 'chest_pain'
  | 'wheezing'
  | 'chills'
  | 'fatigue';

export type GISymptomTag =
  | 'diarrhea'
  | 'nausea'
  | 'vomiting'
  | 'stomach_cramping'
  | 'loss_of_appetite'
  | 'blood_in_stool'
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
  symptoms?: SymptomTag[];
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
  disposition?: string;
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

  /** Set when a user acts on the notification. ISO timestamp. */
  actedAt?: ISO;
  /** ID of the LineListEvent created/updated as a result of acting on this notification. */
  lineListRecordId?: string;
  /** Present on LINE_LIST_REVIEW notifications that recommend line listing. */
  action?: 'add_to_line_list';
  /** Structured context for the recommended line list action. */
  payload?: LineListNotificationPayload;

}

// ─── Contact Tracing ─────────────────────────────────────────────────────────

export interface ContactTraceCase {
  id: string;
  status: 'open' | 'closed';
  indexResidentMrn: string;
  indexRef:
    | { kind: 'ipEvent'; id: string }
    | { kind: 'symptom'; residentMrn: string; startISO: string; endISO?: string };
  syndromeOrOrganism?: string;
  notes?: string;
  createdAt: ISO;
  updatedAt: ISO;
}

export interface ContactTraceExposure {
  id: string;
  caseId: string;
  personRef: { kind: 'resident'; mrn: string } | { kind: 'staff'; staffId: string };
  exposureStartISO: string;
  exposureEndISO?: string;
  location?: string;
  risk: 'low' | 'medium' | 'high';
  actions: {
    monitoring?: boolean;
    testing?: boolean;
    isolation?: boolean;
    notes?: string;
  };
  outcome?: string;
  createdAt: ISO;
  updatedAt: ISO;
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

/** IP Admission Screening record — captures infection-prevention assessment within 72h of admission. */
export interface AdmissionScreeningRecord {
  id: string;
  residentId?: string | null;
  mrn?: string | null;
  name?: string | null;
  room?: string | null;
  unit?: string | null;
  admitDate?: string | null;
  screeningDate?: string | null;
  daysSinceAdmit?: number | null;
  /**
   * Workflow status of the screening record.
   * - `'pending'`   – virtual UI state for auto-generated entries; **never persisted to the database**.
   * - `'draft'`     – in-progress / saved but not finalised.
   * - `'completed'` – finalized; clinical data has been encoded back to the resident profile.
   */
  screeningStatus?: 'pending' | 'draft' | 'completed';
  completedBy?: string | null;
  completedByTitle?: string | null;
  notes?: string | null;
  createdAt: ISO;
  updatedAt: ISO;

  admissionSource?: string | null;
  recentHospitalization?: boolean | null;
  transferFromFacility?: boolean | null;
  currentSymptoms?: string[] | null;
  currentDiagnosis?: string | null;
  isolationStatus?: string | null;
  precautionType?: string | null;
  mdroHistory?: boolean | null;
  mdroOrganism?: string | null;
  recentAntibiotics?: boolean | null;
  antibioticDetails?: string | null;
  devicesPresent?: string[] | null;
  vaccinationReviewed?: boolean | null;
  vaccinationNotes?: string | null;
  followUpActions?: string | null;
  recommendations?: string | null;
}

export interface FacilityStore {
  /** Current user role for RBAC. Defaults to 'Nurse' when absent. */
  currentRole?: UserRole;
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
  contactTraceCases: Record<string, ContactTraceCase>;
  contactTraceExposures: Record<string, ContactTraceExposure>;
  lineListEvents?: Record<string, LineListEvent>;
  lineListOverrides?: Record<string, Record<string, string>>;
  shiftLog?: Record<string, ShiftLogEntry>;
  dismissedRuleKeys?: string[];
  /** Append-only audit log of data mutations. Capped at 500 most-recent entries. */
  mutationLog?: MutationLogEntry[];
  notificationMeta?: {
    lastDetectionRunAtISO?: string;
    lastSeenEventAtISO?: string;
  };
  /** IP Admission Screening records — indexed by id. Optional for backward compatibility. */
  admissionScreenings?: Record<string, AdmissionScreeningRecord>;
}

export interface UnifiedDB {
  schemaName: "UNIFIED_DB";
  schemaVersion: "UNIFIED_DB_V3";
  createdAt: ISO;
  updatedAt: ISO;
  integrity: { lastGoodWriteAt?: ISO; lastGoodBytes?: number };
  data: {
    facilities: { byId: Record<string, Facility>; activeFacilityId: string };
    facilityData: Record<string, FacilityStore>;
  };
}
