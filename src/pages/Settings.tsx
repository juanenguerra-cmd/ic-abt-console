import React from "react";
import { useDB } from "../context/DBContext";
import { Settings as SettingsIcon, Database, Trash2 } from "lucide-react";

export function Settings() {
  const { db, updateDB } = useDB();

  const handleClearDB = () => {
    if (confirm("Are you sure you want to clear all data? This cannot be undone.")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-neutral-900 tracking-tight">Settings</h2>
      </div>

      <div className="bg-white shadow-sm rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-neutral-900 flex items-center">
            <Database className="mr-2 h-5 w-5 text-neutral-400" /> Database Information
          </h3>
          <div className="mt-2 max-w-xl text-sm text-neutral-500">
            <p>Your data is stored locally in your browser. No data is sent to external servers.</p>
          </div>
          <div className="mt-5 border-t border-neutral-200 pt-5">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-neutral-500">Schema Version</dt>
                <dd className="mt-1 text-sm text-neutral-900">{db.schemaVersion}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-neutral-500">Last Updated</dt>
                <dd className="mt-1 text-sm text-neutral-900">{new Date(db.updatedAt).toLocaleString()}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <div className="bg-red-50 shadow-sm rounded-xl border border-red-200 overflow-hidden">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-red-800 flex items-center">
            <Trash2 className="mr-2 h-5 w-5 text-red-400" /> Danger Zone
          </h3>
          <div className="mt-2 max-w-xl text-sm text-red-700">
            <p>Once you delete your database, there is no going back. Please be certain.</p>
          </div>
          <div className="mt-5">
            <button
              type="button"
              onClick={handleClearDB}
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:text-sm"
            >
              Clear Database
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
