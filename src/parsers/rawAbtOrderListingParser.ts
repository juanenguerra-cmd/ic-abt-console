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
}

// ─── Lookup Maps ──────────────────────────────────────────────────────────────

const ROUTE_MAP: Record<string, string> = {
  'by mouth': 'PO',
  orally: 'PO',
  oral: 'PO',
  po: 'PO',
  intravenously: 'IV',
  intravenous: 'IV',
  iv: 'IV',
  intramuscularly: 'IM',
  intramuscular: 'IM',
  im: 'IM',
  subcutaneously: 'SC',
  subcutaneous: 'SC',
  sc: 'SC',
  topically: 'TOP',
  topical: 'TOP',
  inhalation: 'INH',
  inhaled: 'INH',
  nebulized: 'INH',
  ophthalmic: 'OPH',
  otic: 'OTC',
  vaginally: 'VAG',
  vaginal: 'VAG',
  rectally: 'PR',
  rectal: 'PR',
  transdermal: 'TD',
  patch: 'TD',
  'nasogastric tube': 'NG',
  'via ng': 'NG',
  ng: 'NG',
};

const FREQUENCY_MAP: Array<{ pattern: RegExp; normalized: string }> = [
  { pattern: /\b(two times a day|twice daily|bid|bd)\b/i,   normalized: 'BID'    },
  { pattern: /\b(three times a day|tid)\b/i,                normalized: 'TID'    },
  { pattern: /\b(four times a day|qid)\b/i,                 normalized: 'QID'    },
  { pattern: /\b(once a day|once daily|daily|qd)\b/i,       normalized: 'QD'     },
  { pattern: /\bevery\s*6\s*hours\b/i,                      normalized: 'Q6H'    },
  { pattern: /\bevery\s*8\s*hours\b/i,                      normalized: 'Q8H'    },
  { pattern: /\bevery\s*12\s*hours\b/i,                     normalized: 'Q12H'   },
  { pattern: /\bevery\s*24\s*hours\b/i,                     normalized: 'Q24H'   },
  { pattern: /\bevery\s*48\s*hours\b/i,                     normalized: 'Q48H'   },
  { pattern: /\bevery\s*72\s*hours\b/i,                     normalized: 'Q72H'   },
  { pattern: /\bevery other day\b|qod\b|eod\b/i,            normalized: 'QOD'    },
  { pattern: /\btwice weekly\b|two times.*week\b/i,         normalized: 'BIW'    },
  { pattern: /\bonce weekly\b|weekly\b|q\s*7\s*days?\b/i,   normalized: 'Weekly' },
  { pattern: /\bas needed\b|prn\b/i,                        normalized: 'PRN'    },
];

const INDICATION_DEFAULTS: Array<{
  pattern: RegExp;
  source: string;
  category: string;
  syndrome: string;
}> = [
  { pattern: /\buti\b|bacteriuria/i,                     source: 'Urinary',        category: 'UTI',             syndrome: 'Genitourinary'      },
  { pattern: /pneumonia|lower resp|lrti\b/i,             source: 'Respiratory',    category: 'LRTI',            syndrome: 'Respiratory'        },
  { pattern: /\bsinusit|upper resp|urti\b/i,             source: 'Respiratory',    category: 'URTI',            syndrome: 'Respiratory'        },
  { pattern: /cellulitis|skin\b|wound|ssti\b/i,          source: 'Skin',           category: 'SSTI',            syndrome: 'Skin/Soft Tissue'   },
  { pattern: /oral suppression|chronic suppress/i,       source: 'Chronic',        category: 'Suppression',     syndrome: 'Chronic Suppression'},
  { pattern: /\bc\.?\s*diff|clostridium|cdiff/i,         source: 'GI',             category: 'CDI',             syndrome: 'Gastrointestinal'   },
  { pattern: /\bgastro|diarrhea|colitis/i,               source: 'GI',             category: 'Gastroenteritis', syndrome: 'Gastrointestinal'   },
  { pattern: /\bsepsis|bacteremia|bloodstream|bsi\b/i,   source: 'Bloodstream',    category: 'BSI',             syndrome: 'Bloodstream'        },
  { pattern: /\bosteo|bone infect/i,                     source: 'Bone',           category: 'Osteomyelitis',   syndrome: 'Musculoskeletal'    },
  { pattern: /\bconjunctiv|eye infect|ophthalm/i,        source: 'Eye',            category: 'Eye Infection',   syndrome: 'Eye/Ear'            },
  { pattern: /\botitis|ear infect/i,                     source: 'Ear',            category: 'Otitis',          syndrome: 'Eye/Ear'            },
  { pattern: /\bdental|tooth|perio\b/i,                  source: 'Oral',           category: 'Dental',          syndrome: 'Oral'               },
  { pattern: /\bprophylax|prevention|ppx\b/i,            source: 'Prophylaxis',    category: 'Prophylaxis',     syndrome: 'Prophylaxis'        },
  { pattern: /\bh\.?\s*pylori\b/i,                       source: 'GI',             category: 'H. Pylori',       syndrome: 'Gastrointestinal'   },
  { pattern: /\bmeningit/i,                              source: 'CNS',            category: 'Meningitis',      syndrome: 'CNS'                },
  { pattern: /\bendocard/i,                              source: 'Cardiovascular', category: 'Endocarditis',    syndrome: 'Cardiovascular'     },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const normalizeDate = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return '';
  const month = Number(match[1]);
  const day   = Number(match[2]);
  const year  = Number(match[3]);
  const date  = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth()    !== month - 1 ||
    date.getUTCDate()     !== day
  ) return '';
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const addDays = (isoDate: string, days: number): string => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const normalizeRoute = (value: string): string => {
  const lower = value.trim().toLowerCase();
  if (!lower) return '';
  for (const [key, code] of Object.entries(ROUTE_MAP)) {
    if (lower.includes(key)) return code;
  }
  return 'Other';
};

