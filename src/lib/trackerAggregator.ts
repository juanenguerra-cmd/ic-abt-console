/**
 * trackerAggregator.ts
 *
 * Pure, client-side aggregation helpers for infection-tracker reports.
 * All helpers are deterministic and side-effect-free so they can be
 * unit-tested or reused across multiple report views.
 */

import { IPEvent } from '../domain/models';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Quarter = 1 | 2 | 3 | 4;

/** Shape stored in localStorage under 'ltc_facility_metrics'. */
export type StoredMonthlyMetric = number | { residentDays: number; averageCensus?: number };

export interface MonthlyInfectionData {
  /** "YYYY-MM" */
  monthKey: string;
  /** Human-readable label, e.g. "January 2024" */
  monthLabel: string;
  caseCount: number;
  /** null when no denominator has been entered for this month */
  residentDays: number | null;
  /** null when residentDays is null; rate = (cases / residentDays) * 1000 */
  ratePer1000: number | null;
}

export interface CategoryMonthlyCount {
  monthKey: string;
  count: number;
}

export interface CategoryBreakdown {
  category: string;
  totalCases: number;
  /** One entry per quarter-month, in order */
  monthly: CategoryMonthlyCount[];
}

export type TrendDirection = 'increasing' | 'decreasing' | 'stable' | 'insufficient-data';

export interface TrendResult {
  direction: TrendDirection;
  note: string;
}

export interface QuarterlyTotals {
  totalCases: number;
  /** null when none of the 3 months have denominator data */
  totalResidentDays: number | null;
  /** null when totalResidentDays is null */
  quarterRatePer1000: number | null;
}

export interface QuarterlyInfectionRateReport {
  quarter: Quarter;
  year: number;
  /** e.g. "Q1 (Jan–Mar) 2025" */
  periodLabel: string;
  selectedUnit: string | null;
  totals: QuarterlyTotals;
  /** Exactly 3 entries, one per month in the quarter */
  months: MonthlyInfectionData[];
  byCategory: CategoryBreakdown[];
  trend: TrendResult;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April',
  'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December',
];

const QUARTER_LABELS: Record<Quarter, string> = {
  1: 'Q1 (Jan–Mar)',
  2: 'Q2 (Apr–Jun)',
  3: 'Q3 (Jul–Sep)',
  4: 'Q4 (Oct–Dec)',
};

/**
 * A count-difference of this magnitude (or more) between the first and last
 * month is treated as a meaningful change for trend classification.
 */
const TREND_MEANINGFUL_DIFF = 2;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the three "YYYY-MM" month keys for a given year and quarter, in
 * chronological order.
 */
export function getQuarterMonths(year: number, quarter: Quarter): [string, string, string] {
  const firstMonth = (quarter - 1) * 3 + 1;
  const pad = (n: number) => String(n).padStart(2, '0');
  return [
    `${year}-${pad(firstMonth)}`,
    `${year}-${pad(firstMonth + 1)}`,
    `${year}-${pad(firstMonth + 2)}`,
  ];
}

/** "YYYY-MM" → "Month YYYY" */
function monthKeyToLabel(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const monthIndex = parseInt(monthStr, 10) - 1;
  const name = MONTH_NAMES[monthIndex >= 0 && monthIndex < 12 ? monthIndex : 0];
  return `${name} ${yearStr}`;
}

/**
 * Preferred event date: onsetDate if present, otherwise createdAt.
 * Consistent with the hierarchy used throughout the existing report views.
 */
function getEventDate(ip: IPEvent): Date {
  return new Date(ip.onsetDate || ip.createdAt);
}

/** Case-insensitive, trimmed unit comparison. */
function normalizeUnit(unit: string | undefined): string {
  return (unit ?? '').trim().toLowerCase();
}

// ─── Core aggregation ────────────────────────────────────────────────────────

/**
 * Counts infections that fall within a given calendar month, optionally
 * filtered by unit.  Returns total case count and a per-category breakdown.
 *
 * Reusable helper — suitable for monthly surveillance, rolling-12-month,
 * or any other report that needs month-level infection data.
 */
export function buildMonthlyInfectionCounts(
  infections: IPEvent[],
  monthKey: string,
  unitFilter?: string | null,
): { caseCount: number; byCategory: Record<string, number> } {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-based

  const normalizedFilter = unitFilter ? normalizeUnit(unitFilter) : null;

  let caseCount = 0;
  const byCategory: Record<string, number> = {};

  for (const ip of infections) {
    const d = getEventDate(ip);
    if (d.getFullYear() !== year || d.getMonth() + 1 !== month) continue;

    if (normalizedFilter !== null) {
      const ipUnit = normalizeUnit(ip.locationSnapshot?.unit);
      if (ipUnit !== normalizedFilter) continue;
    }

    caseCount++;
    const cat = ip.infectionCategory || 'Unknown';
    byCategory[cat] = (byCategory[cat] ?? 0) + 1;
  }

  return { caseCount, byCategory };
}

/**
 * Reads resident-days from the stored metrics map.
 * Handles both the legacy plain-number format and the newer
 * { residentDays, averageCensus } object format.
 * Returns null when no entry exists or the value is zero.
 */
