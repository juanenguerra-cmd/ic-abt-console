import React, { useState } from 'react';
import { Resident, IPEvent } from '../../domain/models';
import { useFacilityData, useDatabase } from '../../app/providers';
import { ArrowLeft, Plus, Edit, Trash2 } from 'lucide-react';

interface Props {
  resident: Resident;
  onBack: () => void;
  onAddIpEvent: (residentId: string) => void;
  onEditIpEvent: (event: IPEvent) => void;
}

export const BackOfficeResidentDetail: React.FC<Props> = ({ resident, onBack, onAddIpEvent, onEditIpEvent }) => {
  const { store } = useFacilityData();
  const { updateDB } = useDatabase();
  const [activeTab, setActiveTab] = useState<'ip'>('ip');

  const ipEvents = Object.values(store.infections || {}).filter(
    ip => ip.residentRef.id === resident.mrn
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this IP event?')) {
      updateDB(draft => {
        const facilityId = draft.data.facilities.activeFacilityId;
        delete draft.data.facilityData[facilityId].infections[id];
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-neutral-100 rounded-full">
          <ArrowLeft className="w-5 h-5 text-neutral-600" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">{resident.displayName}</h2>
          <p className="text-neutral-500">MRN: {resident.mrn} | DOB: {resident.dob || '-'}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
        <div className="border-b border-neutral-200">
          <nav className="flex -mb-px">
            <button
              className={`px-6 py-3 text-sm font-medium border-b-2 ${activeTab === 'ip' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'}`}
              onClick={() => setActiveTab('ip')}
            >
              IP Events
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'ip' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-neutral-900">IP History</h3>
                <button 
                  onClick={() => onAddIpEvent(resident.mrn)}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add IP Event
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Onset Date</th>
                      <th className="px-4 py-3 font-medium">Precaution Type</th>
                      <th className="px-4 py-3 font-medium">Organism</th>
                      <th className="px-4 py-3 font-medium">Unit/Room</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Resolution Date</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {ipEvents.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-neutral-500">
                          No IP events found.
                        </td>
                      </tr>
                    ) : (
                      ipEvents.map(event => (
                        <tr key={event.id} className="hover:bg-neutral-50">
                          <td className="px-4 py-3">{new Date(event.createdAt).toLocaleDateString()}</td>
                          <td className="px-4 py-3">{event.isolationType || '-'}</td>
                          <td className="px-4 py-3">{event.organism || '-'}</td>
                          <td className="px-4 py-3">
                            {event.locationSnapshot?.unit || '-'} {event.locationSnapshot?.room ? `/ ${event.locationSnapshot.room}` : ''}
                          </td>
                          <td className="px-4 py-3">{event.status}</td>
                          <td className="px-4 py-3">{event.resolvedAt ? new Date(event.resolvedAt).toLocaleDateString() : '-'}</td>
                          <td className="px-4 py-3 text-right space-x-3">
                            <button onClick={() => onEditIpEvent(event)} className="text-indigo-600 hover:text-indigo-900"><Edit className="w-4 h-4" /></button>
                            <button onClick={() => handleDelete(event.id)} className="text-red-600 hover:text-red-900"><Trash2 className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
