import React, { useState, useEffect, useRef } from "react";
import { useDatabase, useFacilityData } from "../../app/providers";
import { restoreFromPrevAsync } from "../../storage/engine";
import { Database, Download, RefreshCw, AlertTriangle, CheckCircle, Building2, Save, Upload, FileText as FileTextIcon, Calendar, Map } from "lucide-react";
import { UnifiedDB } from "../../domain/models";
import { MonthlyMetricsModal } from "./MonthlyMetricsModal";
import { UnitRoomConfigModal } from "./UnitRoomConfigModal";
import { CsvMigrationWizard } from "./CsvMigrationWizard";

const MAX_STORAGE_CHARS = 5 * 1024 * 1024; // 5MB

export const SettingsConsole: React.FC = () => {
  const { db, updateDB, setDB } = useDatabase();
  const { activeFacilityId, store } = useFacilityData();
  const [dbSize, setDbSize] = useState(0);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMetricsModalOpen, setIsMetricsModalOpen] = useState(false);
  const [isUnitRoomConfigModalOpen, setIsUnitRoomConfigModalOpen] = useState(false);
  
  // Floor tile sizes
  const [tileSizes, setTileSizes] = useState<Record<string, number>>({});
  useEffect(() => {
    try { setTileSizes(JSON.parse(localStorage.getItem(`ltc_floor_tile_sizes_v1:${activeFacilityId}`) || '{}')); } catch { setTileSizes({}); }
  }, [activeFacilityId]);
  const saveTileSizes = (sizes: Record<string, number>) => {
    setTileSizes(sizes);
    localStorage.setItem(`ltc_floor_tile_sizes_v1:${activeFacilityId}`, JSON.stringify(sizes));
  };
  
  const facility = db.data.facilities.byId[activeFacilityId];
  const [facilityName, setFacilityName] = useState(facility?.name || "");
  const [bedCapacity, setBedCapacity] = useState(facility?.bedCapacity?.toString() || "");

  useEffect(() => {
    if (facility) {
      setFacilityName(facility.name);
      setBedCapacity(facility.bedCapacity?.toString() || "");
    }
  }, [facility]);

  const handleSaveFacility = () => {
    updateDB((draft) => {
      const f = draft.data.facilities.byId[activeFacilityId];
      if (f) {
        f.name = facilityName;
        f.bedCapacity = bedCapacity ? parseInt(bedCapacity, 10) : undefined;
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
    localStorage.setItem('ltc_last_backup_timestamp', Date.now().toString());
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
        try {
          const text = e.target?.result as string;
          const parsed = JSON.parse(text) as UnifiedDB;
          if (parsed.schemaVersion !== 'UNIFIED_DB_V2') {
            alert('Invalid backup file: Schema version does not match.');
            return;
          }
          if (restoreConfirm.toUpperCase() === 'RESTORE') {
            setDB(parsed);
            alert('Backup restored successfully.');
            setRestoreConfirm('');
          } else {
            alert('Please type RESTORE to confirm.');
          }
        } catch (error) {
          alert('Error reading or parsing backup file.');
          console.error(error);
        }
      };
      reader.readAsText(file);
    }
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
          <h3 className="text-lg leading-6 font-medium text-neutral-900">Floor Layout — Room Tile Sizes</h3>
        </div>
        <div className="px-4 py-5 sm:p-6 space-y-4">
          <p className="text-sm text-neutral-600">Configure the visual tile size for each room on the floor map (1 = smallest, 10 = largest).</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {(() => {
              // Collect all rooms from residents and stored config
              const roomSet = new Set<string>();
              Object.values(store.residents).forEach(r => { if (r.currentRoom) roomSet.add(r.currentRoom); });
              try {
                const stored = localStorage.getItem('ltc_facility_rooms_config');
                if (stored) {
                  const mapping = JSON.parse(stored);
                  Object.values(mapping).forEach((roomsStr: any) => {
                    roomsStr.split(',').map((s: string) => s.trim()).filter(Boolean).forEach((r: string) => roomSet.add(r));
                  });
                }
              } catch {}
              const rooms = Array.from(roomSet).sort();
              if (rooms.length === 0) return <p className="text-sm text-neutral-400 col-span-3">No rooms configured yet.</p>;
              return rooms.map(room => {
                const size = tileSizes[room] ?? 5;
                return (
                  <div key={room} className="flex flex-col gap-2 bg-neutral-50 border border-neutral-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-neutral-700">Room {room}</span>
                      <span className="text-xs text-neutral-500">{size}</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={size}
                      onChange={e => saveTileSizes({ ...tileSizes, [room]: Number(e.target.value) })}
                      className="w-full"
                    />
                    {/* Live preview */}
                    <div className="flex justify-center">
                      <div
                        style={{ width: `${size * 8}px`, height: `${size * 8}px` }}
                        className="bg-indigo-400 rounded-sm transition-all duration-200"
                        title={`Tile preview: size ${size}`}
                      />
                    </div>
                  </div>
                );
              });
            })()}
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
                disabled={restoreConfirm.toUpperCase() !== 'RESTORE'}
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
    </div>
  );
};
