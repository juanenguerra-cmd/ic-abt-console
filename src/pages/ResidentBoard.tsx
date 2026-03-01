import React, { useState } from "react";
import { useDB } from "../context/DBContext";
import { Resident, QuarantineResident, Unit } from "../domain/models";
import { v4 as uuidv4 } from "uuid";
import { Plus, Search, UserPlus } from "lucide-react";

export function ResidentBoard() {
  const { store, db, activeFacilityId, updateDB } = useDB();
  const [searchTerm, setSearchTerm] = useState("");

  const facility = db.data.facilities.byId[activeFacilityId];
  const units = facility?.units || [];

  const handleAddResident = () => {
    const mrn = prompt("Enter MRN:");
    if (!mrn) return;
    const displayName = prompt("Enter Display Name:");
    if (!displayName) return;

    updateDB((draft) => {
      const store = draft.data.facilityData[activeFacilityId];
      store.residents[mrn] = {
        mrn,
        displayName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "Active",
      };
    });
  };

  const handleAddUnit = () => {
    const name = prompt("Enter Unit Name:");
    if (!name) return;
    updateDB((draft) => {
      const fac = draft.data.facilities.byId[activeFacilityId];
      fac.units.push({ id: uuidv4(), name });
    });
  };

  const allResidents = [
    ...(Object.values(store.residents) as Resident[]).filter(r => !r.isHistorical && !r.backOfficeOnly),
    ...(Object.values(store.quarantine) as QuarantineResident[]).map((q) => ({
      ...q,
      isQuarantine: true,
    })),
  ];

  const filteredResidents = allResidents.filter(
    (r) =>
      r.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ("mrn" in r && r.mrn.toLowerCase().includes(searchTerm.toLowerCase())) ||
      ("tempId" in r && r.tempId.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-neutral-900 tracking-tight">Resident Board</h2>
        <div className="flex space-x-3">
          <button
            onClick={handleAddUnit}
            className="inline-flex items-center px-4 py-2 border border-neutral-300 shadow-sm text-sm font-medium rounded-md text-neutral-700 bg-white hover:bg-neutral-50"
          >
            <Plus className="mr-2 h-4 w-4" /> Add Unit
          </button>
          <button
            onClick={handleAddResident}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700"
          >
            <UserPlus className="mr-2 h-4 w-4" /> Add Resident
          </button>
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-neutral-400" />
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-3 py-2 border border-neutral-300 rounded-md leading-5 bg-white placeholder-neutral-500 focus:outline-none focus:placeholder-neutral-400 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
          placeholder="Search residents by name or MRN..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {units.length === 0 ? (
          <div className="col-span-full p-12 text-center border-2 border-dashed border-neutral-300 rounded-lg">
            <p className="text-neutral-500">No units configured. Add a unit to organize residents.</p>
          </div>
        ) : (
          units.map((unit) => (
            <UnitCard
              key={unit.id}
              unit={unit}
              residents={filteredResidents.filter(
                (r) =>
                  ("currentUnit" in r && r.currentUnit === unit.id) ||
                  ("unitSnapshot" in r && r.unitSnapshot === unit.id)
              )}
            />
          ))
        )}
        
        {/* Unassigned Residents */}
        <UnitCard
          unit={{ id: "unassigned", name: "Unassigned" }}
          residents={filteredResidents.filter(
            (r) =>
              !("currentUnit" in r && r.currentUnit) &&
              !("unitSnapshot" in r && r.unitSnapshot)
          )}
        />
      </div>
    </div>
  );
}

const UnitCard: React.FC<{ unit: Unit; residents: any[] }> = ({ unit, residents }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
      <div className="bg-neutral-50 px-4 py-3 border-b border-neutral-200 flex justify-between items-center">
        <h3 className="text-sm font-medium text-neutral-900">{unit.name}</h3>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-200 text-neutral-800">
          {residents.length}
        </span>
      </div>
      <ul className="divide-y divide-neutral-200 max-h-96 overflow-y-auto">
        {residents.length === 0 ? (
          <li className="px-4 py-4 text-sm text-neutral-500 text-center">No residents</li>
        ) : (
          residents.map((r) => (
            <li key={r.mrn || r.tempId} className="px-4 py-3 hover:bg-neutral-50 cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-neutral-900 truncate">
                  {r.displayName}
                  {r.isQuarantine && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                      Quarantine
                    </span>
                  )}
                </div>
                <div className="text-xs text-neutral-500">
                  {r.mrn || r.tempId}
                </div>
              </div>
              <div className="mt-1 flex justify-between text-xs text-neutral-500">
                <span>{r.currentRoom || r.roomSnapshot || "No Room"}</span>
                <span>{r.status || "Unknown"}</span>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
