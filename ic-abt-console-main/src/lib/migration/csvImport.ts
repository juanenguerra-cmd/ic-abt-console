import { ABTCourse, IPEvent, QuarantineResident, Resident, ResidentRef, VaxEvent } from "../../domain/models";
import { MigrationDatasetType } from "./csvTemplates";

export interface CsvColumnMapping {
  column: string;
  mappedField: string | null;
}

export interface CsvParsedData {
  headers: string[];
  rows: string[][];
}

const normalize = (value: string) => value.trim().toLowerCase().replace(/[\s_]+/g, "");

const FIELD_SYNONYMS: Record<MigrationDatasetType, Record<string, string[]>> = {
  ABT: {
    id: ["id", "abtid", "courseid"],
    residentId: ["residentid", "residentref", "resident"],
    mrn: ["mrn", "medicalrecordnumber"],
    status: ["status", "coursestatus"],
    medication: ["medication", "antibiotic", "drug"],
    medicationClass: ["medicationclass", "drugclass"],
    route: ["route"],
    frequency: ["frequency"],
    indication: ["indication"],
    infectionSource: ["infectionsource", "source"],
    syndromeCategory: ["syndromecategory", "syndrome", "category"],
    startDate: ["startdate", "start"],
    endDate: ["enddate", "end", "stopdate"],
    cultureCollected: ["culturecollected", "culture"],
    cultureCollectionDate: ["culturecollectiondate", "culturedate"],
    cultureSource: ["culturesource"],
    organismIdentified: ["organismidentified", "organism"],
    sensitivitySummary: ["sensitivitysummary", "sensitivity"],
    diagnostics: ["diagnostics", "diagnostic", "dx"],
    locationUnit: ["locationunit", "unit", "currentunit"],
    locationRoom: ["locationroom", "room", "currentroom"],
    notes: ["notes", "note"],
    createdAt: ["createdat", "created"],
    updatedAt: ["updatedat", "updated"],
  },
  IP: {
    id: ["id", "ipeventid"],
    residentId: ["residentid", "residentref", "resident"],
    mrn: ["mrn", "medicalrecordnumber"],
    status: ["status", "eventstatus"],
    infectionCategory: ["infectioncategory", "category"],
    infectionSite: ["infectionsite", "site"],
    sourceOfInfection: ["sourceofinfection", "source"],
    isolationType: ["isolationtype", "isolation"],
    ebp: ["ebp", "enhancedbarrierprecaution"],
    organism: ["organism"],
    specimenCollectedDate: ["specimencollecteddate", "specimendate"],
    labResultDate: ["labresultdate", "labdate"],
    outbreakId: ["outbreakid"],
    locationUnit: ["locationunit", "unit", "currentunit"],
    locationRoom: ["locationroom", "room", "currentroom"],
    notes: ["notes", "note"],
    createdAt: ["createdat", "created"],
    updatedAt: ["updatedat", "updated"],
  },
  VAX: {
    id: ["id", "vaxid", "vaccinationid"],
    residentId: ["residentid", "residentref", "resident"],
    mrn: ["mrn", "medicalrecordnumber"],
    vaccine: ["vaccine", "vaccinename"],
    status: ["status", "vaccinestatus"],
    dateGiven: ["dategiven", "givendate", "date"],
    dueDate: ["duedate", "nextduedate"],
    offerDate: ["offerdate", "offereddate"],
    declineReason: ["declinereason", "refusalreason"],
    notes: ["notes", "note"],
    createdAt: ["createdat", "created"],
    updatedAt: ["updatedat", "updated"],
  },
};

const FIELD_ORDER: Record<MigrationDatasetType, string[]> = {
  ABT: Object.keys(FIELD_SYNONYMS.ABT),
  IP: Object.keys(FIELD_SYNONYMS.IP),
  VAX: Object.keys(FIELD_SYNONYMS.VAX),
};

export const parseCsv = (text: string): CsvParsedData => {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[i + 1] === "\n") {
        i++;
      }
      row.push(current.trim());
      current = "";
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    current += char;
  }

  row.push(current.trim());
  if (row.some((value) => value.length > 0)) {
    rows.push(row);
  }

  return {
    headers: rows[0] || [],
    rows: rows.slice(1),
  };
};

