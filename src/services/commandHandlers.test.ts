/**
 * Tests for commandHandlers — SaveSlicesResult integration, debounced packed
 * remote sync, partial failure reporting, no-auth fast path, and
 * applyMutation changed-slice detection.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Browser global stubs (commandHandlers uses window / BroadcastChannel)
// ---------------------------------------------------------------------------

const mockDispatchEvent = vi.fn();
const mockBroadcastChannelPostMessage = vi.fn();
const mockBroadcastChannelClose = vi.fn();

// Provide minimal browser globals that are referenced inside commandHandlers.ts
if (typeof (global as any).window === 'undefined') {
  (global as any).window = {};
}
(global as any).window.dispatchEvent = mockDispatchEvent;

(global as any).BroadcastChannel = vi.fn().mockImplementation(() => ({
  postMessage: mockBroadcastChannelPostMessage,
  close: mockBroadcastChannelClose,
}));

(global as any).Event = class Event {
  type: string;
  constructor(type: string) { this.type = type; }
};

(global as any).CustomEvent = class CustomEvent {
  type: string;
  detail: unknown;
  constructor(type: string, init?: { detail?: unknown }) {
    this.type = type;
    this.detail = init?.detail;
  }
};

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../storage/engine', () => ({
  saveDBAsync: vi.fn().mockResolvedValue(undefined),
  restoreFromPrevAsync: vi.fn().mockResolvedValue(true),
  validateCommitGate: vi.fn(),
}));

const mockSaveSlices = vi.fn();
const mockWriteSyncSignal = vi.fn().mockResolvedValue(undefined);
vi.mock('../storage/repository', () => ({
  StorageRepository: {
    saveSlices: (...args: any[]) => mockSaveSlices(...args),
    writeSyncSignal: (...args: any[]) => mockWriteSyncSignal(...args),
  },
  STORAGE_SLICES: [
    'residents', 'abts', 'infections', 'vaxEvents',
    'auditSessions', 'infectionControlAuditSessions', 'notifications', 'mutationLog',
  ],
}));

vi.mock('../services/firebase', () => ({
  getCurrentUser: vi.fn(),
  db: {},
}));

vi.mock('./api', () => ({
  remoteSaveDb: vi.fn().mockResolvedValue(undefined),
}));

const mockMarkSlicesPending = vi.fn().mockResolvedValue(undefined);
const mockMarkPackedSyncPending = vi.fn().mockResolvedValue(undefined);
const mockClearPackedSyncPending = vi.fn().mockResolvedValue(undefined);
vi.mock('../storage/syncOutbox', () => ({
  markSlicesPending: (...args: any[]) => mockMarkSlicesPending(...args),
  markPackedSyncPending: (...args: any[]) => mockMarkPackedSyncPending(...args),
  clearPackedSyncPending: () => mockClearPackedSyncPending(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { commandHandlers } from './commandHandlers';
import { saveDBAsync } from '../storage/engine';
import { getCurrentUser } from '../services/firebase';
import { remoteSaveDb } from './api';

const mockSaveDBAsync = vi.mocked(saveDBAsync);
const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockRemoteSaveDb = vi.mocked(remoteSaveDb);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_USER = { uid: 'user-123' } as any;
const FACILITY_A = 'facility-A';

function makeSuccessResult(slices: string[]) {
  return {
    allSucceeded: true,
    succeededSlices: slices,
    failedSlices: [],
    results: slices.map(s => ({ slice: s, success: true })),
  };
}

function makeFailureResult(succeeded: string[], failed: string[]) {
  return {
    allSucceeded: false,
    succeededSlices: succeeded,
    failedSlices: failed,
    results: [
      ...succeeded.map(s => ({ slice: s, success: true })),
      ...failed.map(s => ({ slice: s, success: false, error: new Error('Write failed') })),
    ],
  };
}

/** Minimal UnifiedDB with one facility store. */
function makeDB(facilityId: string, storeData: Record<string, any> = {}) {
  return {
    schemaName: 'UNIFIED_DB',
    schemaVersion: 'UNIFIED_DB_V3',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    integrity: {},
    data: {
      facilities: { byId: { [facilityId]: { id: facilityId } }, activeFacilityId: facilityId },
      facilityData: {
        [facilityId]: {
          residents: {},
          abts: {},
          infections: {},
          vaxEvents: {},
          auditSessions: {},
          infectionControlAuditSessions: {},
          notifications: {},
          mutationLog: undefined,
          ...storeData,
        },
      },
    },
  } as any;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  mockGetCurrentUser.mockResolvedValue(MOCK_USER);
  mockSaveSlices.mockResolvedValue(makeSuccessResult(['residents']));
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// applyMutation
// ---------------------------------------------------------------------------

describe('commandHandlers.applyMutation', () => {
  test('returns unchanged nextDb when updater is a no-op', () => {
    const db = makeDB(FACILITY_A);
    const { nextDb } = commandHandlers.applyMutation(db, FACILITY_A, () => {});
    expect(JSON.stringify(nextDb)).toBe(JSON.stringify(db));
  });

  test('detects which slices changed after the updater runs', () => {
    const db = makeDB(FACILITY_A);
    const { changedSlices } = commandHandlers.applyMutation(db, FACILITY_A, draft => {
      draft.data.facilityData[FACILITY_A].residents = { r1: { id: 'r1' } as any };
    });

    expect(changedSlices).toContain('residents');
    expect(changedSlices).not.toContain('abts');
  });

  test('sets mainChanged when non-slice data changes', () => {
    const db = makeDB(FACILITY_A);
    const { mainChanged } = commandHandlers.applyMutation(db, FACILITY_A, draft => {
      draft.data.facilities.activeFacilityId = 'new-facility';
    });

    expect(mainChanged).toBe(true);
  });

  test('mainChanged is false when only slice data changes', () => {
    const db = makeDB(FACILITY_A);
    const { mainChanged } = commandHandlers.applyMutation(db, FACILITY_A, draft => {
      draft.data.facilityData[FACILITY_A].residents = { r1: { id: 'r1' } as any };
    });

    expect(mainChanged).toBe(false);
  });

  test('appends a mutation log entry when meta is provided', () => {
    const db = makeDB(FACILITY_A);
    const { nextDb } = commandHandlers.applyMutation(
      db, FACILITY_A, () => {},
      { action: 'create', entityType: 'Resident', entityId: 'r1', who: 'nurse-1' },
    );

    const log = nextDb.data.facilityData[FACILITY_A].mutationLog;
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ action: 'create', entityType: 'Resident', entityId: 'r1' });
  });

  test('does not append a mutation log entry when meta is absent', () => {
    const db = makeDB(FACILITY_A);
    const { nextDb } = commandHandlers.applyMutation(db, FACILITY_A, () => {});

    expect(nextDb.data.facilityData[FACILITY_A].mutationLog ?? []).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// saveDatabase — no-auth fast path
// ---------------------------------------------------------------------------

describe('commandHandlers.saveDatabase – no-auth', () => {
  beforeEach(() => {
    mockGetCurrentUser.mockResolvedValue(null);
  });

  test('saves locally with skipRemote when user is not authenticated', async () => {
    const db = makeDB(FACILITY_A);

    await commandHandlers.saveDatabase(db, FACILITY_A, [], true);

    expect(mockSaveDBAsync).toHaveBeenCalledWith(db, { skipRemote: true });
  });

  test('does not call StorageRepository.saveSlices when user is not authenticated', async () => {
    const db = makeDB(FACILITY_A);

    await commandHandlers.saveDatabase(db, FACILITY_A, ['residents'], false);

    expect(mockSaveSlices).not.toHaveBeenCalled();
  });

  test('does not schedule debounced remote sync when user is not authenticated', async () => {
    const db = makeDB(FACILITY_A);

    await commandHandlers.saveDatabase(db, FACILITY_A, ['residents'], false);
    await vi.runAllTimersAsync();

    expect(mockRemoteSaveDb).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// saveDatabase — full save path (mainChanged = true)
// ---------------------------------------------------------------------------

describe('commandHandlers.saveDatabase – full save (mainChanged)', () => {
  test('calls saveDBAsync without skipRemote on main change', async () => {
    const db = makeDB(FACILITY_A);
    mockSaveSlices.mockResolvedValue(makeSuccessResult([]));

    await commandHandlers.saveDatabase(db, FACILITY_A, [], true);

    expect(mockSaveDBAsync).toHaveBeenCalledWith(db);
    expect(mockSaveDBAsync).not.toHaveBeenCalledWith(db, expect.objectContaining({ skipRemote: true }));
  });

  test('calls saveSlices for ALL STORAGE_SLICES on main change', async () => {
    const db = makeDB(FACILITY_A);
    mockSaveSlices.mockResolvedValue(makeSuccessResult([]));

    await commandHandlers.saveDatabase(db, FACILITY_A, [], true);

    expect(mockSaveSlices).toHaveBeenCalledWith(
      FACILITY_A,
      db.data.facilityData[FACILITY_A],
      expect.arrayContaining(['residents', 'abts', 'infections']),
    );
  });

  test('dispatches backup-failed when any slice fails on the main-change path', async () => {
    const db = makeDB(FACILITY_A);
    mockSaveSlices.mockResolvedValue(makeFailureResult(['residents'], ['abts']));

    await commandHandlers.saveDatabase(db, FACILITY_A, [], true);

    const dispatchedTypes = mockDispatchEvent.mock.calls.map(([e]) => e.type);
    expect(dispatchedTypes).toContain('backup-failed');
  });
});

// ---------------------------------------------------------------------------
// saveDatabase — slice-only path (mainChanged = false, changedSlices non-empty)
// ---------------------------------------------------------------------------

describe('commandHandlers.saveDatabase – slice-only path', () => {
  test('saves locally first (skipRemote) before attempting remote slice writes', async () => {
    const db = makeDB(FACILITY_A);
    mockSaveSlices.mockResolvedValue(makeSuccessResult(['residents']));

    await commandHandlers.saveDatabase(db, FACILITY_A, ['residents'], false);

    expect(mockSaveDBAsync).toHaveBeenCalledWith(db, { skipRemote: true });
  });

  test('calls saveSlices with only the changed slices (not all slices)', async () => {
    const db = makeDB(FACILITY_A);
    mockSaveSlices.mockResolvedValue(makeSuccessResult(['residents']));

    await commandHandlers.saveDatabase(db, FACILITY_A, ['residents'], false);

    const [, , slicesArg] = mockSaveSlices.mock.calls[0];
    expect(slicesArg).toEqual(['residents']);
  });

  test('schedules debounced remote sync after a successful slice-only save', async () => {
    const db = makeDB(FACILITY_A);
    mockSaveSlices.mockResolvedValue(makeSuccessResult(['residents']));

    await commandHandlers.saveDatabase(db, FACILITY_A, ['residents'], false);

    // Advance time past the 2-second debounce window
    await vi.runAllTimersAsync();

    expect(mockRemoteSaveDb).toHaveBeenCalledWith(db);
  });

  test('dispatches backup-failed on partial slice failure', async () => {
    const db = makeDB(FACILITY_A);
    mockSaveSlices.mockResolvedValue(makeFailureResult(['residents'], ['abts']));

    await commandHandlers.saveDatabase(db, FACILITY_A, ['residents', 'abts'], false);

    const dispatchedTypes = mockDispatchEvent.mock.calls.map(([e]) => e.type);
    expect(dispatchedTypes).toContain('backup-failed');
  });

  test('does NOT schedule packed remote sync after a partial slice failure', async () => {
    const db = makeDB(FACILITY_A);
    mockSaveSlices.mockResolvedValue(makeFailureResult(['residents'], ['abts']));

    await commandHandlers.saveDatabase(db, FACILITY_A, ['residents', 'abts'], false);
    await vi.runAllTimersAsync();

    // Packed remote sync should NOT fire to avoid masking per-slice failures
    expect(mockRemoteSaveDb).not.toHaveBeenCalled();
  });

  test('dispatches backup-failed on total slice failure', async () => {
    const db = makeDB(FACILITY_A);
    mockSaveSlices.mockResolvedValue(makeFailureResult([], ['residents', 'abts']));

    await commandHandlers.saveDatabase(db, FACILITY_A, ['residents', 'abts'], false);

    const dispatchedTypes = mockDispatchEvent.mock.calls.map(([e]) => e.type);
    expect(dispatchedTypes).toContain('backup-failed');
  });

  test('does NOT dispatch backup-failed when all slices succeed', async () => {
    const db = makeDB(FACILITY_A);
    mockSaveSlices.mockResolvedValue(makeSuccessResult(['residents', 'abts']));

    await commandHandlers.saveDatabase(db, FACILITY_A, ['residents', 'abts'], false);

    const dispatchedTypes = mockDispatchEvent.mock.calls.map(([e]) => e.type);
    expect(dispatchedTypes).not.toContain('backup-failed');
  });

  test('broadcasts DB_UPDATED message via BroadcastChannel', async () => {
    const db = makeDB(FACILITY_A);
    mockSaveSlices.mockResolvedValue(makeSuccessResult(['residents']));

    await commandHandlers.saveDatabase(db, FACILITY_A, ['residents'], false);

    expect(mockBroadcastChannelPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'DB_UPDATED' }),
    );
  });

  test('marks failed slices as pending in outbox on slice-only path failure', async () => {
    const db = makeDB(FACILITY_A);
    mockSaveSlices.mockResolvedValue(makeFailureResult(['abts'], ['residents']));

    await commandHandlers.saveDatabase(db, FACILITY_A, ['residents', 'abts'], false);

    expect(mockMarkSlicesPending).toHaveBeenCalledWith(['residents']);
  });

  test('marks failed slices as pending in outbox on main-change path failure', async () => {
    const db = makeDB(FACILITY_A);
    mockSaveSlices.mockResolvedValue(makeFailureResult([], ['abts']));

    await commandHandlers.saveDatabase(db, FACILITY_A, [], true);

    expect(mockMarkSlicesPending).toHaveBeenCalledWith(['abts']);
  });

  test('does NOT mark slices pending in outbox when all slices succeed', async () => {
    const db = makeDB(FACILITY_A);
    mockSaveSlices.mockResolvedValue(makeSuccessResult(['residents', 'abts']));

    await commandHandlers.saveDatabase(db, FACILITY_A, ['residents', 'abts'], false);

    expect(mockMarkSlicesPending).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Debounced remote sync behaviour
// ---------------------------------------------------------------------------

describe('debounced remote sync (scheduleRemoteSync)', () => {
  test('rapid successive saves coalesce into a single remote push', async () => {
    const db1 = makeDB(FACILITY_A, { residents: { r1: { id: 'r1' } as any } });
    const db2 = makeDB(FACILITY_A, { residents: { r1: { id: 'r1' } as any, r2: { id: 'r2' } as any } });
    mockSaveSlices.mockResolvedValue(makeSuccessResult(['residents']));

    // Fire two saves in rapid succession (before debounce window expires)
    await commandHandlers.saveDatabase(db1, FACILITY_A, ['residents'], false);
    await commandHandlers.saveDatabase(db2, FACILITY_A, ['residents'], false);

    // Advance time to flush the debounce timer
    await vi.runAllTimersAsync();

    // Only one remote push should have occurred
    expect(mockRemoteSaveDb).toHaveBeenCalledTimes(1);
  });

  test('debounced push carries the latest DB snapshot', async () => {
    const db1 = makeDB(FACILITY_A);
    const db2 = makeDB(FACILITY_A, { residents: { r2: { id: 'r2' } as any } });
    mockSaveSlices.mockResolvedValue(makeSuccessResult(['residents']));

    await commandHandlers.saveDatabase(db1, FACILITY_A, ['residents'], false);
    await commandHandlers.saveDatabase(db2, FACILITY_A, ['residents'], false);
    await vi.runAllTimersAsync();

    // The push should use db2 (the most recent state)
    expect(mockRemoteSaveDb).toHaveBeenCalledWith(db2);
  });

  test('marks packed sync pending in outbox when debounced push fails', async () => {
    const db = makeDB(FACILITY_A);
    mockSaveSlices.mockResolvedValue(makeSuccessResult(['residents']));
    mockRemoteSaveDb.mockRejectedValueOnce(new Error('Network error'));

    await commandHandlers.saveDatabase(db, FACILITY_A, ['residents'], false);
    await vi.runAllTimersAsync();

    expect(mockMarkPackedSyncPending).toHaveBeenCalled();
  });

  test('clears packed sync pending in outbox when debounced push succeeds', async () => {
    const db = makeDB(FACILITY_A);
    mockSaveSlices.mockResolvedValue(makeSuccessResult(['residents']));
    mockRemoteSaveDb.mockResolvedValueOnce(undefined);

    await commandHandlers.saveDatabase(db, FACILITY_A, ['residents'], false);
    await vi.runAllTimersAsync();

    expect(mockClearPackedSyncPending).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Sync signal — writeSyncSignal calls after successful saves
// ---------------------------------------------------------------------------

describe('commandHandlers.saveDatabase – writeSyncSignal (cross-device push)', () => {
  test('writes sync signal after a successful slice-only save', async () => {
    const db = makeDB(FACILITY_A);
    mockSaveSlices.mockResolvedValue(makeSuccessResult(['residents']));

    await commandHandlers.saveDatabase(db, FACILITY_A, ['residents'], false);

    expect(mockWriteSyncSignal).toHaveBeenCalledWith(
      FACILITY_A,
      ['residents'],
      expect.any(String),
    );
  });

  test('writes sync signal with succeeded slices after a successful full save', async () => {
    const db = makeDB(FACILITY_A);
    const allSlices = ['residents', 'abts', 'infections', 'vaxEvents',
      'auditSessions', 'infectionControlAuditSessions', 'notifications', 'mutationLog'];
    mockSaveSlices.mockResolvedValue(makeSuccessResult(allSlices));

    await commandHandlers.saveDatabase(db, FACILITY_A, [], true);

    expect(mockWriteSyncSignal).toHaveBeenCalledWith(
      FACILITY_A,
      expect.arrayContaining(['residents', 'abts']),
      expect.any(String),
    );
  });

  test('does NOT write sync signal when user is not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const db = makeDB(FACILITY_A);

    await commandHandlers.saveDatabase(db, FACILITY_A, ['residents'], false);

    expect(mockWriteSyncSignal).not.toHaveBeenCalled();
  });

  test('does NOT write sync signal when all slices fail on slice-only path', async () => {
    const db = makeDB(FACILITY_A);
    mockSaveSlices.mockResolvedValue(makeFailureResult([], ['residents']));

    await commandHandlers.saveDatabase(db, FACILITY_A, ['residents'], false);

    expect(mockWriteSyncSignal).not.toHaveBeenCalled();
  });

  test('does NOT write sync signal when no slices succeed on main-change path', async () => {
    const db = makeDB(FACILITY_A);
    mockSaveSlices.mockResolvedValue(makeFailureResult([], ['residents', 'abts']));

    await commandHandlers.saveDatabase(db, FACILITY_A, [], true);

    expect(mockWriteSyncSignal).not.toHaveBeenCalled();
  });
});
