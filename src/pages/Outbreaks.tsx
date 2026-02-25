import React, { useState } from "react";
import { useDB } from "../context/DBContext";
import { v4 as uuidv4 } from "uuid";
import { ShieldAlert, Plus, Calendar } from "lucide-react";

export function Outbreaks() {
  const { store, db, activeFacilityId, updateDB } = useDB();
  const facilityId = activeFacilityId;

  const handleAddOutbreak = () => {
    const title = prompt("Enter Outbreak Title:");
    if (!title) return;

    updateDB((draft) => {
      const store = draft.data.facilityData[facilityId];
      const id = uuidv4();
      store.outbreaks[id] = {
        id,
        facilityId,
        title,
        startDate: new Date().toISOString(),
        status: "suspected",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const outbreaks = Object.values(store.outbreaks);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-neutral-900 tracking-tight">Outbreak Management</h2>
        <button
          onClick={handleAddOutbreak}
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="mr-2 h-4 w-4" /> New Outbreak
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {outbreaks.length === 0 ? (
          <div className="col-span-full p-12 text-center border-2 border-dashed border-neutral-300 rounded-lg">
            <ShieldAlert className="mx-auto h-12 w-12 text-neutral-400" />
            <h3 className="mt-2 text-sm font-medium text-neutral-900">No active outbreaks</h3>
            <p className="mt-1 text-sm text-neutral-500">Get started by creating a new outbreak record.</p>
          </div>
        ) : (
          outbreaks.map((ob) => (
            <div key={ob.id} className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-neutral-200 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-medium text-neutral-900">{ob.title}</h3>
                  <div className="mt-1 flex items-center text-sm text-neutral-500">
                    <Calendar className="flex-shrink-0 mr-1.5 h-4 w-4 text-neutral-400" />
                    <p>Started {new Date(ob.startDate).toLocaleDateString()}</p>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    ob.status === "suspected"
                      ? "bg-amber-100 text-amber-800"
                      : ob.status === "confirmed"
                      ? "bg-red-100 text-red-800"
                      : ob.status === "contained"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-neutral-100 text-neutral-800"
                  }`}
                >
                  {ob.status.charAt(0).toUpperCase() + ob.status.slice(1)}
                </span>
              </div>
              <div className="px-6 py-4 bg-neutral-50">
                <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                  <div className="sm:col-span-1">
                    <dt className="text-sm font-medium text-neutral-500">Pathogen</dt>
                    <dd className="mt-1 text-sm text-neutral-900">{ob.pathogen || "Unknown"}</dd>
                  </div>
                  <div className="sm:col-span-1">
                    <dt className="text-sm font-medium text-neutral-500">Syndrome</dt>
                    <dd className="mt-1 text-sm text-neutral-900">{ob.syndromeCategory || "N/A"}</dd>
                  </div>
                </dl>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
