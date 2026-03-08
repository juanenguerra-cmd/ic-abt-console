import Papa from 'papaparse';
import { Resident } from '../domain/models';

export type HistoricalRowStatus = 'NEW' | 'DUPLICATE-HISTORICAL' | 'CONFLICT-ACTIVE' | 'ERROR';
export type DuplicateAction = 'skip' | 'merge-fill-blanks';
export type ConflictAction = 'skip' | 'link';

export interface HistoricalResidentStagingData {
  mrn: string;
  firstName: string;
  lastName: string;
  sex: string;
  admissionDate: string;
  allergies: string;
  lastKnownAttendingMD: string;
  primaryDiagnosis: string;
}

export interface HistoricalResidentStagingRow {
  id: string;
  rowNumber: number;
  status: HistoricalRowStatus;
  skip: boolean;
  duplicateAction: DuplicateAction;
  conflictAction: ConflictAction;
  data: HistoricalResidentStagingData;
  errors: string[];
  linkedResidentMrn?: string;
  editedFields: Array<keyof HistoricalResidentStagingData>;
}

const HEADER_ALIASES: Record<keyof HistoricalResidentStagingData, string[]> = {
  mrn: ['resident id'],
  lastName: ['resident last name'],
  firstName: ['resident first name'],
  sex: ['gender'],
  admissionDate: ['admission date'],
  allergies: ['allergies'],
  lastKnownAttendingMD: ['primary physician'],
  primaryDiagnosis: ['primary diagnosis']
};

const REQUIRED_FIELDS: Array<keyof HistoricalResidentStagingData> = ['mrn', 'firstName', 'lastName'];

const normalizeHeader = (value: string) => value.trim().toLowerCase();

const normalizeSex = (value: string): string => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'm' || normalized === 'male') return 'M';
  if (normalized === 'f' || normalized === 'female') return 'F';
  return value.trim();
};

export const normalizeUsDateToIso = (value: string): string | null => {
  const raw = value.trim();
  if (!raw) return '';
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (!match) {
    return null;
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(candidate.getTime()) ||
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
};

const buildHeaderMap = (headers: string[]): Partial<Record<keyof HistoricalResidentStagingData, string>> => {
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));
  const map: Partial<Record<keyof HistoricalResidentStagingData, string>> = {};

  (Object.keys(HEADER_ALIASES) as Array<keyof HistoricalResidentStagingData>).forEach((field) => {
    const aliases = HEADER_ALIASES[field];
    const matchedIndex = normalizedHeaders.findIndex((header) => aliases.includes(header));
    if (matchedIndex >= 0) {
      map[field] = headers[matchedIndex];
    }
  });

  return map;
};

export const parseHistoricalResidentCsv = async (
  file: File,
  existingResidents: Resident[]
): Promise<{ rows: HistoricalResidentStagingRow[]; missingRequiredHeaders: string[] }> => {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        const headerMap = buildHeaderMap(headers);
        const missingRequiredHeaders = REQUIRED_FIELDS.filter((field) => !headerMap[field]).map((field) => HEADER_ALIASES[field][0]);

        const rows: HistoricalResidentStagingRow[] = (results.data || []).map((rawRow, index) => {
          const get = (field: keyof HistoricalResidentStagingData) => {
            const header = headerMap[field];
            const value = header ? rawRow[header] : '';
            return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
          };

          const admissionRaw = get('admissionDate');
          const admissionDate = admissionRaw ? normalizeUsDateToIso(admissionRaw) : '';

          const data: HistoricalResidentStagingData = {
            mrn: get('mrn'),
            firstName: get('firstName'),
            lastName: get('lastName'),
            sex: normalizeSex(get('sex')),
            admissionDate: admissionDate ?? admissionRaw,
            allergies: get('allergies'),
            lastKnownAttendingMD: get('lastKnownAttendingMD'),
            primaryDiagnosis: get('primaryDiagnosis')
          };

          const errors: string[] = [];
          if (!data.mrn) errors.push('Missing MRN (Resident Id).');
          if (!data.firstName) errors.push('Missing first name.');
          if (!data.lastName) errors.push('Missing last name.');
          if (admissionRaw && admissionDate === null) {
            errors.push('Invalid Admission Date. Use MM/DD/YYYY.');
          }

          const existing = existingResidents.find((resident) => resident.mrn === data.mrn);
          let status: HistoricalRowStatus = 'NEW';
          let duplicateAction: DuplicateAction = 'skip';
          let conflictAction: ConflictAction = 'skip';

          if (errors.length > 0) {
            status = 'ERROR';
          } else if (existing?.backOfficeOnly || existing?.isHistorical) {
            status = 'DUPLICATE-HISTORICAL';
            duplicateAction = 'skip';
          } else if (existing) {
            status = 'CONFLICT-ACTIVE';
            conflictAction = 'skip';
          }

          return {
            id: `historical-resident-${Date.now()}-${index}`,
            rowNumber: index + 2,
            status,
            skip: false,
            duplicateAction,
            conflictAction,
            data,
            errors,
            linkedResidentMrn: existing?.mrn,
            editedFields: []
          };
        });

        resolve({ rows, missingRequiredHeaders });
      },
      error: (error) => reject(error)
    });
  });
};
