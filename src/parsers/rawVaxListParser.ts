export type RawVaxStatus = 'PARSED' | 'NEEDS_REVIEW' | 'ERROR';

export interface RawVaxStagingRow {
  id: string;
  rowNumber: number;
  status: RawVaxStatus;
  skip: boolean;
  errors: string[];
  warnings: string[];
  duplicateKey: string;
  residentNameRaw: string;
  mrn: string;
  residentLastName: string;
  residentFirstName: string;
  recordedDateRaw: string;
  eventDate: string;
  vaccineType: string;
  eventStatus: string;
}

const normalizeDate = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return '';
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
};

const parseResident = (residentNameRaw: string) => {
  const mrnMatch = residentNameRaw.match(/\(([^)]+)\)/);
  const mrn = (mrnMatch?.[1] || '').trim();
  const withoutMrn = residentNameRaw.replace(/\([^)]*\)/g, '').trim();
  const [lastName = '', firstChunk = ''] = withoutMrn.split(',').map((part) => part.trim());
  return {
    mrn,
    residentLastName: lastName,
    residentFirstName: firstChunk,
  };
};

const splitLine = (line: string): string[] => (line.includes('\t') ? line.split('\t') : line.split(/\s{2,}/)).map((part) => part.trim());

const findDateCell = (columns: string[]): string => {
  const found = columns.find((col) => /\d{1,2}\/\d{1,2}\/\d{4}/.test(col));
  return found || '';
};

export const mapVaxStatusSelection = (selection: 'Vaccinated' | 'Historical' | 'Refused'): string => {
  if (selection === 'Vaccinated') return 'given';
  if (selection === 'Historical') return 'documented-historical';
  return 'declined';
};

export const parseRawVaxList = (
  rawText: string,
  vaccineType: string,
  statusSelection: 'Vaccinated' | 'Historical' | 'Refused'
): RawVaxStagingRow[] => {
  const eventStatus = mapVaxStatusSelection(statusSelection);
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const cols = splitLine(line);
      const residentNameRaw = cols[0] || '';
      const dateRaw = findDateCell(cols);
      const eventDate = normalizeDate(dateRaw);
      const resident = parseResident(residentNameRaw);

      const errors: string[] = [];
      const warnings: string[] = [];
      if (!resident.mrn) errors.push('Missing MRN');
      if (!dateRaw || !eventDate) errors.push('Invalid or missing event date');
      if (!vaccineType.trim()) errors.push('Missing vaccine type');

      const status: RawVaxStatus = errors.length ? 'ERROR' : warnings.length ? 'NEEDS_REVIEW' : 'PARSED';
      const duplicateKey = [resident.mrn, vaccineType, eventDate, eventStatus].join('|').toLowerCase();

      return {
        id: `raw-vax-${index}-${Date.now()}`,
        rowNumber: index + 1,
        status,
        skip: false,
        errors,
        warnings,
        duplicateKey,
        residentNameRaw,
        mrn: resident.mrn,
        residentLastName: resident.residentLastName,
        residentFirstName: resident.residentFirstName,
        recordedDateRaw: dateRaw,
        eventDate,
        vaccineType,
        eventStatus,
      };
    });
};
