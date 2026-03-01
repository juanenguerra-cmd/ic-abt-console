import React, { useState, useEffect, useRef } from "react";
import { useDatabase, useFacilityData } from "../../app/providers";
import { useRole } from "../../context/RoleContext";
import { UserRole } from "../../types/roles";
import { restoreFromPrevAsync } from "../../storage/engine";
import { Database, Download, RefreshCw, AlertTriangle, CheckCircle, Building2, Save, Upload, FileText as FileTextIcon, Calendar, Map, Users, Shield } from "lucide-react";
import { UnifiedDB } from "../../domain/models";
import { MonthlyMetricsModal } from "./MonthlyMetricsModal";
import { UnitRoomConfigModal } from "./UnitRoomConfigModal";
import { CsvMigrationWizard } from "./CsvMigrationWizard";
import { useNavigate } from "react-router-dom";
import { LS_LAST_BACKUP_TS } from "../../constants/storageKeys";

const MAX_STORAGE_CHARS = 5 * 1024 * 1024; // 5MB

const validateUnifiedDB = (db: unknown): { valid: boolean; error?: string } => {
  if (!db || typeof db !== "object") {
    return { valid: false, error: "Invalid database format" };
  }

  const parsedDB = db as Record<string, unknown>;
  const data = parsedDB.data as Record<string, unknown> | undefined;
  if (!data || typeof data !== "object") {
    return { valid: false, error: "Missing data object" };
  }

  const facilities = data.facilities as Record<string, unknown> | undefined;
  if (!facilities || typeof facilities !== "object") {
    return { valid: false, error: "Invalid facilities structure" };
  }

  const facilitiesById = facilities.byId as Record<string, unknown> | undefined;
  const activeFacilityId = facilities.activeFacilityId;
  if (!facilitiesById || typeof facilitiesById !== "object" || typeof activeFacilityId !== "string" || !activeFacilityId.trim()) {
    return { valid: false, error: "Invalid facilities structure" };
  }

  const facilityData = data.facilityData as Record<string, unknown> | undefined;
  if (!facilityData || typeof facilityData !== "object") {
    return { valid: false, error: "Missing facilityData object" };
  }

  const activeFacilityData = facilityData[activeFacilityId] as Record<string, unknown> | undefined;
  if (!activeFacilityData || typeof activeFacilityData !== "object") {
    return { valid: false, error: `Missing data for facility: ${activeFacilityId}` };
  }

  const requiredCollections = ["residents", "staff", "infections", "abts", "vaxEvents", "staffVaxEvents", "fitTestEvents", "notes"];
  for (const collection of requiredCollections) {
    const value = activeFacilityData[collection];
    if (value === undefined || value === null) {
      return { valid: false, error: `Missing or null collection: ${collection}` };
    }
    if (typeof value !== "object") {
      return { valid: false, error: `Invalid collection type: ${collection}` };
    }
  }

  return { valid: true };
};

