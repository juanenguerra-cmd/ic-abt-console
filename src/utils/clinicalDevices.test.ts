import test from 'node:test';
import assert from 'node:assert/strict';
import { getDeviceDay, normalizeClinicalDevices } from './clinicalDevices';

test('normalizeClinicalDevices supports legacy boolean line fields', () => {
  const normalized = normalizeClinicalDevices({
    oxygen: { enabled: true, mode: 'PRN' },
    urinaryCatheter: true as any,
    indwellingCatheter: false as any,
    midline: true as any,
    picc: false as any,
    piv: true as any,
  } as any);

  assert.equal(normalized.urinaryCatheter.active, true);
  assert.equal(normalized.urinaryCatheter.insertedDate, null);
  assert.equal(normalized.midline.active, true);
  assert.equal(normalized.piv.active, true);
});

test('getDeviceDay returns device day including insertion day', () => {
  const today = new Date();
  const sixDaysAgo = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  assert.equal(getDeviceDay(sixDaysAgo), 7);
});
