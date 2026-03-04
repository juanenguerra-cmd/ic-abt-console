import { PrintJob } from './printJob';

const KEY = 'PRINT_JOBS_V1';
const TTL_MS = 10 * 60 * 1000;

function readAll(): Record<string, PrintJob> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, PrintJob>) : {};
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, PrintJob>): void {
  localStorage.setItem(KEY, JSON.stringify(map));
}

export function savePrintJob(job: PrintJob): void {
  const map = readAll();
  map[job.id] = job;
  writeAll(map);
}

export function loadPrintJob(id: string): PrintJob | null {
  const map = readAll();
  const job = map[id];
  if (!job) return null;

  if (Date.now() - job.createdAt > TTL_MS) {
    delete map[id];
    writeAll(map);
    return null;
  }

  return job;
}

export function deletePrintJob(id: string): void {
  const map = readAll();
  if (map[id]) {
    delete map[id];
    writeAll(map);
  }
}

export function cleanupExpiredPrintJobs(): void {
  const map = readAll();
  let changed = false;

  for (const [id, job] of Object.entries(map)) {
    if (!job?.createdAt || Date.now() - job.createdAt > TTL_MS) {
      delete map[id];
      changed = true;
    }
  }

  if (changed) writeAll(map);
}
