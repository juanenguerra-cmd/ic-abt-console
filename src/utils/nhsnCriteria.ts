/**
 * NHSN LTC Surveillance Criteria Checker
 * Pure functions — no side effects, no imports of React or DB.
 * All reads use optional chaining; never throws on missing data.
 */

import { IPEvent, ABTCourse, Resident } from "../domain/models";

// ---------- Shared types ----------

export type CriterionStatus = 'met' | 'not_met' | 'missing_data';

export interface NhsnCriterion {
  label: string;
  status: CriterionStatus;
  note?: string;
}

export interface NhsnResult {
  verdict: 'meets' | 'does_not_meet' | 'insufficient_data';
  criteria: NhsnCriterion[];
}

export type CautiResult = NhsnResult;
export type CdiffResult = NhsnResult;

// ---------- Helpers ----------

function daysBetween(dateA: string | undefined, dateB: string | undefined): number | null {
  if (!dateA || !dateB) return null;
  try {
    const a = new Date(dateA).getTime();
    const b = new Date(dateB).getTime();
    if (isNaN(a) || isNaN(b)) return null;
    return Math.floor((b - a) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

function verdictFromCriteria(criteria: NhsnCriterion[]): NhsnResult['verdict'] {
  if (criteria.some(c => c.status === 'not_met')) return 'does_not_meet';
  if (criteria.some(c => c.status === 'missing_data')) return 'insufficient_data';
  return 'meets';
}

// ---------- NHSN LTC CAUTI Checker ----------
/**
 * NHSN LTC CAUTI Definition.
 * Criteria (ALL must be met):
 * 1. Urinary catheter present ≥ 2 calendar days before symptom onset
 * 2. At least one UTI symptom documented
 * 3. Positive urine culture ≥ 100,000 CFU/mL (≤ 2 organisms)
 */
export function checkCauti(
  ip: IPEvent,
  _abts: ABTCourse[],
  resident: Resident
): CautiResult {
  const criteria: NhsnCriterion[] = [];

  // Criterion 1: Urinary catheter ≥ 2 days before onset
  const hasUrinaryCatheter =
    (ip.deviceTypes ?? []).some(d => /urinary.catheter/i.test(d)) ||
    /urinary.catheter/i.test(ip.isolationType ?? '');

  if (!hasUrinaryCatheter) {
    criteria.push({
      label: 'Urinary catheter present ≥ 2 days before onset',
      status: 'missing_data',
      note: 'No urinary catheter device flag found on this event.',
    });
  } else {
    // We know catheter is present; check duration if admission date available
    const admissionDate = resident?.admissionDate;
    const onsetDate = ip.onsetDate;
    const cathDays = daysBetween(admissionDate, onsetDate);
    if (cathDays === null) {
      criteria.push({
        label: 'Urinary catheter present ≥ 2 days before onset',
        status: 'missing_data',
        note: 'Cannot calculate duration: onset date or admission date missing.',
      });
    } else if (cathDays >= 2) {
      criteria.push({
        label: 'Urinary catheter present ≥ 2 days before onset',
        status: 'met',
        note: `Catheter present ~${cathDays} days (estimated from admission date).`,
      });
    } else {
      criteria.push({
        label: 'Urinary catheter present ≥ 2 days before onset',
        status: 'not_met',
        note: `Estimated only ${cathDays} day(s) between admission and onset.`,
      });
    }
  }

  // Criterion 2: UTI symptom documented (fever, suprapubic tenderness, CVA pain, urgency/frequency/dysuria)
  const utiSymptomKeywords = ['fever', 'suprapubic', 'cva', 'urgency', 'frequency', 'dysuria', 'tenderness'];
  const notesLower = (ip.notes ?? '').toLowerCase();
  const hasSymptom = utiSymptomKeywords.some(kw => notesLower.includes(kw));
  if (hasSymptom) {
    criteria.push({ label: 'UTI symptom documented (fever, suprapubic tenderness, CVA pain, urgency/frequency/dysuria)', status: 'met' });
  } else {
    criteria.push({
      label: 'UTI symptom documented (fever, suprapubic tenderness, CVA pain, urgency/frequency/dysuria)',
      status: 'missing_data',
      note: 'No UTI symptom keywords found in event notes. Document symptoms in the notes field.',
    });
  }

  // Criterion 3: Positive urine culture ≥ 100,000 CFU/mL
  const hasLabResult = !!ip.labResultDate;
  const hasSpecimen = !!ip.specimenCollectedDate;
  if (!hasSpecimen) {
    criteria.push({
      label: 'Positive urine culture ≥ 100,000 CFU/mL (≤ 2 organisms)',
      status: 'missing_data',
      note: 'Specimen collection date not documented.',
    });
  } else if (!hasLabResult) {
    criteria.push({
      label: 'Positive urine culture ≥ 100,000 CFU/mL (≤ 2 organisms)',
      status: 'missing_data',
      note: 'Lab result date not documented.',
    });
  } else {
    criteria.push({
      label: 'Positive urine culture ≥ 100,000 CFU/mL (≤ 2 organisms)',
      status: 'missing_data',
      note: 'Culture collected and result documented. Verify CFU count and organism count manually.',
    });
  }

  return { verdict: verdictFromCriteria(criteria), criteria };
}

// ---------- NHSN LTC C. diff LabID Checker ----------
/**
 * NHSN LTC C. difficile LabID Event Definition.
 * Criteria:
 * 1. Positive C. diff toxin or NAAT lab result
 * 2. Onset > 3 days after admission (community-onset if ≤ 3 days)
 * 3. No prior positive C. diff result in same resident within past 14 days
 */
export function checkCdiffLabId(
  ip: IPEvent,
  allIpEvents: IPEvent[]
): CdiffResult {
  const criteria: NhsnCriterion[] = [];

  // Criterion 1: Positive C. diff lab result documented
  const hasLabResult = !!ip.labResultDate;
  const hasSpecimen = !!ip.specimenCollectedDate;
  const organism = (ip.organism ?? '').toLowerCase();
  // All patterns compared against already-lowercase string
  const isCdiffOrganism = organism.includes('c. diff') || organism.includes('c.diff') || organism.includes('cdiff') || organism.includes('clostridioides') || organism.includes('clostridium diff');

  if (!hasSpecimen && !hasLabResult) {
    criteria.push({
      label: 'Positive C. diff toxin or NAAT lab result',
      status: 'missing_data',
      note: 'No specimen collection or lab result date documented.',
    });
  } else if (!hasLabResult) {
    criteria.push({
      label: 'Positive C. diff toxin or NAAT lab result',
      status: 'missing_data',
      note: 'Lab result date not yet documented.',
    });
  } else if (!isCdiffOrganism) {
    criteria.push({
      label: 'Positive C. diff toxin or NAAT lab result',
      status: 'missing_data',
      note: 'Lab result date documented but C. diff not listed as organism.',
    });
  } else {
    criteria.push({
      label: 'Positive C. diff toxin or NAAT lab result',
      status: 'met',
      note: 'Lab result documented and C. diff identified as organism.',
    });
  }

  // Criterion 2: Onset > 3 days after admission
  const onsetDateFromNotes = (() => {
    try {
      const match = (ip.notes ?? '').match(/--- EXTENDED DATA ---\n(.*)/s);
      if (match) {
        const ext = JSON.parse(match[1]) as Record<string, unknown>;
        return typeof ext.onsetDate === 'string' ? ext.onsetDate : null;
      }
    } catch { /* empty */ }
    return null;
  })();

  const effectiveOnsetDate = ip.onsetDate ?? onsetDateFromNotes ?? ip.createdAt;

  // We don't have resident here, but we can check ip.locationSnapshot for the created date
  // Use createdAt as a fallback approximation for admission
  const daysSinceCreation = daysBetween(ip.createdAt?.split('T')[0], effectiveOnsetDate);

  if (!effectiveOnsetDate) {
    criteria.push({
      label: 'Onset > 3 calendar days after admission (healthcare-onset)',
      status: 'missing_data',
      note: 'Onset date not documented.',
    });
  } else if (daysSinceCreation === null) {
    criteria.push({
      label: 'Onset > 3 calendar days after admission (healthcare-onset)',
      status: 'missing_data',
      note: 'Cannot calculate days from admission — admission date not available in event data.',
    });
  } else if (daysSinceCreation > 3) {
    criteria.push({
      label: 'Onset > 3 calendar days after admission (healthcare-onset)',
      status: 'met',
      note: `Onset approximately ${daysSinceCreation} days after event creation date.`,
    });
  } else {
    criteria.push({
      label: 'Onset > 3 calendar days after admission (healthcare-onset)',
      status: 'not_met',
      note: 'Onset ≤ 3 days — may be community-onset. Confirm with admission date.',
    });
  }

  // Criterion 3: No prior C. diff positive in past 14 days for same resident
  const residentId = ip.residentRef?.id;
  const priorCdiff = allIpEvents.filter(ev => {
    if (ev.id === ip.id) return false;
    if (ev.residentRef?.id !== residentId) return false;
    const evOrganism = (ev.organism ?? '').toLowerCase();
    if (!evOrganism.includes('diff')) return false;
    const evCategory = (ev.infectionCategory ?? '').toLowerCase();
    if (!evCategory.includes('diff') && !evCategory.includes('gi')) return false;
    const daysDiff = daysBetween(ev.createdAt?.split('T')[0], ip.createdAt?.split('T')[0]);
    return daysDiff !== null && daysDiff >= 0 && daysDiff <= 14;
  });

  if (!residentId) {
    criteria.push({
      label: 'No prior C. diff positive within 14 days',
      status: 'missing_data',
      note: 'Cannot verify: resident reference missing.',
    });
  } else if (priorCdiff.length > 0) {
    criteria.push({
      label: 'No prior C. diff positive within 14 days',
      status: 'not_met',
      note: `${priorCdiff.length} prior C. diff event(s) found within the last 14 days for this resident.`,
    });
  } else {
    criteria.push({
      label: 'No prior C. diff positive within 14 days',
      status: 'met',
    });
  }

  return { verdict: verdictFromCriteria(criteria), criteria };
}
