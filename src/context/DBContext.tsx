import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { UnifiedDB, FacilityStore } from "../domain/models";
import { loadDB, saveDB, createEmptyDB } from "../services/db";

interface DBContextType {
  db: UnifiedDB;
  activeFacilityId: string;
  store: FacilityStore;
  updateDB: (updater: (draft: UnifiedDB) => void) => boolean;
}

const DBContext = createContext<DBContextType | null>(null);

export function DBProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<UnifiedDB>(createEmptyDB());

  useEffect(() => {
    setDb(loadDB());
  }, []);

  const updateDB = (updater: (draft: UnifiedDB) => void) => {
    const nextDb = JSON.parse(JSON.stringify(db)) as UnifiedDB; // Simple deep clone
    updater(nextDb);
    const success = saveDB(nextDb);
    if (success) {
      setDb(nextDb);
    } else {
      console.error("Failed to commit DB update.");
    }
    return success;
  };

  const activeFacilityId = db.data.facilities.activeFacilityId;
  const store = db.data.facilityData[activeFacilityId];

  return (
    <DBContext.Provider value={{ db, activeFacilityId, store, updateDB }}>
      {children}
    </DBContext.Provider>
  );
}

export function useDB() {
  const context = useContext(DBContext);
  if (!context) {
    throw new Error("useDB must be used within a DBProvider");
  }
  return context;
}