function resolveResidentDays(
  metricsMap: Record<string, StoredMonthlyMetric>,
  monthKey: string,
): number | null {
  const v = metricsMap[monthKey];
  if (v === undefined || v === null) return null;
  const days = typeof v === 'number' ? v : v.residentDays;
  return days > 0 ? days : null;
}

/**
 * Classifies the direction of change between the first and last month of a
 * quarter.  Requires at least 2 months with any recorded activity or
 * denominator data to produce a non-"insufficient-data" result.
 *
 * "Meaningfully different" is defined as a raw case-count difference ≥
 * TREND_MEANINGFUL_DIFF (currently 2).  This threshold is explicit and
 * transparent — no statistical modelling involved.
 */
export function computeTrend(months: MonthlyInfectionData[]): TrendResult {
  // A month counts as having "data" if it has cases OR a denominator entered.
  const withData = months.filter(m => m.caseCount > 0 || m.residentDays !== null);
  if (withData.length < 2) {
    return {
      direction: 'insufficient-data',
      note: 'Insufficient data to determine a trend (fewer than 2 months with activity or denominator data).',
    };
  }

  const first = months[0];
  const last = months[months.length - 1];
  const diff = last.caseCount - first.caseCount;

  if (diff >= TREND_MEANINGFUL_DIFF) {
    return {
      direction: 'increasing',
      note: `Infection counts increased from ${first.monthLabel} (${first.caseCount}) to ${last.monthLabel} (${last.caseCount}).`,
    };
  }
  if (diff <= -TREND_MEANINGFUL_DIFF) {
    return {
      direction: 'decreasing',
      note: `Infection counts decreased from ${first.monthLabel} (${first.caseCount}) to ${last.monthLabel} (${last.caseCount}).`,
    };
  }
  return {
    direction: 'stable',
    note: `Infection counts remained stable across the quarter (${first.monthLabel}: ${first.caseCount}, ${last.monthLabel}: ${last.caseCount}).`,
  };
}

/**
 * Builds the complete quarterly infection rate report data structure.
 *
 * @param infections  All IPEvent records for the facility (unfiltered by date).
 * @param metricsMap  The parsed contents of localStorage['ltc_facility_metrics'].
 * @param options     Year, quarter (1–4), and optional unit filter.
 */
export function buildQuarterlyInfectionRateReport(
  infections: IPEvent[],
  metricsMap: Record<string, StoredMonthlyMetric>,
  options: { year: number; quarter: Quarter; unitFilter?: string | null },
): QuarterlyInfectionRateReport {
  const { year, quarter, unitFilter } = options;
  const monthKeys = getQuarterMonths(year, quarter);

  // ── Per-month rollup ──────────────────────────────────────────────────────
  const months: MonthlyInfectionData[] = monthKeys.map(monthKey => {
    const { caseCount } = buildMonthlyInfectionCounts(infections, monthKey, unitFilter);
    const rd = resolveResidentDays(metricsMap, monthKey);
    const ratePer1000 = rd !== null ? (caseCount / rd) * 1000 : null;
    return {
      monthKey,
      monthLabel: monthKeyToLabel(monthKey),
      caseCount,
      residentDays: rd,
      ratePer1000,
    };
  });

  // ── Quarter-level totals ──────────────────────────────────────────────────
  const totalCases = months.reduce((s, m) => s + m.caseCount, 0);
  const monthsWithDenominator = months.filter(m => m.residentDays !== null);
  const totalResidentDays =
    monthsWithDenominator.length > 0
      ? monthsWithDenominator.reduce((s, m) => s + (m.residentDays ?? 0), 0)
      : null;
  const quarterRatePer1000 =
    totalResidentDays !== null && totalResidentDays > 0
      ? (totalCases / totalResidentDays) * 1000
      : null;

  // ── Category breakdown ────────────────────────────────────────────────────
  const catAccumulator: Record<string, { total: number; monthly: Record<string, number> }> = {};

  for (const monthKey of monthKeys) {
    const { byCategory } = buildMonthlyInfectionCounts(infections, monthKey, unitFilter);
    for (const [cat, count] of Object.entries(byCategory)) {
      if (!catAccumulator[cat]) catAccumulator[cat] = { total: 0, monthly: {} };
      catAccumulator[cat].total += count;
      catAccumulator[cat].monthly[monthKey] = (catAccumulator[cat].monthly[monthKey] ?? 0) + count;
    }
  }

  const byCategory: CategoryBreakdown[] = Object.entries(catAccumulator)
    .sort(([, a], [, b]) => b.total - a.total)
    .map(([category, data]) => ({
      category,
      totalCases: data.total,
      monthly: monthKeys.map(mk => ({ monthKey: mk, count: data.monthly[mk] ?? 0 })),
    }));

  // ── Assemble result ───────────────────────────────────────────────────────
  return {
    quarter,
    year,
    periodLabel: `${QUARTER_LABELS[quarter]} ${year}`,
    selectedUnit: unitFilter || null,
    totals: { totalCases, totalResidentDays, quarterRatePer1000 },
    months,
    byCategory,
    trend: computeTrend(months),
  };
}