const normalizeFrequency = (summary: string): { raw: string; normalized: string } => {
  for (const entry of FREQUENCY_MAP) {
    const match = summary.match(entry.pattern);
    if (match) return { raw: match[0], normalized: entry.normalized };
  }
  return { raw: '', normalized: '' };
};

/**
 * Parses "CASANO, MARYANN A (200999)"
 * → mrn: "200999", lastName: "CASANO", firstName: "MARYANN"
 * Strips trailing single-letter middle initial ("MARYANN A" → "MARYANN").
 * MRN is the true linking key to the resident census — name is display only.
 */
const parseResident = (residentNameRaw: string) => {
  const mrnMatch = residentNameRaw.match(/\(([^)]+)\)/);
  const mrn = (mrnMatch?.[1] ?? '').trim();
  const withoutMrn = residentNameRaw.replace(/\([^)]*\)/g, '').trim();
  const [lastName = '', firstChunk = ''] = withoutMrn.split(',').map((p) => p.trim());
  // Strip trailing single-letter middle initial e.g. "MARYANN A" → "MARYANN"
  const residentFirstName = firstChunk.replace(/\s+[A-Z]\.?\s*$/, '').trim();
  return { mrn, residentLastName: lastName, residentFirstName };
};

/**
 * Extracts brand medication name and dose from the order summary column.
 * Input:  "Macrobid Oral Capsule 100 MG (Nitrofurantoin Monohyd Macro) Give 1 capsule..."
 * Output: { medicationName: "Macrobid Oral Capsule", dose: "100 MG" }
 * Everything before the first dose unit match = medication name.
 * Everything after = discarded (generic name, directions, indication).
 */
const parseMedicationAndDose = (summary: string): { medicationName: string; dose: string } => {
  const doseMatch = summary.match(/\b(\d+(?:\.\d+)?)\s*(MG|MCG|G|GRAM|ML|UNITS?)\b/i);
  if (!doseMatch) {
    return { medicationName: summary.split(' for ')[0].trim(), dose: '' };
  }
  const dose           = `${doseMatch[1]} ${doseMatch[2].toUpperCase()}`;
  const medicationName = summary.slice(0, doseMatch.index).replace(/^-\s*/, '').trim();
  return { medicationName, dose };
};

const parseDurationDays = (summary: string): number => {
  const match = summary.match(/(?:for|x)\s*(\d{1,3})\s*days?/i);
  return match ? Number(match[1]) : 0;
};

const deriveIndicationDefaults = (indicationRaw: string, orderSummaryRaw: string) => {
  const combined = `${indicationRaw} ${orderSummaryRaw}`;
  const match = INDICATION_DEFAULTS.find((item) => item.pattern.test(combined));
  if (!match) return { sourceOfInfection: '', indicationCategory: '', syndrome: '' };
  return {
    sourceOfInfection:  match.source,
    indicationCategory: match.category,
    syndrome:           match.syndrome,
  };
};

