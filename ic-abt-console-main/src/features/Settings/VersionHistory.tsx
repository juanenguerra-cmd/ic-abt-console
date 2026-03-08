import React from "react";
import { VERSION_HISTORY } from "../../constants/versionHistory";
import { History, GitCommit } from "lucide-react";

export const VersionHistory: React.FC = () => {
  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="px-4 py-5 sm:px-6 border-b border-neutral-200 bg-neutral-50 flex items-center">
        <History className="h-5 w-5 text-indigo-500 mr-2" />
        <h3 className="text-lg leading-6 font-medium text-neutral-900">Version History</h3>
      </div>
      <div className="px-4 py-5 sm:p-6">
        <div className="space-y-8">
          {VERSION_HISTORY.map((entry, index) => (
            <div key={entry.version} className="relative pl-8 border-l-2 border-neutral-200 last:border-transparent">
              <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-indigo-500 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              </div>
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between mb-2">
                <h4 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                  v{entry.version}
                  {index === 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                      Latest
                    </span>
                  )}
                </h4>
                <span className="text-sm text-neutral-500 flex items-center gap-1 font-mono">
                  <GitCommit className="w-3 h-3" />
                  {entry.date}
                </span>
              </div>
              <ul className="space-y-1 text-sm text-neutral-600">
                {entry.changes.map((change, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-neutral-400 shrink-0" />
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
