import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import { UnifiedDB, FacilityStore } from "../domain/models";
import { loadDBAsync, saveDBAsync, SchemaMigrationError, reconcileWithRemoteAsync } from "../storage/engine";
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

// Stronger debug helper
function debugDb(label: string, db: any) {
  try {
    const facId = db?.data?.facilities?.activeFacilityId;
    const store = db?.data?.facilityData?.[facId] || {};
    console.log(`[${label}]`, {
      schemaName: db?.schemaName,
      schemaVersion: db?.schemaVersion,
      activeFacilityId: facId,
      residentCount: Object.keys(store?.residents?.byId || {}).length,
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
  const [error, setError] = useState<string | null>(null);
  const [isSafeMode, setIsSafeMode] = useState(false);
  const [isMigrationRequired, setIsMigrationRequired] = useState(false);
  const [saveErrorToast, setSaveErrorToast] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus);
  const dbRef = useRef(db);
  dbRef.current = db;

  useEffect(() => {
    const bootstrapApp = async () => {
      const justRestored = sessionStorage.getItem(LS_JUST_RESTORED_FLAG) === "true";
      
      if (justRestored) {
        console.info("Skipping normal bootstrap because backup was just restored.");
        setTimeout(() => sessionStorage.removeItem(LS_JUST_RESTORED_FLAG), 500);
      }

      try {
        const loadedDb = await loadDBAsync({ skipRemoteReconciliation: justRestored });
        setDb(loadedDb);
        const facId = loadedDb.data.facilities.activeFacilityId;
        _setActiveFacilityId(facId);
        localStorage.setItem(LS_ACTIVE_FACILITY_ID, facId);
        debugDb("initial-load", loadedDb);
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

      setDb(nextDb); // Optimistic update

      try {
        await commandHandlers.saveDatabase(nextDb, activeFacilityId, changedSlices, mainChanged);
        setSaveErrorToast(null);
      } catch (e: any) {
        console.error("Failed to save database:", e);
        setSaveErrorToast(e.message || "An unknown error occurred during save.");
      }
    },
    [activeFacilityId],
  );

  const setDB = useCallback(async (newDb: UnifiedDB) => {
    await saveDBAsync(newDb, { skipRemote: true }); 
    setDb(newDb);
    const newFacId = newDb.data.facilities.activeFacilityId;
    _setActiveFacilityId(newFacId);
    localStorage.setItem(LS_ACTIVE_FACILITY_ID, newFacId);
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
    if (!db) return;
    setSyncStatus((s) => ({ ...s, isSyncing: true, status: "syncing" }));
    await triggerManualSync(db);
    setSyncStatus(refreshSyncStatusFromStorage());
  }, [db]);

  useEffect(() => {
    if (!db || !activeFacilityId) return;

    const unsub = onSnapshot(fsDoc(firestoreDb, `sync/${activeFacilityId}`), (snap) => {
      if (!snap.exists()) return;
      const signal = snap.data();
      if (signal.sessionId === SESSION_ID) return;
      if (signal.timestamp > (db.updatedAt || '')) {
        reconcileWithRemoteAsync(db).then((result) => {
            if (result.action === 'pull') {
                setSyncStatus(refreshSyncStatusFromStorage());
            }
        });
      }
    });

    return () => unsub();
  }, [db, activeFacilityId]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user && db) {
        reconcileWithRemoteAsync(db, 'auth').then(() => {
            setSyncStatus(refreshSyncStatusFromStorage());
        });
      }
    });
    return () => unsub();
  }, [db]);
  
  useEffect(() => {
    startSyncTimer(async () => {
      if (db) {
        await reconcileWithRemoteAsync(db, 'timer');
        setSyncStatus(refreshSyncStatusFromStorage());
      }
    });
    return () => stopSyncTimer();
  }, [db]);

  useEffect(() => {
    const channel = new BroadcastChannel('ic_console_sync');
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'DB_UPDATED' && db) {
        reconcileWithRemoteAsync(db, 'broadcast').then(() => {
          setSyncStatus(refreshSyncStatusFromStorage());
        });
      }
    };
    channel.addEventListener('message', handler);
    return () => channel.removeEventListener('message', handler);
  }, [db]);

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
