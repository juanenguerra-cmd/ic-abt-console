/**
 * Resident Dashboard Signal Computation — Single Source of Truth
 *
 * Computes IC-relevant signals for a single resident based on current store data.
 * Used for Kanban tile strip colours and the default "highlighted" dashboard filter.
 *
 * Strip priority:
 *  1) yellow – Active Isolation (isolationType set)
 *  2) blue   – EBP / Enhanced Barrier Precautions flag only (no formal isolation type)
 *  3) green  – Active ABT course
 *  else none
 *
 * NOTE: Isolation and EBP chips should be mutually exclusive for the dashboard tile.
 * hasActivePrecaution = protocol is Isolation (not EBP) and an isolation type is assigned.
 * hasEbp             = EBP protocol is selected only when no active Isolation signal exists.
 * EBP entries may still have text in isolationType (stored as EBP indication),
 * so isolation keys off ebp=false.
 */

import { FacilityStore } from '../domain/models';
import { computeSymptomIndicators } from './symptomIndicators';
import { getActiveABT, getVaxDue } from './countCardDataHelpers';

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
  // Formal isolation only — protocol must be isolation (ebp !== true)
  // and isolationType must be explicitly assigned.
  const hasActivePrecaution = Object.values(store.infections || {}).some(
    i =>
      i.residentRef.kind === 'mrn' &&
      i.residentRef.id === residentId &&
      i.status === 'active' &&
      i.ebp !== true &&
      Boolean(i.isolationType)
  );

  const hasAnyActiveEbp = Object.values(store.infections || {}).some(
    i =>
      i.residentRef.kind === 'mrn' &&
      i.residentRef.id === residentId &&
      i.status === 'active' &&
      i.ebp === true
  );

  // Keep chip behavior mutually exclusive: if Isolation is active, do not also render EBP chip.
  const hasEbp = !hasActivePrecaution && hasAnyActiveEbp;

  const hasActiveAbt = getActiveABT(Object.values(store.abts || {}), residentId).length > 0;

  const hasDueVax = getVaxDue(Object.values(store.vaxEvents || {}), residentId).length > 0;

  const resolvedSymptomMap = symptomMap ?? computeSymptomIndicators(store, nowMs);
  const ind = resolvedSymptomMap[residentId];
  const hasRecentSymptoms96h = Boolean(ind && (ind.respiratory || ind.gi));

  // Strip colour logic:
  // - Formal isolation → yellow (most restrictive, highest priority)
  // - EBP only → blue
  // - Active ABT only → green
  let strip: ResidentSignals['strip'] = 'none';
  if (hasActivePrecaution) strip = 'yellow';
  else if (hasEbp) strip = 'blue';
  else if (hasActiveAbt) strip = 'green';

  return { hasActivePrecaution, hasEbp, hasActiveAbt, hasDueVax, hasRecentSymptoms96h, strip };
}
