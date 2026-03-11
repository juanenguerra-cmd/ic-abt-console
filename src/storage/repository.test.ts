/**
 * Tests for StorageRepository slice sync behaviour.
 *
 * Covered scenarios:
 *  1. Facility-scoped Firestore paths – users/{uid}/facilities/{fid}/{slice}/{docId}
 *  2. Legacy fallback reads from users/{uid}/{slice} + safe non-destructive migration
 *  3. Sequential per-slice save with retry and SaveSlicesResult handling
 *  4. Partial failure behaviour where some slices fail and others succeed
 *  5. No-auth failure handling
 *  6. Cross-facility isolation
 *  7. Startup reconciliation after migrated slice reads
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks — must be declared before the module under test is imported
// ---------------------------------------------------------------------------

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn().mockResolvedValue(undefined),
  writeBatch: vi.fn(),
  serverTimestamp: vi.fn().mockReturnValue('SERVER_TIMESTAMP'),
}));

vi.mock('../services/firebase', () => ({
  getCurrentUser: vi.fn(),
  db: {},
}));

vi.mock('@/src/services/eventBus', () => ({
  eventBus: { emit: vi.fn() },
}));

vi.mock('./idb', () => ({
  idbGet: vi.fn().mockResolvedValue(null),
  idbSet: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks so the mocked versions are used)
// ---------------------------------------------------------------------------

import { StorageRepository, STORAGE_SLICES } from './repository';
import { collection, doc, getDocs, getDoc, setDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { getCurrentUser } from '../services/firebase';
import { eventBus } from '@/src/services/eventBus';

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------

const mockCollection = vi.mocked(collection);
const mockGetDocs = vi.mocked(getDocs);
const mockGetDoc = vi.mocked(getDoc);
const mockWriteBatch = vi.mocked(writeBatch);
const mockDoc = vi.mocked(doc);
const mockSetDoc = vi.mocked(setDoc);
const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockEventBusEmit = vi.mocked(eventBus.emit);

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const MOCK_USER = { uid: 'user-123' } as any;
const FACILITY_A = 'facility-A';
const FACILITY_B = 'facility-B';

/** Build a fake Firestore QuerySnapshot. */
function makeSnapshot(docs: Array<Record<string, any>>) {
  return {
    empty: docs.length === 0,
    docs: docs.map(d => ({ data: () => d, id: d.id })),
  };
}

/** Build a fake writeBatch that can succeed or fail on commit. */
function makeBatch(commitImpl?: () => Promise<void>) {
  return {
    set: vi.fn(),
    commit: vi.fn().mockImplementation(commitImpl ?? (() => Promise.resolve())),
  } as any;
}

/** Minimal FacilityStore for use in saveSlices calls. */
function makeStore(overrides: Partial<Record<string, any>> = {}) {
  return {
    residents: overrides.residents ?? {},
    abts: overrides.abts ?? {},
    infections: {},
    vaxEvents: {},
    auditSessions: {},
    infectionControlAuditSessions: {},
    notifications: {},
    mutationLog: undefined,
  } as any;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  // Default authenticated user
  mockGetCurrentUser.mockResolvedValue(MOCK_USER);

  // Default: collection returns an identifier string for path assertions
  mockCollection.mockImplementation((_db: any, ...segments: string[]) => segments.join('/') as any);

  // Default: doc returns an object with a path property for path assertions
  mockDoc.mockImplementation((_db: any, ...segments: string[]) => ({ path: segments.join('/') }) as any);

  // Default: empty snapshot
  mockGetDocs.mockResolvedValue(makeSnapshot([]) as any);

  // Default: single document does not exist
  mockGetDoc.mockResolvedValue({ exists: () => false, data: () => null } as any);

  // Default: successful write batch
  mockWriteBatch.mockReturnValue(makeBatch());
});

// ---------------------------------------------------------------------------
// saveSlice
// ---------------------------------------------------------------------------

