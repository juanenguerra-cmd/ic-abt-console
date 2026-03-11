import type { Resident } from '../domain/models';
import { filterActiveResidents } from './countCardDataHelpers';

// ─── Device Utilization Report ────────────────────────────────────────────────

export interface DeviceReportRow {
  residentId: string;
  name: string;
  mrn: string;
  room: string;
  unit: string;
  devices: string[];
}

export interface DeviceReport {
  reportDate: string;
  selectedUnit: string | null;
  censusCount: number;
  totals: Array<{ device: string; count: number }>;
  rows: DeviceReportRow[];
}

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
  centralLine: DeviceEntry;
  trach: DeviceEntry;
  peg: DeviceEntry;
  woundVac: DeviceEntry;
  dialysisAccess: DeviceEntry;
  ostomy: DeviceEntry;
};

export const EMPTY_CLINICAL_DEVICES: ClinicalDevices = {
  oxygen: { enabled: false, mode: null },
  urinaryCatheter: { active: false, insertedDate: null },
  indwellingCatheter: { active: false, insertedDate: null },
  midline: { active: false, insertedDate: null },
  picc: { active: false, insertedDate: null },
  piv: { active: false, insertedDate: null },
  centralLine: { active: false, insertedDate: null },
  trach: { active: false, insertedDate: null },
  peg: { active: false, insertedDate: null },
  woundVac: { active: false, insertedDate: null },
  dialysisAccess: { active: false, insertedDate: null },
  ostomy: { active: false, insertedDate: null },
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
    centralLine: toDeviceEntry((raw as any).centralLine),
    trach: toDeviceEntry((raw as any).trach),
    peg: toDeviceEntry((raw as any).peg),
    woundVac: toDeviceEntry((raw as any).woundVac),
    dialysisAccess: toDeviceEntry((raw as any).dialysisAccess),
    ostomy: toDeviceEntry((raw as any).ostomy),
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

export function buildDeviceUtilizationReport(
  residents: Resident[],
  selectedUnit?: string | null,
): DeviceReport {
  const activeResidents = filterActiveResidents(residents).filter((r) =>
    selectedUnit == null || r.currentUnit === selectedUnit,
  );

  const rows: DeviceReportRow[] = activeResidents
    .map((r) => {
      const devices = normalizeClinicalDevices(r);
      const deviceList: string[] = [];

      if (devices.oxygen.enabled) {
        deviceList.push(devices.oxygen.mode ? `Oxygen (${devices.oxygen.mode})` : 'Oxygen');
      }
      if (devices.urinaryCatheter.active) deviceList.push(formatDeviceDayLabel('Foley Catheter', devices.urinaryCatheter.insertedDate));
      if (devices.indwellingCatheter.active) deviceList.push(formatDeviceDayLabel('Indwelling Catheter', devices.indwellingCatheter.insertedDate));
      if (devices.midline.active) deviceList.push(formatDeviceDayLabel('Midline', devices.midline.insertedDate));
      if (devices.picc.active) deviceList.push(formatDeviceDayLabel('PICC', devices.picc.insertedDate));
      if (devices.piv.active) deviceList.push(formatDeviceDayLabel('PIV', devices.piv.insertedDate));
      if (devices.centralLine.active) deviceList.push(formatDeviceDayLabel('Central Line', devices.centralLine.insertedDate));
      if (devices.trach.active) deviceList.push(formatDeviceDayLabel('Tracheostomy', devices.trach.insertedDate));
      if (devices.peg.active) deviceList.push(formatDeviceDayLabel('PEG / Feeding Tube', devices.peg.insertedDate));
      if (devices.woundVac.active) deviceList.push(formatDeviceDayLabel('Wound Vac', devices.woundVac.insertedDate));
      if (devices.dialysisAccess.active) deviceList.push(formatDeviceDayLabel('Dialysis Access', devices.dialysisAccess.insertedDate));
      if (devices.ostomy.active) deviceList.push('Ostomy');

      return {
        residentId: r.mrn,
        name: r.displayName ?? '',
        mrn: r.mrn ?? '',
        room: r.currentRoom ?? '',
        unit: r.currentUnit ?? '',
        devices: deviceList,
      };
    })
    .filter((r) => r.devices.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const device of row.devices) {
      // Strip trailing parenthetical suffixes for counting
      // e.g. "Oxygen (Continuous)" → "Oxygen", "PICC (Day 3)" → "PICC"
      const key = device.replace(/\s*\([^)]+\)$/, '');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return {
    reportDate: new Date().toISOString(),
    selectedUnit: selectedUnit ?? null,
    censusCount: activeResidents.length,
    totals: Array.from(counts.entries()).map(([device, count]) => ({ device, count })),
    rows,
  };
}
