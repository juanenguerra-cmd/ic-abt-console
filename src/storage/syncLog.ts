/**
 * Lightweight IDB-backed sync run log and conflict log.
 *
 * Each reconciliation cycle appends a {@link SyncRun} record.  When a
 * conflict is detected (both local and remote modified since last sync)
 * a {@link SyncConflict} record is also written.
 *
 * Both logs are stored as ring-buffers with a fixed maximum size so they
 * never grow without bound.
 */

import { idbGet, idbSet } from './idb';

// ---------------------------------------------------------------------------
// IDB keys
// ---------------------------------------------------------------------------

export const SYNC_RUNS_IDB_KEY = 'sync_runs_v1';
export const SYNC_CONFLICTS_IDB_KEY = 'sync_conflicts_v1';
export const SYNC_LAST_SUCCESS_IDB_KEY = 'sync_last_success_v1';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_SYNC_RUNS = 50;
const MAX_CONFLICTS = 100;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The outcome of a single reconciliation cycle. */
export type SyncAction = 'pull' | 'push' | 'noop' | 'error' | 'offline';

/** A single reconciliation run entry stored in the log. */
export interface SyncRun {
  /** Unique identifier for this run. */
  id: string;
  /** ISO timestamp when the run started. */
  startedAt: string;
  /** ISO timestamp when the run finished (absent while in-progress). */
  completedAt?: string;
  /** What action was taken as a result of the comparison. */
  action: SyncAction;
  /** Number of records pushed to remote (whole-DB push counts as 1). */
  pushedCount: number;
  /** Number of records pulled from remote (whole-DB pull counts as 1). */
  pulledCount: number;
  /** Number of conflicts detected during this run. */
  conflictCount: number;
  /** What initiated this run (e.g. 'timer', 'focus', 'manual', 'startup'). */
  triggeredBy: string;
  /** Human-readable error message when action is 'error'. */
  error?: string;
}

/**
 * A conflict record: both local and remote had changes since the last
 * successful sync.  The default resolution strategy is last-write-wins
 * (remote wins when remote.updatedAt > local.updatedAt).
 */
export interface SyncConflict {
  /** Unique identifier. */
  id: string;
  /** ISO timestamp when the conflict was detected. */
  detectedAt: string;
  /**
   * Entity type that conflicted.  'database' indicates the packed whole-DB
   * comparison; per-entity values (e.g. 'residents') require slice-level
   * tracking which is not yet implemented.
   */
  entityType: string;
  /** Entity identifier within its type. */
  entityId: string;
  /** local.updatedAt at conflict time. */
  localUpdatedAt: string;
  /** remote.updatedAt at conflict time. */
  remoteUpdatedAt: string;
  /** Strategy applied to resolve the conflict. */
  resolution: 'remote-wins' | 'local-wins';
  /** ISO timestamp when the conflict was resolved. */
  resolvedAt: string;
}

// ---------------------------------------------------------------------------
// Sync run log
// ---------------------------------------------------------------------------

/**
 * Append a {@link SyncRun} to the persistent ring-buffer.
 * Older entries are evicted once the buffer exceeds {@link MAX_SYNC_RUNS}.
 */
export async function appendSyncRun(run: SyncRun): Promise<void> {
  const runs: SyncRun[] = (await idbGet<SyncRun[]>(SYNC_RUNS_IDB_KEY)) ?? [];
  runs.push(run);
  if (runs.length > MAX_SYNC_RUNS) {
    runs.splice(0, runs.length - MAX_SYNC_RUNS);
  }
  await idbSet(SYNC_RUNS_IDB_KEY, runs);
}

/**
 * Return the most recent sync runs, newest first.
 *
 * @param n  Maximum number of entries to return (default: 10).
 */
export async function getRecentSyncRuns(n = 10): Promise<SyncRun[]> {
  const runs: SyncRun[] = (await idbGet<SyncRun[]>(SYNC_RUNS_IDB_KEY)) ?? [];
  return runs.slice(-n).reverse();
}

// ---------------------------------------------------------------------------
// Conflict log
// ---------------------------------------------------------------------------

/**
 * Append a {@link SyncConflict} to the persistent ring-buffer.
 * Older entries are evicted once the buffer exceeds {@link MAX_CONFLICTS}.
 */
export async function appendConflict(conflict: SyncConflict): Promise<void> {
  const conflicts: SyncConflict[] = (await idbGet<SyncConflict[]>(SYNC_CONFLICTS_IDB_KEY)) ?? [];
  conflicts.push(conflict);
  if (conflicts.length > MAX_CONFLICTS) {
    conflicts.splice(0, conflicts.length - MAX_CONFLICTS);
  }
  await idbSet(SYNC_CONFLICTS_IDB_KEY, conflicts);
}

/**
 * Return the most recent conflict records, newest first.
 *
 * @param n  Maximum number of entries to return (default: 20).
 */
export async function getRecentConflicts(n = 20): Promise<SyncConflict[]> {
  const conflicts: SyncConflict[] = (await idbGet<SyncConflict[]>(SYNC_CONFLICTS_IDB_KEY)) ?? [];
  return conflicts.slice(-n).reverse();
}

// ---------------------------------------------------------------------------
// Last successful sync timestamp
// ---------------------------------------------------------------------------

/**
 * Return the ISO timestamp of the last successfully completed sync, or
 * `null` if no sync has ever succeeded in this browser.
 */
export async function getLastSuccessfulSyncAt(): Promise<string | null> {
  const entry = await idbGet<{ syncedAt: string }>(SYNC_LAST_SUCCESS_IDB_KEY);
  return entry?.syncedAt ?? null;
}

/**
 * Persist the ISO timestamp of the most recent successful sync.
 * Called by the sync orchestrator after a pull or push completes.
 */
export async function setLastSuccessfulSyncAt(syncedAt: string): Promise<void> {
  await idbSet(SYNC_LAST_SUCCESS_IDB_KEY, { syncedAt });
}
