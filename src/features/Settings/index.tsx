import React, { useState, useEffect, useRef } from "react";
import { useDatabase, useFacilityData } from "../../app/providers";
import { restoreFromPrev } from "../../storage/engine";
import { Database, Download, RefreshCw, AlertTriangle, CheckCircle, Building2, Save, Upload, FileText as FileTextIcon, Calendar } from "lucide-react";
import { UnifiedDB, ABTCourse, IPEvent, VaxEvent } from "../../domain/models";
import { v4 as uuidv4 } from 'uuid';
import { MonthlyMetricsModal } from "./MonthlyMetricsModal";

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
        if (restoreFromPrev()) {
          window.location.reload();
        } else {
          alert("No previous snapshot found.");
          setIsRestoring(false);
        }
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

  const handleCsvImport = (file: File, type: 'ABT' | 'IP' | 'VAX') => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = text.split('\n').slice(1); // Skip header
      updateDB(draft => {
        rows.forEach(row => {
          const cols = row.split(',');
          const mrn = cols[0];
          if (!draft.data.facilityData[activeFacilityId].residents[mrn]) {
            console.warn(`Orphaned record found for MRN: ${mrn}. Skipping.`);
            return;
          }
          const id = uuidv4();
          const residentRef: { kind: 'mrn'; id: string } = { kind: 'mrn', id: mrn };
          
          if (type === 'ABT') {
            const newAbt: ABTCourse = { id, residentRef, medication: cols[1], startDate: cols[2], status: 'completed', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            draft.data.facilityData[activeFacilityId].abts[id] = newAbt;
          } else if (type === 'IP') {
            const newIp: IPEvent = { id, residentRef, infectionSite: cols[1], organism: cols[2], status: 'resolved', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            draft.data.facilityData[activeFacilityId].infections[id] = newIp;
          } else if (type === 'VAX') {
            const newVax: VaxEvent = { id, residentRef, vaccine: cols[1], dateGiven: cols[2], status: 'given', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            draft.data.facilityData[activeFacilityId].vaxEvents[id] = newVax;
          }
        });
      });
      alert(`${type} data imported successfully.`);
    };
    reader.readAsText(file);
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
          <p className="text-sm text-neutral-600">Import historical data from CSV files. The first column must be 'mrn'.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <CsvUploader label="ABT History" onFileUpload={(file) => handleCsvImport(file, 'ABT')} templateCsv={`mrn,medication,startDate`}/>
            <CsvUploader label="IP History" onFileUpload={(file) => handleCsvImport(file, 'IP')} templateCsv={`mrn,infectionSite,organism`} />
            <CsvUploader label="Vax History" onFileUpload={(file) => handleCsvImport(file, 'VAX')} templateCsv={`mrn,vaccine,dateGiven`} />
          </div>
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

const CsvUploader = ({ label, onFileUpload, templateCsv }: { label: string, onFileUpload: (file: File) => void, templateCsv: string }) => {
  const ref = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      onFileUpload(file);
    }
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([templateCsv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${label.toLowerCase().replace(' ', '_')}_template.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="text-center p-4 border-2 border-dashed border-neutral-300 rounded-lg flex flex-col justify-between">
      <div>
        <p className="text-sm font-medium text-neutral-800 mb-2">{label}</p>
        <button 
          data-testid={`upload-csv-button-${label.toLowerCase().replace(' ', '-')}`}
          onClick={() => ref.current?.click()}
          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
        >
          {fileName ? 'Replace File' : 'Upload CSV'}
        </button>
        {fileName && <p className="text-xs text-neutral-500 mt-1 truncate">{fileName}</p>}
        <input type="file" ref={ref} onChange={handleChange} className="hidden" accept=".csv" />
      </div>
      <button data-testid={`download-template-button-${label.toLowerCase().replace(' ', '-')}`} onClick={handleDownloadTemplate} className="mt-2 text-xs text-neutral-500 hover:text-neutral-700 active:scale-95">Download Template</button>
    </div>
  )
}
