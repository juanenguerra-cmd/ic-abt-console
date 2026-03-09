import { test, expect } from 'vitest';
import { getDeviceDay, normalizeClinicalDevices } from './clinicalDevices';

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