export const buildAutoMapping = (headers: string[], type: MigrationDatasetType): CsvColumnMapping[] => {
  return headers.map((header) => {
    const normalized = normalize(header);
    const mappedField =
      FIELD_ORDER[type].find((field) => FIELD_SYNONYMS[type][field].includes(normalized)) || null;
    return {
      column: header,
      mappedField,
    };
  });
};

export const getDatasetFields = (type: MigrationDatasetType) => FIELD_ORDER[type];

export const normalizeDate = (value: string): string | undefined => {
  if (!value.trim()) return undefined;
  const trimmed = value.trim();
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/;
  const usDate = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const isoMatch = trimmed.match(isoDate);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const usMatch = trimmed.match(usDate);
  if (!usMatch) return undefined;
  const month = usMatch[1].padStart(2, "0");
  const day = usMatch[2].padStart(2, "0");
  return `${usMatch[3]}-${month}-${day}`;
};

export const normalizeStatus = (type: MigrationDatasetType, value: string): string | undefined => {
  if (!value.trim()) return undefined;
  const normalized = normalize(value);
  const statusMap: Record<MigrationDatasetType, Record<string, string>> = {
    ABT: {
      active: "active",
      completed: "completed",
      complete: "completed",
      discontinued: "discontinued",
      stopped: "discontinued",
    },
    IP: {
      active: "active",
      resolved: "resolved",
      historical: "historical",
      history: "historical",
    },
    VAX: {
      given: "given",
      due: "due",
      overdue: "overdue",
      declined: "declined",
      scheduled: "scheduled",
      contraindicated: "contraindicated",
    },
  };
  return statusMap[type][normalized];
};

export const normalizeBoolean = (value: string): boolean | undefined => {
  if (!value.trim()) return undefined;
  const normalized = normalize(value);
  if (["true", "yes", "1", "y"].includes(normalized)) return true;
  if (["false", "no", "0", "n"].includes(normalized)) return false;
  return undefined;
};

export interface ImportRowError {
  rowNumber: number;
  message: string;
}

export interface ImportResult {
  importedCount: number;
  updatedCount: number;
  errors: ImportRowError[];
  /** Number of QuarantineResident records created for MRNs not found in active census or historical list. */
  quarantineCreated: number;
}

interface ImportContext {
  residents: Record<string, Resident>;
  quarantine: Record<string, QuarantineResident>;
  abts: Record<string, ABTCourse>;
  infections: Record<string, IPEvent>;
  vaxEvents: Record<string, VaxEvent>;
  nowISO: string;
  createId: () => string;
}

const getMappedValue = (row: string[], mapping: CsvColumnMapping[], field: string): string => {
  const index = mapping.findIndex((entry) => entry.mappedField === field);
  return index >= 0 ? (row[index] || "").trim() : "";
};

const getResidentRef = (row: string[], mapping: CsvColumnMapping[]): ResidentRef | null => {
  const residentId = getMappedValue(row, mapping, "residentId");
  const mrn = getMappedValue(row, mapping, "mrn");
  const candidate = residentId || mrn;
  if (!candidate) return null;
  return candidate.startsWith("Q:")
    ? { kind: "quarantine", id: candidate }
    : { kind: "mrn", id: candidate };
};

/**
 * 3-tier resident resolution:
 *  Tier 1 — Active census: isHistorical !== true, status not Discharged/Deceased
 *  Tier 2 — Historical list: isHistorical === true
 *  Tier 3 — Unresolved: creates a QuarantineResident for manual linking
 *
 * Returns the effective ResidentRef and whether a quarantine record was created.
 */
const resolveResidentRef = (
  mrn: string,
  context: ImportContext,
  rowNumber: number,
  type: MigrationDatasetType
): { ref: ResidentRef; quarantined: boolean } => {
  const residentList = Object.values(context.residents);

  // Tier 1: active census
  const isActive = residentList.some(
    (r) => r.mrn === mrn && !r.isHistorical && r.status !== 'Discharged' && r.status !== 'Deceased'
  );
  if (isActive) return { ref: { kind: 'mrn', id: mrn }, quarantined: false };

  // Tier 2: historical list
  const isHistorical = residentList.some(
    (r) => r.mrn === mrn && r.isHistorical === true
  );
  if (isHistorical) return { ref: { kind: 'mrn', id: mrn }, quarantined: false };

  // Tier 3: not found anywhere — create quarantine placeholder
  const quarantineId = `Q:${context.createId()}`;
  context.quarantine[quarantineId] = {
    tempId: quarantineId,
    displayName: `MRN ${mrn}`,
    source: 'census_missing_mrn',
    rawHint: `${type} row ${rowNumber} — MRN: ${mrn}`,
    createdAt: context.nowISO,
    updatedAt: context.nowISO,
  };
  return { ref: { kind: 'quarantine', id: quarantineId }, quarantined: true };
};

