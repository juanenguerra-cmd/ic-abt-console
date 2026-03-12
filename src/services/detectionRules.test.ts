/**
 * Tests for DetectionRules — G4 (14-day ABT escalation) and G5 (IP no isolation).
 */

import { describe, test, expect } from 'vitest';
import { DetectionRules } from './detectionRules';
import { ABTCourse, IPEvent } from '../domain/models';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAbt(overrides: Partial<ABTCourse> = {}): ABTCourse {
  return {
    id: 'abt-1',
    residentRef: { id: 'r-1', label: 'Test Resident' },
    status: 'active',
    medication: 'Amoxicillin',
    medicationId: '',
    enteredMedicationText: 'Amoxicillin',
    dose: '500',
    doseUnit: 'mg',
    route: 'PO',
    frequency: 'TID',
    startDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    indication: 'UTI',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as ABTCourse;
}

function makeIp(overrides: Partial<IPEvent> = {}): IPEvent {
  return {
    id: 'ip-1',
    residentRef: { id: 'r-1', label: 'Test Resident' },
    status: 'active',
    infectionCategory: 'UTI',
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as IPEvent;
}

// ---------------------------------------------------------------------------
// G4: checkAbt14DayEscalation
// ---------------------------------------------------------------------------

describe('DetectionRules.checkAbt14DayEscalation (G4)', () => {
  const now = new Date();

  test('returns null when ABT is not active', () => {
    const abt = makeAbt({ status: 'completed' });
    expect(DetectionRules.checkAbt14DayEscalation(abt, now)).toBeNull();
  });

  test('returns null when ABT has no startDate', () => {
    const abt = makeAbt({ startDate: undefined });
    expect(DetectionRules.checkAbt14DayEscalation(abt, now)).toBeNull();
  });

  test('returns null when ABT is active but less than 14 days old', () => {
    const thirteenDaysAgo = new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000);
    const abt = makeAbt({ startDate: thirteenDaysAgo.toISOString().slice(0, 10) });
    expect(DetectionRules.checkAbt14DayEscalation(abt, now)).toBeNull();
  });

  test('fires ABT_STEWARDSHIP alert when ABT is exactly 14 days old', () => {
    const exactlyFourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const abt = makeAbt({ startDate: exactlyFourteenDaysAgo.toISOString().slice(0, 10) });
    const result = DetectionRules.checkAbt14DayEscalation(abt, now);
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe('abt_14day_timeout_rule');
    expect(result!.category).toBe('ABT_STEWARDSHIP');
    expect(result!.message).toContain('Amoxicillin');
    expect(result!.refs.abtId).toBe('abt-1');
  });

  test('fires ABT_STEWARDSHIP alert when ABT is more than 14 days old', () => {
    const twentyDaysAgo = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
    const abt = makeAbt({ startDate: twentyDaysAgo.toISOString().slice(0, 10) });
    const result = DetectionRules.checkAbt14DayEscalation(abt, now);
    expect(result).not.toBeNull();
    expect(result!.category).toBe('ABT_STEWARDSHIP');
  });

  test('message includes the medication name', () => {
    const abt = makeAbt({
      medication: 'Vancomycin',
      startDate: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    });
    const result = DetectionRules.checkAbt14DayEscalation(abt, now);
    expect(result!.message).toContain('Vancomycin');
  });
});

// ---------------------------------------------------------------------------
// G5: checkIpNoIsolationAlert
// ---------------------------------------------------------------------------

describe('DetectionRules.checkIpNoIsolationAlert (G5)', () => {
  const now = new Date();

  test('returns null when IP event is not active', () => {
    const ip = makeIp({ status: 'resolved' });
    expect(DetectionRules.checkIpNoIsolationAlert(ip, now)).toBeNull();
  });

  test('returns null when IP is active and < 4 hours old without isolationType', () => {
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const ip = makeIp({ createdAt: twoHoursAgo.toISOString() });
    expect(DetectionRules.checkIpNoIsolationAlert(ip, now)).toBeNull();
  });

  test('returns null when IP is active > 4 hours but isolationType is set', () => {
    const ip = makeIp({ isolationType: 'Contact' });
    expect(DetectionRules.checkIpNoIsolationAlert(ip, now)).toBeNull();
  });

  test('returns null when IP is active > 4 hours but ebp flag is set', () => {
    const ip = makeIp({ ebp: true } as any);
    expect(DetectionRules.checkIpNoIsolationAlert(ip, now)).toBeNull();
  });

  test('fires LINE_LIST_REVIEW when active IP > 4 hours with no isolationType', () => {
    const ip = makeIp();
    const result = DetectionRules.checkIpNoIsolationAlert(ip, now);
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe('ip_no_isolation_rule');
    expect(result!.category).toBe('LINE_LIST_REVIEW');
    expect(result!.refs.ipId).toBe('ip-1');
  });

  test('fires at exactly 4 hours elapsed', () => {
    const exactlyFourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
    const ip = makeIp({ createdAt: exactlyFourHoursAgo.toISOString() });
    const result = DetectionRules.checkIpNoIsolationAlert(ip, now);
    expect(result).not.toBeNull();
  });

  test('message includes infection category', () => {
    const ip = makeIp({ infectionCategory: 'Respiratory' });
    const result = DetectionRules.checkIpNoIsolationAlert(ip, now);
    expect(result!.message).toContain('Respiratory');
  });
});
