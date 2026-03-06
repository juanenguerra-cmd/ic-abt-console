import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import { UnifiedDB, FacilityStore, MutationLogEntry } from "../domain/models";
import { loadDBAsync, saveDBAsync, restoreFromPrevAsync, StorageError, SchemaMigrationError, DB_KEY_MAIN } from "../storage/engine";
import { AlertTriangle, RefreshCw, X } from "lucide-react";

const MAX_MUTATION_LOG_ENTRIES = 500;

interface MutationMeta {
  action: MutationLogEntry['action'];
  entityType: string;
  entityId: string;
  who?: string;
}

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

const DatabaseContext = createContext<DatabaseContextType | null>(null);
const FacilityContext = createContext<FacilityContextType | null>(null);

export function AppProviders({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<UnifiedDB | null>(null);
  const [activeFacilityId, setActiveFacilityId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSafeMode, setIsSafeMode] = useState(false);
  const [isMigrationRequired, setIsMigrationRequired] = useState(false);
  const [saveErrorToast, setSaveErrorToast] = useState<string | null>(null);

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
    const channel = new BroadcastChannel('ic_console_sync');
    channel.onmessage = (event) => {
      if (event.data.type === 'DB_UPDATED') {
        loadDBAsync().then((loadedDb) => {
          setDb(loadedDb);
          setActiveFacilityId(loadedDb.data.facilities.activeFacilityId);
        }).catch(err => console.error("Failed to sync DB from other tab", err));
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
  }, []);

  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  const updateDB = useCallback((updater: (draft: UnifiedDB) => void, meta?: MutationMeta) => {
    if (!db) return Promise.resolve();

    try {
      // Create a deep clone to act as our draft
      const nextDb = JSON.parse(JSON.stringify(db)) as UnifiedDB;
      updater(nextDb);

      // G8: Append mutation log entry to every active facility store.
      if (meta) {
        const entry: MutationLogEntry = {
          timestamp: new Date().toISOString(),
          who: meta.who ?? 'unknown',
          action: meta.action,
          entityType: meta.entityType,
          entityId: meta.entityId,
        };
        const activeFacilityId = nextDb.data.facilities.activeFacilityId;
        const facilityStore = nextDb.data.facilityData[activeFacilityId];
        if (facilityStore) {
          if (!facilityStore.mutationLog) facilityStore.mutationLog = [];
          facilityStore.mutationLog.push(entry);
          if (facilityStore.mutationLog.length > MAX_MUTATION_LOG_ENTRIES) {
            facilityStore.mutationLog = facilityStore.mutationLog.slice(-MAX_MUTATION_LOG_ENTRIES);
          }
        }
      }

      // Optimistically update React state immediately.
      const prevDb = db;
      setDb(nextDb);
      setError(null);

      // Sequential Save Queue: Ensure saves happen in order and don't collide.
      const savePromise = saveQueue.current.then(async () => {
        try {
          await saveDBAsync(nextDb);
          const channel = new BroadcastChannel('ic_console_sync');
          channel.postMessage({ type: 'DB_UPDATED' });
          channel.close();
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
  }, [db]);

  const setDB = useCallback((newDb: UnifiedDB) => {
    const prevDb = db;
    setDb(newDb);
    setError(null);

    const savePromise = saveQueue.current.then(async () => {
      try {
        await saveDBAsync(newDb);
        const channel = new BroadcastChannel('ic_console_sync');
        channel.postMessage({ type: 'DB_UPDATED' });
        channel.close();
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
  }, [db]);

  const handleRestore = () => {
    restoreFromPrevAsync().then((ok) => {
      if (ok) {
        window.location.reload();
      } else {
        alert("No previous healthy snapshot found to restore.");
      }
    });
  };

  const handleHardReset = () => {
    if (confirm("Are you absolutely sure? This will wipe all data and reset the application.")) {
      localStorage.clear();
      window.location.reload();
    }
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