const findExistingRecordId = (
  type: MigrationDatasetType,
  row: string[],
  mapping: CsvColumnMapping[],
  residentRef: ResidentRef,
  context: ImportContext
): string | null => {
  const explicitId = getMappedValue(row, mapping, "id");
  if (explicitId) return explicitId;

  if (type === "ABT") {
    const medication = getMappedValue(row, mapping, "medication");
    const startDate = normalizeDate(getMappedValue(row, mapping, "startDate"));
    const existing = Object.values(context.abts).find(
      (item) =>
        item.residentRef.id === residentRef.id &&
        item.medication === medication &&
        (item.startDate || "") === (startDate || "")
    );
    return existing?.id || null;
  }
  if (type === "IP") {
    const infectionSite = getMappedValue(row, mapping, "infectionSite");
    const organism = getMappedValue(row, mapping, "organism");
    const specimenCollectedDate = normalizeDate(getMappedValue(row, mapping, "specimenCollectedDate"));
    const existing = Object.values(context.infections).find(
      (item) =>
        item.residentRef.id === residentRef.id &&
        (item.infectionSite || "") === infectionSite &&
        (item.organism || "") === organism &&
        (item.specimenCollectedDate || "") === (specimenCollectedDate || "")
    );
    return existing?.id || null;
  }
  const vaccine = getMappedValue(row, mapping, "vaccine");
  const dateGiven = normalizeDate(getMappedValue(row, mapping, "dateGiven"));
  const existing = Object.values(context.vaxEvents).find(
    (item) =>
      item.residentRef.id === residentRef.id &&
      item.vaccine === vaccine &&
      (item.dateGiven || "") === (dateGiven || "")
  );
  return existing?.id || null;
};

