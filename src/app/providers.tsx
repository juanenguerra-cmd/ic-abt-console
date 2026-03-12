import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import { UnifiedDB, FacilityStore, Facility } from "../domain/models";
import { loadDBAsync, saveDBAsync, SchemaMigrationError, reconcileWithRemoteAsync } from "../storage/engine";
import { STORAGE_SLICES } from "../storage/repository";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { commandHandlers, MutationMeta, SESSION_ID } from "../services/commandHandlers";
import { onSnapshot, doc as fsDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db as firestoreDb, waitForAuthReady } from "../services/firebase";
import {
  startSyncTimer,
  stopSyncTimer,
  triggerManualSync,
  refreshSyncStatusFromStorage,
  getSyncStatus,
  SyncStatus,
} from "../services/syncService";
import { LS_JUST_RESTORED_FLAG, LS_ACTIVE_FACILITY_ID } from "../constants/storageKeys";

const TOAST_AUTO_DISMISS_MS = 4_000;
let _bootstrapPromise: Promise<UnifiedDB> | null = null;

const bootstrapApp = async (): Promise<UnifiedDB> => {
  const justRestored = sessionStorage.getItem(LS_JUST_RESTORED_FLAG) === "true";
  if (justRestored) {
    console.info("[Bootstrap] Skipping remote reconciliation: backup was just restored.");
    sessionStorage.removeItem(LS_JUST_RESTORED_FLAG);
  }
  try {
    const loadedDb = await loadDBAsync({ skipRemoteReconciliation: justRestored });
    if (!loadedDb.data.facilities.activeFacilityId) {
      console.warn("[Bootstrap] No active facility found, creating a default one.");
      const newFacility: Facility = {
        id: `fac-${new Date().getTime()}`,
        name: "My Facility",
        units: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      loadedDb.data.facilities.byId[newFacility.id] = newFacility;
      loadedDb.data.facilities.activeFacilityId = newFacility.id;
      loadedDb.data.facilityData[newFacility.id] = {
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
        lineListEvents: {},
      };
    }

    return loadedDb;
  } catch (err) {
    console.error("Failed to load DB:", err);
    throw err;
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
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSafeMode, setIsSafeMode] = useState(false);
  const [isMigrationRequired, setIsMigrationRequired] = useState(false);
  const [saveErrorToast, setSaveErrorToast] = useState<string | null>(null);
  const [appToast, setAppToast] = useState<{ message: string; type: string } | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus);

  const dbRef = useRef(db);
  dbRef.current = db;

  const isRestoringRef = useRef(false);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!_bootstrapPromise) {
      _bootstrapPromise = bootstrapApp();
    }

    _bootstrapPromise.then((loadedDb) => {
      dbRef.current = loadedDb; 
      setDb(loadedDb);
      const facId = loadedDb.data.facilities.activeFacilityId;
      _setActiveFacilityId(facId);
      localStorage.setItem(LS_ACTIVE_FACILITY_ID, facId);
    }).catch(err => {
      if (err instanceof SchemaMigrationError) {
        setIsMigrationRequired(true);
        setError(err.message);
      } else {
        setIsSafeMode(true);
        setError(err instanceof Error ? err.message : "Unknown database error");
      }
    });
  }, []); 

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      const uid = user?.uid ?? null;
      setUserId(uid);
      if (user && dbRef.current && !isRestoringRef.current) {
        reconcileWithRemoteAsync(dbRef.current, 'auth').then(async () => {
          await refreshSyncStatusFromStorage();
          setSyncStatus(getSyncStatus());
        }).catch(err => console.warn('[Sync] Auth-triggered reconciliation failed:', err));
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!userId || !activeFacilityId) return;

    let unsub: (() => void) | null = null;
    try {
      unsub = onSnapshot(fsDoc(firestoreDb, 'users', userId, 'meta', 'sync'), (snap) => {
        if (!snap.exists()) return;
        const signal = snap.data();
        if (signal.sessionId === SESSION_ID) return;
        const currentDb = dbRef.current;
        if (!currentDb || isRestoringRef.current) return;
        if ((signal.lastUpdatedAt || '') > (currentDb.updatedAt || '')) {
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
        unsub();
      }
    };
  }, [userId, activeFacilityId]); 

  useEffect(() => {
    const startTimer = async () => {
      const user = await waitForAuthReady();
      if (user) {
        startSyncTimer(() => (isRestoringRef.current ? null : dbRef.current));
      } else {
        console.warn('Skipping periodic sync: auth is not available.');
      }
    };

    startTimer();

    return () => {
      stopSyncTimer();
    };
  }, [userId]);

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
      channel.close(); 
    };
  }, []); 

  useEffect(() => {
    const handleOnline = () => {
      const currentDb = dbRef.current;
      if (!currentDb || isRestoringRef.current) return;
      reconcileWithRemoteAsync(currentDb, 'online').then(async () => {
        await refreshSyncStatusFromStorage();
        setSyncStatus(getSyncStatus());
      }).catch(err => console.warn('[Sync] Online-triggered reconciliation failed:', err));
    };
    const handleFocus = () => {
      const currentDb = dbRef.current;
      if (!currentDb || isRestoringRef.current) return;
      reconcileWithRemoteAsync(currentDb, 'focus').then(async () => {
        await refreshSyncStatusFromStorage();
        setSyncStatus(getSyncStatus());
      }).catch(err => console.warn('[Sync] Focus-triggered reconciliation failed:', err));
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  useEffect(() => {
    const handler = () => {
      setSyncStatus(getSyncStatus());
    };
    window.addEventListener('sync-status-changed', handler);
    return () => window.removeEventListener('sync-status-changed', handler);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const { message, type } = (e as CustomEvent<{ message: string; type: string }>).detail ?? {};
      if (!message) return;
      setAppToast({ message, type: type ?? 'info' });
      setTimeout(() => setAppToast(null), TOAST_AUTO_DISMISS_MS);
    };
    window.addEventListener('app-toast', handler);
    return () => window.removeEventListener('app-toast', handler);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      if (isRestoringRef.current) return;
      const remoteDb = (e as CustomEvent<UnifiedDB>).detail;
      if (!remoteDb) return;
      dbRef.current = remoteDb; 
      setDb(remoteDb);
      const facId = remoteDb.data?.facilities?.activeFacilityId;
      if (facId) {
        _setActiveFacilityId(facId);
        localStorage.setItem(LS_ACTIVE_FACILITY_ID, facId);
      }
    };
    window.addEventListener('db-reconciled-from-remote', handler);
    return () => window.removeEventListener('db-reconciled-from-remote', handler);
  }, []);

  const updateDB = useCallback(
    async (updater: (draft: UnifiedDB) => void, meta?: MutationMeta) => {
      if (!dbRef.current || !activeFacilityId) return;

      const { nextDb, changedSlices, mainChanged } = commandHandlers.applyMutation(
        dbRef.current,
        activeFacilityId,
        updater,
        meta,
      );

      dbRef.current = nextDb;
      setDb(nextDb); 

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
    isRestoringRef.current = true;
    try {
      newDb.updatedAt = new Date().toISOString();
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
      
      dbRef.current = newDb;
      setDb(newDb);
      _setActiveFacilityId(newFacId);
      localStorage.setItem(LS_ACTIVE_FACILITY_ID, newFacId);
    } finally {
      setTimeout(() => {
        isRestoringRef.current = false;
      }, 5000);
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
                onClick={() => window.location.reload()}
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
                      <X className="h-4 h-4" />
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
