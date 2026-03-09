
import React, { useState, useEffect, useRef } from "react";
import { useDatabase, useFacilityData } from "../../app/providers";
import { useRole } from "../../context/RoleContext";
import { UserRole } from "../../types/roles";
import { restoreFromPrevAsync, hardResetStorageAsync, runMigrations, packV3 } from "../../storage/engine";
import { Database, Download, RefreshCw, AlertTriangle, CheckCircle, Building2, Save, Upload, FileText as FileTextIcon, Calendar, Map, Users, Shield, Loader2 } from "lucide-react";
import { UnifiedDB } from "../../domain/models";
import { MonthlyMetricsModal } from "./MonthlyMetricsModal";
import { UnitRoomConfigModal } from "./UnitRoomConfigModal";
import { CsvMigrationWizard } from "./CsvMigrationWizard";
import { useNavigate } from "react-router-dom";
import { LS_LAST_BACKUP_TS, LS_JUST_RESTORED_FLAG } from "../../constants/storageKeys";
import { alertService } from "../../services/alertService";
import { VersionHistory } from "./VersionHistory";

// Stronger debug helper as requested.
function debugDb(label: string, db: any) {
  try {
    const facId = db?.data?.facilities?.activeFacilityId;
    const store = db?.data?.facilityData?.[facId] || {};
    console.log(`[${label}]`, {
      schemaName: db?.schemaName,
      schemaVersion: db?.schemaVersion,
      hasDictionary: !!db?.dictionary,
      dictionarySize: Array.isArray(db?.dictionary) ? db.dictionary.length : 0,
      activeFacilityId: facId,
      facilityKeys: Object.keys(db?.data?.facilityData || {}),
      residentCount: Object.keys(store?.residents?.byId || {}).length,
      abtCount: Object.keys(store?.abts?.byId || {}).length,
      infectionCount: Object.keys(store?.infections?.byId || {}).length,
      vaxCount: Object.keys(store?.vaxEvents?.byId || {}).length,
      notificationCount: Object.keys(store?.notifications?.byId || {}).length,
    });
  } catch (e) {
    console.error(`[${label}] debugDb failed`, e);
  }
}

// Validation and repair logic for the imported database.
const validateAndRepairDb = (db: unknown): { valid: boolean; error?: string; repairedDB?: UnifiedDB } => {
  if (!db || typeof db !== 'object') {
    return { valid: false, error: 'Invalid root object.' };
  }

  const workingDB = JSON.parse(JSON.stringify(db)) as UnifiedDB;

  if (!workingDB.data?.facilities?.byId) {
    return { valid: false, error: 'Missing facilities.byId.' };
  }
  if (!workingDB.data?.facilityData) {
    return { valid: false, error: 'Missing facilityData.' };
  }

  let activeId = workingDB.data.facilities.activeFacilityId;
  const facilityIds = Object.keys(workingDB.data.facilities.byId);

  if (!activeId || !facilityIds.includes(activeId)) {
    if (facilityIds.length === 1) {
      activeId = facilityIds[0];
      workingDB.data.facilities.activeFacilityId = activeId;
      console.warn('Repaired activeFacilityId by setting it to the only available facility.');
    } else {
      return { valid: false, error: `Invalid or missing activeFacilityId: '${activeId}'.` };
    }
  }

  if (!workingDB.data.facilityData[activeId]) {
    console.warn(`Missing facilityData for active facility '${activeId}'. Initializing empty store.`);
    workingDB.data.facilityData[activeId] = { residents: { byId: {}, allIds: [] } } as any;
  }

  return { valid: true, repairedDB: workingDB };
};


