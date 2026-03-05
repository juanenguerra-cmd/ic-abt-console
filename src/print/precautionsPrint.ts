export interface PrecautionsPrintRow {
  room: string;
  residentName: string;
  precautionType: string;
  indication: string;
  startDate: string;
  organism: string;
  status: string;
}

export interface PrecautionsPrintPayload {
  facilityName: string;
  unitLabel: string;
  printedDate: string;
  rows: PrecautionsPrintRow[];
}

const PRECAUTIONS_PRINT_KEY = 'PRECAUTIONS_PRINT_PAYLOAD_V2';

export function savePrecautionsPrintPayload(payload: PrecautionsPrintPayload): void {
  sessionStorage.setItem(PRECAUTIONS_PRINT_KEY, JSON.stringify(payload));
}

export function loadPrecautionsPrintPayload(): PrecautionsPrintPayload | null {
  try {
    const raw = sessionStorage.getItem(PRECAUTIONS_PRINT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PrecautionsPrintPayload;
  } catch {
    return null;
  }
}

export function clearPrecautionsPrintPayload(): void {
  sessionStorage.removeItem(PRECAUTIONS_PRINT_KEY);
}
