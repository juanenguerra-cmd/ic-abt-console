import type { Resident } from '../domain/models';

export type DeviceEntry = {
  active: boolean;
  insertedDate: string | null;
};

export type ClinicalDevices = {
  oxygen: {
    enabled: boolean;
    mode: 'PRN' | 'Continuous' | null;
  };
  urinaryCatheter: DeviceEntry;
  indwellingCatheter: DeviceEntry;
  midline: DeviceEntry;
  picc: DeviceEntry;
  piv: DeviceEntry;
};

export const EMPTY_CLINICAL_DEVICES: ClinicalDevices = {
  oxygen: { enabled: false, mode: null },
  urinaryCatheter: { active: false, insertedDate: null },
  indwellingCatheter: { active: false, insertedDate: null },
  midline: { active: false, insertedDate: null },
  picc: { active: false, insertedDate: null },
  piv: { active: false, insertedDate: null },
};

const toDeviceEntry = (value: unknown): DeviceEntry => {
  if (typeof value === 'boolean') {
    return { active: value, insertedDate: null };
  }
  if (value && typeof value === 'object') {
    const maybe = value as { active?: unknown; insertedDate?: unknown };
    return {
      active: Boolean(maybe.active),
      insertedDate: typeof maybe.insertedDate === 'string' && maybe.insertedDate.trim() ? maybe.insertedDate : null,
    };
  }
  return { active: false, insertedDate: null };
};

export const normalizeClinicalDevices = (resident?: Resident | null): ClinicalDevices => {
  const raw = resident?.clinicalDevices;
  if (!raw) return EMPTY_CLINICAL_DEVICES;

  return {
    oxygen: {
      enabled: Boolean(raw.oxygen?.enabled),
      mode: raw.oxygen?.mode === 'Continuous' || raw.oxygen?.mode === 'PRN' ? raw.oxygen.mode : null,
    },
    urinaryCatheter: toDeviceEntry((raw as any).urinaryCatheter),
    indwellingCatheter: toDeviceEntry((raw as any).indwellingCatheter),
    midline: toDeviceEntry((raw as any).midline),
    picc: toDeviceEntry((raw as any).picc),
    piv: toDeviceEntry((raw as any).piv),
  };
};

export const getDeviceDay = (insertedDate?: string | null): number | null => {
  if (!insertedDate) return null;
  const start = new Date(insertedDate);
  if (Number.isNaN(start.getTime())) return null;

  const today = new Date();
  const diff = today.getTime() - start.getTime();
  const day = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
  return day > 0 ? day : 1;
};

export const formatDeviceDayLabel = (name: string, insertedDate?: string | null): string => {
  const day = getDeviceDay(insertedDate);
  return day ? `${name} (Day ${day})` : name;
};
