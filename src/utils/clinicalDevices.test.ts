import { test, expect, describe } from 'vitest';
import { getDeviceDay, normalizeClinicalDevices, buildDeviceUtilizationReport } from './clinicalDevices';
import type { Resident } from '../domain/models';

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

test('normalizeClinicalDevices supports legacy boolean line fields', () => {
  // normalizeClinicalDevices takes a Resident and reads resident.clinicalDevices.
  // The legacy boolean fields (e.g. urinaryCatheter: true) live inside that
  // clinicalDevices property, so the test wraps them accordingly.
  const normalized = normalizeClinicalDevices({
    clinicalDevices: {
      oxygen: { enabled: true, mode: 'PRN' },
      urinaryCatheter: true as any,
      indwellingCatheter: false as any,
      midline: true as any,
      picc: false as any,
      piv: true as any,
    },
  } as any);

  expect(normalized.urinaryCatheter.active).toBe(true);
  expect(normalized.urinaryCatheter.insertedDate).toBeNull();
  expect(normalized.midline.active).toBe(true);
  expect(normalized.piv.active).toBe(true);
});

test('getDeviceDay returns device day including insertion day', () => {
  const today = new Date();
  const sixDaysAgo = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  expect(getDeviceDay(sixDaysAgo)).toBe(7);
});

describe('buildDeviceUtilizationReport', () => {
  test('returns only active residents with devices', () => {
    const residents: Resident[] = [
      makeResident({
        mrn: 'A1',
        displayName: 'Alice',
        currentUnit: 'Unit 1',
        currentRoom: '101',
        clinicalDevices: { oxygen: { enabled: true, mode: 'Continuous' } } as any,
      }),
      makeResident({
        mrn: 'B1',
        displayName: 'Bob',
        currentUnit: 'Unit 1',
        clinicalDevices: { picc: { active: true, insertedDate: null } } as any,
      }),
      // Discharged resident should be excluded
      makeResident({
        mrn: 'C1',
        displayName: 'Charlie',
        status: 'Discharged',
        isHistorical: true,
        clinicalDevices: { oxygen: { enabled: true, mode: 'PRN' } } as any,
      }),
      // Resident with no devices should be excluded
      makeResident({ mrn: 'D1', displayName: 'Diana' }),
    ];

    const result = buildDeviceUtilizationReport(residents);

    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((r) => r.mrn)).toEqual(['A1', 'B1']);
    expect(result.totals.find((t) => t.device === 'Oxygen')?.count).toBe(1);
    expect(result.totals.find((t) => t.device === 'PICC')?.count).toBe(1);
  });

  test('filters by unit when selectedUnit is provided', () => {
    const residents: Resident[] = [
      makeResident({
        mrn: 'A1',
        displayName: 'Alice',
        currentUnit: 'Unit 1',
        clinicalDevices: { oxygen: { enabled: true, mode: 'PRN' } } as any,
      }),
      makeResident({
        mrn: 'B1',
        displayName: 'Bob',
        currentUnit: 'Unit 2',
        clinicalDevices: { midline: { active: true, insertedDate: null } } as any,
      }),
    ];

    const result = buildDeviceUtilizationReport(residents, 'Unit 1');

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].mrn).toBe('A1');
    expect(result.selectedUnit).toBe('Unit 1');
  });

  test('returns empty report when no residents have devices', () => {
    const residents: Resident[] = [
      makeResident({ mrn: 'A1', displayName: 'Alice' }),
    ];

    const result = buildDeviceUtilizationReport(residents);

    expect(result.rows).toHaveLength(0);
    expect(result.totals).toHaveLength(0);
    expect(result.censusCount).toBe(1);
  });

  test('rows are sorted alphabetically by name', () => {
    const residents: Resident[] = [
      makeResident({
        mrn: 'Z9',
        displayName: 'Zara',
        clinicalDevices: { picc: { active: true, insertedDate: null } } as any,
      }),
      makeResident({
        mrn: 'A1',
        displayName: 'Alice',
        clinicalDevices: { oxygen: { enabled: true, mode: 'PRN' } } as any,
      }),
    ];

    const result = buildDeviceUtilizationReport(residents);

    expect(result.rows[0].name).toBe('Alice');
    expect(result.rows[1].name).toBe('Zara');
  });

  test('counts oxygen with mode in oxygen label', () => {
    const residents: Resident[] = [
      makeResident({
        mrn: 'A1',
        displayName: 'Alice',
        clinicalDevices: { oxygen: { enabled: true, mode: 'Continuous' } } as any,
      }),
    ];

    const result = buildDeviceUtilizationReport(residents);
    expect(result.rows[0].devices[0]).toBe('Oxygen (Continuous)');
    expect(result.totals[0].device).toBe('Oxygen');
    expect(result.totals[0].count).toBe(1);
  });

  test('includes new device types (centralLine, trach, peg, woundVac, dialysisAccess, ostomy)', () => {
    const residents: Resident[] = [
      makeResident({
        mrn: 'A1',
        displayName: 'Alice',
        clinicalDevices: {
          centralLine: { active: true, insertedDate: null },
          trach: { active: true, insertedDate: null },
          peg: { active: true, insertedDate: null },
          woundVac: { active: true, insertedDate: null },
          dialysisAccess: { active: true, insertedDate: null },
          ostomy: { active: true, insertedDate: null },
        } as any,
      }),
    ];

    const result = buildDeviceUtilizationReport(residents);
    expect(result.rows).toHaveLength(1);
    const deviceNames = result.rows[0].devices;
    expect(deviceNames).toContain('Central Line');
    expect(deviceNames).toContain('Tracheostomy');
    expect(deviceNames).toContain('PEG / Feeding Tube');
    expect(deviceNames).toContain('Wound Vac');
    expect(deviceNames).toContain('Dialysis Access');
    expect(deviceNames).toContain('Ostomy');
    expect(result.totals.map((t) => t.device)).toEqual(
      expect.arrayContaining(['Central Line', 'Tracheostomy', 'PEG / Feeding Tube', 'Wound Vac', 'Dialysis Access', 'Ostomy']),
    );
  });

  test('normalizeClinicalDevices returns defaults for new fields when absent', () => {
    const resident = makeResident({ mrn: 'A1', displayName: 'Alice' });
    const devices = normalizeClinicalDevices(resident);
    expect(devices.centralLine).toEqual({ active: false, insertedDate: null });
    expect(devices.trach).toEqual({ active: false, insertedDate: null });
    expect(devices.peg).toEqual({ active: false, insertedDate: null });
    expect(devices.woundVac).toEqual({ active: false, insertedDate: null });
    expect(devices.dialysisAccess).toEqual({ active: false, insertedDate: null });
    expect(devices.ostomy).toEqual({ active: false, insertedDate: null });
  });
});
