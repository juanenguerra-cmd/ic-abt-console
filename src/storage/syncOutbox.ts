/**
 * Persistent sync outbox stored in IndexedDB.
 *
 * Every failed remote write is recorded here. On each retry trigger
 * (startup, online, focus, auth-restored) the outbox is drained:
 * successful items are removed, failed items are kept with updated
 * metadata for the next retry.
 *
 * The outbox state uses a simple structure rather than a list of
 * arbitrary entries, because the data being retried lives in IDB
 * already — we only need to remember *what kind* of sync is pending.
 */

import { idbGet, idbSet } from './idb';

export const OUTBOX_IDB_KEY = 'sync_outbox_v1';

/** Describes what remote writes are pending. */
export interface SyncOutboxState {
  /** Whether the full packed DB needs to be pushed to remote. */
  hasPendingPackedSync: boolean;
  /** Slice names whose last remote write failed and need to be retried. */
  pendingSlices: string[];
  /** ISO timestamp of the most recent failure. */
  lastFailureAt?: string;
  /** Human-readable error from the most recent failure. */
  lastError?: string;
}

const EMPTY_STATE: SyncOutboxState = {
  hasPendingPackedSync: false,
  pendingSlices: [],
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Returns the current outbox state, defaulting to empty if not set. */
export async function getOutboxState(): Promise<SyncOutboxState> {
  return (await idbGet<SyncOutboxState>(OUTBOX_IDB_KEY)) ?? { ...EMPTY_STATE };
}

/** Returns true when any remote write is pending. */
export async function hasOutboxItems(): Promise<boolean> {
  const state = await getOutboxState();
  return state.hasPendingPackedSync || state.pendingSlices.length > 0;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** Mark the full packed DB sync as pending (remote write failed). */
export async function markPackedSyncPending(error?: unknown): Promise<void> {
  const current = await getOutboxState();
  current.hasPendingPackedSync = true;
  _applyError(current, error);
  await idbSet(OUTBOX_IDB_KEY, current);
  _notifyChange(false);
}

/** Mark one or more slice names as pending (their remote writes failed). */
export async function markSlicesPending(slices: string[], error?: unknown): Promise<void> {
  const current = await getOutboxState();
  const existing = new Set(current.pendingSlices);
  for (const s of slices) existing.add(s);
  current.pendingSlices = [...existing];
  _applyError(current, error);
  await idbSet(OUTBOX_IDB_KEY, current);
  _notifyChange(false);
}

/** Remove the packed-sync pending flag (succeeded). */
export async function clearPackedSyncPending(): Promise<void> {
  const current = await getOutboxState();
  current.hasPendingPackedSync = false;
  await idbSet(OUTBOX_IDB_KEY, current);
  _notifyChange(current.pendingSlices.length === 0);
}

/** Remove the given slice names from the pending list (succeeded). */
export async function clearSlicesPending(slices: string[]): Promise<void> {
  const current = await getOutboxState();
  const toRemove = new Set(slices);
  current.pendingSlices = current.pendingSlices.filter((s) => !toRemove.has(s));
  await idbSet(OUTBOX_IDB_KEY, current);
  _notifyChange(!current.hasPendingPackedSync && current.pendingSlices.length === 0);
}

/** Clear the entire outbox (e.g. after a successful full sync). */
export async function clearOutbox(): Promise<void> {
  await idbSet(OUTBOX_IDB_KEY, { ...EMPTY_STATE });
  _notifyChange(true);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _applyError(state: SyncOutboxState, error?: unknown): void {
  if (error !== undefined) {
    state.lastFailureAt = new Date().toISOString();
    state.lastError = error instanceof Error ? error.message : String(error);
  }
}

/**
 * Dispatch a DOM event so the SyncStatusIndicator (and any other listener)
 * can react to outbox changes without polling.
 *
 * @param isEmpty  true when the outbox just became empty.
 */
function _notifyChange(isEmpty: boolean): void {
  try {
    window.dispatchEvent(
      new CustomEvent('sync-outbox-changed', { detail: { isEmpty } })
    );
  } catch {
    // Ignore — may not be available in test environments.
  }
}
