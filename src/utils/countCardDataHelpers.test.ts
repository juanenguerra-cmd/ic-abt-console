import { test, expect, describe } from 'vitest';
import { computeResidentSignals } from './residentSignals';
import { getActiveABT, getVaxDue, isActiveCensusResident } from './countCardDataHelpers';
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
