import Papa from "papaparse";
import { ABTCourse } from "../domain/models";

export type AbtStagingStatus = "OK" | "NEEDS_REVIEW" | "ERROR" | "DUPLICATE";

export interface AbtCsvRowData {
  mrn: string;
  residentName: string;
  medicationName: string;
  dose: string;
  route: string;
  frequency: string;
  startDate: string;
  endDate: string;
  indication: string;
  status: string;
}

export interface AbtCsvDuplicateMatch {
  id: string;
  medication: string;
  startDate: string;
  status: string;
}

export interface AbtCsvStagingRow {
  rowId: string;
  data: AbtCsvRowData;
  status: AbtStagingStatus;
  errors: string[];
  warnings: string[];
  skip: boolean;
  duplicateMatch?: AbtCsvDuplicateMatch;
}

const FIELD_ALIASES: Record<keyof AbtCsvRowData, string[]> = {
  mrn: ["mrn", "medicalrecordnumber", "residentmrn", "id"],
  residentName: ["residentname", "name", "resident", "patientname"],
  medicationName: ["medication", "medicationname", "drug", "antibiotic", "order"],
  dose: ["dose", "dosage", "strength"],
  route: ["route", "administrationroute"],
  frequency: ["frequency", "schedule", "sig"],
  startDate: ["startdate", "started", "start"],
  endDate: ["enddate", "ended", "stopdate", "stop"],
  indication: ["indication", "reason", "diagnosis", "infectionsource"],
  status: ["status", "orderstatus", "coursestatus"],
};

const cleanHeader = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const toDateOnly = (input: string): string => {
  const value = input.trim();
  if (!value) return "";

  const isoMatch = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
      return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
    }
  }

  const slashMatch = value.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (slashMatch) {
    const month = Number(slashMatch[1]);
    const day = Number(slashMatch[2]);
    const rawYear = Number(slashMatch[3]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
      return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
    }
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return "";
};

const normalizeMedicationText = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, "").trim();

const normalizeAbtStatus = (value: string): string => {
  const lowered = value.trim().toLowerCase();
  if (!lowered) return "active";
  if (lowered.includes("complete")) return "completed";
  if (lowered.includes("discontinu")) return "discontinued";
  return "active";
};

const pickValue = (row: Record<string, string>, key: keyof AbtCsvRowData): string => {
  const aliases = FIELD_ALIASES[key];
  for (const [rawHeader, rawValue] of Object.entries(row)) {
    if (aliases.includes(cleanHeader(rawHeader))) {
      return String(rawValue || "").trim();
    }
  }
  return "";
};

const findDuplicate = (data: AbtCsvRowData, existingAbts: ABTCourse[]): AbtCsvDuplicateMatch | undefined => {
  if (!data.mrn || !data.startDate) return undefined;

  const normalizedMedication = normalizeMedicationText(data.medicationName);
  const fallbackMedicationText = normalizeMedicationText(`${data.dose} ${data.route} ${data.frequency}`);
  const match = existingAbts.find((abt) => {
    if (abt.residentRef.id !== data.mrn) return false;
    if ((abt.startDate || "").slice(0, 10) !== data.startDate) return false;

    const existingMedication = (abt.medication || "").trim().toLowerCase();
    if (data.medicationName) {
      return existingMedication === data.medicationName.trim().toLowerCase();
    }

    if (normalizedMedication) {
      return normalizeMedicationText(abt.medication || "") === normalizedMedication;
    }

    return Boolean(fallbackMedicationText) && normalizeMedicationText(abt.medication || "") === fallbackMedicationText;
  });

  if (!match) return undefined;
  return {
    id: match.id,
    medication: match.medication || "",
    startDate: (match.startDate || "").slice(0, 10),
    status: match.status,
  };
};

export const evaluateAbtStagingRow = (rowId: string, data: AbtCsvRowData, existingAbts: ABTCourse[]): AbtCsvStagingRow => {
  const errors: string[] = [];
  const warnings: string[] = [];

  const normalizedData: AbtCsvRowData = {
    ...data,
    startDate: toDateOnly(data.startDate),
    endDate: toDateOnly(data.endDate),
    status: normalizeAbtStatus(data.status),
  };

  if (!normalizedData.mrn) errors.push("MRN is required");
  if (!normalizedData.medicationName) errors.push("Medication name is required");
  if (!normalizedData.startDate) errors.push("Start date is required or invalid");
  if (data.endDate && !normalizedData.endDate) errors.push("End date is invalid");

  if (!normalizedData.route) warnings.push("Route is blank");
  if (!normalizedData.frequency) warnings.push("Frequency is blank");
  if (!normalizedData.indication) warnings.push("Indication is blank");

  const duplicateMatch = findDuplicate(normalizedData, existingAbts);
  let status: AbtStagingStatus = "OK";

  if (errors.length) status = "ERROR";
  else if (duplicateMatch) status = "DUPLICATE";
  else if (warnings.length) status = "NEEDS_REVIEW";

  return {
    rowId,
    data: normalizedData,
    status,
    errors,
    warnings,
    skip: status === "ERROR" || status === "DUPLICATE",
    duplicateMatch,
  };
};

export const parseAbtCsvToStaging = (csvText: string, existingAbts: ABTCourse[]): AbtCsvStagingRow[] => {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length) {
    throw new Error(parsed.errors[0].message || "Unable to parse CSV");
  }

  return parsed.data.map((row, index) => {
    const data: AbtCsvRowData = {
      mrn: pickValue(row, "mrn"),
      residentName: pickValue(row, "residentName"),
      medicationName: pickValue(row, "medicationName"),
      dose: pickValue(row, "dose"),
      route: pickValue(row, "route"),
      frequency: pickValue(row, "frequency"),
      startDate: pickValue(row, "startDate"),
      endDate: pickValue(row, "endDate"),
      indication: pickValue(row, "indication"),
      status: pickValue(row, "status"),
    };

    return evaluateAbtStagingRow(`abt-csv-${index + 1}`, data, existingAbts);
  });
};
