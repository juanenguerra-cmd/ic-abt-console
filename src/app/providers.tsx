import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import { UnifiedDB, FacilityStore } from "../domain/models";
import { loadDBAsync, saveDBAsync, SchemaMigrationError, reconcileWithRemoteAsync } from "../storage/engine";
import { STORAGE_SLICES } from "../storage/repository";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { commandHandlers, MutationMeta, SESSION_ID } from "../services/commandHandlers";
import { onSnapshot, doc as fsDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db as firestoreDb } from "../services/firebase";
import {
  startSyncTimer,
  stopSyncTimer,
  triggerManualSync,
  refreshSyncStatusFromStorage,
  getSyncStatus,
  SyncStatus,
} from "../services/syncService";
import { LS_JUST_RESTORED_FLAG, LS_ACTIVE_FACILITY_ID } from "../constants/storageKeys";

// How long to keep the restore guard active after setDB completes.
// This covers the ~1.5 s window between restore and the page reload
// triggered by the restore flow, preventing any in-flight reconciliation
// from overwriting the freshly-restored state.
const RESTORE_GUARD_TTL_MS = 5_000;
// How long an app-toast notification stays visible before auto-dismissing.
const TOAST_AUTO_DISMISS_MS = 4_000;
type SyncDebugInfo = {
  label: string;
  syncMode?: string;
  facilityId?: string | null;
  userId?: string | null;
  listenerKey?: string;
  residentCount?: number;
  abtCount?: number;
  infectionCount?: number;
  vaxCount?: number;
  extra?: Record<string, unknown>;
};

function syncLog(info: SyncDebugInfo): void {
  if (typeof window !== 'undefined' && (window as any).__SYNC_DEBUG__) {
    console.log('[SyncDebug]', info);
  }
}

// Stronger debug helper
function debugDb(label: string, db: any) {
  try {
    const facId = db?.data?.facilities?.activeFacilityId;
    const store = db?.data?.facilityData?.[facId] || {};
    const info = {
      schemaName: db?.schemaName,
      schemaVersion: db?.schemaVersion,
      activeFacilityId: facId,
      residentCount: Object.keys(store?.residents?.byId || {}).length,
    };
    console.log(`[${label}]`, info);
    syncLog({
      label,
      facilityId: facId,
      residentCount: info.residentCount,
    });
  } catch (e) {
    console.error(`[${label}] debugDb failed`, e);
  }
}

interface DatabaseContextType {
  db: UnifiedDB;
  updateDB: (updater: (draft: UnifiedDB) => void, meta?: MutationMeta) => void;
  setDB: (db: UnifiedDB) => Promise<void>;
  error: string | null;
}

interface FacilityContextType {
  activeFacilityId: string;
  setActiveFacilityId: (id: string) => void;
  store: FacilityStore;
}

interface SyncStatusContextType {
  syncStatus: SyncStatus;
  triggerSync: () => Promise<void>;
}

const DatabaseContext = createContext<DatabaseContextType | null>(null);
const FacilityContext = createContext<FacilityContextType | null>(null);
const SyncStatusContext = createContext<SyncStatusContextType | null>(null);

