import type { Resident } from "../domain/models";

type ClinicalDevices = NonNullable<Resident["clinicalDevices"]>;
type DeviceEntry = ClinicalDevices["urinaryCatheter"];

export const EMPTY_CLINICAL_DEVICES: ClinicalDevices = {
  oxygen: { enabled: false, mode: null },
  urinaryCatheter: { active: false, insertedDate: null },
  indwellingCatheter: { active: false, insertedDate: null },
  midline: { active: false, insertedDate: null },
  picc: { active: false, insertedDate: null },
  piv: { active: false, insertedDate: null },
};

const normalizeLineDevice = (value: unknown): DeviceEntry => {
  if (typeof value === "boolean") {
    return { active: value, insertedDate: null };
  }

  if (value && typeof value === "object") {
    const candidate = value as { active?: unknown; insertedDate?: unknown };
    return {
      active: Boolean(candidate.active),
      insertedDate: typeof candidate.insertedDate === "string" && candidate.insertedDate.trim() ? candidate.insertedDate : null,
    };
  }

  return { active: false, insertedDate: null };
};

export const normalizeClinicalDevices = (devices?: Resident["clinicalDevices"]): ClinicalDevices => {
  if (!devices) return EMPTY_CLINICAL_DEVICES;

  return {
    oxygen: {
      enabled: Boolean(devices.oxygen?.enabled),
      mode: devices.oxygen?.mode === "PRN" || devices.oxygen?.mode === "Continuous" ? devices.oxygen.mode : null,
    },
    urinaryCatheter: normalizeLineDevice((devices as any).urinaryCatheter),
    indwellingCatheter: normalizeLineDevice((devices as any).indwellingCatheter),
    midline: normalizeLineDevice((devices as any).midline),
    picc: normalizeLineDevice((devices as any).picc),
    piv: normalizeLineDevice((devices as any).piv),
  };
};

export const getDeviceDay = (insertedDate: string): number | null => {
  const start = new Date(insertedDate);
  if (Number.isNaN(start.getTime())) return null;

  const today = new Date();
  const diff = today.getTime() - start.getTime();
  const day = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(day, 1);
};
