import React, { useState } from "react";
import { useFacilityData, useDatabase } from "../../app/providers";
import { QuarantineResident } from "../../domain/models";
import { UserPlus, Link, AlertTriangle, Check, Edit2 } from "lucide-react";
import { QuarantineEditModal } from "./QuarantineEditModal";

export const QuarantineInbox: React.FC = () => {
  const { store } = useFacilityData();
  const { updateDB } = useDatabase();
  const [selectedQId, setSelectedQId] = useState<string | null>(null);
  const [targetMrn, setTargetMrn] = useState("");
  const [editingQId, setEditingQId] = useState<string | null>(null);

  const quarantineList = (Object.values(store.quarantine) as QuarantineResident[]).filter(q => !q.resolvedToMrn);

  const handleRelink = () => {
    if (!selectedQId || !targetMrn) return;

    updateDB((draft) => {
      const facilityId = draft.data.facilities.activeFacilityId;
      const facilityStore = draft.data.facilityData[facilityId];
      
      const qResident = facilityStore.quarantine[selectedQId];
      if (!qResident) return;

      // 1. Check if target MRN exists, if not create it from Q data
      let resident = facilityStore.residents[targetMrn];
      if (!resident) {
        resident = {
          mrn: targetMrn,
          displayName: qResident.displayName || "Unknown",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: "Active",
          identityAliases: [],
        };
        facilityStore.residents[targetMrn] = resident;
      }

      // 2. Add alias to resident
      if (!resident.identityAliases) resident.identityAliases = [];
      resident.identityAliases.push({
        source: "census",
        legacyId: qResident.tempId,
        name: qResident.displayName,
      });

      // 3. Mark Q record as resolved
      qResident.resolvedToMrn = targetMrn;
      qResident.updatedAt = new Date().toISOString();

      // 4. Relink any references (Stub - in a real app we'd scan all collections)
      // For example:
      // Object.values(facilityStore.infections).forEach(inf => {
      //   if (inf.residentRef.kind === 'quarantine' && inf.residentRef.id === selectedQId) {
      //     inf.residentRef = { kind: 'mrn', id: targetMrn };
      //   }
      // });
    });

    setSelectedQId(null);
    setTargetMrn("");
  };

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border-l-4 border-amber-400 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-amber-400" aria-hidden="true" />
          </div>
          <div className="ml-3">
            <p className="text-sm text-amber-700">
              Items in Quarantine are temporary records created from census imports where the MRN was missing or unrecognized. 
              Link them to a valid MRN to merge data.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-neutral-200">
          {quarantineList.length === 0 ? (
            <li className="px-6 py-12 text-center text-neutral-500">
              <Check className="mx-auto h-12 w-12 text-emerald-400 mb-3" />
              <p>No items in quarantine. All residents are properly identified.</p>
            </li>
          ) : (
            quarantineList.map((q) => (
              <li key={q.tempId} className="px-6 py-4 hover:bg-neutral-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-neutral-900 truncate">{q.displayName || "Unknown Name"}</h4>
                    <p className="text-xs text-neutral-500 font-mono mt-1">{q.tempId}</p>
                    <p className="text-xs text-neutral-400 mt-1">Source: {q.source}</p>
                    {q.rawHint && (
                      <p className="text-xs text-neutral-400 font-mono mt-1 bg-neutral-100 inline-block px-1 rounded">
                        Raw: {q.rawHint}
                      </p>
                    )}
                  </div>
                  
                  <div className="ml-4 flex-shrink-0 flex items-center gap-3">
                    <button
                      onClick={() => setEditingQId(q.tempId)}
                      className="inline-flex items-center px-3 py-2 border border-neutral-300 shadow-sm text-sm leading-4 font-medium rounded-md text-neutral-700 bg-white hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                    >
                      <Edit2 className="h-4 w-4 mr-2 text-neutral-400" />
                      Edit Raw Data
                    </button>
                    {selectedQId === q.tempId ? (
                      <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-200">
                        <input
                          type="text"
                          value={targetMrn}
                          onChange={(e) => setTargetMrn(e.target.value)}
                          placeholder="Enter valid MRN"
                          className="shadow-sm focus:ring-emerald-500 focus:border-emerald-500 block w-40 sm:text-sm border-neutral-300 rounded-md"
                          autoFocus
                        />
                        <button
                          onClick={handleRelink}
                          disabled={!targetMrn}
                          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setSelectedQId(null)}
                          className="text-neutral-400 hover:text-neutral-500"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setSelectedQId(q.tempId)}
                        className="inline-flex items-center px-3 py-2 border border-neutral-300 shadow-sm text-sm leading-4 font-medium rounded-md text-neutral-700 bg-white hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                      >
                        <Link className="h-4 w-4 mr-2 text-neutral-400" />
                        Link to MRN
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      {editingQId && (
        <QuarantineEditModal
          quarantineId={editingQId}
          onClose={() => setEditingQId(null)}
        />
      )}
    </div>
  );
};
