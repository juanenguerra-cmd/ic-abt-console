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
  identityAliases?: Alias[];
  createdAt: ISO;
  updatedAt: ISO;
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
  locationSnapshot?: { unit?: string; room?: string };
  notes?: string;
  createdAt: ISO;
  updatedAt: ISO;
}

export interface IPEvent {
  id: string;
  residentRef: ResidentRef;
  status: "active" | "resolved" | "historical";
  infectionCategory?: string;
  infectionSite?: string;
  sourceOfInfection?: string;
  isolationType?: string;
  ebp?: boolean;
  organism?: string;
  specimenCollectedDate?: string;
  labResultDate?: string;
  outbreakId?: string;
  locationSnapshot?: { unit?: string; room?: string };
  notes?: string;
  createdAt: ISO;
  updatedAt: ISO;
}

export interface VaxEvent {
  id: string;
  residentRef: ResidentRef;
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
  displayName: string;
  employeeId?: string;
  role?: string;
  department?: string;
  createdAt: ISO;
  updatedAt: ISO;
}

export interface StaffVaxEvent {
  id: string;
  staffId: string;
  vaccine: string;
  status: "given" | "due" | "declined";
  dateGiven?: string;
  dueDate?: string;
  declineReason?: string;
  createdAt: ISO;
  updatedAt: ISO;
}

export interface FitTestEvent {
  id: string;
  staffId: string;
  fitTestDate: string;
  respiratorType?: string;
  model?: string;
  size?: string;
  method?: string;
  result?: string;
  nextDueDate?: string;
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
  roomFormat?: string;
}

export interface Facility {
  id: string;
  name: string;
  dohId?: string;
  address?: string;
  timezone?: string;
  units: Unit[];
  floorLayouts?: FloorLayout[];
  createdAt: ISO;
  updatedAt: ISO;
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
}

export interface UnifiedDB {
  schemaName: "UNIFIED_DB";
  schemaVersion: "UNIFIED_DB_V2";
  createdAt: ISO;
  updatedAt: ISO;
  integrity: { lastGoodWriteAt?: ISO; lastGoodBytes?: number };
  data: {
    facilities: { byId: Record<string, Facility>; activeFacilityId: string; };
    facilityData: Record<string, FacilityStore>; 
  };
}
