/**
 * Vaccine Coverage Count Engine
 *
 * Computes COUNTS of active/current residents who are "covered" for
 * Influenza, Pneumococcal, COVID-19, and RSV.
 *
 * Coverage includes BOTH in-house administered records AND historical/documented records.
 * Population: ACTIVE census residents only (not discharged, not historical, not back-office-only).
 */

import type { FacilityStore, VaxEvent, Resident } from '../domain/models';

// ─── Config ──────────────────────────────────────────────────────────────────

export interface FluSeasonConfig {
  /** Month (1-12) and day the flu season starts each year. Default: Aug 1. */
  seasonStartMonth: number;
  seasonStartDay: number;
  /** Month (1-12) and day the flu season ends. Default: Mar 31. */
  seasonEndMonth: number;
  seasonEndDay: number;
}

export interface VaccineCoverageConfig {
  fluSeason?: Partial<FluSeasonConfig>;
  /** Number of days back to consider a COVID-19 event valid. Default: 365. */
  covidLookbackDays?: number;
  /** Override "today" for testing / deterministic reports. */
  today?: Date;
}

const DEFAULT_FLU: FluSeasonConfig = {
  seasonStartMonth: 8,  // August
  seasonStartDay: 1,
  seasonEndMonth: 3,    // March
  seasonEndDay: 31,
};

// ─── Output ───────────────────────────────────────────────────────────────────

export interface VaccineCoverageResult {
  /** Total active census residents (not historical, not back-office-only, status Active). */
  totalActiveCensus: number;
  /** Residents covered for Influenza in the current flu season. */
  influenza: number;
  /** Residents covered for Pneumococcal (lifetime). */
  pneumococcal: number;
  /** Residents covered for COVID-19 in the last covidLookbackDays days. */
  covid19: number;
  /** Residents covered for RSV (lifetime). */
  rsv: number;
  /** VaxEvents that could not be linked to an active census resident. */
  unlinkedEventCount: number;
  /** Human-readable accuracy risk warnings. */
  accuracyRisks: string[];
  /** ISO date range used for the current flu season (for display). */
  fluSeasonWindow: { start: string; end: string } | null;
  /** ISO boundary used for the COVID-19 lookback window. */
  covidSinceDate: string;
}

// ─── Vaccine name matching ────────────────────────────────────────────────────

/** Returns true if the vaccine string is an Influenza vaccine. */
export const isInfluenza = (vaccine: string): boolean =>
  /influenza|\bflu\b/i.test(vaccine);

/** Returns true if the vaccine string is a Pneumococcal vaccine. */
export const isPneumococcal = (vaccine: string): boolean =>
  /pneumo/i.test(vaccine);

/** Returns true if the vaccine string is a COVID-19 vaccine. */
export const isCovid19 = (vaccine: string): boolean =>
  /covid|sars.?cov/i.test(vaccine);

/** Returns true if the vaccine string is an RSV vaccine. */
export const isRsv = (vaccine: string): boolean =>
  /\brsv\b|respiratory syncytial/i.test(vaccine);

// ─── Event qualification ──────────────────────────────────────────────────────

/**
 * Parse the embedded extended-data JSON from a VaxEvent's notes field.
 * Returns an empty object if the block is absent or malformed.
 */
export const parseExtendedData = (notes: string | undefined): Record<string, unknown> => {
  if (!notes) return {};
  try {
    const match = notes.match(/--- EXTENDED DATA ---\n([\s\S]*)/);
    if (match) return JSON.parse(match[1]);
  } catch {
    // swallow parse errors
  }
  return {};
};

/**
 * Resolve the canonical "date given" for a VaxEvent.
 * Preference order: dateGiven ?? administeredDate ?? createdAt
 */
export const getCanonicalDate = (event: VaxEvent): string | undefined =>
  event.dateGiven ?? event.administeredDate ?? event.createdAt;

/**
 * Returns true if the VaxEvent represents a vaccine that was actually
 * administered (in-house OR historically documented).
 *
 * Qualifying conditions:
 *   - status is 'given' OR 'documented-historical'
 *   - administrationSource (from extended data) is 'in_house' or 'historical',
 *     OR administrationSite is 'In-House' or 'Outside Provider',
 *     OR source is 'manual-historical', 'csv-import', or 'in-app'
 *   - resident linked to an MRN ref (not a quarantine/temp record)
 */
