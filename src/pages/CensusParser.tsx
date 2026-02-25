import React, { useState } from "react";
import { useDB } from "../context/DBContext";
import { v4 as uuidv4 } from "uuid";
import { FileText, Upload, CheckCircle } from "lucide-react";

export function CensusParser() {
  const { updateDB, activeFacilityId } = useDB();
  const [rawText, setRawText] = useState("");
  const [parsedCount, setParsedCount] = useState(0);

  const handleParse = () => {
    if (!rawText.trim()) return;

    const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
    let count = 0;

    updateDB((draft) => {
      const store = draft.data.facilityData[activeFacilityId];
      lines.forEach((line) => {
        // Simple heuristic: "MRN Name DOB" or just "Name"
        const parts = line.split(/\s+/);
        if (parts.length >= 2 && /^\d+$/.test(parts[0])) {
          // Looks like MRN
          const mrn = parts[0];
          const name = parts.slice(1).join(" ");
          if (!store.residents[mrn]) {
            store.residents[mrn] = {
              mrn,
              displayName: name,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              status: "Active",
            };
            count++;
          }
        } else {
          // Quarantine
          const tempId = `Q:${uuidv4()}`;
          store.quarantine[tempId] = {
            tempId,
            displayName: line,
            source: "manual_entry",
            rawHint: line,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          count++;
        }
      });
    });

    setParsedCount(count);
    setRawText("");
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-neutral-900 tracking-tight">Census Parser</h2>
      </div>

      <div className="bg-white shadow-sm rounded-xl border border-neutral-200 p-6">
        <label htmlFor="census-text" className="block text-sm font-medium text-neutral-700 mb-2">
          Paste Raw Census Data
        </label>
        <textarea
          id="census-text"
          rows={10}
          className="block w-full rounded-md border-neutral-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm p-3 border"
          placeholder="12345 John Doe 01/01/1950\nJane Smith\n..."
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
        />
        <div className="mt-4 flex justify-between items-center">
          <p className="text-sm text-neutral-500">
            Lines starting with a number are treated as MRN + Name. Others go to Quarantine.
          </p>
          <button
            onClick={handleParse}
            disabled={!rawText.trim()}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="mr-2 h-4 w-4" /> Parse & Import
          </button>
        </div>
      </div>

      {parsedCount > 0 && (
        <div className="rounded-md bg-emerald-50 p-4 border border-emerald-200">
          <div className="flex">
            <div className="flex-shrink-0">
              <CheckCircle className="h-5 w-5 text-emerald-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-emerald-800">Import Successful</h3>
              <div className="mt-2 text-sm text-emerald-700">
                <p>Successfully parsed and imported {parsedCount} records.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
