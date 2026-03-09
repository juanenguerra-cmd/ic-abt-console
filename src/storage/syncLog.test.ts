/**
 * Tests for the syncLog module.
 *
 * Covered scenarios:
 *  1. appendSyncRun / getRecentSyncRuns basic round-trip
 *  2. Ring-buffer: oldest runs are evicted when MAX is exceeded
 *  3. getRecentSyncRuns returns newest-first and respects the limit
 *  4. appendConflict / getRecentConflicts basic round-trip
 *  5. Ring-buffer eviction for conflict log
 *  6. getLastSuccessfulSyncAt returns null when nothing stored
 *  7. setLastSuccessfulSyncAt / getLastSuccessfulSyncAt round-trip
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the IDB adapter so tests run without a real IndexedDB
// ---------------------------------------------------------------------------

const idbStore: Record<string, unknown> = {};

vi.mock('./idb', () => ({
  idbGet: vi.fn(async (key: string) => idbStore[key] ?? null),
  idbSet: vi.fn(async (key: string, value: unknown) => {
    idbStore[key] = value;
  }),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  appendSyncRun,
  getRecentSyncRuns,
  appendConflict,
  getRecentConflicts,
  getLastSuccessfulSyncAt,
  setLastSuccessfulSyncAt,
  SYNC_RUNS_IDB_KEY,
  SYNC_CONFLICTS_IDB_KEY,
  SYNC_LAST_SUCCESS_IDB_KEY,
  SyncRun,
  SyncConflict,
} from './syncLog';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSyncRun(overrides: Partial<SyncRun> = {}): SyncRun {
  return {
    id: `run-${Date.now()}-${Math.random()}`,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    action: 'noop',
    pushedCount: 0,
    pulledCount: 0,
    conflictCount: 0,
    triggeredBy: 'test',
    ...overrides,
  };
}

function makeConflict(overrides: Partial<SyncConflict> = {}): SyncConflict {
  return {
    id: `conflict-${Date.now()}-${Math.random()}`,
    detectedAt: new Date().toISOString(),
    entityType: 'database',
    entityId: 'main',
    localUpdatedAt: new Date().toISOString(),
    remoteUpdatedAt: new Date().toISOString(),
    resolution: 'remote-wins',
    resolvedAt: new Date().toISOString(),
    ...overrides,
  };
}

function resetStore() {
  delete idbStore[SYNC_RUNS_IDB_KEY];
  delete idbStore[SYNC_CONFLICTS_IDB_KEY];
  delete idbStore[SYNC_LAST_SUCCESS_IDB_KEY];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetStore();
});

describe('appendSyncRun / getRecentSyncRuns', () => {
  test('returns empty array when no runs are stored', async () => {
    const runs = await getRecentSyncRuns();
    expect(runs).toEqual([]);
  });

  test('appends a run and retrieves it', async () => {
    const run = makeSyncRun({ action: 'push', pushedCount: 1, triggeredBy: 'manual' });
    await appendSyncRun(run);
    const runs = await getRecentSyncRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0].id).toBe(run.id);
    expect(runs[0].action).toBe('push');
  });

  test('returns results newest-first', async () => {
    const r1 = makeSyncRun({ id: 'first' });
    const r2 = makeSyncRun({ id: 'second' });
    await appendSyncRun(r1);
    await appendSyncRun(r2);
    const runs = await getRecentSyncRuns();
    expect(runs[0].id).toBe('second');
    expect(runs[1].id).toBe('first');
  });

  test('respects the n limit', async () => {
    for (let i = 0; i < 5; i++) {
      await appendSyncRun(makeSyncRun({ id: `run-${i}` }));
    }
    const runs = await getRecentSyncRuns(3);
    expect(runs).toHaveLength(3);
  });

  test('evicts oldest entries when ring-buffer is full (MAX = 50)', async () => {
    // Add 51 entries — the first one should be evicted.
    const firstId = 'run-0';
    await appendSyncRun(makeSyncRun({ id: firstId }));
    for (let i = 1; i <= 50; i++) {
      await appendSyncRun(makeSyncRun({ id: `run-${i}` }));
    }
    const runs = await getRecentSyncRuns(50);
    const ids = runs.map((r) => r.id);
    expect(ids).not.toContain(firstId);
    expect(runs).toHaveLength(50);
  });
});

describe('appendConflict / getRecentConflicts', () => {
  test('returns empty array when no conflicts are stored', async () => {
    const conflicts = await getRecentConflicts();
    expect(conflicts).toEqual([]);
  });

  test('appends a conflict and retrieves it', async () => {
    const conflict = makeConflict({ entityType: 'residents', resolution: 'remote-wins' });
    await appendConflict(conflict);
    const conflicts = await getRecentConflicts();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].id).toBe(conflict.id);
    expect(conflicts[0].entityType).toBe('residents');
  });

  test('returns results newest-first', async () => {
    const c1 = makeConflict({ id: 'c-first' });
    const c2 = makeConflict({ id: 'c-second' });
    await appendConflict(c1);
    await appendConflict(c2);
    const conflicts = await getRecentConflicts();
    expect(conflicts[0].id).toBe('c-second');
    expect(conflicts[1].id).toBe('c-first');
  });

  test('evicts oldest entries when ring-buffer is full (MAX = 100)', async () => {
    const firstId = 'c-0';
    await appendConflict(makeConflict({ id: firstId }));
    for (let i = 1; i <= 100; i++) {
      await appendConflict(makeConflict({ id: `c-${i}` }));
    }
    const conflicts = await getRecentConflicts(100);
    const ids = conflicts.map((c) => c.id);
    expect(ids).not.toContain(firstId);
    expect(conflicts).toHaveLength(100);
  });
});

describe('getLastSuccessfulSyncAt / setLastSuccessfulSyncAt', () => {
  test('returns null when nothing is stored', async () => {
    expect(await getLastSuccessfulSyncAt()).toBeNull();
  });

  test('persists and retrieves the sync timestamp', async () => {
    const ts = new Date().toISOString();
    await setLastSuccessfulSyncAt(ts);
    expect(await getLastSuccessfulSyncAt()).toBe(ts);
  });

  test('overwrites a previous value', async () => {
    await setLastSuccessfulSyncAt('2024-01-01T00:00:00.000Z');
    const ts2 = '2024-06-15T12:00:00.000Z';
    await setLastSuccessfulSyncAt(ts2);
    expect(await getLastSuccessfulSyncAt()).toBe(ts2);
  });
});
