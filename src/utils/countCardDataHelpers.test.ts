import { test, expect, describe, vi, afterEach } from 'vitest';
import { computeResidentSignals } from './residentSignals';
import { getActiveABT, getVaxDue, isActiveCensusResident, filterActiveResidents, getAbtDays } from './countCardDataHelpers';
import { FacilityStore, Resident } from '../domain/models';

const makeResident = (overrides: Partial<Resident>): Resident => ({
  mrn: 'R1',
  displayName: 'Resident One',
  status: 'Active',
  sex: 'F',
  isHistorical: false,
  backOfficeOnly: false,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  ...overrides,
});

test('getActiveABT is resilient to mixed case and padded statuses', () => {
  const active = getActiveABT([
    {
      id: 'a1',
      residentRef: { kind: 'mrn', id: 'R1' },
      status: ' Active ' as any,
      medication: 'Test',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    },
    {
      id: 'a2',
      residentRef: { kind: 'mrn', id: 'R1' },
      status: 'completed',
      medication: 'Test',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    },
  ] as any);

  expect(active.length).toBe(1);
  expect(active[0].id).toBe('a1');
});

test('getVaxDue matches due and overdue despite casing/whitespace', () => {
  const due = getVaxDue([
    {
      id: 'v1',
      residentRef: { kind: 'mrn', id: 'R1' },
      vaccine: 'Influenza',
      status: ' Due ' as any,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    },
    {
      id: 'v2',
      residentRef: { kind: 'mrn', id: 'R2' },
      vaccine: 'Influenza',
      status: 'OVERDUE' as any,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    },
    {
      id: 'v3',
      residentRef: { kind: 'mrn', id: 'R2' },
      vaccine: 'Influenza',
      status: 'given',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    },
  ] as any);

  expect(due.map(v => v.id)).toEqual(['v1', 'v2']);
});

test('active census helper: active status resident is included', () => {
  expect(isActiveCensusResident(makeResident({ currentUnit: 'Unit 1' }))).toBe(true);
});

test('active census helper: historical resident is excluded', () => {
  expect(isActiveCensusResident(makeResident({ currentUnit: '', isHistorical: true }))).toBe(false);
});

test('active census helper: back-office-only resident is excluded', () => {
  expect(isActiveCensusResident(makeResident({ currentUnit: 'Unit 2', backOfficeOnly: true }))).toBe(false);
});

test('active census helper: resident with "unassigned" unit and active status is included', () => {
  // isActiveCensusResident checks status, isHistorical, and backOfficeOnly only.
  // A resident with currentUnit ' unassigned ' but status 'Active' is currently
  // included because the function does not filter by unit value.
  expect(isActiveCensusResident(makeResident({ currentUnit: ' unassigned ' }))).toBe(true);
});

test('filterActiveResidents: removes isHistorical and backOfficeOnly residents', () => {
  const active = makeResident({ mrn: 'A1', currentUnit: 'Unit 1' });
  const historical = makeResident({ mrn: 'H1', isHistorical: true });
  const backOffice = makeResident({ mrn: 'B1', backOfficeOnly: true });
  const discharged = makeResident({ mrn: 'D1', status: 'Discharged' });
  const result = filterActiveResidents([active, historical, backOffice, discharged]);
  expect(result.map(r => r.mrn)).toEqual(['A1']);
});

test('filterActiveResidents: returns empty array when no active residents', () => {
  const historical = makeResident({ mrn: 'H1', isHistorical: true });
  const backOffice = makeResident({ mrn: 'B1', backOfficeOnly: true });
  expect(filterActiveResidents([historical, backOffice])).toHaveLength(0);
});

test('computeResidentSignals uses normalized ABT/VAX helper rules', () => {
  const store: FacilityStore = {
    residents: {
      R1: makeResident({ mrn: 'R1', currentUnit: 'Unit 1' }),
    },
    abts: {
      a1: {
        id: 'a1',
        residentRef: { kind: 'mrn', id: 'R1' },
        status: ' active ' as any,
        medication: 'Ceftriaxone',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    },
    vaxEvents: {
      v1: {
        id: 'v1',
        residentRef: { kind: 'mrn', id: 'R1' },
        vaccine: 'COVID-19',
        status: ' Overdue ' as any,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    },
    infections: {},
    outbreaks: {},
    quarantine: {},
    notes: {},
    staff: {},
    notifications: {},
    bedCensusHistory: {},
    infectionControlAuditTemplates: {},
    infectionControlAuditSessions: {},
    infectionControlAuditItems: {},
    floorLayouts: {},
    mdroEvents: {},
    staffVaccinations: {},
    importJobs: {},
    apiKeyPresent: false,
  } as any;

  const signals = computeResidentSignals('R1', store, Date.now(), { R1: { respiratory: false, gi: false } });
  expect(signals.hasActiveAbt).toBe(true);
  expect(signals.hasDueVax).toBe(true);
});

describe('getAbtDays – correct off-by-one fix', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('3/11/2026 to 3/18/2026 → total = 7, currentDay = 1 on 3/11/2026', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-11T12:00:00'));
    const result = getAbtDays('2026-03-11', '2026-03-18');
    expect(result?.total).toBe(7);
    expect(result?.current).toBe(1);
  });

  test('3/11/2026 to 3/18/2026 → currentDay = 7 on 3/17/2026 (last treatment day)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-17T12:00:00'));
    const result = getAbtDays('2026-03-11', '2026-03-18');
    expect(result?.total).toBe(7);
    expect(result?.current).toBe(7);
  });

  test('currentDay is clamped to total when today is past endDate', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-25T12:00:00'));
    const result = getAbtDays('2026-03-11', '2026-03-18');
    expect(result?.total).toBe(7);
    expect(result?.current).toBe(7);
  });

  test('same-day course (start = end - 1 day) → total = 1', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-11T12:00:00'));
    const result = getAbtDays('2026-03-11', '2026-03-12');
    expect(result?.total).toBe(1);
    expect(result?.current).toBe(1);
  });

  test('no endDate → total is null, current counts up from start', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-13T12:00:00'));
    const result = getAbtDays('2026-03-11');
    expect(result?.total).toBeNull();
    expect(result?.current).toBe(3);
  });

  test('returns null when startDate is missing', () => {
    const result = getAbtDays(undefined, '2026-03-18');
    expect(result).toBeNull();
  });

  test('future startDate → currentDay is clamped to 1', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-10T12:00:00'));
    const result = getAbtDays('2026-03-11', '2026-03-18');
    // current would be 0 without clamping; must be at least 1
    expect(result?.current).toBe(1);
    expect(result?.total).toBe(7);
  });
});
