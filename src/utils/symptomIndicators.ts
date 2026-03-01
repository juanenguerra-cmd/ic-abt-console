/**
 * 96-Hour Rolling Symptom Indicator Utility
 *
 * Determines which residents have active Respiratory or GI symptom signals
 * within the past 96 hours, for display on the Live Floor Map.
 *
 * Canonical timestamp: createdAt (the moment data was entered into the system).
 * This avoids stale indicators from backdated or imported records being
 * presented as if they were recent events.
 *
 * Qualifying sources:
 *  1. Active ABT courses whose indication / syndromeCategory matches
 *     Respiratory or GI keywords AND whose createdAt is within 96 h.
 *  2. Resident notes containing respiratory or GI hashtags / keywords
 *     whose createdAt is within 96 h.
 *
 * Resolution:
 *  - ABT courses with status 'completed' or 'discontinued' are excluded.
 *  - Notes have no explicit resolution; the time window acts as automatic expiry.
 */

import { FacilityStore } from '../domain/models';

export interface SymptomIndicator {
  /** True when a qualifying Respiratory signal exists within 96 hours. */
  respiratory: boolean;
  /** True when a qualifying GI signal exists within 96 hours. */
  gi: boolean;
}

/** Respiratory symptom keywords (lower-case). */
const RESP_KEYWORDS = [
  'pneumonia', 'uri', 'bronchitis', 'covid', 'influenza', 'rsv', 'resp',
  '#cough', '#runnynose', '#fever', '#sorethroat', '#sob', 'cough',
  'runny nose', 'sore throat', 'shortness of breath',
];

/** GI symptom keywords (lower-case). */
const GI_KEYWORDS = [
  'diarrhea', 'gastroenteritis', 'c. diff', 'cdiff', 'n/v', 'vomit',
  'gi', '#diarrhea', '#vomiting', '#nausea', '#abdominalpain',
  'nausea', 'vomiting', 'abdominal pain',
];

const MS_96H = 96 * 60 * 60 * 1000;

/**
 * Returns a map of `mrn → SymptomIndicator` for residents who have at least
 * one qualifying Respiratory or GI signal within the past 96 hours.
 *
 * @param store   The current facility store snapshot.
 * @param nowMs   Current time in milliseconds (pass `Date.now()` at call site
 *                so callers can control the reference clock in tests).
 */
export function computeSymptomIndicators(
  store: FacilityStore,
  nowMs: number
): Record<string, SymptomIndicator> {
  const cutoff = nowMs - MS_96H;
  const result: Record<string, SymptomIndicator> = {};

  const ensureEntry = (mrn: string) => {
    if (!result[mrn]) result[mrn] = { respiratory: false, gi: false };
    return result[mrn];
  };

  // ── 1. ABT courses ───────────────────────────────────────────────────────
  for (const abt of Object.values(store.abts || {})) {
    // Only active prescriptions contribute (completed/discontinued = resolved)
    if (abt.status !== 'active') continue;

    // Guard against future-dated entries
    const entryMs = new Date(abt.createdAt).getTime();
    if (entryMs > nowMs) continue;
    if (entryMs < cutoff) continue;

    const mrn = abt.residentRef?.kind === 'mrn' ? abt.residentRef.id : undefined;
    if (!mrn) continue;

    const combined = `${(abt.indication || '').toLowerCase()} ${(abt.syndromeCategory || '').toLowerCase()}`;
    const entry = ensureEntry(mrn);
    if (!entry.respiratory && RESP_KEYWORDS.some(k => combined.includes(k))) {
      entry.respiratory = true;
    }
    if (!entry.gi && GI_KEYWORDS.some(k => combined.includes(k))) {
      entry.gi = true;
    }
  }

  // ── 2. Resident notes ────────────────────────────────────────────────────
  for (const note of Object.values(store.notes || {})) {
    // Guard against future-dated entries
    const entryMs = new Date(note.createdAt).getTime();
    if (entryMs > nowMs) continue;
    if (entryMs < cutoff) continue;

    const mrn = note.residentRef?.kind === 'mrn' ? note.residentRef.id : undefined;
    if (!mrn) continue;

    const lowerBody = (note.body || '').toLowerCase();
    const entry = ensureEntry(mrn);
    if (!entry.respiratory && RESP_KEYWORDS.some(k => lowerBody.includes(k))) {
      entry.respiratory = true;
    }
    if (!entry.gi && GI_KEYWORDS.some(k => lowerBody.includes(k))) {
      entry.gi = true;
    }
  }

  return result;
}