describe('StorageRepository.saveSlice', () => {
  test('uses facility-scoped Firestore path users/{uid}/facilities/{fid}/{slice}', async () => {
    await StorageRepository.saveSlice(FACILITY_A, 'residents', { r1: { id: 'r1' } });

    expect(mockCollection).toHaveBeenCalledWith(
      expect.anything(),
      'users', MOCK_USER.uid, 'facilities', FACILITY_A, 'residents',
    );
  });

  test('throws when user is not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    await expect(
      StorageRepository.saveSlice(FACILITY_A, 'residents', {}),
    ).rejects.toThrow(/not authenticated/i);
  });

  test('uses item.id as the Firestore document ID', async () => {
    const batch = makeBatch();
    mockWriteBatch.mockReturnValue(batch);

    await StorageRepository.saveSlice(FACILITY_A, 'residents', { r1: { id: 'r1', name: 'Alice' } });

    expect(batch.set).toHaveBeenCalledTimes(1);
    const [, dataArg] = batch.set.mock.calls[0];
    expect(dataArg).toMatchObject({ id: 'r1', name: 'Alice' });
  });

  test('items without an id property are skipped', async () => {
    const batch = makeBatch();
    mockWriteBatch.mockReturnValue(batch);

    await StorageRepository.saveSlice(FACILITY_A, 'residents', [
      { name: 'No ID' },
      { id: 'r2', name: 'Has ID' },
    ]);

    expect(batch.set).toHaveBeenCalledTimes(1);
  });

  test('accepts array-shaped data', async () => {
    const batch = makeBatch();
    mockWriteBatch.mockReturnValue(batch);

    await StorageRepository.saveSlice(FACILITY_A, 'residents', [
      { id: 'r1' },
      { id: 'r2' },
    ]);

    expect(batch.set).toHaveBeenCalledTimes(2);
  });

  test('cross-facility isolation: facility-A and facility-B use different collection paths', async () => {
    await StorageRepository.saveSlice(FACILITY_A, 'residents', {});
    await StorageRepository.saveSlice(FACILITY_B, 'residents', {});

    const callArgs = mockCollection.mock.calls;
    expect(callArgs[0]).toContain(FACILITY_A);
    expect(callArgs[1]).toContain(FACILITY_B);
    // Paths must differ
    expect(callArgs[0].join('/')).not.toBe(callArgs[1].join('/'));
  });
});

// ---------------------------------------------------------------------------
// loadSlice
// ---------------------------------------------------------------------------