export const SettingsConsole: React.FC = () => {
  const { db, updateDB, setDB } = useDatabase();
  const { activeFacilityId, store } = useFacilityData();
  const { role, setRole, can } = useRole();
  const navigate = useNavigate();
  const [dbSize, setDbSize] = useState(0);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMetricsModalOpen, setIsMetricsModalOpen] = useState(false);
  const [isUnitRoomConfigModalOpen, setIsUnitRoomConfigModalOpen] = useState(false);
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);
  
  // Global floor tile size (1–10, default 5)
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
  // Pixel dimensions for the current tile size (same formula as FloorMap)
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
    alert("Facility settings saved.");
  };

  useEffect(() => {
    if (db) {
      const serialized = JSON.stringify(db);
      setDbSize(serialized.length);
      setLastSaved(db.updatedAt);
    }
  }, [db]);

  const usagePercent = (dbSize / MAX_STORAGE_CHARS) * 100;
  const usageColor = usagePercent > 80 ? "bg-red-500" : usagePercent > 50 ? "bg-amber-500" : "bg-emerald-500";

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `unified_db_backup_${new Date().toISOString()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    localStorage.setItem(LS_LAST_BACKUP_TS, Date.now().toString());
  };

  const handleRestorePrev = () => {
    if (confirm("Are you sure you want to restore the previous snapshot? Current unsaved changes may be lost.")) {
      setIsRestoring(true);
      setTimeout(() => {
        restoreFromPrevAsync().then((ok) => {
          if (ok) {
            window.location.reload();
          } else {
            alert("No previous snapshot found.");
            setIsRestoring(false);
          }
        });
      }, 1000);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        let text = "";
        try {
          text = e.target?.result as string;
          const parsed = JSON.parse(text) as UnifiedDB;
          if (parsed.schemaVersion !== "UNIFIED_DB_V2") {
            alert("Invalid backup file: Schema version does not match.");
            return;
          }

          const validation = validateUnifiedDB(parsed);
          if (!validation.valid) {
            alert(`Invalid backup file: ${validation.error}`);
            console.error("Validation failed:", validation.error);
            return;
          }

          if (restoreConfirm === "RESTORE") {
            setDB(parsed);
            alert("Backup restored successfully.");
            setRestoreConfirm("");
          } else {
            alert("Please type RESTORE to confirm.");
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Unknown error";
          alert(`Error reading or parsing backup file: ${errorMsg}`);
          console.error("Restore error:", error);
          console.error("Parsed data preview:", text.substring(0, 500));
        }
      };
      reader.readAsText(file);
    }
    event.target.value = '';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
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
          <div className="flex flex-col sm:flex-row gap-8 items-start">
            {/* Slider control */}
            <div className="flex-1 space-y-3">
              <p className="text-sm text-neutral-600">
                Adjust how large each room tile appears on the live floor map. Move the slider to preview the exact size.
              </p>
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-neutral-500">Small</span>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={tileSize}
                  onChange={e => handleTileSizeChange(Number(e.target.value))}
                  className="flex-1 accent-indigo-600 h-2 cursor-pointer"
                />
                <span className="text-xs font-medium text-neutral-500">Large</span>
              </div>
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span>Size {tileSize} of 10</span>
                <span>{previewTileW} × {previewTileH} px</span>
              </div>
            </div>

            {/* Sample tile preview — actual pixel size */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Sample Tile</p>
              <div
                className="flex items-center justify-center rounded-xl border border-neutral-200 bg-neutral-100 transition-all duration-200"
                style={{
                  width: `${Math.max(previewTileW + 48, 120)}px`,
                  height: `${Math.max(previewTileH + 48, 96)}px`,
                }}
              >
                <div
                  style={{ width: `${previewTileW}px`, height: `${previewTileH}px` }}
                  className="relative flex flex-col items-center justify-center border-2 rounded shadow-sm bg-white border-neutral-300 text-neutral-600 transition-all duration-200 overflow-hidden"
                >
                  <span className="text-[9px] font-bold uppercase tracking-tighter opacity-50 leading-none">Room</span>
                  <span className="font-black leading-none" style={{ fontSize: `${Math.max(10, Math.min(previewTileH * 0.28, 18))}px` }}>1A</span>
                </div>
              </div>
              <p className="text-[10px] text-neutral-400">{previewTileW} × {previewTileH} px</p>
            </div>
          </div>
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
          <div className="px-4 py-5 sm:px-6 border-b border-neutral-200 bg-neutral-50 flex items-center">
            <Shield className="h-5 w-5 text-indigo-500 mr-2" />
            <h3 className="text-lg leading-6 font-medium text-neutral-900">Role Management</h3>
          </div>
          <div className="px-4 py-5 sm:p-6 space-y-4">
            <p className="text-sm text-neutral-600">Set the active user role for this session. Changing the role restricts access to features accordingly.</p>
            <div className="flex flex-wrap gap-3">
              {(['Viewer', 'Nurse', 'ICLead', 'Admin'] as UserRole[]).map((r) => (
                <button
                  key={r}
                  onClick={() => (r === 'Viewer' || r === 'Nurse') ? setPendingRole(r) : setRole(r)}
                  className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors active:scale-95 ${
                    role === r
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <p className="text-xs text-neutral-500">
              Current role: <strong>{role}</strong>. Viewer = read-only; Nurse = add/edit residents &amp; shift log; ICLead = + outbreaks, audits, exports; Admin = full access.
            </p>
          </div>
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
        <div className="px-4 py-5 sm:px-6 border-b border-neutral-200 bg-neutral-50 flex justify-between items-center">
          <div>
            <h3 className="text-lg leading-6 font-medium text-neutral-900">Database Status</h3>
            <p className="mt-1 max-w-2xl text-sm text-neutral-500">
              Local storage usage and integrity monitoring.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              usagePercent > 80 ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"
            }`}>
              {usagePercent > 80 ? "Storage Critical" : "Healthy"}
            </span>
          </div>
        </div>
        <div className="px-4 py-5 sm:p-6 space-y-6">
          <div>
            <div className="flex justify-between text-sm font-medium text-neutral-700 mb-1">
              <span>Storage Usage</span>
              <span>{usagePercent.toFixed(1)}% ({ (dbSize / 1024).toFixed(1) } KB / 5 MB)</span>
            </div>
            <div className="w-full bg-neutral-200 rounded-full h-2.5 overflow-hidden">
              <div className={`${usageColor} h-2.5 rounded-full transition-all duration-500`} style={{ width: `${usagePercent}%` }}></div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="bg-neutral-50 overflow-hidden rounded-lg border border-neutral-200 p-4 flex items-center">
              <div className="flex-shrink-0 bg-emerald-100 rounded-md p-3">
                <CheckCircle className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="ml-4 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-neutral-500 truncate">Last Successful Save</dt>
                  <dd className="flex items-baseline">
                    <div className="text-lg font-semibold text-neutral-900">
                      {lastSaved ? new Date(lastSaved).toLocaleTimeString() : "Never"}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>

            <div className="bg-neutral-50 overflow-hidden rounded-lg border border-neutral-200 p-4 flex items-center">
              <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                <Database className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-neutral-500 truncate">Schema Version</dt>
                  <dd className="flex items-baseline">
                    <div className="text-lg font-semibold text-neutral-900">
                      {db.schemaVersion}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CSV Migration */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-neutral-200 bg-neutral-50 flex items-center">
          <FileTextIcon className="h-5 w-5 text-indigo-500 mr-2" />
          <h3 className="text-lg leading-6 font-medium text-neutral-900">CSV Data Migration</h3>
        </div>
        <div className="px-4 py-5 sm:p-6 space-y-4">
          <p className="text-sm text-neutral-600">Download full migration templates for IP, ABT, and VAX, then import using a CSV mapper with preview and validation.</p>
          <CsvMigrationWizard />
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden border border-red-100">
        <div className="px-4 py-5 sm:px-6 border-b border-red-100 bg-red-50 flex items-center">
          <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
          <h3 className="text-lg leading-6 font-medium text-red-900">Emergency Recovery Tools</h3>
        </div>
        <div className="px-4 py-5 sm:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <button
              data-testid="export-backup-button"
              onClick={handleExport}
              className="relative inline-flex items-center justify-center px-4 py-2 border border-neutral-300 shadow-sm text-sm font-medium rounded-md text-neutral-700 bg-white hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 active:scale-95"
            >
              <Download className="-ml-1 mr-2 h-5 w-5 text-neutral-400" aria-hidden="true" />
              <span>Export Full Backup (JSON)</span>
            </button>

            <button
              data-testid="restore-snapshot-button"
              onClick={handleRestorePrev}
              disabled={isRestoring}
              className="relative inline-flex items-center justify-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 active:scale-95"
            >
              <RefreshCw className={`-ml-1 mr-2 h-5 w-5 ${isRestoring ? "animate-spin" : ""}`} aria-hidden="true" />
              <span>{isRestoring ? "Restoring..." : "Restore Previous Snapshot"}</span>
            </button>
          </div>
          <div className="mt-6 p-4 border border-yellow-300 bg-yellow-50 rounded-md">
            <h4 className="text-sm font-bold text-yellow-800">Restore from JSON Backup</h4>
            <p className="text-xs text-yellow-700 mt-1">This will completely overwrite all current data. This action cannot be undone.</p>
            <div className="mt-3 flex items-center gap-2">
              <input 
                type="text" 
                placeholder="Type 'RESTORE' to enable" 
                value={restoreConfirm}
                onChange={e => setRestoreConfirm(e.target.value)}
                className="w-full border border-yellow-400 rounded-md p-2 text-sm"
              />
              <button
                data-testid="select-restore-file-button"
                onClick={() => fileInputRef.current?.click()}
                disabled={restoreConfirm !== 'RESTORE'}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              >
                <Upload className="w-4 h-4" />
                Select File
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
            </div>
          </div>
          <p className="mt-4 text-xs text-neutral-500">
            <strong>Note:</strong> "Restore Previous Snapshot" will revert the database to the state immediately before the last save operation. Use this if you accidentally deleted data or encountered a save error.
          </p>
        </div>
      </div>
      {pendingRole && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setPendingRole(null)}
          onKeyDown={(e) => e.key === 'Escape' && setPendingRole(null)}
          role="presentation"
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 space-y-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pending-role-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-amber-500 flex-shrink-0" />
              <h2 id="pending-role-modal-title" className="text-lg font-semibold text-neutral-900">Restricted Role Warning</h2>
            </div>
            <p className="text-sm text-neutral-700">
              Switching to <strong>{pendingRole}</strong> will limit your access. You may lose access to Settings and other features. Use Admin to restore full access.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setPendingRole(null)}
                className="px-4 py-2 rounded-md text-sm font-medium border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={() => { setRole(pendingRole); setPendingRole(null); }}
                className="px-4 py-2 rounded-md text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 active:scale-95"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
