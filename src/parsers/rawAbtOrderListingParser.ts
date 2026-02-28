export type RawRowStatus = 'PARSED' | 'NEEDS_REVIEW' | 'ERROR';

export interface RawAbtStagingRow {
  id: string;
  rowNumber: number;
  status: RawRowStatus;
  skip: boolean;
  errors: string[];
  warnings: string[];
  duplicateKey: string;
  residentNameRaw: string;
  mrn: string;
  residentLastName: string;
  residentFirstName: string;
  orderSummaryRaw: string;
  orderStatusRaw: string;
  startDateRaw: string;
  endDateRaw: string;
  startDate: string;
  endDate: string;
  computedEndDate: string;
  endDateWasComputed: boolean;
  routeRaw: string;
  routeNormalized: string;
  indicationRaw: string;
  medicationName: string;
  dose: string;
  frequencyRaw: string;
  frequencyNormalized: string;
  durationDays: string;
  sourceOfInfection: string;
  indicationCategory: string;
  syndrome: string;
  prescriber: string;
}

const ROUTE_MAP: Record<string, string> = {
  'by mouth': 'PO',
  oral: 'PO',
  po: 'PO',
  intravenously: 'IV',
  intravenous: 'IV',
  iv: 'IV',
  intramuscularly: 'IM',
  intramuscular: 'IM',
  im: 'IM',
  subcutaneous: 'SC',
  subcutaneously: 'SC',
  sc: 'SC',
};

const FREQUENCY_MAP: Array<{ pattern: RegExp; normalized: string }> = [
  { pattern: /\b(two times a day|twice daily|bid|bd)\b/i, normalized: 'BID' },
  { pattern: /\b(three times a day|tid)\b/i, normalized: 'TID' },
  { pattern: /\b(four times a day|qid)\b/i, normalized: 'QID' },
  { pattern: /\b(once a day|daily|qd)\b/i, normalized: 'QD' },
  { pattern: /\bevery\s*12\s*hours\b/i, normalized: 'Q12H' },
  { pattern: /\bevery\s*8\s*hours\b/i, normalized: 'Q8H' },
  { pattern: /\bevery\s*6\s*hours\b/i, normalized: 'Q6H' },
  { pattern: /\bevery\s*24\s*hours\b/i, normalized: 'Q24H' },
];

const INDICATION_DEFAULTS: Array<{ pattern: RegExp; source: string; category: string; syndrome: string }> = [
  { pattern: /\buti\b|bacteriuria/i, source: 'Urinary', category: 'UTI', syndrome: 'Genitourinary' },
  { pattern: /pneumonia|respiratory/i, source: 'Respiratory', category: 'LRTI', syndrome: 'Respiratory' },
  { pattern: /cellulitis|skin|wound/i, source: 'Skin', category: 'SSTI', syndrome: 'Skin/Soft Tissue' },
  { pattern: /oral suppression/i, source: 'Chronic', category: 'Suppression', syndrome: 'Chronic suppression' },
];

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

const addDays = (isoDate: string, days: number): string => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const normalizeRoute = (value: string): string => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return '';
  for (const [raw, code] of Object.entries(ROUTE_MAP)) {
    if (normalized.includes(raw)) return code;
  }
  return 'Other';
};