describe('StorageRepository.loadSlice', () => {
  test('reads from facility-scoped path first', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ data: { r1: { id: 'r1' } } }) } as any);

    await StorageRepository.loadSlice(MOCK_USER.uid, FACILITY_A, 'residents');

    // The first doc() call creates the canonical path reference
    const firstDocCall = mockDoc.mock.calls[0];
    expect(firstDocCall).toContain('facilities');
    expect(firstDocCall).toContain(FACILITY_A);
    expect(firstDocCall).toContain('slices');
    expect(firstDocCall).toContain('residents');
  });

  test('returns the data payload extracted from the facility-scoped document', async () => {
    const sliceData = { r1: { id: 'r1', name: 'Alice' }, r2: { id: 'r2', name: 'Bob' } };
    mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ data: sliceData }) } as any);

    const result = await StorageRepository.loadSlice(MOCK_USER.uid, FACILITY_A, 'residents');

    expect(result).toEqual(sliceData);
  });

  test('returns null when canonical doc does not exist and all legacy paths are empty', async () => {
    // Default beforeEach: all getDoc calls return non-existing

    const result = await StorageRepository.loadSlice(MOCK_USER.uid, FACILITY_A, 'residents');

    expect(result).toBeNull();
  });

  test('falls back to legacy path when facility-scoped path is empty', async () => {
    const legacyData = { r1: { id: 'r1', name: 'Legacy Resident' } };
    mockGetDoc
      .mockResolvedValueOnce({ exists: () => false, data: () => null } as any)   // canonical: empty
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ data: legacyData }) } as any); // first legacy

    const result = await StorageRepository.loadSlice(MOCK_USER.uid, FACILITY_A, 'residents');

    expect(result).toEqual(legacyData);
  });

  test('auto-migrates legacy data to facility-scoped path after fallback read', async () => {
    const legacyData = { r1: { id: 'r1' } };
    mockGetDoc
      .mockResolvedValueOnce({ exists: () => false, data: () => null } as any)
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ data: legacyData }) } as any);

    await StorageRepository.loadSlice(MOCK_USER.uid, FACILITY_A, 'residents');

    // setDoc must have been called for migration with merge option
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    expect(mockSetDoc.mock.calls[0][2]).toEqual({ merge: true });
  });

  test('migration writes to the facility-scoped path, not the legacy path', async () => {
    const legacyData = { r1: { id: 'r1' } };
    mockGetDoc
      .mockResolvedValueOnce({ exists: () => false, data: () => null } as any)
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ data: legacyData }) } as any);

    await StorageRepository.loadSlice(MOCK_USER.uid, FACILITY_A, 'residents');

    // The first doc() call is for the canonical ref; setDoc should be called with it
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const [migratedToRef] = mockSetDoc.mock.calls[0];
    expect((migratedToRef as any).path).toContain('facilities');
    expect((migratedToRef as any).path).toContain(FACILITY_A);
    expect((migratedToRef as any).path).toContain('slices');
  });

  test('migration is non-destructive: only setDoc is called for migration, no delete', async () => {
    const legacyData = { r1: { id: 'r1' } };
    mockGetDoc
      .mockResolvedValueOnce({ exists: () => false, data: () => null } as any)
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ data: legacyData }) } as any);

    await StorageRepository.loadSlice(MOCK_USER.uid, FACILITY_A, 'residents');

    // Migration uses setDoc (not writeBatch or deleteDoc)
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    expect(mockWriteBatch).not.toHaveBeenCalled();
  });

  test('returns null when both facility-scoped and legacy paths are empty', async () => {
    // Default beforeEach: all getDoc calls return non-existing

    const result = await StorageRepository.loadSlice(MOCK_USER.uid, FACILITY_A, 'residents');

    expect(result).toBeNull();
  });

  test('returns legacy data even if the migration write fails', async () => {
    const legacyData = { r1: { id: 'r1', name: 'Legacy' } };
    mockGetDoc
      .mockResolvedValueOnce({ exists: () => false, data: () => null } as any)
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ data: legacyData }) } as any);

    // Migration setDoc throws
    mockSetDoc.mockRejectedValueOnce(new Error('Write failed'));

    const result = await StorageRepository.loadSlice(MOCK_USER.uid, FACILITY_A, 'residents');

    // Legacy data must still be returned despite migration failure
    expect(result).toEqual(legacyData);
  });

  test('extracts the payload field when data field is absent', async () => {
    const sliceData = { r1: { id: 'r1' } };
    mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ payload: sliceData }) } as any);

    const result = await StorageRepository.loadSlice(MOCK_USER.uid, FACILITY_A, 'residents');

    expect(result).toEqual(sliceData);
  });
});

// ---------------------------------------------------------------------------
// saveSlices
// ---------------------------------------------------------------------------

