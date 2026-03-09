/**
 * Tests for the SyncOutbox module.
 *
 * Covered scenarios:
 *  1. Initial state returns empty outbox
 *  2. markPackedSyncPending sets hasPendingPackedSync and error metadata
 *  3. markSlicesPending accumulates slice names (no duplicates)
 *  4. clearPackedSyncPending removes packed flag without touching slices
 *  5. clearSlicesPending removes only the specified slices
 *  6. clearOutbox resets everything
 *  7. hasOutboxItems returns correct boolean
 *  8. DOM events are dispatched on state changes
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the IDB adapter so tests run without a real IndexedDB
// ---------------------------------------------------------------------------

const idbStore: Record<string, unknown> = {};

vi.mock('./idb', () => ({
  idbGet: vi.fn(async (key: string) => idbStore[key] ?? null),
  idbSet: vi.fn(async (key: string, value: unknown) => { idbStore[key] = value; }),
}));

// Stub window.dispatchEvent for event assertions
const mockDispatchEvent = vi.fn();
if (typeof (global as any).window === 'undefined') {
  (global as any).window = {};
}
(global as any).window.dispatchEvent = mockDispatchEvent;

(global as any).CustomEvent = class CustomEvent {
  type: string;
  detail: unknown;
  constructor(type: string, init?: { detail?: unknown }) {
    this.type = type;
    this.detail = init?.detail;
  }
};

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  getOutboxState,
  hasOutboxItems,
  markPackedSyncPending,
  markSlicesPending,
  clearPackedSyncPending,
  clearSlicesPending,
  clearOutbox,
  OUTBOX_IDB_KEY,
} from './syncOutbox';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetStore() {
  delete idbStore[OUTBOX_IDB_KEY];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetStore();
  mockDispatchEvent.mockClear();
});

describe('getOutboxState', () => {
  test('returns empty state when nothing is stored', async () => {
    const state = await getOutboxState();
    expect(state.hasPendingPackedSync).toBe(false);
    expect(state.pendingSlices).toEqual([]);
    expect(state.lastFailureAt).toBeUndefined();
    expect(state.lastError).toBeUndefined();
  });
});

describe('hasOutboxItems', () => {
  test('returns false when outbox is empty', async () => {
    expect(await hasOutboxItems()).toBe(false);
  });

  test('returns true when hasPendingPackedSync is set', async () => {
    await markPackedSyncPending();
    expect(await hasOutboxItems()).toBe(true);
  });

  test('returns true when pendingSlices has entries', async () => {
    await markSlicesPending(['residents']);
    expect(await hasOutboxItems()).toBe(true);
  });
});

describe('markPackedSyncPending', () => {
  test('sets hasPendingPackedSync to true', async () => {
    await markPackedSyncPending();
    const state = await getOutboxState();
    expect(state.hasPendingPackedSync).toBe(true);
  });

  test('records error metadata when an error is provided', async () => {
    await markPackedSyncPending(new Error('Network failure'));
    const state = await getOutboxState();
    expect(state.lastError).toBe('Network failure');
    expect(state.lastFailureAt).toBeDefined();
  });

  test('records string error when provided', async () => {
    await markPackedSyncPending('timed out');
    const state = await getOutboxState();
    expect(state.lastError).toBe('timed out');
  });

  test('dispatches sync-outbox-changed event', async () => {
    await markPackedSyncPending();
    const dispatched = mockDispatchEvent.mock.calls.find(
      ([e]) => e.type === 'sync-outbox-changed'
    );
    expect(dispatched).toBeDefined();
    expect(dispatched![0].detail.isEmpty).toBe(false);
  });
});

describe('markSlicesPending', () => {
  test('accumulates slice names', async () => {
    await markSlicesPending(['residents']);
    await markSlicesPending(['abts']);
    const state = await getOutboxState();
    expect(state.pendingSlices).toContain('residents');
    expect(state.pendingSlices).toContain('abts');
  });

  test('does not duplicate slice names', async () => {
    await markSlicesPending(['residents']);
    await markSlicesPending(['residents']);
    const state = await getOutboxState();
    expect(state.pendingSlices.filter((s) => s === 'residents')).toHaveLength(1);
  });

  test('can add multiple slices at once', async () => {
    await markSlicesPending(['residents', 'abts', 'infections']);
    const state = await getOutboxState();
    expect(state.pendingSlices).toHaveLength(3);
  });
});

describe('clearPackedSyncPending', () => {
  test('sets hasPendingPackedSync to false without touching slices', async () => {
    await markPackedSyncPending();
    await markSlicesPending(['residents']);
    await clearPackedSyncPending();

    const state = await getOutboxState();
    expect(state.hasPendingPackedSync).toBe(false);
    expect(state.pendingSlices).toContain('residents');
  });

  test('dispatches sync-outbox-changed with isEmpty=true when no slices remain', async () => {
    await markPackedSyncPending();
    mockDispatchEvent.mockClear();
    await clearPackedSyncPending();

    const dispatched = mockDispatchEvent.mock.calls.find(
      ([e]) => e.type === 'sync-outbox-changed'
    );
    expect(dispatched).toBeDefined();
    expect(dispatched![0].detail.isEmpty).toBe(true);
  });

  test('dispatches sync-outbox-changed with isEmpty=false when slices remain', async () => {
    await markPackedSyncPending();
    await markSlicesPending(['residents']);
    mockDispatchEvent.mockClear();
    await clearPackedSyncPending();

    const dispatched = mockDispatchEvent.mock.calls.find(
      ([e]) => e.type === 'sync-outbox-changed'
    );
    expect(dispatched![0].detail.isEmpty).toBe(false);
  });
});

describe('clearSlicesPending', () => {
  test('removes the specified slices from the pending list', async () => {
    await markSlicesPending(['residents', 'abts', 'infections']);
    await clearSlicesPending(['residents', 'infections']);

    const state = await getOutboxState();
    expect(state.pendingSlices).not.toContain('residents');
    expect(state.pendingSlices).not.toContain('infections');
    expect(state.pendingSlices).toContain('abts');
  });

  test('is a no-op for slices that are not in the list', async () => {
    await markSlicesPending(['residents']);
    await clearSlicesPending(['abts']);

    const state = await getOutboxState();
    expect(state.pendingSlices).toContain('residents');
  });
});

describe('clearOutbox', () => {
  test('resets the full outbox state', async () => {
    await markPackedSyncPending(new Error('err'));
    await markSlicesPending(['residents', 'abts']);
    await clearOutbox();

    const state = await getOutboxState();
    expect(state.hasPendingPackedSync).toBe(false);
    expect(state.pendingSlices).toHaveLength(0);
  });

  test('dispatches sync-outbox-changed with isEmpty=true', async () => {
    await markPackedSyncPending();
    mockDispatchEvent.mockClear();
    await clearOutbox();

    const dispatched = mockDispatchEvent.mock.calls.find(
      ([e]) => e.type === 'sync-outbox-changed'
    );
    expect(dispatched).toBeDefined();
    expect(dispatched![0].detail.isEmpty).toBe(true);
  });
});