export const importMappedRows = (
  type: MigrationDatasetType,
  rows: string[][],
  mapping: CsvColumnMapping[],
  context: ImportContext
): ImportResult => {
  const errors: ImportRowError[] = [];
  let importedCount = 0;
  let updatedCount = 0;
  let quarantineCreated = 0;

  rows.forEach((row, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const residentRef = getResidentRef(row, mapping);
    if (!residentRef) {
      errors.push({ rowNumber, message: "Missing resident linkage (residentId or MRN)." });
      return;
    }

    // 3-tier resolution — only applies to MRN-based refs (Q: refs pass through as-is)
    let effectiveResidentRef = residentRef;
    if (residentRef.kind === "mrn") {
      const { ref, quarantined } = resolveResidentRef(residentRef.id, context, rowNumber, type);
      effectiveResidentRef = ref;
      if (quarantined) quarantineCreated++;
    }

    const dateFields: Record<MigrationDatasetType, string[]> = {
      ABT: ["startDate", "endDate", "cultureCollectionDate"],
      IP: ["specimenCollectedDate", "labResultDate"],
      VAX: ["dateGiven", "dueDate", "offerDate"],
    };
    for (const field of dateFields[type]) {
      const raw = getMappedValue(row, mapping, field);
      if (raw && !normalizeDate(raw)) {
        errors.push({ rowNumber, message: `Invalid date format for ${field}. Use YYYY-MM-DD or MM/DD/YYYY.` });
        return;
      }
    }

    const existingId = findExistingRecordId(type, row, mapping, effectiveResidentRef, context);
    const id = existingId || context.createId();
    const createdAt = getMappedValue(row, mapping, "createdAt") || context.nowISO;
    const updatedAt = getMappedValue(row, mapping, "updatedAt") || context.nowISO;

    if (type === "ABT") {
      const status = normalizeStatus("ABT", getMappedValue(row, mapping, "status")) || "completed";
      const medication = getMappedValue(row, mapping, "medication");
      if (!medication) {
        errors.push({ rowNumber, message: "ABT medication is required." });
        return;
      }
      const diagnosticsRaw = getMappedValue(row, mapping, "diagnostics");
      let diagnostics: object | undefined;
      if (diagnosticsRaw) {
        try {
          diagnostics = JSON.parse(diagnosticsRaw);
        } catch {
          diagnostics = { source: diagnosticsRaw };
        }
      }
      context.abts[id] = {
        id,
        residentRef: effectiveResidentRef,
        status: status as ABTCourse["status"],
        medication,
        medicationClass: getMappedValue(row, mapping, "medicationClass") || undefined,
        route: getMappedValue(row, mapping, "route") || undefined,
        frequency: getMappedValue(row, mapping, "frequency") || undefined,
        indication: getMappedValue(row, mapping, "indication") || undefined,
        infectionSource: getMappedValue(row, mapping, "infectionSource") || undefined,
        syndromeCategory: getMappedValue(row, mapping, "syndromeCategory") || undefined,
        startDate: normalizeDate(getMappedValue(row, mapping, "startDate")),
        endDate: normalizeDate(getMappedValue(row, mapping, "endDate")),
        cultureCollected: normalizeBoolean(getMappedValue(row, mapping, "cultureCollected")),
        cultureCollectionDate: normalizeDate(getMappedValue(row, mapping, "cultureCollectionDate")),
        cultureSource: getMappedValue(row, mapping, "cultureSource") || undefined,
        organismIdentified: getMappedValue(row, mapping, "organismIdentified") || undefined,
        sensitivitySummary: getMappedValue(row, mapping, "sensitivitySummary") || undefined,
        diagnostics,
        locationSnapshot: {
          unit: getMappedValue(row, mapping, "locationUnit") || undefined,
          room: getMappedValue(row, mapping, "locationRoom") || undefined,
        },
        notes: getMappedValue(row, mapping, "notes") || undefined,
        createdAt,
        updatedAt,
      };
    } else if (type === "IP") {
      const status = normalizeStatus("IP", getMappedValue(row, mapping, "status")) || "resolved";
      context.infections[id] = {
        id,
        residentRef: effectiveResidentRef,
        status: status as IPEvent["status"],
        infectionCategory: getMappedValue(row, mapping, "infectionCategory") || undefined,
        infectionSite: getMappedValue(row, mapping, "infectionSite") || undefined,
        sourceOfInfection: getMappedValue(row, mapping, "sourceOfInfection") || undefined,
        isolationType: getMappedValue(row, mapping, "isolationType") || undefined,
        ebp: normalizeBoolean(getMappedValue(row, mapping, "ebp")),
        organism: getMappedValue(row, mapping, "organism") || undefined,
        specimenCollectedDate: normalizeDate(getMappedValue(row, mapping, "specimenCollectedDate")),
        labResultDate: normalizeDate(getMappedValue(row, mapping, "labResultDate")),
        outbreakId: getMappedValue(row, mapping, "outbreakId") || undefined,
        locationSnapshot: {
          unit: getMappedValue(row, mapping, "locationUnit") || undefined,
          room: getMappedValue(row, mapping, "locationRoom") || undefined,
        },
        notes: getMappedValue(row, mapping, "notes") || undefined,
        createdAt,
        updatedAt,
      };
    } else {
      const status = normalizeStatus("VAX", getMappedValue(row, mapping, "status")) || "given";
      const vaccine = getMappedValue(row, mapping, "vaccine");
      if (!vaccine) {
        errors.push({ rowNumber, message: "VAX vaccine is required." });
        return;
      }
      context.vaxEvents[id] = {
        id,
        residentRef: effectiveResidentRef,
        vaccine,
        status: status as VaxEvent["status"],
        dateGiven: normalizeDate(getMappedValue(row, mapping, "dateGiven")),
        dueDate: normalizeDate(getMappedValue(row, mapping, "dueDate")),
        offerDate: normalizeDate(getMappedValue(row, mapping, "offerDate")),
        declineReason: getMappedValue(row, mapping, "declineReason") || undefined,
        notes: getMappedValue(row, mapping, "notes") || undefined,
        createdAt,
        updatedAt,
      };
    }

    if (existingId) updatedCount++;
    else importedCount++;
  });

  return { importedCount, updatedCount, errors, quarantineCreated };
};
