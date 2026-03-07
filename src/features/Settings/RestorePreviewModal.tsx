import React from "react";
import { UnifiedDB } from "../../domain/models";
import { AlertTriangle, CheckCircle, X } from "lucide-react";

interface RestorePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  currentDB: UnifiedDB;
  backupDB: UnifiedDB | null;
  backupMetadata?: any;
}

export const RestorePreviewModal: React.FC<RestorePreviewModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  currentDB,
  backupDB,
  backupMetadata,
}) => {
  if (!isOpen || !backupDB) return null;

  const getCount = (db: UnifiedDB, collection: string) => {
    let count = 0;
    for (const facilityId of Object.keys(db.data.facilityData)) {
      const store = db.data.facilityData[facilityId];
      if (store && (store as any)[collection]) {
        count += Object.keys((store as any)[collection]).length;
      }
    }
    return count;
  };

  const collections = [
    { key: "residents", label: "Residents" },
    { key: "staff", label: "Staff" },
    { key: "infections", label: "Infections" },
    { key: "abts", label: "ABT Courses" },
    { key: "vaxEvents", label: "Vaccinations" },
    { key: "notes", label: "Notes" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50 rounded-t-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-neutral-900">Preview Restore</h2>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1">
          <p className="text-sm text-neutral-600 mb-6">
            You are about to restore a backup from <strong>{new Date(backupDB.updatedAt).toLocaleString()}</strong>.
            This will overwrite your current database. Please review the differences below before confirming.
          </p>

          {backupMetadata && (
            <div className="mb-6 bg-neutral-50 border border-neutral-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-neutral-900 mb-2">Backup Metadata</h3>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <dt className="text-neutral-500 inline">Exported By: </dt>
                  <dd className="text-neutral-900 inline font-medium">{backupMetadata.exportedBy || 'Unknown'}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500 inline">Facility: </dt>
                  <dd className="text-neutral-900 inline font-medium">{backupMetadata.facilityName || 'Unknown'}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500 inline">App Version: </dt>
                  <dd className="text-neutral-900 inline font-medium">{backupMetadata.appVersion || 'Unknown'}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500 inline">Size: </dt>
                  <dd className="text-neutral-900 inline font-medium">
                    {backupMetadata.sizeBytes ? `${(backupMetadata.sizeBytes / 1024).toFixed(1)} KB` : 'Unknown'}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          <div className="border border-neutral-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Data Type</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">Current DB</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">Backup DB</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">Difference</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200">
                {collections.map(({ key, label }) => {
                  const currentCount = getCount(currentDB, key);
                  const backupCount = getCount(backupDB, key);
                  const diff = backupCount - currentCount;
                  
                  return (
                    <tr key={key}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-900">{label}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-neutral-500">{currentCount}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-neutral-900 font-medium">{backupCount}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          diff > 0 ? 'bg-emerald-100 text-emerald-800' : 
                          diff < 0 ? 'bg-red-100 text-red-800' : 
                          'bg-neutral-100 text-neutral-800'
                        }`}>
                          {diff > 0 ? '+' : ''}{diff}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          <div className="mt-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-400" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Warning: Destructive Action</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>
                    Restoring this backup will permanently delete any data added since the backup was created.
                    This action cannot be undone.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50 flex justify-end gap-3 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700"
          >
            <CheckCircle className="w-4 h-4" />
            Confirm Restore
          </button>
        </div>
      </div>
    </div>
  );
};
