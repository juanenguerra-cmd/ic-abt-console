import { PrintJob } from './printJob';

const KEY = 'PRINT_JOBS_V1';

function readMap(): Record<string, PrintJob> {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, PrintJob>;
  } catch {
    return {};
  }
}

function writeMap(next: Record<string, PrintJob>) {
  sessionStorage.setItem(KEY, JSON.stringify(next));
}

export function savePrintJob(job: PrintJob): void {
  const map = readMap();
  map[job.id] = job;

  // trim stale jobs (older than 30min) + cap map size
  const now = Date.now();
  const entries = Object.entries(map)
    .filter(([, value]) => now - value.createdAt < 30 * 60 * 1000)
    .sort((a, b) => b[1].createdAt - a[1].createdAt)
    .slice(0, 100);

  writeMap(Object.fromEntries(entries));
}

export function loadPrintJob(id: string): PrintJob | null {
  const map = readMap();
  return map[id] ?? null;
}

export function deletePrintJob(id: string): void {
  const map = readMap();
  if (!(id in map)) return;
  delete map[id];
  writeMap(map);
}
