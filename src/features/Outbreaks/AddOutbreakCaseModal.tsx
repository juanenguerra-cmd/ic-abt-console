import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { useFacilityData, useDatabase } from '../../app/providers';
import { OutbreakCase } from '../../domain/models';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  outbreakId: string;
  onClose: () => void;
  onSaved?: () => void;
}

export const AddOutbreakCaseModal: React.FC<Props> = ({ outbreakId, onClose, onSaved }) => {
  const { store, activeFacilityId } = useFacilityData();
  const { updateDB } = useDatabase();

  const [residentId, setResidentId] = useState('');
  const [onsetDate, setOnsetDate] = useState(new Date().toISOString().slice(0, 10));
  const [caseStatus, setCaseStatus] = useState<'probable' | 'confirmed' | 'ruled_out'>('probable');

  const residents = Object.values(store.residents).sort((a, b) => 
    a.displayName.localeCompare(b.displayName)
  );

  const handleSave = () => {
    if (!residentId || !onsetDate) {
      alert('Please select a resident and onset date.');
      return;
    }

    const now = new Date().toISOString();

    updateDB(draft => {
      const fd = draft.data.facilityData[activeFacilityId];
      const resident = fd.residents[residentId];
      
      const outbreakCase: OutbreakCase = {
        id: uuidv4(),
        outbreakId,
        residentRef: { kind: 'mrn', id: residentId },
        caseStatus,
        symptomOnsetDate: onsetDate,
        locationSnapshot: {
          unit: resident?.currentUnit,
          room: resident?.currentRoom,
        },
        createdAt: now,
        updatedAt: now,
      };

      fd.outbreakCases = fd.outbreakCases ?? {};
      fd.outbreakCases[outbreakCase.id] = outbreakCase;
    });

    onSaved?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <h2 className="text-lg font-bold text-neutral-900">Add Case to Outbreak</h2>
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

          {/* Case Status */}
          <div>
            <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
              Case Status <span className="text-red-500">*</span>
            </label>
            <select
              value={caseStatus}
              onChange={e => setCaseStatus(e.target.value as any)}
              className="w-full border border-neutral-300 rounded-md text-sm px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="probable">Probable</option>
              <option value="confirmed">Confirmed</option>
              <option value="ruled_out">Ruled Out</option>
            </select>
          </div>

          {/* Onset Date */}
          <div>
            <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
              Onset Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={onsetDate}
              onChange={e => setOnsetDate(e.target.value)}
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
            Add Case
          </button>
        </div>
      </div>
    </div>
  );
};