const splitLine = (line: string): string[] =>
  (line.includes('\t') ? line.split('\t') : line.split(/\s{2,}/)).map((p) => p.trim());

/** A line is a data row if it contains a parenthesized MRN-like value and at least one date. */
const isLikelyDataLine = (line: string) =>
  /\([^)]{2,}\)/.test(line) && /(\d{1,2}\/\d{1,2}\/\d{4})/.test(line);

// ─── Main Export ──────────────────────────────────────────────────────────────

export const parseRawAbtOrderListing = (rawText: string): RawAbtStagingRow[] => {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const startIndex = lines.findIndex(isLikelyDataLine);
  const bodyLines  = startIndex >= 0 ? lines.slice(startIndex) : [];

  return bodyLines.map((line, index) => {
    const cols = splitLine(line);

    // Expected column order from source report:
    // 0: Resident Name (includes MRN in parens)
    // 1: Order Summary (medication, dose, directions, indication)
    // 2: Order Status
    // 3: Start Date
    // 4: End Date
    // 5: Route
    // 6: Indication (raw)
    const residentNameRaw = cols[0] ?? '';
    const orderSummaryRaw = cols[1] ?? '';
    const orderStatusRaw  = cols[2] ?? '';
    const startDateRaw    = cols[3] ?? '';
    const endDateRaw      = cols[4] ?? '';
    const routeRaw        = cols[5] ?? '';
    const indicationRaw   = cols[6] ?? '';

    const resident           = parseResident(residentNameRaw);
    const startDate          = normalizeDate(startDateRaw);
    const parsedEndDate      = normalizeDate(endDateRaw);
    const { medicationName, dose } = parseMedicationAndDose(orderSummaryRaw);
    const durationDays       = parseDurationDays(orderSummaryRaw);
    const frequency          = normalizeFrequency(orderSummaryRaw);
    const routeNormalized    = normalizeRoute(routeRaw);
    const endDate            = parsedEndDate || (startDate && durationDays ? addDays(startDate, durationDays) : '');
    const endDateWasComputed = !parsedEndDate && Boolean(endDate);
    const defaults           = deriveIndicationDefaults(indicationRaw, orderSummaryRaw);

    const errors:   string[] = [];
    const warnings: string[] = [];

    if (!resident.mrn)                errors.push('Missing MRN');
    if (!startDateRaw || !startDate)  errors.push('Invalid or missing start date');
    if (endDateRaw && !parsedEndDate) errors.push('Invalid end date format');
    if (!orderSummaryRaw)             errors.push('Missing order summary');

    if (!routeNormalized || routeNormalized === 'Other')
      warnings.push('Unknown route — verify manually');
    if (!frequency.normalized)
      warnings.push('Unknown frequency — verify manually');
    if (!defaults.sourceOfInfection)
      warnings.push('Indication not auto-mapped — verify Source / Category / Syndrome');

    const status: RawRowStatus = errors.length
      ? 'ERROR'
      : warnings.length
      ? 'NEEDS_REVIEW'
      : 'PARSED';

    const fallbackMed  = orderSummaryRaw || `row-${index + 1}`;
    const duplicateKey = [
      resident.mrn,
      medicationName || fallbackMed,
      startDate,
      routeNormalized || 'Other',
    ].join('|').toLowerCase();

    return {
      id:                  `raw-abt-${index}-${Date.now()}`,
      rowNumber:           index + 1,
      status,
      skip:                false,
      errors,
      warnings,
      duplicateKey,
      residentNameRaw,
      mrn:                 resident.mrn,
      residentLastName:    resident.residentLastName,
      residentFirstName:   resident.residentFirstName,
      orderSummaryRaw,
      orderStatusRaw,
      startDateRaw,
      endDateRaw,
      startDate,
      endDate,
      computedEndDate:     endDateWasComputed ? endDate : '',
      endDateWasComputed,
      routeRaw,
      routeNormalized,
      indicationRaw,
      medicationName,
      dose,
      frequencyRaw:        frequency.raw,
      frequencyNormalized: frequency.normalized,
      durationDays:        durationDays ? String(durationDays) : '',
      sourceOfInfection:   defaults.sourceOfInfection,
      indicationCategory:  defaults.indicationCategory,
      syndrome:            defaults.syndrome,
    };
  });
};
