import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import { UnifiedDB, FacilityStore } from "../domain/models";
import { loadDBAsync, SchemaMigrationError, reconcileWithRemoteAsync } from "../storage/engine";
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
  DEFAULT_SYNC_INTERVAL_MS,
} from "../services/syncService";
import { DB_KEY_MAIN, LS_JUST_RESTORED_FLAG, LS_ACTIVE_FACILITY_ID } from "../constants/storageKeys";

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
  const [activeFacilityId, setActiveFacilityId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSafeMode, setIsSafeMode] = useState(false);
  const [isMigrationRequired, setIsMigrationRequired] = useState(false);
  const [saveErrorToast, setSaveErrorToast] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus);
  const didJustRestore = useRef(false);

  useEffect(() => {
    // Check for a sentinel flag indicating a recent backup restore.
    if (localStorage.getItem(LS_JUST_RESTORED_FLAG)) {
      localStorage.removeItem(LS_JUST_RESTORED_FLAG);
      didJustRestore.current = true;
      console.log('[Providers] Just restored from backup. Remote sync will be skipped for this session start.');
    }

    loadDBAsync()
      .then((loadedDb) => {
        setDb(loadedDb);
        // Hydrate active facility from localStorage first, then from DB as a fallback.
        const storedFacilityId = localStorage.getItem(LS_ACTIVE_FACILITY_ID);
        setActiveFacilityId(storedFacilityId || loadedDb.data.facilities.activeFacilityId);
      })
      .catch((err) => {
        console.error("Failed to load DB:", err);
        if (err instanceof SchemaMigrationError) {
          setIsMigrationRequired(true);
          setError(err.message);
        } else {
          setIsSafeMode(true);
          setError(err instanceof Error ? err.message : "Unknown database error");
        }
      });
  }, []);

  // Multi-tab sync
  useEffect(() => {
    if (import.meta.env.PROD) {
      const channel = new BroadcastChannel('ic_console_sync');
      channel.onmessage = async (event) => {
        if (event.data.type === 'DB_UPDATED') {
          const { changedSlices, mainChanged } = event.data;
          try {
            if (!mainChanged && changedSlices?.length > 0) {
              const { StorageRepository } = await import('../storage/repository');
              let currentFacilityId: string | null = null;
              setDb(currentDb => {
                if (currentDb) currentFacilityId = currentDb.data.facilities.activeFacilityId;
                return currentDb;
              });
              if (!currentFacilityId) return;
              
              const newSlices: any = {};
              for (const slice of changedSlices) {
                const data = await StorageRepository.loadSlice(currentFacilityId, slice);
                if (data) newSlices[slice] = data;
              }
              
              setDb(currentDb => {
                if (!currentDb) return currentDb;
                const nextDb = JSON.parse(JSON.stringify(currentDb));
                const store = nextDb.data.facilityData[currentFacilityId!];
                if (store) {
                  for (const slice of changedSlices) {
                    if (newSlices[slice]) store[slice] = newSlices[slice];
                  }
                }
                return nextDb;
              });
            } else {
              const loadedDb = await loadDBAsync();
              setDb(loadedDb);
              setActiveFacilityId(loadedDb.data.facilities.activeFacilityId);
            }
          } catch (err) {
            console.error("Failed to sync DB from other tab", err);
          }
        }
      };

      const handleStorageChange = (e: StorageEvent) => {
        if ((e.key === DB_KEY_MAIN || e.key === `${DB_KEY_MAIN}_signal`) && e.newValue !== null) {
          loadDBAsync().then((loadedDb) => {
            setDb(loadedDb);
            setActiveFacilityId(loadedDb.data.facilities.activeFacilityId);
          }).catch(err => console.error("Failed to sync DB from other tab", err));
        }
      };
      window.addEventListener("storage", handleStorageChange);
      
      return () => {
        channel.close();
        window.removeEventListener("storage", handleStorageChange);
      };
    }
  }, []);

  // Remote reconciliation event listener
  useEffect(() => {
    const handleRemoteReconcile = (event: Event) => {
      const remoteDb = (event as CustomEvent<UnifiedDB>).detail;
      if (!remoteDb) return;
      console.log("[Providers] Applying remote DB from background reconciliation.");
      setDb(remoteDb);
      setActiveFacilityId(remoteDb.data.facilities.activeFacilityId);
    };
    window.addEventListener('db-reconciled-from-remote', handleRemoteReconcile);
    return () => window.removeEventListener('db-reconciled-from-remote', handleRemoteReconcile);
  }, []);

  const triggerReconciliation = useCallback((reason: string) => {
    // After a restore, the first reconciliation is skipped to prevent overwriting the restored data.
    if (didJustRestore.current) {
      console.log(`[Providers] Skipping initial reconciliation (${reason}) after backup restore.`);
      didJustRestore.current = false; // Allow subsequent reconciliations.
      return;
    }

    setDb(current => {
      if (!current) return current;
      console.log(`[Providers] Triggering remote reconciliation: ${reason}`);
      reconcileWithRemoteAsync(current, reason).catch((e) =>
        console.warn(`[Providers] Reconciliation failed (${reason}):`, e)
      );
      return current;
    });
  }, []);

  // Sync status event listener
  useEffect(() => {
    const handleStatusChange = (event: Event) => {
      setSyncStatus((event as CustomEvent<SyncStatus>).detail);
    };
    window.addEventListener('sync-status-changed', handleStatusChange);
    refreshSyncStatusFromStorage().catch(() => {});
    return () => window.removeEventListener('sync-status-changed', handleStatusChange);
  }, []);

  // Sync timer
  const dbRef = useRef<UnifiedDB | null>(null);
  useEffect(() => { dbRef.current = db; }, [db]);
  useEffect(() => {
    if (!db) return;
    startSyncTimer(() => dbRef.current, DEFAULT_SYNC_INTERVAL_MS);
    return () => stopSyncTimer();
  }, [!!db]);

  const triggerSync = useCallback(async () => {
    await triggerManualSync(() => dbRef.current);
  }, []);

  // Cross-device sync listener
  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      if (!user) return;
      const signalRef = fsDoc(firestoreDb, 'users', user.uid, 'meta', 'sync');
      unsubscribeSnapshot = onSnapshot(signalRef, (snapshot) => {
        if (snapshot.metadata.hasPendingWrites || !snapshot.exists()) return;
        if (snapshot.data()?.sessionId === SESSION_ID) return;
        console.log('[Providers] Cross-device change detected. Triggering reconciliation.');
        triggerReconciliation('firestore-signal');
      }, (err) => console.warn('[Providers] Firestore sync signal listener error:', err));
    });
    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, [triggerReconciliation]);

  // Reconciliation triggers
  useEffect(() => {
    const handleFocus = () => triggerReconciliation('window-focus');
    const handleOnline = () => triggerReconciliation('online');
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) triggerReconciliation('auth-state-change');
    });
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
      unsubscribeAuth();
    };
  }, [triggerReconciliation]);

  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  const updateDB = useCallback((updater: (draft: UnifiedDB) => void, meta?: MutationMeta) => {
    if (!db || !activeFacilityId) return Promise.resolve();

    try {
      const { nextDb, changedSlices, mainChanged } = commandHandlers.applyMutation(db, activeFacilityId, updater, meta);
      const prevDb = db;
      setDb(nextDb);
      setError(null);

      const savePromise = saveQueue.current.then(async () => {
        try {
          await commandHandlers.saveDatabase(nextDb, activeFacilityId, changedSlices, mainChanged);
        } catch (err) {
          console.error("DB_SAVE_FAILURE", err);
          window.dispatchEvent(new CustomEvent("DB_SAVE_FAILURE", { detail: err }));
          const msg = err instanceof Error ? err.message : "Failed to save database";
          setError(msg);
          setSaveErrorToast(msg);
          setDb(current => current === nextDb ? prevDb : current);
          throw err; 
        }
      });
      saveQueue.current = savePromise.catch(() => {});
      return savePromise;
    } catch (err) {
      console.error("DB_UPDATE_ERROR", err);
      const msg = err instanceof Error ? err.message : "Failed to update database";
      setError(msg);
      setSaveErrorToast(msg);
      return Promise.reject(err);
    }
  }, [db, activeFacilityId]);

  const setDB = useCallback((newDb: UnifiedDB): Promise<void> => {
    const prevDb = db;
    // This is the key change for restore: update both the DB object and the active facility ID.
    setDb(newDb);
    setActiveFacilityId(newDb.data.facilities.activeFacilityId);
    setError(null);

    const savePromise = saveQueue.current.then(async () => {
      try {
        // Force a full save, using the facility ID from the new DB object.
        await commandHandlers.saveDatabase(newDb, newDb.data.facilities.activeFacilityId, [], true);
      } catch (err) {
        console.error("DB_SAVE_FAILURE", err);
        window.dispatchEvent(new CustomEvent("DB_SAVE_FAILURE", { detail: err }));
        const msg = err instanceof Error ? err.message : "Failed to save database";
        setError(msg);
        setSaveErrorToast(msg);
        // Robust rollback: also restore the previous facility ID.
        setDb(current => {
          if (current === newDb) {
            setActiveFacilityId(prevDb?.data.facilities.activeFacilityId ?? null);
            return prevDb || current;
          }
          return current;
        });
        throw err;
      }
    });

    saveQueue.current = savePromise.catch(() => {});
    return savePromise;
  }, [db]);

  const handleRestore = () => commandHandlers.restorePrevious();
  const handleHardReset = () => commandHandlers.hardReset();

  if (isMigrationRequired) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-amber-200">
          <div className="bg-amber-50 p-6 text-center">
            <h2 className="text-xl font-bold text-amber-900">Migration Required</h2>
            <p className="text-sm text-amber-700 mt-2">{error}</p>
          </div>
          <div className="p-6">
            <button onClick={handleRestore} className="w-full flex items-center justify-center px-4 py-2 border rounded-md text-white bg-blue-600">
              Restore from Previous Snapshot
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isSafeMode) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-red-200">
          <div className="bg-red-50 p-6 text-center">
            <h2 className="text-xl font-bold text-red-900">Safe Mode</h2>
            <p className="text-sm text-red-700 mt-2">{error}</p>
          </div>
          <div className="p-6 space-y-4">
            <button onClick={handleRestore} className="w-full flex items-center justify-center px-4 py-2 border rounded-md text-white bg-blue-600">
              Restore from Previous Snapshot
            </button>
            <button onClick={handleHardReset} className="w-full flex items-center justify-center px-4 py-2 border text-red-700 bg-white">
              Hard Reset (Erase All Data)
            </button>
          </div>
        </div>
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
          {saveErrorToast && (
            <div className="fixed top-4 right-4 z-[9999] w-full max-w-sm">
              <div className="bg-red-50 border border-red-300 rounded-lg shadow-lg p-4">
                <p className="text-sm font-semibold text-red-900">Save Failed</p>
                <p className="text-xs text-red-700 mt-1">{saveErrorToast}</p>
                <button onClick={() => setSaveErrorToast(null)}><X className="h-4 w-4" /></button>
              </div>
            </div>
          )}
          {children}
        </SyncStatusContext.Provider>
      </FacilityContext.Provider>
    </DatabaseContext.Provider>
  );
}

export function useDatabase() {
  const context = useContext(DatabaseContext);
  if (!context) throw new Error("useDatabase must be used within AppProviders");
  return context;
}

export function useFacilityData() {
  const context = useContext(FacilityContext);
  if (!context) throw new Error("useFacilityData must be used within AppProviders");
  return context;
}

export function useSyncStatus() {
  const context = useContext(SyncStatusContext);
  if (!context) throw new Error("useSyncStatus must be used within AppProviders");
  return context;
}
