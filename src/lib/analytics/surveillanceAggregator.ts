/**
 * Pure aggregator for the Monthly Infection Surveillance Log.
 *
 * No side effects, no mutations of source records, no backend dependencies.
 * Designed to be composable: a future quarterly rate report can call
 * buildMonthlyInfectionSurveillanceLog for each month in a quarter.
 */

import type { FacilityStore, IPEvent } from '../../domain/models';

// ─── Normalised Surveillance Category ────────────────────────────────────────

export type SurveillanceCategory =
  | 'UTI'
  | 'Respiratory'
  | 'GI'
  | 'Skin/Soft Tissue'
  | 'MDRO / Resistant Organism'
  | 'Device-Associated'
  | 'Other'
  | 'Unknown';

const CATEGORY_MAP: Record<string, SurveillanceCategory> = {
  // UTI
  uti: 'UTI',
  'urinary tract infection': 'UTI',
  // Respiratory
  pneumonia: 'Respiratory',
  influenza: 'Respiratory',
  'covid-19': 'Respiratory',
  covid19: 'Respiratory',
  'covid 19': 'Respiratory',
  rsv: 'Respiratory',
  pertussis: 'Respiratory',
  tuberculosis: 'Respiratory',
  tb: 'Respiratory',
  measles: 'Respiratory',
  // GI
  gi: 'GI',
  'c. diff': 'GI',
  cdiff: 'GI',
  'c.diff': 'GI',
  'clostridioides difficile': 'GI',
  norovirus: 'GI',
  gastroenteritis: 'GI',
  // Skin / Soft Tissue
  'skin/soft tissue': 'Skin/Soft Tissue',
  skin: 'Skin/Soft Tissue',
  scabies: 'Skin/Soft Tissue',
  lice: 'Skin/Soft Tissue',
  varicella: 'Skin/Soft Tissue',
  'varicella (chickenpox)': 'Skin/Soft Tissue',
  'surgical site infection': 'Skin/Soft Tissue',
  'pressure ulcer': 'Skin/Soft Tissue',
  wound: 'Skin/Soft Tissue',
  // MDRO / Resistant Organism
  mrsa: 'MDRO / Resistant Organism',
  vre: 'MDRO / Resistant Organism',
  mdro: 'MDRO / Resistant Organism',
  cre: 'MDRO / Resistant Organism',
  esbl: 'MDRO / Resistant Organism',
  'resistant organism': 'MDRO / Resistant Organism',
  // Device-Associated
  cauti: 'Device-Associated',
  clabsi: 'Device-Associated',
  vap: 'Device-Associated',
  'device-associated': 'Device-Associated',
  'device associated': 'Device-Associated',
  // Bloodstream / Sepsis / Other
  bloodstream: 'Other',
  sepsis: 'Other',
  meningitis: 'Other',
  'routine surveillance': 'Other',
  other: 'Other',
};

/** Map a raw infection category string to the normalised surveillance set. */
export function normalizeInfectionCategory(
  raw: string | null | undefined,
): SurveillanceCategory {
  if (!raw?.trim()) return 'Unknown';
  return CATEGORY_MAP[raw.trim().toLowerCase()] ?? 'Other';
}

// ─── Event Date Resolution ────────────────────────────────────────────────────
// Priority: onset → specimen/lab → createdAt → null

/** Return the best available event date for a given IPEvent, as a date-only string. */
export function getIPEventDate(ip: IPEvent): string | null {
  if (ip.onsetDate) return ip.onsetDate.slice(0, 10);
  if (ip.specimenCollectedDate) return ip.specimenCollectedDate.slice(0, 10);
  if (ip.labResultDate) return ip.labResultDate.slice(0, 10);
  if (ip.createdAt) return ip.createdAt.slice(0, 10);
  return null;
}

// ─── Lab / Confirmation Status ────────────────────────────────────────────────

export type LabStatus = 'confirmed' | 'suspected' | 'unknown';

/** Derive a lab-confirmed status from available fields on IPEvent. */
export function deriveLabStatus(ip: IPEvent): LabStatus {
  if (ip.labResultDate) return 'confirmed';
  if (ip.specimenCollectedDate || ip.organism) return 'suspected';
  return 'unknown';
}

// ─── Output Types ─────────────────────────────────────────────────────────────

export interface SurveillanceRow {
  caseId: string;
  residentName: string;
  mrn: string;
  room: string;
  unit: string;
  eventDate: string | null;
  infectionCategory: SurveillanceCategory;
  rawInfectionType: string;
  organism: string;
  labStatus: LabStatus;
  precautions: string;
  outcome: string;
}