describe('StorageRepository.saveSlices', () => {
  test('returns allSucceeded: true when all slices save without error', async () => {
    const store = makeStore({ residents: { r1: { id: 'r1' } } });

    const result = await StorageRepository.saveSlices(FACILITY_A, store, ['residents']);

    expect(result.allSucceeded).toBe(true);
    expect(result.succeededSlices).toContain('residents');
    expect(result.failedSlices).toHaveLength(0);
  });

  test('returns empty success result for an empty changedSlices array', async () => {
    const result = await StorageRepository.saveSlices(FACILITY_A, makeStore(), []);

    expect(result.allSucceeded).toBe(true);
    expect(result.succeededSlices).toHaveLength(0);
    expect(result.failedSlices).toHaveLength(0);
    expect(result.results).toHaveLength(0);
  });

  test('no-auth: returns allSucceeded: false with every requested slice in failedSlices', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const result = await StorageRepository.saveSlices(FACILITY_A, makeStore(), ['residents', 'abts']);

    expect(result.allSucceeded).toBe(false);
    expect(result.failedSlices).toEqual(expect.arrayContaining(['residents', 'abts']));
    expect(result.succeededSlices).toHaveLength(0);
  });

  test('no-auth: every SliceSaveResult has success: false and an error', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const result = await StorageRepository.saveSlices(FACILITY_A, makeStore(), ['residents', 'abts']);

    result.results.forEach(r => {
      expect(r.success).toBe(false);
      expect(r.error).toBeDefined();
    });
  });

  test('no-auth: never throws — always returns a SaveSlicesResult', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    await expect(
      StorageRepository.saveSlices(FACILITY_A, makeStore(), ['residents']),
    ).resolves.toBeDefined();
  });

  test('partial failure: some slices fail while others succeed', async () => {
    const store = makeStore({
      residents: { r1: { id: 'r1' } },
      abts: { a1: { id: 'a1' } },
    });

    // SLICE_SAVE_MAX_RETRIES = 2 → residents gets 3 total batch commits before
    // being recorded as failed.  The 4th commit is for abts, which succeeds.
    let batchCreateCount = 0;
    mockWriteBatch.mockImplementation(() => {
      batchCreateCount++;
      if (batchCreateCount <= 3) {
        return makeBatch(() => Promise.reject(new Error('Residents always fails')));
      }
      return makeBatch();
    });

    const result = await StorageRepository.saveSlices(FACILITY_A, store, ['residents', 'abts']);

    expect(result.allSucceeded).toBe(false);
    expect(result.succeededSlices).toHaveLength(1);
    expect(result.failedSlices).toHaveLength(1);
    expect(result.results).toHaveLength(2);
  });

  test('total failure: never throws — always returns a SaveSlicesResult', async () => {
    mockWriteBatch.mockReturnValue(makeBatch(() => Promise.reject(new Error('Network error'))));

    await expect(
      StorageRepository.saveSlices(FACILITY_A, makeStore({ residents: { r1: { id: 'r1' } } }), ['residents']),
    ).resolves.toBeDefined();
  });

  test('total failure: allSucceeded is false and failedSlices lists the slice', async () => {
    mockWriteBatch.mockReturnValue(makeBatch(() => Promise.reject(new Error('Network error'))));

    const result = await StorageRepository.saveSlices(
      FACILITY_A,
      makeStore({ residents: { r1: { id: 'r1' } } }),
      ['residents'],
    );

    expect(result.allSucceeded).toBe(false);
    expect(result.failedSlices).toContain('residents');
  });

  test('executes slices sequentially (residents before abts)', async () => {
    const order: string[] = [];
    mockCollection.mockImplementation((_db: any, ...segments: string[]) => {
      order.push(segments[segments.length - 1]);
      return segments.join('/') as any;
    });
    const store = makeStore({ residents: { r1: { id: 'r1' } }, abts: { a1: { id: 'a1' } } });

    await StorageRepository.saveSlices(FACILITY_A, store, ['residents', 'abts']);

    expect(order.indexOf('residents')).toBeLessThan(order.indexOf('abts'));
  });

  test('emits sync-start and sync-end events on the eventBus', async () => {
    const store = makeStore({ residents: { r1: { id: 'r1' } } });

    await StorageRepository.saveSlices(FACILITY_A, store, ['residents']);

    expect(mockEventBusEmit).toHaveBeenCalledWith('sync-start', expect.anything());
    expect(mockEventBusEmit).toHaveBeenCalledWith('sync-end', expect.anything());
  });

  test('sync-end event reports allSucceeded: false on partial failure', async () => {
    const store = makeStore({ residents: { r1: { id: 'r1' } }, abts: { a1: { id: 'a1' } } });
    // Residents exhausts all 3 attempts; abts succeeds on its first attempt
    let batchCreateCount = 0;
    mockWriteBatch.mockImplementation(() => {
      batchCreateCount++;
      if (batchCreateCount <= 3) {
        return makeBatch(() => Promise.reject(new Error('Residents always fails')));
      }
      return makeBatch();
    });

    await StorageRepository.saveSlices(FACILITY_A, store, ['residents', 'abts']);

    const syncEndCall = mockEventBusEmit.mock.calls.find(([event]) => event === 'sync-end');
    expect(syncEndCall).toBeDefined();
    expect(syncEndCall![1]).toMatchObject({ allSucceeded: false });
    expect(syncEndCall![1].failedSlices).toContain('residents');
  });

  test('retries a failing slice before recording it as failed', async () => {
    // The commit fails on the first two attempts but succeeds on the third
    let commitCalls = 0;
    mockWriteBatch.mockImplementation(() =>
      makeBatch(async () => {
        commitCalls++;
        if (commitCalls <= 2) throw new Error(`Attempt ${commitCalls} failed`);
      }),
    );
    const store = makeStore({ residents: { r1: { id: 'r1' } } });

    const result = await StorageRepository.saveSlices(FACILITY_A, store, ['residents']);

    // 3 calls total (attempt 1, 2, 3) with eventual success
    expect(commitCalls).toBe(3);
    expect(result.allSucceeded).toBe(true);
  });

  test('marks slice as failed after exhausting all retry attempts', async () => {
    mockWriteBatch.mockReturnValue(
      makeBatch(() => Promise.reject(new Error('Always fails'))),
    );
    const store = makeStore({ residents: { r1: { id: 'r1' } } });

    const result = await StorageRepository.saveSlices(FACILITY_A, store, ['residents']);

    expect(result.allSucceeded).toBe(false);
    expect(result.failedSlices).toContain('residents');
  });
});

