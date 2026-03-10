import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { useFacilityData, useDatabase } from '../../app/providers';
import { OutbreakExposure } from '../../domain/models';
import { v4 as uuidv4 } from 'uuid';
import { todayLocalDateInputValue } from '../../lib/dateUtils';

interface Props {
  outbreakId: string;
  onClose: () => void;
  onSaved?: () => void;
}

export const AddOutbreakExposureModal: React.FC<Props> = ({ outbreakId, onClose, onSaved }) => {
  const { store, activeFacilityId } = useFacilityData();
  const { updateDB } = useDatabase();

  const [residentId, setResidentId] = useState('');
  const [exposureDate, setExposureDate] = useState(todayLocalDateInputValue());
  const [exposureType, setExposureType] = useState('');
  const [monitoringUntil, setMonitoringUntil] = useState('');

  const residents = Object.values(store.residents).sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );

  const handleSave = () => {
    if (!residentId || !exposureDate) {
      alert('Please select a resident and exposure date.');
      return;
    }

    const now = new Date().toISOString();

    updateDB(draft => {
      const fd = draft.data.facilityData[activeFacilityId];

      const exposure: OutbreakExposure = {
        id: uuidv4(),
        outbreakId,
        residentRef: { kind: 'mrn', id: residentId },
        exposureDate,
        exposureType: exposureType || undefined,
        monitoringUntil: monitoringUntil || undefined,
        outcome: 'unknown',
        createdAt: now,
        updatedAt: now,
      };

      fd.outbreakExposures = fd.outbreakExposures ?? {};
      fd.outbreakExposures[exposure.id] = exposure;
    });

    onSaved?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <h2 className="text-lg font-bold text-neutral-900">Add Exposure / Monitoring</h2>
          <button onClick={onClose} className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-md">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Resident */}
          <div>
            <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
              Resident <span className="text-red-500">*</span>
            </label>
            <select
              value={residentId}
              onChange={e => setResidentId(e.target.value)}
              className="w-full border border-neutral-300 rounded-md text-sm px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Select a resident...</option>
              {residents.map(r => (
                <option key={r.mrn} value={r.mrn}>
                  {r.displayName} ({r.currentUnit} - {r.currentRoom})
                </option>
              ))}
            </select>
          </div>

          {/* Exposure Date */}
          <div>
            <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
              Exposure Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={exposureDate}
              onChange={e => setExposureDate(e.target.value)}
              className="w-full border border-neutral-300 rounded-md text-sm px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* Exposure Type */}
          <div>
            <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
              Exposure Type
            </label>
            <input
              type="text"
              value={exposureType}
              onChange={e => setExposureType(e.target.value)}
              placeholder="e.g. Direct contact, Shared dining"
              className="w-full border border-neutral-300 rounded-md text-sm px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* Monitoring Until */}
          <div>
            <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
              Monitor Until
            </label>
            <input
              type="date"
              value={monitoringUntil}
              onChange={e => setMonitoringUntil(e.target.value)}
              className="w-full border border-neutral-300 rounded-md text-sm px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-neutral-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
          >
            <Save className="w-4 h-4" />
            Add Exposure
          </button>
        </div>
      </div>
    </div>
  );
};
