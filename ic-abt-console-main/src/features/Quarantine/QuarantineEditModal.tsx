import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { useDatabase, useFacilityData } from '../../app/providers';
import { QuarantineResident } from '../../domain/models';

interface Props {
  quarantineId: string;
  onClose: () => void;
}

export const QuarantineEditModal: React.FC<Props> = ({ quarantineId, onClose }) => {
  const { store, activeFacilityId } = useFacilityData();
  const { updateDB } = useDatabase();
  
  const qRes = store.quarantine[quarantineId];
  
  const [displayName, setDisplayName] = useState(qRes?.displayName || '');
  const [dob, setDob] = useState(qRes?.dob || '');
  const [unitSnapshot, setUnitSnapshot] = useState(qRes?.unitSnapshot || '');
  const [roomSnapshot, setRoomSnapshot] = useState(qRes?.roomSnapshot || '');

  if (!qRes) return null;

  const handleSave = () => {
    updateDB(draft => {
      const facility = draft.data.facilityData[activeFacilityId];
      const record = facility.quarantine[quarantineId];
      if (record) {
        record.displayName = displayName;
        record.dob = dob;
        record.unitSnapshot = unitSnapshot;
        record.roomSnapshot = roomSnapshot;
        record.updatedAt = new Date().toISOString();
      }
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-50 shrink-0">
          <h2 className="text-xl font-bold text-neutral-900">Edit Raw Data</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Display Name</label>
            <input 
              type="text" 
              value={displayName} 
              onChange={e => setDisplayName(e.target.value)} 
              className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Date of Birth</label>
            <input 
              type="date" 
              value={dob} 
              onChange={e => setDob(e.target.value)} 
              className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Unit</label>
            <input 
              type="text" 
              value={unitSnapshot} 
              onChange={e => setUnitSnapshot(e.target.value)} 
              className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Room</label>
            <input 
              type="text" 
              value={roomSnapshot} 
              onChange={e => setRoomSnapshot(e.target.value)} 
              className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500" 
            />
          </div>
        </div>
        
        <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-md hover:bg-neutral-100 text-sm font-medium">
            Cancel
          </button>
          <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 text-sm font-medium">
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