export interface SurveillanceLogTotals {
  totalCases: number;
  confirmed: number;
  suspected: number;
  unknownStatus: number;
}

export interface SurveillanceLogResult {
  /** e.g. "2025-03" */
  monthKey: string;
  /** e.g. "March 2025" */
  periodLabel: string;
  selectedUnit: string | null;
  totals: SurveillanceLogTotals;
  byCategory: Array<{ category: SurveillanceCategory; count: number }>;
  byUnit: Array<{ unit: string; count: number }>;
  rows: SurveillanceRow[];
  /**
   * Resident-days denominator for infection-rate calculations.
   * null when not yet available; callers can populate via external census data
   * without requiring changes to this aggregator.
   */
  residentDays: number | null;
}

// ─── Aggregator ───────────────────────────────────────────────────────────────

/**
 * Build a typed Monthly Infection Surveillance Log from existing store data.
 *
 * @param store   - Current FacilityStore (read-only; records are never mutated).
 * @param month   - Calendar month, 1–12.
 * @param year    - Four-digit year.
 * @param selectedUnit - Optional unit filter; pass null / undefined for all units.
 * @param residentDays - Optional resident-days denominator for future rate support.
 */
export function buildMonthlyInfectionSurveillanceLog(
  store: FacilityStore,
  month: number,
  year: number,
  selectedUnit?: string | null,
  residentDays?: number | null,
): SurveillanceLogResult {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

  const inPeriod = (dateStr: string | null): boolean => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d >= monthStart && d <= monthEnd;
  };

  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const periodLabel = new Date(year, month - 1, 1).toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });

  const rows: SurveillanceRow[] = [];

  for (const ip of Object.values(store.infections ?? {}) as IPEvent[]) {
    const eventDate = getIPEventDate(ip);
    if (!inPeriod(eventDate)) continue;

    const res =
      ip.residentRef.kind === 'mrn'
        ? store.residents?.[ip.residentRef.id]
        : store.quarantine?.[ip.residentRef.id];

    const unit =
      ip.locationSnapshot?.unit ||
      (res as { currentUnit?: string } | undefined)?.currentUnit ||
      'Unknown';

    if (selectedUnit && unit !== selectedUnit) continue;

    const mrn =
      ip.residentRef.kind === 'mrn' ? ip.residentRef.id : '';

    const displayName =
      (res as { displayName?: string } | undefined)?.displayName;

    const residentName =
      displayName ??
      (ip.residentRef.kind === 'quarantine'
        ? `Quarantine (${ip.residentRef.id})`
        : mrn
        ? `MRN: ${mrn}`
        : '—');

    const room =
      ip.locationSnapshot?.room ||
      (res as { currentRoom?: string } | undefined)?.currentRoom ||
      '';

    rows.push({
      caseId: ip.id,
      residentName,
      mrn,
      room,
      unit,
      eventDate,
      infectionCategory: normalizeInfectionCategory(ip.infectionCategory),
      rawInfectionType: ip.infectionCategory ?? '',
      organism: ip.organism ?? '',
      labStatus: deriveLabStatus(ip),
      precautions: ip.isolationType ?? '',
      outcome:
        ip.status === 'resolved'
          ? 'Resolved'
          : ip.status === 'historical'
          ? 'Historical'
          : 'Active',
    });
  }

  // Sort: eventDate ascending, then residentName ascending
  rows.sort((a, b) => {
    const dc = (a.eventDate ?? '').localeCompare(b.eventDate ?? '');
    if (dc !== 0) return dc;
    return a.residentName.localeCompare(b.residentName);
  });

  // Totals
  const confirmed = rows.filter(r => r.labStatus === 'confirmed').length;
  const suspected = rows.filter(r => r.labStatus === 'suspected').length;
  const unknownStatus = rows.filter(r => r.labStatus === 'unknown').length;

  // By category
  const catMap = new Map<SurveillanceCategory, number>();
  for (const r of rows) {
    catMap.set(r.infectionCategory, (catMap.get(r.infectionCategory) ?? 0) + 1);
  }
  const byCategory = Array.from(catMap.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  // By unit
  const unitMap = new Map<string, number>();
  for (const r of rows) {
    unitMap.set(r.unit, (unitMap.get(r.unit) ?? 0) + 1);
  }
  const byUnit = Array.from(unitMap.entries())
    .map(([unit, count]) => ({ unit, count }))
    .sort((a, b) => b.count - a.count);

  return {
    monthKey,
    periodLabel,
    selectedUnit: selectedUnit ?? null,
    totals: { totalCases: rows.length, confirmed, suspected, unknownStatus },
    byCategory,
    byUnit,
    rows,
    residentDays: residentDays ?? null,
  };
}
