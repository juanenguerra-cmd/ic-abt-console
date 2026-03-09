import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import { UnifiedDB, FacilityStore } from "../domain/models";
import { loadDBAsync, SchemaMigrationError, DB_KEY_MAIN, reconcileWithRemoteAsync } from "../storage/engine";
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

interface DatabaseContextType {
  db: UnifiedDB;
  updateDB: (updater: (draft: UnifiedDB) => void, meta?: MutationMeta) => void;
  setDB: (db: UnifiedDB) => void;
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

  useEffect(() => {
    loadDBAsync()
      .then((loadedDb) => {
        setDb(loadedDb);
        setActiveFacilityId(loadedDb.data.facilities.activeFacilityId);
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

  // Multi-tab sync: detect when another tab writes to the database
  useEffect(() => {
    // This feature is disabled in development to prevent HMR issues.
    if (import.meta.env.PROD) {
      const channel = new BroadcastChannel('ic_console_sync');
      channel.onmessage = async (event) => {
        if (event.data.type === 'DB_UPDATED') {
          const { changedSlices, mainChanged } = event.data;
          
          try {
            if (!mainChanged && changedSlices && changedSlices.length > 0) {
              // Only specific slices changed, we can load just those slices and merge them
              // into our current state, avoiding a full database reload.
              const { StorageRepository } = await import('../storage/repository');
              
              // We need activeFacilityId, but we don't want to add it to deps.
              // We can get it from the current state using setDb.
              let currentFacilityId: string | null = null;
              setDb(currentDb => {
                if (currentDb) {
                  currentFacilityId = currentDb.data.facilities.activeFacilityId;
                }
                return currentDb;
              });
              
              if (!currentFacilityId) return;
              
              // Async load the changed slices
              const newSlices: any = {};
              for (const slice of changedSlices) {
                const data = await StorageRepository.loadSlice(currentFacilityId, slice);
                if (data) newSlices[slice] = data;
              }
              
              // Apply the loaded slices to the state
              setDb(currentDb => {
                if (!currentDb) return currentDb;
                const nextDb = JSON.parse(JSON.stringify(currentDb));
                const store = nextDb.data.facilityData[currentFacilityId!];
                if (store) {
                  for (const slice of changedSlices) {
                    if (newSlices[slice]) {
                      store[slice] = newSlices[slice];
                    }
                  }
                }
                return nextDb;
              });
              
            } else {
              // Full reload required
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

  // Remote reconciliation: apply a newer DB delivered by the background sync.
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

  // Stable helper that reads the current in-memory DB via the functional-updater
  // form of setDb (avoids stale closures) and kicks off an async reconciliation.
  // When reconciliation finds the remote is newer it dispatches the
  // `db-reconciled-from-remote` event handled above, which actually updates state.
  const triggerReconciliation = useCallback((reason: string) => {
    setDb(current => {
      if (!current) return current;
      console.log(`[Providers] Triggering remote reconciliation: ${reason}`);
      reconcileWithRemoteAsync(current, reason).catch((e) =>
        console.warn(`[Providers] Reconciliation failed (${reason}):`, e)
      );
      return current;
    });
  }, []); // empty deps — setDb is stable; reconcileWithRemoteAsync has no captured state

  // Subscribe to sync-status-changed events so the SyncStatusContext stays
  // in sync with the background service.
  useEffect(() => {
    const handleStatusChange = (event: Event) => {
      const detail = (event as CustomEvent<SyncStatus>).detail;
      if (detail) setSyncStatus(detail);
    };
    window.addEventListener('sync-status-changed', handleStatusChange);
    // Hydrate from IDB on mount so last-synced-at is visible immediately.
    refreshSyncStatusFromStorage().catch(() => {});
    return () => window.removeEventListener('sync-status-changed', handleStatusChange);
  }, []);

  // Start the periodic sync timer once the DB is loaded.
  // A stable getter (via ref) avoids re-creating the timer on every render.
  const dbRef = useRef<UnifiedDB | null>(null);
  useEffect(() => { dbRef.current = db; }, [db]);

  useEffect(() => {
    if (!db) return;
    startSyncTimer(() => dbRef.current, DEFAULT_SYNC_INTERVAL_MS);
    return () => stopSyncTimer();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!db]); // start once when db becomes available

  // triggerSync for manual "Sync Now" action exposed via context.
  const triggerSync = useCallback(async () => {
    await triggerManualSync(() => dbRef.current);
  }, []);

  // Realtime cross-device sync: subscribe to a Firestore signal document that
  // Device A writes after each successful save.  When Device B receives the
  // snapshot and the write originated from a different session, it triggers a
  // reconciliation so the UI reflects the remote changes without requiring a
  // manual page refresh, focus event, or reconnection.
  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      // Always tear down the previous listener when auth state changes.
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      if (!user) return;

      // Listen to users/{uid}/meta/sync — written by every device on save.
      const signalRef = fsDoc(firestoreDb, 'users', user.uid, 'meta', 'sync');
      unsubscribeSnapshot = onSnapshot(
        signalRef,
        (snapshot) => {
          // Skip writes that are still pending confirmation (i.e. our own write
          // before Firestore has acknowledged it).
          if (snapshot.metadata.hasPendingWrites) return;
          if (!snapshot.exists()) return;

          const data = snapshot.data();
          // Skip signals that this tab/session wrote — no reconciliation needed.
          if (data?.sessionId === SESSION_ID) return;

          console.log('[Providers] Cross-device change detected via Firestore listener. Triggering reconciliation.');
          triggerReconciliation('firestore-signal');
        },
        (err) => {
          console.warn('[Providers] Firestore sync signal listener error:', err);
        },
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, [triggerReconciliation]);

  // Retry outbox + reconcile on: window focus, coming back online, auth transitions.
  useEffect(() => {
    const handleFocus = () => triggerReconciliation('window-focus');
    const handleOnline = () => triggerReconciliation('online');

    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);

    // Auth transition: when the user logs in during an active session, replay
    // the outbox and reconcile so any local-only changes are pushed to remote.
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        triggerReconciliation('auth-state-change');
      }
    });

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
      unsubscribeAuth();
    };
  }, [triggerReconciliation]); // triggerReconciliation is stable (useCallback with empty deps)

  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  const updateDB = useCallback((updater: (draft: UnifiedDB) => void, meta?: MutationMeta) => {
    if (!db || !activeFacilityId) return Promise.resolve();

    try {
      const { nextDb, changedSlices, mainChanged } = commandHandlers.applyMutation(db, activeFacilityId, updater, meta);

      // Optimistically update React state immediately.
      const prevDb = db;
      setDb(nextDb);
      setError(null);

      // Sequential Save Queue: Ensure saves happen in order and don't collide.
      const savePromise = saveQueue.current.then(async () => {
        try {
          await commandHandlers.saveDatabase(nextDb, activeFacilityId, changedSlices, mainChanged);
        } catch (err) {
          console.error("DB_SAVE_FAILURE", err);
          window.dispatchEvent(new CustomEvent("DB_SAVE_FAILURE", { detail: err }));
          const msg = err instanceof Error ? err.message : "Failed to save database";
          setError(msg);
          setSaveErrorToast(msg);
          
          // Robust Rollback: Only roll back if the current state is still the one we just set.
          // If another updateDB has run in the meantime, rolling back to prevDb would lose data.
          setDb(current => {
            if (current === nextDb) return prevDb;
            return current;
          });
          throw err; 
        }
      });

      saveQueue.current = savePromise.catch(() => {
        // Catch queue errors to prevent the chain from breaking permanently
      });

      return savePromise;

    } catch (err) {
      console.error("DB_UPDATE_ERROR", err);
      const msg = err instanceof Error ? err.message : "Failed to update database";
      setError(msg);
      setSaveErrorToast(msg);
      return Promise.reject(err);
    }
  }, [db, activeFacilityId]);

  const setDB = useCallback((newDb: UnifiedDB) => {
    const prevDb = db;
    setDb(newDb);
    setError(null);

    const savePromise = saveQueue.current.then(async () => {
      try {
        await commandHandlers.saveDatabase(newDb, activeFacilityId || newDb.data.facilities.activeFacilityId, [], true); // Force full save
      } catch (err) {
        console.error("DB_SAVE_FAILURE", err);
        window.dispatchEvent(new CustomEvent("DB_SAVE_FAILURE", { detail: err }));
        const msg = err instanceof Error ? err.message : "Failed to save database";
        setError(msg);
        setSaveErrorToast(msg);
        setDb(current => {
          if (current === newDb) return prevDb || current;
          return current;
        });
        throw err;
      }
    });

    saveQueue.current = savePromise.catch(() => {});
    return savePromise;
  }, [db, activeFacilityId]);

  const handleRestore = () => {
    commandHandlers.restorePrevious();
  };

  const handleHardReset = () => {
    commandHandlers.hardReset();
  };

  if (isMigrationRequired) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-amber-200 overflow-hidden">
          <div className="bg-amber-50 p-6 border-b border-amber-100 flex flex-col items-center text-center">
            <div className="h-12 w-12 bg-amber-100 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-amber-900">Migration Required</h2>
            <p className="text-sm text-amber-700 mt-2">
              Your database schema is incompatible with this version of the application. Please contact support or restore from a backup before proceeding.
            </p>
          </div>
          <div className="p-6 space-y-4">
            <div className="bg-neutral-50 rounded-md p-3 border border-neutral-200">
              <p className="text-xs font-mono text-neutral-600 break-words">{error}</p>
            </div>
            <button
              onClick={handleRestore}
              className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Restore from Previous Snapshot
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isSafeMode) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-red-200 overflow-hidden">
          <div className="bg-red-50 p-6 border-b border-red-100 flex flex-col items-center text-center">
            <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-red-900">Safe Mode</h2>
            <p className="text-sm text-red-700 mt-2">
              The application failed to load due to database corruption or storage limits.
            </p>
          </div>
          <div className="p-6 space-y-4">
            <div className="bg-neutral-50 rounded-md p-3 border border-neutral-200">
              <p className="text-xs font-mono text-neutral-600 break-words">{error}</p>
            </div>
            
            <button
              onClick={handleRestore}
              className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Restore from Previous Snapshot
            </button>
            
            <button
              onClick={handleHardReset}
              className="w-full flex items-center justify-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
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

  const store = db.data.facilityData[activeFacilityId] || {
    residents: {},
    quarantine: {},
    abts: {},
    infections: {},
    vaxEvents: {},
    notes: {},
    staff: {},
    staffVaxEvents: {},
    fitTestEvents: {},
    auditSessions: {},
    outbreaks: {},
    outbreakCases: {},
    outbreakExposures: {},
    outbreakDailyStatuses: {},
    exportProfiles: {},
    surveyPackets: {},
    infectionControlAuditSessions: {},
    infectionControlAuditItems: {},
    notifications: {},
    contactTraceCases: {},
    contactTraceExposures: {},
  };

  return (
    <DatabaseContext.Provider value={{ db, updateDB, setDB, error }}>
      <FacilityContext.Provider value={{ activeFacilityId, setActiveFacilityId, store }}>
        <SyncStatusContext.Provider value={{ syncStatus, triggerSync }}>
          {saveErrorToast && (
            <div className="fixed top-4 right-4 z-[9999] w-full max-w-sm">
              <div className="bg-red-50 border border-red-300 rounded-lg shadow-lg p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-900">Save Failed</p>
                  <p className="text-xs text-red-700 mt-1 break-words">{saveErrorToast}</p>
                </div>
                <button onClick={() => setSaveErrorToast(null)} className="text-red-400 hover:text-red-600 shrink-0"><X className="h-4 w-4" /></button>
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