const normalizeFrequency = (summary: string): { raw: string; normalized: string } => {
  for (const entry of FREQUENCY_MAP) {
    const match = summary.match(entry.pattern);
    if (match) {
      return { raw: match[0], normalized: entry.normalized };
    }
  }
  return { raw: '', normalized: '' };
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

const parseMedicationAndDose = (summary: string): { medicationName: string; dose: string } => {
  const doseMatch = summary.match(/\b(\d+(?:\.\d+)?)\s*(MG|MCG|G|GRAM|ML|UNITS?)\b/i);
  if (!doseMatch) {
    return { medicationName: summary.split(' for ')[0].trim(), dose: '' };
  }
  const dose = `${doseMatch[1]} ${doseMatch[2].toUpperCase()}`;
  const medicationName = summary.slice(0, doseMatch.index).replace(/^-\s*/, '').trim();
  return { medicationName, dose };
};

const parseDurationDays = (summary: string): number => {
  const durationMatch = summary.match(/(?:for|x)\s*(\d{1,3})\s*days?/i);
  if (!durationMatch) return 0;
  return Number(durationMatch[1]);
};

const deriveIndicationDefaults = (indicationRaw: string, orderSummaryRaw: string) => {
  const combined = `${indicationRaw} ${orderSummaryRaw}`;
  const match = INDICATION_DEFAULTS.find((item) => item.pattern.test(combined));
  if (!match) return { sourceOfInfection: '', indicationCategory: '', syndrome: '' };
  return {
    sourceOfInfection: match.source,
    indicationCategory: match.category,
    syndrome: match.syndrome,
  };
};

const splitLine = (line: string): string[] => {
  if (line.includes('\t')) return line.split('\t').map((part) => part.trim());
  return line.split(/\s{2,}/).map((part) => part.trim());
};

const isLikelyDataLine = (line: string) => /\([^)]{2,}\)/.test(line) && /(\d{1,2}\/\d{1,2}\/\d{4})/.test(line);

export const parseRawAbtOrderListing = (rawText: string): RawAbtStagingRow[] => {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const startIndex = lines.findIndex(isLikelyDataLine);
  const bodyLines = startIndex >= 0 ? lines.slice(startIndex) : [];

  return bodyLines.map((line, index) => {
    const cols = splitLine(line);
    const residentNameRaw = cols[0] || '';
    const orderSummaryRaw = cols[1] || '';
    const orderStatusRaw = cols[2] || '';
    const startDateRaw = cols[3] || '';
    const endDateRaw = cols[4] || '';
    const routeRaw = cols[5] || '';
    const indicationRaw = cols[6] || '';

    const resident = parseResident(residentNameRaw);
    const startDate = normalizeDate(startDateRaw);
    const parsedEndDate = normalizeDate(endDateRaw);
    const { medicationName, dose } = parseMedicationAndDose(orderSummaryRaw);
    const durationDays = parseDurationDays(orderSummaryRaw);
    const frequency = normalizeFrequency(orderSummaryRaw);
    const routeNormalized = normalizeRoute(routeRaw);
    const endDate = parsedEndDate || (startDate && durationDays ? addDays(startDate, durationDays) : '');
    const endDateWasComputed = !parsedEndDate && Boolean(endDate);
    const defaults = deriveIndicationDefaults(indicationRaw, orderSummaryRaw);

    const errors: string[] = [];
    const warnings: string[] = [];

    if (!resident.mrn) errors.push('Missing MRN');
    if (!startDateRaw || !startDate) errors.push('Invalid or missing start date');
    if (endDateRaw && !parsedEndDate) errors.push('Invalid end date');
    if (!orderSummaryRaw) errors.push('Missing order summary');

    if (!routeNormalized || routeNormalized === 'Other') warnings.push('Unknown route');
    if (!frequency.normalized) warnings.push('Unknown frequency');

    const status: RawRowStatus = errors.length
      ? 'ERROR'
      : warnings.length
      ? 'NEEDS_REVIEW'
      : 'PARSED';

    const fallbackMed = orderSummaryRaw || `row-${index + 1}`;
    const duplicateKey = [resident.mrn, medicationName || fallbackMed, startDate, routeNormalized || 'Other']
      .join('|')
      .toLowerCase();

    return {
      id: `raw-abt-${index}-${Date.now()}`,
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
      orderSummaryRaw,
      orderStatusRaw,
      startDateRaw,
      endDateRaw,
      startDate,
      endDate,
      computedEndDate: endDateWasComputed ? endDate : '',
      endDateWasComputed,
      routeRaw,
      routeNormalized,
      indicationRaw,
      medicationName,
      dose,
      frequencyRaw: frequency.raw,
      frequencyNormalized: frequency.normalized,
      durationDays: durationDays ? String(durationDays) : '',
      sourceOfInfection: defaults.sourceOfInfection,
      indicationCategory: defaults.indicationCategory,
      syndrome: defaults.syndrome,
      prescriber: '',
    };
  });
};