export const isQualifyingEvent = (event: VaxEvent): boolean => {
  // Must be a status indicating the vaccine was given
  if (event.status !== 'given' && event.status !== 'documented-historical') return false;

  // Must be linked to an MRN resident (not a quarantine entry)
  if (event.residentRef.kind !== 'mrn') return false;

  // Check administrationSite field (set by HistoricalVaxEventModal)
  if (event.administrationSite === 'In-House' || event.administrationSite === 'Outside Provider') {
    return true;
  }

  // Check source field (set by csv-import and legacy importers)
  if (event.source === 'in-app' || event.source === 'manual-historical' || event.source === 'csv-import') {
    return true;
  }

  // Fall back to extended-data administrationSource (set by VaxEventModal)
  const ext = parseExtendedData(event.notes);
  const src = ext.administrationSource as string | undefined;
  if (src === 'in_house' || src === 'historical') return true;

  // If none of the above source indicators are set but status is 'given',
  // treat as in-house (default path when no extended data was recorded).
  if (event.status === 'given') return true;

  return false;
};

// ─── Flu Season Window ────────────────────────────────────────────────────────

/**
 * Returns the flu season window (start and end Date) that is either
 * currently active or most recently completed, relative to `today`.
 *
 * Season spans from Aug 1 of year Y to Mar 31 of year Y+1.
 * - If today is Aug 1 – Dec 31: current season starts Aug 1 this year.
 * - If today is Jan 1 – Mar 31: current season started Aug 1 last year.
 * - If today is Apr 1 – Jul 31 (off-season): use the season that just ended
 *   (Aug 1 of the prior year – Mar 31 of the current year).
 */
export const getFluSeasonWindow = (
  today: Date,
  cfg: FluSeasonConfig = DEFAULT_FLU,
): { start: Date; end: Date } => {
  const yr = today.getFullYear();
  const mo = today.getMonth() + 1; // 1-based

  let seasonStartYear: number;

  if (mo > cfg.seasonEndMonth && mo < cfg.seasonStartMonth) {
    // Off-season: Apr–Jul → use the season that just ended
    seasonStartYear = yr - 1;
  } else if (mo >= cfg.seasonStartMonth) {
    // In-season second half: Aug–Dec → season started this year
    seasonStartYear = yr;
  } else {
    // In-season first half: Jan–Mar → season started last year
    seasonStartYear = yr - 1;
  }

  const start = new Date(seasonStartYear, cfg.seasonStartMonth - 1, cfg.seasonStartDay, 0, 0, 0, 0);
  // End year is the following year when the end month is before the start month (typical cross-year season),
  // otherwise it is in the same year as the season start.
  const endYear = cfg.seasonEndMonth < cfg.seasonStartMonth ? seasonStartYear + 1 : seasonStartYear;
  const end = new Date(endYear, cfg.seasonEndMonth - 1, cfg.seasonEndDay, 23, 59, 59, 999);
  return { start, end };
};

// ─── Active residents ─────────────────────────────────────────────────────────

/**
 * Returns the set of MRN strings for active census residents.
 * Active = not isHistorical, not backOfficeOnly, status === 'Active'.
 */
export const getActiveResidentMrns = (store: FacilityStore): Set<string> => {
  const mrns = new Set<string>();
  (Object.values(store.residents) as Resident[]).forEach(r => {
    if (!r.isHistorical && !r.backOfficeOnly && r.status === 'Active') {
      mrns.add(r.mrn);
    }
  });
  return mrns;
};

// ─── Main computation ─────────────────────────────────────────────────────────

/**
 * Compute vaccine coverage counts for the four key vaccines.
 *
 * @param store  The facility data store.
 * @param config Optional configuration overrides.
 * @returns      A {@link VaccineCoverageResult} with counts and risk notes.
 */
