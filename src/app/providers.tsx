import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { UnifiedDB, FacilityStore } from "../domain/models";
import { loadDB, saveDB, restoreFromPrev, StorageError } from "../storage/engine";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface DatabaseContextType {
  db: UnifiedDB;
  updateDB: (updater: (draft: UnifiedDB) => void) => void;
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

  useEffect(() => {
    try {
      const loadedDb = loadDB();
      setDb(loadedDb);
      setActiveFacilityId(loadedDb.data.facilities.activeFacilityId);
    } catch (err) {
      console.error("Failed to load DB:", err);
      setIsSafeMode(true);
      setError(err instanceof Error ? err.message : "Unknown database error");
    }
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
      console.error("Failed to update DB:", err);
      setError(err instanceof Error ? err.message : "Failed to save database");
    }
  }, [db]);

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

  const store = db.data.facilityData[activeFacilityId];

  return (
    <DatabaseContext.Provider value={{ db, updateDB, error }}>
      <FacilityContext.Provider value={{ activeFacilityId, setActiveFacilityId, store }}>
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