// ---------------------------------------------------------------------------
// migrateSlicesToFacilityScope
// ---------------------------------------------------------------------------

describe('StorageRepository.migrateSlicesToFacilityScope', () => {
  test('returns empty arrays when user is not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const result = await StorageRepository.migrateSlicesToFacilityScope(FACILITY_A);

    expect(result.migrated).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
  });

  test('skips all slices when facility-scoped paths already have data', async () => {
    // Every getDocs call returns a non-empty snapshot
    mockGetDocs.mockResolvedValue(makeSnapshot([{ id: 'r1' }]) as any);

    const result = await StorageRepository.migrateSlicesToFacilityScope(FACILITY_A);

    expect(result.skipped).toHaveLength(STORAGE_SLICES.length);
    expect(result.migrated).toHaveLength(0);
  });

  test('skips slices that have no legacy data', async () => {
    mockGetDocs.mockResolvedValue(makeSnapshot([]) as any);

    const result = await StorageRepository.migrateSlicesToFacilityScope(FACILITY_A);

    expect(result.migrated).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
  });

  test('migrates the first slice that has only legacy data', async () => {
    const legacyDocs = [{ id: 'r1' }];
    let callCount = 0;
    mockGetDocs.mockImplementation(async () => {
      callCount++;
      // Each slice makes two getDocs calls: [new path, legacy path]
      // Only make the legacy path for the first slice return data (call #2)
      if (callCount === 2) return makeSnapshot(legacyDocs) as any;
      return makeSnapshot([]) as any;
    });

    const result = await StorageRepository.migrateSlicesToFacilityScope(FACILITY_A);

    expect(result.migrated).toHaveLength(1);
    expect(result.migrated[0]).toBe(STORAGE_SLICES[0]);
  });

  test('records failed slices without throwing', async () => {
    const legacyDocs = [{ id: 'r1' }];
    let callCount = 0;
    mockGetDocs.mockImplementation(async () => {
      callCount++;
      if (callCount === 2) return makeSnapshot(legacyDocs) as any;
      return makeSnapshot([]) as any;
    });
    mockWriteBatch.mockReturnValue(makeBatch(() => Promise.reject(new Error('Write failure'))));

    const result = await StorageRepository.migrateSlicesToFacilityScope(FACILITY_A);

    expect(result.failed).toHaveLength(1);
    expect(result.migrated).toHaveLength(0);
  });

  test('never throws even when every slice write fails', async () => {
    const legacyDocs = [{ id: 'r1' }];
    // All slices have legacy data but no new data
    mockGetDocs.mockImplementation(async (ref: any) => {
      if (typeof ref === 'string' && ref.includes('facilities')) {
        return makeSnapshot([]) as any;
      }
      return makeSnapshot(legacyDocs) as any;
    });
    mockWriteBatch.mockReturnValue(makeBatch(() => Promise.reject(new Error('Always fails'))));

    await expect(
      StorageRepository.migrateSlicesToFacilityScope(FACILITY_A),
    ).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Startup reconciliation
// ---------------------------------------------------------------------------

describe('StorageRepository.loadSlice (startup reconciliation)', () => {
  function makeUnifiedDB(facilityId: string, storeOverrides: Record<string, any> = {}) {
    return {
      data: {
        facilities: { activeFacilityId: facilityId, byId: {} },
        facilityData: {
          [facilityId]: {
            residents: {},
            abts: {},
            infections: {},
            vaxEvents: {},
            auditSessions: {},
            infectionControlAuditSessions: {},
            notifications: {},
            ...storeOverrides,
          },
        },
      },
    } as any;
  }

  test('after auto-migration, subsequent load reads from facility-scoped path', async () => {
    const legacyData = { r1: { id: 'r1', name: 'Migrated' } };

    // First loadSlice: canonical empty → fall back to legacy → auto-migrate
    // Second loadSlice: canonical now has data
    mockGetDoc
      .mockResolvedValueOnce({ exists: () => false, data: () => null } as any)         // 1st load, canonical: empty
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ data: legacyData }) } as any) // 1st load, legacy
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ data: legacyData }) } as any); // 2nd load, canonical

    const result1 = await StorageRepository.loadSlice(MOCK_USER.uid, FACILITY_A, 'residents');
    const result2 = await StorageRepository.loadSlice(MOCK_USER.uid, FACILITY_A, 'residents');

    expect(result1).toEqual(legacyData);
    expect(result2).toEqual(legacyData);
    // Second load must not trigger the legacy fallback (only 3 getDoc calls total)
    expect(mockGetDoc).toHaveBeenCalledTimes(3);
  });

  test('cross-facility isolation: switching facilityId reads the correct data', async () => {
    const dataA = { a1: { id: 'a1', name: 'Facility A data' } };
    const dataB = { b1: { id: 'b1', name: 'Facility B data' } };

    // Alternate responses so facility A and B return different data
    mockGetDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ data: dataA }) } as any)
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ data: dataB }) } as any);

    const resultA = await StorageRepository.loadSlice(MOCK_USER.uid, FACILITY_A, 'residents');
    const resultB = await StorageRepository.loadSlice(MOCK_USER.uid, FACILITY_B, 'residents');

    expect(Object.keys(resultA!)).toContain('a1');
    expect(Object.keys(resultB!)).toContain('b1');
    expect(resultA).not.toEqual(resultB);
  });
});