export const computeVaccineCoverage = (
  store: FacilityStore,
  config: VaccineCoverageConfig = {},
): VaccineCoverageResult => {
  const today = config.today ?? new Date();
  const fluCfg: FluSeasonConfig = { ...DEFAULT_FLU, ...config.fluSeason };
  const covidLookbackDays = config.covidLookbackDays ?? 365;

  const activeResidentMrns = getActiveResidentMrns(store);
  const totalActiveCensus = activeResidentMrns.size;

  // Compute date boundaries
  const fluWindow = getFluSeasonWindow(today, fluCfg);
  const covidSince = new Date(today.getTime() - covidLookbackDays * 24 * 60 * 60 * 1000);

  // Coverage sets: each MRN appears at most once per vaccine
  const coveredFlu = new Set<string>();
  const coveredPneumo = new Set<string>();
  const coveredCovid = new Set<string>();
  const coveredRsv = new Set<string>();

  let unlinkedEventCount = 0;
  const accuracyRisks: string[] = [];

  // Tracking for risk detection
  let missingDateCount = 0;

  const allVaxEvents = Object.values(store.vaxEvents ?? {}) as VaxEvent[];

  for (const event of allVaxEvents) {
    if (!isQualifyingEvent(event)) continue;

    const mrn = event.residentRef.id;

    // Unlinked: can't find this MRN in the active residents set
    if (!activeResidentMrns.has(mrn)) {
      unlinkedEventCount++;
      continue;
    }

    const canonicalDate = getCanonicalDate(event);
    if (!canonicalDate) {
      missingDateCount++;
      continue;
    }

    // Timezone-safe: compare YYYY-MM-DD strings after stripping time component
    const eventDateMs = new Date(canonicalDate).getTime();

    if (isInfluenza(event.vaccine)) {
      // Only count if event date falls within the current/most-recent flu season
      if (eventDateMs >= fluWindow.start.getTime() && eventDateMs <= fluWindow.end.getTime()) {
        coveredFlu.add(mrn);
      }
    }

    if (isPneumococcal(event.vaccine)) {
      coveredPneumo.add(mrn);
    }

    if (isCovid19(event.vaccine)) {
      if (eventDateMs >= covidSince.getTime()) {
        coveredCovid.add(mrn);
      }
    }

    if (isRsv(event.vaccine)) {
      coveredRsv.add(mrn);
    }
  }

  // ── Accuracy risk detection ────────────────────────────────────────────────

  if (missingDateCount > 0) {
    accuracyRisks.push(
      `${missingDateCount} qualifying vaccine event(s) have no date and were excluded from counts.`,
    );
  }

  // Duplicate resident detection (same displayName, different MRN)
  const nameToMrns: Record<string, string[]> = {};
  (Object.values(store.residents) as Resident[]).forEach(r => {
    if (!r.isHistorical && !r.backOfficeOnly && r.status === 'Active') {
      const key = r.displayName?.trim().toLowerCase() ?? '';
      if (key) {
        if (!nameToMrns[key]) nameToMrns[key] = [];
        nameToMrns[key].push(r.mrn);
      }
    }
  });
  const duplicateNames = Object.entries(nameToMrns).filter(([, mrns]) => mrns.length > 1);
  if (duplicateNames.length > 0) {
    accuracyRisks.push(
      `${duplicateNames.length} resident name(s) map to multiple MRNs — possible duplicate residents. Coverage may be undercounted.`,
    );
  }

  // Warn about unlinked events
  if (unlinkedEventCount > 0) {
    accuracyRisks.push(
      `${unlinkedEventCount} qualifying vaccine event(s) could not be matched to an active census resident (discharged, quarantine, or unknown MRN).`,
    );
  }

  // Warn about deprecated administeredDate usage
  const deprecatedDateCount = allVaxEvents.filter(
    e => !e.dateGiven && !!e.administeredDate,
  ).length;
  if (deprecatedDateCount > 0) {
    accuracyRisks.push(
      `${deprecatedDateCount} vaccine event(s) use the deprecated administeredDate field. Migrate to dateGiven for accurate reporting.`,
    );
  }

  return {
    totalActiveCensus,
    influenza: coveredFlu.size,
    pneumococcal: coveredPneumo.size,
    covid19: coveredCovid.size,
    rsv: coveredRsv.size,
    unlinkedEventCount,
    accuracyRisks,
    fluSeasonWindow: {
      start: fluWindow.start.toISOString().split('T')[0],
      end: fluWindow.end.toISOString().split('T')[0],
    },
    covidSinceDate: covidSince.toISOString().split('T')[0],
  };
};