export function AppProviders({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<UnifiedDB | null>(null);
  const [activeFacilityId, _setActiveFacilityId] = useState<string | null>(
    localStorage.getItem(LS_ACTIVE_FACILITY_ID)
  );
  // Authenticated user ID — set by the onAuthStateChanged listener below.
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSafeMode, setIsSafeMode] = useState(false);
  const [isMigrationRequired, setIsMigrationRequired] = useState(false);
  const [saveErrorToast, setSaveErrorToast] = useState<string | null>(null);
  const [appToast, setAppToast] = useState<{ message: string; type: string } | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus);

  // Stable ref so async callbacks always access the latest db without stale closures.
  const dbRef = useRef(db);
  dbRef.current = db;

  // Guard: set to true during restore/import to prevent concurrent sync from
  // overwriting the freshly-restored state before the page reloads.
  const isRestoringRef = useRef(false);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const bootstrapApp = async () => {
      const justRestored = sessionStorage.getItem(LS_JUST_RESTORED_FLAG) === "true";
      
      if (justRestored) {
        console.info("[Bootstrap] Skipping remote reconciliation: backup was just restored.");
        // Clear immediately so subsequent reloads behave normally.
        sessionStorage.removeItem(LS_JUST_RESTORED_FLAG);
      }

      try {
        const loadedDb = await loadDBAsync({ skipRemoteReconciliation: justRestored });
        dbRef.current = loadedDb; // Update ref immediately
        setDb(loadedDb);
        const facId = loadedDb.data.facilities.activeFacilityId;
        _setActiveFacilityId(facId);
        localStorage.setItem(LS_ACTIVE_FACILITY_ID, facId);
        debugDb("initial-load", loadedDb);
        syncLog({ label: 'bootstrap', facilityId: facId, extra: { justRestored } });

        // ── Startup diagnostics ──────────────────────────────────────────────
        const store = loadedDb.data.facilityData[facId] || {} as any;
        const swReg = await navigator.serviceWorker?.getRegistration?.().catch(() => null);
        const swVersion = swReg?.active?.scriptURL ?? 'none';
        console.group('%c[IC Console] Startup Diagnostics', 'color: #059669; font-weight: bold;');
        console.log('BUILD_ID        :', __BUILD_ID__);
        console.log('SW script URL   :', swVersion);
        console.log('Active facilityId:', facId);
        console.log('Resident count  :', Object.keys(store?.residents?.byId || {}).length);
        console.log('ABT count       :', Object.keys(store?.abts?.byId || {}).length);
        console.log('Infection count :', Object.keys(store?.infections?.byId || {}).length);
        console.log('Vax count       :', Object.keys(store?.vaxEvents?.byId || {}).length);
        console.log('Just restored?  :', justRestored);
        console.log('Schema version  :', loadedDb.schemaVersion);
        console.groupEnd();
      } catch (err) {
        console.error("Failed to load DB:", err);
        if (err instanceof SchemaMigrationError) {
          setIsMigrationRequired(true);
          setError(err.message);
        } else {
          setIsSafeMode(true);
          setError(err instanceof Error ? err.message : "Unknown database error");
        }
      }
    };
    
    bootstrapApp();
  }, []); // Runs once on mount.

  // ── Auth state ─────────────────────────────────────────────────────────────
  // Registered ONCE. Uses dbRef to avoid stale closures; never re-registers
  // on db changes (which would cause rapid subscribe/unsubscribe churn).
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      const uid = user?.uid ?? null;
      setUserId(uid);
      syncLog({ label: 'auth-state-changed', userId: uid });
      if (user && dbRef.current && !isRestoringRef.current) {
        reconcileWithRemoteAsync(dbRef.current, 'auth').then(async () => {
          await refreshSyncStatusFromStorage();
          setSyncStatus(getSyncStatus());
        }).catch(err => console.warn('[Sync] Auth-triggered reconciliation failed:', err));
      }
    });
    return () => unsub();
  }, []); // Empty deps — registered once for the component lifetime.

  // ── Firestore sync-signal listener ────────────────────────────────────────
  // Depends on userId and activeFacilityId ONLY (not `db`). Re-creating this
  // listener on every db change was the primary trigger of Firestore's
  // "INTERNAL ASSERTION FAILED: Unexpected state" error. The callback uses
  // dbRef.current so it always reads the latest state without re-subscribing.
  //
  // Path mirrors StorageRepository.writeSyncSignal: users/{uid}/meta/sync
  useEffect(() => {
    if (!userId || !activeFacilityId) return;

    syncLog({ label: 'onSnapshot-attach', userId, facilityId: activeFacilityId });
    console.log(`[Sync] Attaching sync-signal listener (user=${userId}, facility=${activeFacilityId})`);

    let unsub: (() => void) | null = null;
    try {
      // Path must match StorageRepository.writeSyncSignal exactly:
      //   users/{uid}/meta/sync
      unsub = onSnapshot(fsDoc(firestoreDb, 'users', userId, 'meta', 'sync'), (snap) => {
        if (!snap.exists()) return;
        const signal = snap.data();
        // Skip signals produced by this tab to avoid pointless reconciliation.
        if (signal.sessionId === SESSION_ID) return;
        const currentDb = dbRef.current;
        if (!currentDb || isRestoringRef.current) return;
        // Compare using lastUpdatedAt — the field written by writeSyncSignal.
        if ((signal.lastUpdatedAt || '') > (currentDb.updatedAt || '')) {
          syncLog({ label: 'onSnapshot-triggered-reconcile', userId, facilityId: activeFacilityId });
          reconcileWithRemoteAsync(currentDb).then(async (result) => {
            if (result.action === 'pull') {
              await refreshSyncStatusFromStorage();
              setSyncStatus(getSyncStatus());
            }
          }).catch(err => console.warn('[Sync] Signal-triggered reconciliation failed:', err));
        }
      });
    } catch (err) {
      console.error('[Sync] Failed to attach sync-signal listener:', err);
    }

    return () => {
      if (unsub) {
        console.log(`[Sync] Detaching sync-signal listener (user=${userId}, facility=${activeFacilityId})`);
        syncLog({ label: 'onSnapshot-detach', userId, facilityId: activeFacilityId });
        unsub();
      }
    };
  }, [userId, activeFacilityId]); // Re-attach only on user/facility change, NOT every db mutation.

  // ── Periodic sync timer ────────────────────────────────────────────────────
  // Registered ONCE. DbGetter returns null during restore, which syncService
  // handles by skipping the reconciliation cycle (see _runCycle: if (!db) return).
  useEffect(() => {
    startSyncTimer(() => (isRestoringRef.current ? null : dbRef.current));
    return () => stopSyncTimer();
  }, []); // Empty deps — timer registered once.

  // ── Cross-tab sync via BroadcastChannel ───────────────────────────────────
  // Registered ONCE. Channel is properly closed on cleanup (not just the
  // listener removed) to prevent resource leaks.
  useEffect(() => {
    const channel = new BroadcastChannel('ic_console_sync');
    const handler = (event: MessageEvent) => {
      const currentDb = dbRef.current;
      if (event.data?.type === 'DB_UPDATED' && currentDb && !isRestoringRef.current) {
        reconcileWithRemoteAsync(currentDb, 'broadcast').then(async () => {
          await refreshSyncStatusFromStorage();
          setSyncStatus(getSyncStatus());
        }).catch(err => console.warn('[Sync] Broadcast-triggered reconciliation failed:', err));
      }
    };
    channel.addEventListener('message', handler);
    return () => {
      channel.removeEventListener('message', handler);
      channel.close(); // Properly close, not just remove the listener.
    };
  }, []); // Empty deps — registered once.

  // ── App-toast event (from alertService.show) ─────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const { message, type } = (e as CustomEvent<{ message: string; type: string }>).detail ?? {};
      if (!message) return;
      setAppToast({ message, type: type ?? 'info' });
      // Auto-dismiss after the configured TTL.
      setTimeout(() => setAppToast(null), TOAST_AUTO_DISMISS_MS);
    };
    window.addEventListener('app-toast', handler);
    return () => window.removeEventListener('app-toast', handler);
  }, []); // Empty deps — registered once.
  // When reconciliation pulls a newer DB from the remote, it saves to IDB and
  // fires this event. Without this handler the React state would remain stale
  // for the rest of the session.
  useEffect(() => {
    const handler = (e: Event) => {
      if (isRestoringRef.current) return; // Don't let a remote pull clobber an in-flight restore.
      const remoteDb = (e as CustomEvent<UnifiedDB>).detail;
      if (!remoteDb) return;
      console.log('[Sync] db-reconciled-from-remote: updating live React state.');
      syncLog({ label: 'db-reconciled-from-remote' });
      dbRef.current = remoteDb; // Update ref immediately
      setDb(remoteDb);
      const facId = remoteDb.data?.facilities?.activeFacilityId;
      if (facId) {
        _setActiveFacilityId(facId);
        localStorage.setItem(LS_ACTIVE_FACILITY_ID, facId);
      }
    };
    window.addEventListener('db-reconciled-from-remote', handler);
    return () => window.removeEventListener('db-reconciled-from-remote', handler);
  }, []); // Empty deps — registered once.

  const updateDB = useCallback(
    async (updater: (draft: UnifiedDB) => void, meta?: MutationMeta) => {
      if (!dbRef.current || !activeFacilityId) return;

      const { nextDb, changedSlices, mainChanged } = commandHandlers.applyMutation(
        dbRef.current,
        activeFacilityId,
        updater,
        meta,
      );

      dbRef.current = nextDb; // Update ref immediately for synchronous calls
      setDb(nextDb); // Optimistic update

      saveQueueRef.current = saveQueueRef.current.then(async () => {
        try {
          await commandHandlers.saveDatabase(nextDb, activeFacilityId, changedSlices, mainChanged);
          setSaveErrorToast(null);
        } catch (e: any) {
          console.error("Failed to save database:", e);
          setSaveErrorToast(e.message || "An unknown error occurred during save.");
        }
      });
      
      await saveQueueRef.current;
    },
    [activeFacilityId],
  );

  const setDB = useCallback(async (newDb: UnifiedDB) => {
    // Activate restore guard: prevents concurrent sync from overwriting the
    // restored state before the page reloads (typically within ~1.5 seconds).
    isRestoringRef.current = true;
    syncLog({ label: 'setDB-restore-guard-on' });
    try {
      // Bump the updatedAt timestamp so this restored backup is considered the newest version by all devices
      newDb.updatedAt = new Date().toISOString();
      
      // Save all slices to Firestore and the packed DB locally/remotely
      const newFacId = newDb.data.facilities.activeFacilityId;
      const store = newDb.data.facilityData[newFacId];
      
      saveQueueRef.current = saveQueueRef.current.then(async () => {
        try {
          if (store) {
            await commandHandlers.saveDatabase(newDb, newFacId, [...STORAGE_SLICES], true);
          } else {
            await saveDBAsync(newDb);
          }
        } catch (e: any) {
          console.error("Failed to save database during restore:", e);
        }
      });
      await saveQueueRef.current;
      
      dbRef.current = newDb; // Update ref immediately
      setDb(newDb);
      _setActiveFacilityId(newFacId);
      localStorage.setItem(LS_ACTIVE_FACILITY_ID, newFacId);
    } finally {
      // Keep the guard active for RESTORE_GUARD_TTL_MS so any in-flight async
      // effects triggered by the state change still see it before the page reloads.
      setTimeout(() => {
        isRestoringRef.current = false;
        syncLog({ label: 'setDB-restore-guard-off' });
      }, RESTORE_GUARD_TTL_MS);
    }
  }, []);

  const setActiveFacilityId = useCallback((id: string) => {
    _setActiveFacilityId(id);
    localStorage.setItem(LS_ACTIVE_FACILITY_ID, id);
    if (dbRef.current && dbRef.current.data.facilities.activeFacilityId !== id) {
      updateDB(draft => {
        draft.data.facilities.activeFacilityId = id;
      });
    }
  }, [updateDB]);

  const triggerSync = useCallback(async () => {
    if (!dbRef.current) return;
    setSyncStatus((s) => ({ ...s, isSyncing: true }));
    // triggerManualSync expects a DbGetter — a function that returns the current DB.
    await triggerManualSync(() => dbRef.current);
    await refreshSyncStatusFromStorage();
    setSyncStatus(getSyncStatus());
  }, []);

  if (isMigrationRequired) {
    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-red-50 text-red-900">
            <AlertTriangle className="h-12 w-12 mb-4" />
            <h1 className="text-xl font-bold mb-2">Database Migration Required</h1>
            <p className="max-w-md text-center">{error}</p>
        </div>
    );
  }

  if (isSafeMode) {
     return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-amber-50 text-amber-900">
            <AlertTriangle className="h-12 w-12 mb-4" />
            <h1 className="text-xl font-bold mb-2">Safe Mode</h1>
            <p className="max-w-md text-center mb-4">{error}</p>
            <button
                onClick={() => commandHandlers.hardReset()}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2"
            >
                <RefreshCw className="w-4 h-4" /> Reset and Start Fresh
            </button>
        </div>
     );
  }

  if (!db || !activeFacilityId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  const store = db.data.facilityData[activeFacilityId] || {} as FacilityStore;

  return (
    <DatabaseContext.Provider value={{ db, updateDB, setDB, error }}>
      <FacilityContext.Provider value={{ activeFacilityId, setActiveFacilityId, store }}>
        <SyncStatusContext.Provider value={{ syncStatus, triggerSync }}>
          {children}
           {saveErrorToast && (
              <div className="fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md shadow-lg z-50 flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-3" />
                  <div className="flex-1">
                      <p className="font-bold">Save Error</p>
                      <p className="text-sm">{saveErrorToast}</p>
                  </div>
                  <button onClick={() => setSaveErrorToast(null)} className="ml-4">
                      <X className="h-5 w-5" />
                  </button>
              </div>
            )}
           {appToast && (
              <div className={`fixed bottom-16 right-4 px-4 py-3 rounded-md shadow-lg z-50 flex items-center border ${
                appToast.type === 'error'
                  ? 'bg-red-100 border-red-400 text-red-700'
                  : appToast.type === 'success'
                  ? 'bg-emerald-100 border-emerald-400 text-emerald-700'
                  : 'bg-blue-100 border-blue-400 text-blue-700'
              }`}>
                  <div className="flex-1 text-sm">{appToast.message}</div>
                  <button onClick={() => setAppToast(null)} className="ml-4">
                      <X className="h-4 w-4" />
                  </button>
              </div>
            )}
        </SyncStatusContext.Provider>
      </FacilityContext.Provider>
    </DatabaseContext.Provider>
  );
}

export function useDatabase() {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error("useDatabase must be used within AppProviders");
  }
  return context;
}

export function useFacilityData() {
  const context = useContext(FacilityContext);
  if (!context) {
    throw new Error("useFacilityData must be used within AppProviders");
  }
  return context;
}

export function useSyncStatus() {
  const context = useContext(SyncStatusContext);
  if (!context) {
    throw new Error("useSyncStatus must be used within AppProviders");
  }
  return context;
}
