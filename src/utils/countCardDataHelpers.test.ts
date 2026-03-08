import test from 'node:test';
import assert from 'node:assert/strict';
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

  assert.equal(active.length, 1);
  assert.equal(active[0].id, 'a1');
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

  assert.deepEqual(due.map(v => v.id), ['v1', 'v2']);
});

test('active census helper excludes unassigned, historical, and back-office residents', () => {
  assert.equal(isActiveCensusResident(makeResident({ currentUnit: 'Unit 1' })), true);
  assert.equal(isActiveCensusResident(makeResident({ currentUnit: ' unassigned ' })), false);
  assert.equal(isActiveCensusResident(makeResident({ currentUnit: '', isHistorical: true })), false);
  assert.equal(isActiveCensusResident(makeResident({ currentUnit: 'Unit 2', backOfficeOnly: true })), false);
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
  assert.equal(signals.hasActiveAbt, true);
  assert.equal(signals.hasDueVax, true);
});
