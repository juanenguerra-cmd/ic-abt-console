import React, { useState, useEffect } from "react";
import { useDatabase } from "../../app/providers";
import { restoreFromPrev } from "../../storage/engine";
import { Database, Download, RefreshCw, AlertTriangle, CheckCircle } from "lucide-react";

const MAX_STORAGE_CHARS = 5 * 1024 * 1024; // 5MB

export const SettingsConsole: React.FC = () => {
  const { db, updateDB } = useDatabase();
  const [dbSize, setDbSize] = useState(0);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

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

  return (
    <div className="max-w-4xl mx-auto space-y-8">
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

      <div className="bg-white shadow rounded-lg overflow-hidden border border-red-100">
        <div className="px-4 py-5 sm:px-6 border-b border-red-100 bg-red-50 flex items-center">
          <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
          <h3 className="text-lg leading-6 font-medium text-red-900">Emergency Recovery Tools</h3>
        </div>
        <div className="px-4 py-5 sm:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <button
              onClick={handleExport}
              className="relative inline-flex items-center justify-center px-4 py-2 border border-neutral-300 shadow-sm text-sm font-medium rounded-md text-neutral-700 bg-white hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
            >
              <Download className="-ml-1 mr-2 h-5 w-5 text-neutral-400" aria-hidden="true" />
              <span>Export Full Backup (JSON)</span>
            </button>

            <button
              onClick={handleRestorePrev}
              disabled={isRestoring}
              className="relative inline-flex items-center justify-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
            >
              <RefreshCw className={`-ml-1 mr-2 h-5 w-5 ${isRestoring ? "animate-spin" : ""}`} aria-hidden="true" />
              <span>{isRestoring ? "Restoring..." : "Restore Previous Snapshot"}</span>
            </button>
          </div>
          <p className="mt-4 text-xs text-neutral-500">
            <strong>Note:</strong> "Restore Previous Snapshot" will revert the database to the state immediately before the last save operation. Use this if you accidentally deleted data or encountered a save error.
          </p>
        </div>
      </div>
    </div>
  );
};
