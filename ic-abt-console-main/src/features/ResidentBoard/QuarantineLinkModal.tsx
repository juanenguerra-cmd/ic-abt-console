import React, { useState } from 'react';
import { X, UserPlus, Link as LinkIcon } from 'lucide-react';
import { useDatabase, useFacilityData } from '../../app/providers';
import { Resident } from '../../domain/models';

interface Props {
  quarantineId: string;
  onClose: () => void;
}

export const QuarantineLinkModal: React.FC<Props> = ({ quarantineId, onClose }) => {
  const { store, activeFacilityId } = useFacilityData();
  const { updateDB } = useDatabase();
  
  const qRes = store.quarantine[quarantineId];
  const residents = (Object.values(store.residents) as Resident[]).filter(r => !r.isHistorical && !r.backOfficeOnly);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMrn, setSelectedMrn] = useState<string | null>(null);

  if (!qRes) return null;

  const filteredResidents = residents.filter(r => 
    r.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    r.mrn.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleLink = () => {
    if (!selectedMrn) return;
    
    updateDB(draft => {
      const facility = draft.data.facilityData[activeFacilityId];
      // Move any data from quarantine to the resident if needed
      // For now, just delete from quarantine
      delete facility.quarantine[quarantineId];
    });
    onClose();
  };

  const handleCreateNew = () => {
    const newMrn = `MRN-${Math.floor(Math.random() * 1000000)}`;
    
    updateDB(draft => {
      const facility = draft.data.facilityData[activeFacilityId];
      
      facility.residents[newMrn] = {
        mrn: newMrn,
        displayName: qRes.displayName || '',
        dob: qRes.dob,
        status: 'Active',
        currentUnit: qRes.unitSnapshot,
        currentRoom: qRes.roomSnapshot,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      delete facility.quarantine[quarantineId];
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-50 shrink-0">
          <h2 className="text-xl font-bold text-neutral-900">Resolve Quarantine Record</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
            <h3 className="font-bold text-rose-800 mb-2">Quarantine Record Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-neutral-500">Name:</span> <span className="font-medium">{qRes.displayName}</span></div>
              <div><span className="text-neutral-500">DOB:</span> <span className="font-medium">{qRes.dob || 'Unknown'}</span></div>
              <div><span className="text-neutral-500">Unit:</span> <span className="font-medium">{qRes.unitSnapshot || 'Unknown'}</span></div>
              <div><span className="text-neutral-500">Room:</span> <span className="font-medium">{qRes.roomSnapshot || 'Unknown'}</span></div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-neutral-200 rounded-lg p-4 flex flex-col">
              <h3 className="font-bold text-neutral-900 mb-2 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-indigo-600" />
                Create New Resident
              </h3>
              <p className="text-sm text-neutral-500 mb-4 flex-1">
                Create a new resident profile using the information from this quarantine record.
              </p>
              <button 
                onClick={handleCreateNew}
                className="w-full py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium"
              >
                Create New Profile
              </button>
            </div>

            <div className="border border-neutral-200 rounded-lg p-4 flex flex-col">
              <h3 className="font-bold text-neutral-900 mb-2 flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-emerald-600" />
                Link to Existing
              </h3>
              <p className="text-sm text-neutral-500 mb-4">
                Link this record to an existing resident profile.
              </p>
              
              <input 
                type="text" 
                placeholder="Search residents..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full border border-neutral-300 rounded-md p-2 text-sm mb-3 focus:ring-emerald-500 focus:border-emerald-500"
              />
              
              <div className="flex-1 border border-neutral-200 rounded-md overflow-y-auto max-h-40 mb-3">
                {filteredResidents.map(r => (
                  <div 
                    key={r.mrn}
                    onClick={() => setSelectedMrn(r.mrn)}
                    className={`p-2 text-sm cursor-pointer border-b border-neutral-100 last:border-0 hover:bg-neutral-50 ${selectedMrn === r.mrn ? 'bg-emerald-50 border-emerald-200' : ''}`}
                  >
                    <div className="font-medium text-neutral-900">{r.displayName}</div>
                    <div className="text-xs text-neutral-500">MRN: {r.mrn} • DOB: {r.dob || 'Unknown'}</div>
                  </div>
                ))}
                {filteredResidents.length === 0 && (
                  <div className="p-4 text-center text-sm text-neutral-500">No residents found.</div>
                )}
              </div>
              
              <button 
                onClick={handleLink}
                disabled={!selectedMrn}
                className="w-full py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:bg-neutral-300 disabled:cursor-not-allowed text-sm font-medium"
              >
                Link Selected
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