// ---------------------------------------------------------------------------
// writeSyncSignal
// ---------------------------------------------------------------------------

describe('StorageRepository.writeSyncSignal', () => {
  const SESSION_ID = 'test-session-123';

  test('writes a sync signal document to the users/{uid}/meta/sync path', async () => {
    mockDoc.mockReturnValue('users/user-123/meta/sync' as any);

    await StorageRepository.writeSyncSignal(FACILITY_A, ['residents'], SESSION_ID);

    expect(mockDoc).toHaveBeenCalledWith(
      expect.anything(),
      'users', MOCK_USER.uid, 'meta', 'sync',
    );
    expect(mockSetDoc).toHaveBeenCalledWith(
      'users/user-123/meta/sync',
      expect.objectContaining({
        sessionId: SESSION_ID,
        facilityId: FACILITY_A,
        changedSlices: ['residents'],
      }),
    );
  });

  test('includes a lastUpdatedAt ISO timestamp in the signal document', async () => {
    await StorageRepository.writeSyncSignal(FACILITY_A, ['residents'], SESSION_ID);

    const [, dataArg] = (mockSetDoc.mock.calls[0] as unknown) as [unknown, Record<string, unknown>];
    expect(dataArg.lastUpdatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('does nothing when user is not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    await StorageRepository.writeSyncSignal(FACILITY_A, ['residents'], SESSION_ID);

    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  test('does not throw when setDoc fails — swallows the error', async () => {
    mockSetDoc.mockRejectedValueOnce(new Error('Firestore unavailable'));

    await expect(
      StorageRepository.writeSyncSignal(FACILITY_A, ['residents'], SESSION_ID),
    ).resolves.toBeUndefined();
  });

  test('passes all changed slices in the signal document', async () => {
    const slices = ['residents', 'abts', 'infections'] as any[];

    await StorageRepository.writeSyncSignal(FACILITY_A, slices, SESSION_ID);

    const [, dataArg] = (mockSetDoc.mock.calls[0] as unknown) as [unknown, Record<string, unknown>];
    expect(dataArg.changedSlices).toEqual(slices);
  });
});
