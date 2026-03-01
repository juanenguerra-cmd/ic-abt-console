/**
 * Resident Dashboard Signal Computation — Single Source of Truth
 *
 * Computes IC-relevant signals for a single resident based on current store data.
 * Used for Kanban tile strip colours and the default "highlighted" dashboard filter.
 *
 * Strip priority:
 *  1) yellow – Active Precaution / Isolation
 *  2) green  – Active ABT course
 *  3) blue   – EBP (MDRO) flag on active infection
 *  else none
 */

import { FacilityStore } from '../domain/models';
import { computeSymptomIndicators } from './symptomIndicators';

export interface ResidentSignals {
  hasActivePrecaution: boolean;
  hasEbp: boolean;
  hasActiveAbt: boolean;
  hasDueVax: boolean;
  hasRecentSymptoms96h: boolean;
  strip: 'yellow' | 'blue' | 'green' | 'none';
}

export function computeResidentSignals(
  residentId: string,
  store: FacilityStore,
  nowMs: number,
  /** Pass a pre-computed symptom map to avoid redundant iteration across many residents. */
  symptomMap?: Record<string, { respiratory: boolean; gi: boolean }>
): ResidentSignals {
  const hasActivePrecaution = Object.values(store.infections || {}).some(
    i =>
      i.residentRef.kind === 'mrn' &&
      i.residentRef.id === residentId &&
      i.status === 'active' &&
      Boolean(i.isolationType || i.ebp)
  );

  const hasEbp = Object.values(store.infections || {}).some(
    i =>
      i.residentRef.kind === 'mrn' &&
      i.residentRef.id === residentId &&
      i.status === 'active' &&
      i.ebp === true
  );

  const hasActiveAbt = Object.values(store.abts || {}).some(
    a =>
      a.residentRef.kind === 'mrn' &&
      a.residentRef.id === residentId &&
      a.status === 'active'
  );

  const hasDueVax = Object.values(store.vaxEvents || {}).some(
    v =>
      v.residentRef.kind === 'mrn' &&
      v.residentRef.id === residentId &&
      (v.status === 'due' || v.status === 'overdue')
  );

  const resolvedSymptomMap = symptomMap ?? computeSymptomIndicators(store, nowMs);
  const ind = resolvedSymptomMap[residentId];
  const hasRecentSymptoms96h = Boolean(ind && (ind.respiratory || ind.gi));

  let strip: ResidentSignals['strip'] = 'none';
  if (hasActivePrecaution) strip = 'yellow';
  else if (hasActiveAbt) strip = 'green';
  else if (hasEbp) strip = 'blue';

  return { hasActivePrecaution, hasEbp, hasActiveAbt, hasDueVax, hasRecentSymptoms96h, strip };
}