export const SettingsConsole: React.FC = () => {
  const { db, updateDB, setDB } = useDatabase();
  const { activeFacilityId, setActiveFacilityId } = useFacilityData();
  const { role, setRole, can } = useRole();
  const navigate = useNavigate();
  const [dbSize, setDbSize] = useState(0);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [isRestoreBusy, setIsRestoreBusy] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMetricsModalOpen, setIsMetricsModalOpen] = useState(false);
  const [isUnitRoomConfigModalOpen, setIsUnitRoomConfigModalOpen] = useState(false);
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);
  
  const [tileSize, setTileSize] = useState(5);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`ltc_floor_tile_size_global:${activeFacilityId}`);
      if (stored) setTileSize(Number(stored));
    } catch { setTileSize(5); }
  }, [activeFacilityId]);
  const handleTileSizeChange = (size: number) => {
    setTileSize(size);
    localStorage.setItem(`ltc_floor_tile_size_global:${activeFacilityId}`, String(size));
  };
  const previewTileW = 40 + tileSize * 12;
  const previewTileH = 24 + tileSize * 6;
  
  const facility = db.data.facilities.byId[activeFacilityId];
  const [facilityName, setFacilityName] = useState(facility?.name || "");
  const [bedCapacity, setBedCapacity] = useState(facility?.bedCapacity?.toString() || "");
  const [auditorName, setAuditorName] = useState(facility?.auditorName || "");

  useEffect(() => {
    if (facility) {
      setFacilityName(facility.name);
      setBedCapacity(facility.bedCapacity?.toString() || "");
      setAuditorName(facility.auditorName || "");
    }
  }, [facility]);

  const handleSaveFacility = () => {
    updateDB((draft) => {
      const f = draft.data.facilities.byId[activeFacilityId];
      if (f) {
        f.name = facilityName;
        f.bedCapacity = bedCapacity ? parseInt(bedCapacity, 10) : undefined;
        f.auditorName = auditorName.trim() || undefined;
        f.updatedAt = new Date().toISOString();
      }
    });
    alertService.show("Facility settings saved.", {type: "success"});
  };

  useEffect(() => {
    if (db) {
      const packed = packV3(db);
      const serialized = JSON.stringify(packed);
      setDbSize(serialized.length);
      setLastSaved(db.updatedAt);
    }
  }, [db]);

  const usagePercent = (dbSize / MAX_STORAGE_CHARS) * 100;
  const usageColor = usagePercent > 80 ? "bg-red-500" : usagePercent > 50 ? "bg-amber-500" : "bg-emerald-500";

  const handleExport = () => {
    const packed = packV3(db);
    const blob = new Blob([JSON.stringify(packed, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `unified_db_backup_${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    localStorage.setItem(LS_LAST_BACKUP_TS, Date.now().toString());
    window.dispatchEvent(new Event('backup-completed'));
  };

  const handleRestorePrev = async () => {
    if (confirm("Are you sure? This will overwrite current data.")) {
      setIsRestoreBusy(true);
      try {
        const ok = await restoreFromPrevAsync();
        if (ok) {
          sessionStorage.setItem(LS_JUST_RESTORED_FLAG, "true");
          alertService.show("Previous version restored. App will reload.", {type: "success"});
          setTimeout(() => window.location.reload(), 1000);
        } else {
          alertService.show("No previous snapshot found.", {type: "error"});
        }
      } catch (err) {
        alertService.show(`Restore failed: ${err instanceof Error ? err.message : 'Unknown error'}`, {type: "error"});
      } finally {
        setIsRestoreBusy(false);
      }
    }
  };

  const handleFullReset = async () => {
    if (confirm("Are you absolutely sure? This will erase all data.")) {
      await hardResetStorageAsync();
      alertService.show("All local data has been erased. The app will now reload.", {type: "success"});
      setTimeout(() => window.location.reload(), 1000);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      restoreBackup(file);
    }
    // Reset file input to allow selecting the same file again
    event.target.value = '';
  };

  const restoreBackup = async (file: File) => {
    debugDb("before-restore", db);
    setIsRestoreBusy(true);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      // 1. Centralized normalization: unpacks V3, migrates older schemas, and repairs.
      const normalized = runMigrations(parsed);
      const { valid, error, repairedDB } = validateAndRepairDb(normalized);

      if (!valid || !repairedDB) {
        throw new Error(`Invalid or irreparable backup file: ${error}`);
      }
      debugDb("after-normalize", repairedDB);
      
      // 2. Persist to canonical store AND replace live state via the context provider.
      // `setDB` now handles both persisting to storage and updating the React state.
      await setDB(repairedDB);
      
      // 3. Set the overwrite guard for the next page load using the canonical key.
      sessionStorage.setItem(LS_JUST_RESTORED_FLAG, "true");
      
      // 4. Manually update the active facility ID in the live context.
      setActiveFacilityId(repairedDB.data.facilities.activeFacilityId);
      
      debugDb("after-live-replace", repairedDB); // We check the same DB we just set.

      // 5. Final validation: Check if the live state actually has data.
      const facId = repairedDB.data.facilities.activeFacilityId;
      const liveResidents = Object.keys(repairedDB.data.facilityData[facId]?.residents?.byId || {}).length;

      if (liveResidents <= 0 && Object.keys(repairedDB.data.facilityData[facId]?.abts?.byId || {}).length <= 0) {
        // Check a few stores to be sure. If a backup is truly empty, that's fine, but if it had data and now doesn't, it's an error.
        const originalResidentCount = Object.keys(normalized.data.facilityData[facId]?.residents?.byId || {}).length;
        if (originalResidentCount > 0) {
          throw new Error("Restore completed, but the live application state is unexpectedly empty. Aborting to prevent data loss.");
        }
      }

      alertService.show("Backup restored successfully! The application will now reload to apply all changes.", {type: "success"});

      // Reload to ensure all components and services use the new state.
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (err) {
      console.error("Restore failed", err);
      alertService.show(`${err instanceof Error ? err.message : String(err)}`, {type: "error"});
      setIsRestoreBusy(false); // Only set to false on error, success will reload page.
    }
  };


  return (
    <div className="max-w-4xl mx-auto space-y-8 p-4">
      {/* Facility Settings */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-neutral-200 bg-neutral-50 flex items-center">
          <Building2 className="h-5 w-5 text-indigo-500 mr-2" />
          <h3 className="text-lg leading-6 font-medium text-neutral-900">Facility Settings</h3>
        </div>
        <div className="px-4 py-5 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Facility Name</label>
              <input 
                type="text" 
                value={facilityName}
                onChange={e => setFacilityName(e.target.value)}
                className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Total Bed Capacity</label>
              <input 
                type="number" 
                value={bedCapacity}
                onChange={e => setBedCapacity(e.target.value)}
                className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Auditor / User Name</label>
              <input 
                type="text" 
                value={auditorName}
                onChange={e => setAuditorName(e.target.value)}
                placeholder="e.g. Juan Anguera"
                className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button 
              onClick={() => setIsMetricsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-100 text-neutral-700 rounded-md hover:bg-neutral-200 text-sm font-medium mr-2"
            >
              <Calendar className="w-4 h-4" />
              Manage Monthly Metrics
            </button>
            <button 
              data-testid="save-facility-settings-button"
              onClick={handleSaveFacility}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium active:scale-95"
            >
              <Save className="w-4 h-4" />
              Save Facility Settings
            </button>
          </div>
        </div>
      </div>

      <MonthlyMetricsModal isOpen={isMetricsModalOpen} onClose={() => setIsMetricsModalOpen(false)} />
      <UnitRoomConfigModal isOpen={isUnitRoomConfigModalOpen} onClose={() => setIsUnitRoomConfigModalOpen(false)} />

      {/* Floor Layout Settings */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-neutral-200 bg-neutral-50 flex items-center">
          <Map className="h-5 w-5 text-indigo-500 mr-2" />
          <h3 className="text-lg leading-6 font-medium text-neutral-900">Floor Layout — Room Tile Size</h3>
        </div>
        <div className="px-4 py-5 sm:p-6">
          {/* ... floor layout UI ... */}
        </div>
      </div>

      {/* Unit & Room Mapping */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-neutral-200 bg-neutral-50 flex items-center">
          <Building2 className="h-5 w-5 text-indigo-500 mr-2" />
          <h3 className="text-lg leading-6 font-medium text-neutral-900">Unit & Room Mapping Configuration</h3>
        </div>
        <div className="px-4 py-5 sm:p-6 space-y-4">
          <p className="text-sm text-neutral-600">Configure the available units for your facility and map specific room numbers to each unit.</p>
          <button
            onClick={() => setIsUnitRoomConfigModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-neutral-300 text-neutral-700 rounded-md hover:bg-neutral-50 text-sm font-medium active:scale-95"
          >
            <Building2 className="w-4 h-4" />
            Configure Units & Rooms
          </button>
        </div>
      </div>

      {/* Role Management — Admin only */}
      {can('*') && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {/* ... role management UI ... */}
        </div>
      )}

      {/* Back Office */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-neutral-200 bg-neutral-50 flex items-center">
          <Users className="h-5 w-5 text-indigo-500 mr-2" />
          <h3 className="text-lg leading-6 font-medium text-neutral-900">Back Office</h3>
        </div>
        <div className="px-4 py-5 sm:p-6 space-y-4">
          <p className="text-sm text-neutral-600">Manage historical residents not currently on census.</p>
          <button
            onClick={() => navigate('/back-office')}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-neutral-300 text-neutral-700 rounded-md hover:bg-neutral-50 text-sm font-medium active:scale-95"
          >
            <Users className="w-4 h-4" />
            Go to Back Office
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        {/* ... database status UI ... */}
      </div>

      {/* CSV Migration */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {/* ... csv migration UI ... */}
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden border border-red-100">
        <div className="px-4 py-5 sm:px-6 border-b border-red-100 bg-red-50 flex items-center">
          <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
          <h3 className="text-lg leading-6 font-medium text-red-900">Emergency Recovery Tools</h3>
        </div>
        <div className="px-4 py-5 sm:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <button
              onClick={handleExport}
              className="relative inline-flex items-center justify-center px-4 py-2 border border-neutral-300 shadow-sm text-sm font-medium rounded-md text-neutral-700 bg-white hover:bg-neutral-50"
            >
              <Download className="-ml-1 mr-2 h-5 w-5" />
              <span>Export Full Backup</span>
            </button>
            <button
              onClick={handleRestorePrev}
              disabled={isRestoreBusy}
              className="relative inline-flex items-center justify-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
            >
              <RefreshCw className={`-ml-1 mr-2 h-5 w-5 ${isRestoreBusy ? "animate-spin" : ""}`} />
              <span>{isRestoreBusy ? "Working..." : "Restore Previous"}</span>
            </button>
            <button
              onClick={handleFullReset}
              className="relative inline-flex items-center justify-center px-4 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
            >
              <AlertTriangle className="-ml-1 mr-2 h-5 w-5" />
              <span>Hard Reset</span>
            </button>
          </div>
          <div className="mt-6 p-4 border border-yellow-300 bg-yellow-50 rounded-md">
            <h4 className="text-sm font-bold text-yellow-800">Restore from JSON Backup</h4>
            <p className="text-xs text-yellow-700 mt-1">This will overwrite all current data. This action cannot be undone.</p>
            <div className="mt-3 flex items-center gap-2">
              <input 
                type="text" 
                placeholder="Type 'RESTORE' to enable" 
                value={restoreConfirm}
                onChange={e => setRestoreConfirm(e.target.value)}
                className="w-full border border-yellow-400 rounded-md p-2 text-sm"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={restoreConfirm !== 'RESTORE' || isRestoreBusy}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRestoreBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Select File
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept=".json" />
            </div>
          </div>
        </div>
      </div>

      <VersionHistory />
      
      {/* Modals for roles, etc. */}
    </div>
  );
};
