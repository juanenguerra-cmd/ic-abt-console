import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { UnifiedDB, FacilityStore } from "../domain/models";
import { loadDB, saveDB, restoreFromPrev, StorageError, SchemaMigrationError, DB_KEY_MAIN } from "../storage/engine";
import { AlertTriangle, RefreshCw, X } from "lucide-react";

interface DatabaseContextType {
  db: UnifiedDB;
  updateDB: (updater: (draft: UnifiedDB) => void) => void;
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
  const [crossTabAlert, setCrossTabAlert] = useState(false);

  useEffect(() => {
    try {
      const loadedDb = loadDB();
      setDb(loadedDb);
      setActiveFacilityId(loadedDb.data.facilities.activeFacilityId);
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
  }, []);

  // Multi-tab dirty-write guard: detect when another tab writes to localStorage
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === DB_KEY_MAIN && e.newValue !== null) {
        setCrossTabAlert(true);
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const updateDB = useCallback((updater: (draft: UnifiedDB) => void) => {
    if (!db) return;
    
    try {
      // Create a deep clone to act as our draft
      const nextDb = JSON.parse(JSON.stringify(db)) as UnifiedDB;
      updater(nextDb);
      
      // Attempt to save to storage engine
      saveDB(nextDb);
      
      // If successful, update React state
      setDb(nextDb);
      setError(null);
    } catch (err) {
      console.error("DB_SAVE_FAILURE", err);
      window.dispatchEvent(new CustomEvent("DB_SAVE_FAILURE", { detail: err }));
      const msg = err instanceof Error ? err.message : "Failed to save database";
      setError(msg);
      setSaveErrorToast(msg);
    }
  }, [db]);

  const setDB = useCallback((newDb: UnifiedDB) => {
    try {
      saveDB(newDb);
      setDb(newDb);
      setError(null);
    } catch (err) {
      console.error("DB_SAVE_FAILURE", err);
      window.dispatchEvent(new CustomEvent("DB_SAVE_FAILURE", { detail: err }));
      const msg = err instanceof Error ? err.message : "Failed to save database";
      setError(msg);
      setSaveErrorToast(msg);
    }
  }, []);

  const handleRestore = () => {
    if (restoreFromPrev()) {
      window.location.reload();
    } else {
      alert("No previous healthy snapshot found to restore.");
    }
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
  };

  return (
    <DatabaseContext.Provider value={{ db, updateDB, setDB, error }}>
      <FacilityContext.Provider value={{ activeFacilityId, setActiveFacilityId, store }}>
        {crossTabAlert && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-md px-4">
            <div className="bg-amber-50 border border-amber-300 rounded-lg shadow-lg p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900">Data changed in another tab</p>
                <p className="text-xs text-amber-700 mt-1">Another browser tab has modified the database. Reload to get the latest data and avoid overwriting changes.</p>
              </div>
              <button onClick={() => window.location.reload()} className="text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 px-2 py-1 rounded shrink-0">Reload</button>
              <button onClick={() => setCrossTabAlert(false)} className="text-amber-500 hover:text-amber-700 shrink-0"><X className="h-4 w-4" /></button>
            </div>
          </div>
        )}
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
