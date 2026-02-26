import React from 'react';
import { X } from 'lucide-react';
import { useFacilityData, useDatabase } from '../../app/providers';
import { Resident } from '../../domain/models';

interface Props {
  onClose: () => void;
}

export const CensusModal: React.FC<Props> = ({ onClose }) => {
  const { store, activeFacilityId } = useFacilityData();
  const { db } = useDatabase();
  const facility = db.data.facilities.byId[activeFacilityId];

  const residents = Object.values(store.residents) as Resident[];
  const residentsByUnit: Record<string, Resident[]> = {};

  residents.forEach(r => {
    const unit = r.currentUnit || 'Unassigned';
    if (!residentsByUnit[unit]) {
      residentsByUnit[unit] = [];
    }
    residentsByUnit[unit].push(r);
  });

  const residentCount = residents.length;
  const capacityRate = facility.bedCapacity ? ((residentCount / facility.bedCapacity) * 100).toFixed(1) : null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col h-[90vh]">
        <div className="px-6 py-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-50">
          <h2 className="text-xl font-bold text-neutral-900">Census Details</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-4 text-sm">
            Total Residents: <strong>{residentCount}</strong>
            {capacityRate && ` | Occupancy: <strong>${capacityRate}%</strong>`}
          </div>
          <div className="space-y-4">
            {Object.entries(residentsByUnit).map(([unit, residentsInUnit]) => (
              <div key={unit}>
                <div className="flex justify-between items-baseline">
                  <h3 className="font-bold text-lg text-neutral-800 mb-2 pb-1 border-b border-neutral-200">{unit} ({residentsInUnit.length})</h3>
                  {facility.units.find(u => u.name === unit)?.bedCapacity &&
                    <p className="text-xs text-neutral-500">
                      ({((residentsInUnit.length / facility.units.find(u => u.name === unit)!.bedCapacity!) * 100).toFixed(1)}% Occupancy)
                    </p>
                  }
                </div>
                <ul className="divide-y divide-neutral-100">
                  {residentsInUnit.map(r => (
                    <li key={r.mrn} className="py-1.5 flex justify-between text-sm">
                      <span>{r.displayName}</span>
                      <span className="text-neutral-500 font-mono">MRN: {r.mrn}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};