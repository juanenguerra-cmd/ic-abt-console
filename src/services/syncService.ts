/**
 * Sync service — orchestrates background reconciliation.
 *
 * Responsibilities:
 *  - Run periodic reconciliation on a configurable interval.
 *  - Expose a {@link SyncStatus} object that the UI can read.
 *  - Provide {@link triggerManualSync} for an explicit "Sync Now" action.
 *  - Implement exponential back-off for retries when the remote is unavailable.
 *  - Emit lightweight DOM events so components can react without polling.
 *
 * Usage (typically wired up inside AppProviders):
 *
 *   const svc = createSyncService();
 *   svc.start(() => currentDb, 'app-context');
 *   // Later:
 *   svc.stop();
 *
 * Components that want the current status should subscribe to the
 * `sync-status-changed` window event or use the {@link useSyncStatus} hook.
 */

import { UnifiedDB } from "../domain/models";
import { reconcileWithRemoteAsync, ReconcileResult } from "../storage/engine";
import { hasOutboxItems } from "../storage/syncOutbox";
import { getRecentConflicts, getLastSuccessfulSyncAt } from "../storage/syncLog";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default reconciliation interval (5 minutes). */
export const DEFAULT_SYNC_INTERVAL_MS = 5 * 60 * 1000;

/** Maximum number of consecutive failures before back-off stops increasing. */
const MAX_BACKOFF_STEPS = 5;
/** Base delay (ms) for exponential back-off on failure. */
const BACKOFF_BASE_MS = 30_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Snapshot of the current sync state exposed to the UI. */
export interface SyncStatus {
  /** Whether a sync cycle is currently running. */
  isSyncing: boolean;
  /** ISO timestamp of the last successfully completed sync, or null. */
  lastSyncedAt: string | null;
  /** The outcome of the last completed sync cycle. */
  lastSyncAction: 'pull' | 'push' | 'noop' | 'error' | 'offline' | null;
  /** Error message from the last failed sync cycle, or null. */
  lastError: string | null;
  /** Whether there are writes pending in the outbox. */
  hasPendingWrites: boolean;
  /** Number of conflicts detected in recent history. */
  recentConflictCount: number;
}

/** Function that returns the current in-memory DB (avoids stale closures). */
export type DbGetter = () => UnifiedDB | null;

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

const _status: SyncStatus = {
  isSyncing: false,
  lastSyncedAt: null,
  lastSyncAction: null,
  lastError: null,
  hasPendingWrites: false,
  recentConflictCount: 0,
};

let _timer: ReturnType<typeof setTimeout> | null = null;
let _consecutiveFailures = 0;
let _currentIntervalMs = DEFAULT_SYNC_INTERVAL_MS;

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

/** Return a shallow copy of the current status. */
export function getSyncStatus(): SyncStatus {
  return { ..._status };
}

function _patchStatus(patch: Partial<SyncStatus>): void {
  Object.assign(_status, patch);
  _dispatchStatusChanged();
}

function _dispatchStatusChanged(): void {
  try {
    window.dispatchEvent(
      new CustomEvent('sync-status-changed', { detail: { ..._status } }),
    );
  } catch {
    /* test environments may not have window */
  }
}

// ---------------------------------------------------------------------------
// Back-off helpers
// ---------------------------------------------------------------------------

/**
 * Compute the next retry delay using capped exponential back-off.
 * step 0 → base, step 1 → 2×base, …, step MAX → (2^MAX)×base
 */
function _backoffDelayMs(step: number): number {
  const capped = Math.min(step, MAX_BACKOFF_STEPS);
  return BACKOFF_BASE_MS * Math.pow(2, capped);
}

// ---------------------------------------------------------------------------
// Core sync cycle
// ---------------------------------------------------------------------------

/**
 * Run a single reconciliation cycle.
 *
 * Handles back-off scheduling on failure so the timer always reschedules
 * itself even when the remote is unreachable.
 */
async function _runCycle(
  getDb: DbGetter,
  triggeredBy: string,
  onComplete?: (result: ReconcileResult) => void,
): Promise<void> {
  const db = getDb();
  if (!db) return;

  _patchStatus({ isSyncing: true, lastError: null });

  try {
    const result = await reconcileWithRemoteAsync(db, triggeredBy);

    _consecutiveFailures = 0;

    const [lastSyncedAt, recentConflicts] = await Promise.all([
      getLastSuccessfulSyncAt().catch(() => null),
      getRecentConflicts(20).catch(() => []),
    ]);

    const hasPendingWrites = await hasOutboxItems().catch(() => false);

    _patchStatus({
      isSyncing: false,
      lastSyncAction: result.action,
      lastSyncedAt,
      hasPendingWrites,
      recentConflictCount: recentConflicts.length,
      lastError: result.action === 'error' ? 'Remote sync failed. Changes queued for retry.' : null,
    });

    onComplete?.(result);
  } catch (e) {
    _consecutiveFailures += 1;
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error('[SyncService] Reconciliation cycle failed:', errMsg);

    _patchStatus({
      isSyncing: false,
      lastSyncAction: 'error',
      lastError: errMsg,
    });
  }
}

// ---------------------------------------------------------------------------
// Timer management
// ---------------------------------------------------------------------------

function _clearTimer(): void {
  if (_timer !== null) {
    clearTimeout(_timer);
    _timer = null;
  }
}

function _scheduleNext(getDb: DbGetter, intervalMs: number): void {
  _clearTimer();
  // Use back-off when there have been consecutive failures.
  const delay =
    _consecutiveFailures > 0
      ? _backoffDelayMs(_consecutiveFailures)
      : intervalMs;
  _timer = setTimeout(async () => {
    await _runCycle(getDb, 'timer');
    _scheduleNext(getDb, intervalMs);
  }, delay);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Start the periodic background sync timer. */
export function startSyncTimer(
  getDb: DbGetter,
  intervalMs = DEFAULT_SYNC_INTERVAL_MS,
): void {
  _clearTimer();
  _currentIntervalMs = intervalMs;
  _scheduleNext(getDb, intervalMs);
  console.log(`[SyncService] Periodic sync started (interval: ${intervalMs / 1000}s).`);
}

/** Stop the periodic background sync timer. */
export function stopSyncTimer(): void {
  _clearTimer();
  console.log('[SyncService] Periodic sync stopped.');
}

/**
 * Trigger an immediate reconciliation cycle (e.g. from a "Sync Now" button).
 *
 * Resets the timer so the next automatic cycle runs at a full interval after
 * the manual sync completes.
 *
 * @param getDb        Returns the current in-memory DB.
 * @param onComplete   Optional callback fired after the cycle finishes.
 */
export async function triggerManualSync(
  getDb: DbGetter,
  onComplete?: (result: ReconcileResult) => void,
): Promise<void> {
  _clearTimer();
  await _runCycle(getDb, 'manual', onComplete);
  if (_currentIntervalMs > 0) {
    _scheduleNext(getDb, _currentIntervalMs);
  }
}

/**
 * Refresh the status object from IDB (e.g. on initial mount) so the UI
 * reflects the persisted last-synced timestamp before the first sync cycle.
 */
export async function refreshSyncStatusFromStorage(): Promise<void> {
  const [lastSyncedAt, recentConflicts, hasPendingWrites] = await Promise.all([
    getLastSuccessfulSyncAt().catch(() => null),
    getRecentConflicts(20).catch(() => []),
    hasOutboxItems().catch(() => false),
  ]);
  _patchStatus({
    lastSyncedAt,
    recentConflictCount: recentConflicts.length,
    hasPendingWrites,
  });
}
