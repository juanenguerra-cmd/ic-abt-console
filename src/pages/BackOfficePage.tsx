import React, { useState } from 'react';
import { useDatabase, useFacilityData } from '../app/providers';
import { Resident, IPEvent, ABTCourse, VaxEvent } from '../domain/models';
import { Search, Plus, Edit, Activity, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useNavigate } from 'react-router-dom';
import { HistoricalCsvUploader } from '../features/BackOffice/HistoricalCsvUploader';
import { BackOfficeResidentDetail } from '../features/BackOffice/BackOfficeResidentDetail';
import { HistoricalIpEventModal } from '../features/BackOffice/HistoricalIpEventModal';
import { GlobalIpHistory } from '../features/BackOffice/GlobalIpHistory';
import { HistoricalAbtEventModal } from '../features/BackOffice/HistoricalAbtEventModal';
import { GlobalAbtHistory } from '../features/BackOffice/GlobalAbtHistory';
import { HistoricalVaxEventModal } from '../features/BackOffice/HistoricalVaxEventModal';
import { GlobalVaxHistory } from '../features/BackOffice/GlobalVaxHistory';

export const BackOfficePage: React.FC = () => {
  const { store } = useFacilityData();
  const { updateDB } = useDatabase();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingResident, setEditingResident] = useState<Resident | null>(null);
  const [activeTab, setActiveTab] = useState<'residents' | 'ip-history' | 'abx-history' | 'vax-history'>('residents');
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  
  const [showIpModal, setShowIpModal] = useState(false);
  const [editingIpEvent, setEditingIpEvent] = useState<IPEvent | undefined>();
  const [showAbtModal, setShowAbtModal] = useState(false);
  const [editingAbtEvent, setEditingAbtEvent] = useState<ABTCourse | undefined>();
  const [prefilledResidentId, setPrefilledResidentId] = useState<string | undefined>();
  const [showVaxModal, setShowVaxModal] = useState(false);
  const [editingVaxEvent, setEditingVaxEvent] = useState<VaxEvent | undefined>();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    mrn: '',
    dob: '',
    lastKnownUnit: '',
    lastKnownRoom: '',
    lastKnownAttendingMD: '',
    dischargedAt: '',
    notes: ''
  });

  const allResidents = Object.values(store.residents || {}) as Resident[];
  const historicalResidents = allResidents.filter(r => r.backOfficeOnly);

  const filteredResidents = historicalResidents.filter(r => {
    const term = searchTerm.toLowerCase();
    return (
      r.displayName.toLowerCase().includes(term) ||
      r.mrn.toLowerCase().includes(term)
    );
  });

  const handleOpenModal = (resident?: Resident) => {
    if (resident) {
      setEditingResident(resident);
      setFormData({
        firstName: resident.firstName || '',
        lastName: resident.lastName || '',
        mrn: resident.mrn,
        dob: resident.dob || '',
        lastKnownUnit: resident.lastKnownUnit || '',
        lastKnownRoom: resident.lastKnownRoom || '',
        lastKnownAttendingMD: resident.lastKnownAttendingMD || '',
        dischargedAt: resident.dischargedAt || '',
        notes: '' // Assuming notes aren't directly on resident for now, or we can add it
      });
    } else {
      setEditingResident(null);
      setFormData({
        firstName: '',
        lastName: '',
        mrn: '',
        dob: '',
        lastKnownUnit: '',
        lastKnownRoom: '',
        lastKnownAttendingMD: '',
        dischargedAt: '',
        notes: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingResident(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    updateDB(draft => {
      const facilityId = draft.data.facilities.activeFacilityId;
      const facilityData = draft.data.facilityData[facilityId];
      
      if (!facilityData.residents) {
        facilityData.residents = {};
      }

      const residentId = editingResident ? editingResident.mrn : formData.mrn;
      
      const resident: Resident = {
        ...(editingResident || {
          createdAt: new Date().toISOString(),
          identityAliases: []
        }),
        mrn: formData.mrn,
        firstName: formData.firstName,
        lastName: formData.lastName,
        displayName: `${formData.lastName}, ${formData.firstName}`,
        dob: formData.dob,
        lastKnownUnit: formData.lastKnownUnit,
        lastKnownRoom: formData.lastKnownRoom,
        lastKnownAttendingMD: formData.lastKnownAttendingMD,
        dischargedAt: formData.dischargedAt,
        isHistorical: true,
        backOfficeOnly: true,
        historicalSource: 'manual',
        updatedAt: new Date().toISOString()
      };

      facilityData.residents[residentId] = resident;

      if (formData.notes.trim()) {
        if (!facilityData.notes) {
          facilityData.notes = {};
        }
        const noteId = uuidv4();
        facilityData.notes[noteId] = {
          id: noteId,
          residentRef: { kind: 'mrn', id: residentId },
          noteType: 'general',
          title: 'Historical Resident Note',
          body: formData.notes.trim(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }
    });

    handleCloseModal();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {selectedResident ? (
        <BackOfficeResidentDetail 
          resident={selectedResident} 
          onBack={() => setSelectedResident(null)} 
          onAddIpEvent={(residentId) => {
            setPrefilledResidentId(residentId);
            setEditingIpEvent(undefined);
            setShowIpModal(true);
          }}
          onEditIpEvent={(event) => {
            setPrefilledResidentId(event.residentRef.id);
            setEditingIpEvent(event);
            setShowIpModal(true);
          }}
          onAddAbtEvent={(residentId) => {
            setPrefilledResidentId(residentId);
            setEditingAbtEvent(undefined);
            setShowAbtModal(true);
          }}
          onEditAbtEvent={(event) => {
            setPrefilledResidentId(event.residentRef.id);
            setEditingAbtEvent(event);
            setShowAbtModal(true);
          }}
          onAddVaxEvent={(residentId) => {
            setPrefilledResidentId(residentId);
            setEditingVaxEvent(undefined);
            setShowVaxModal(true);
          }}
          onEditVaxEvent={(event) => {
            setPrefilledResidentId(event.residentRef.id);
            setEditingVaxEvent(event);
            setShowVaxModal(true);
          }}
        />
      ) : (
        <>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">Back Office</h1>
              <p className="text-neutral-500">Manage historical residents and events.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setPrefilledResidentId(undefined);
                  setEditingVaxEvent(undefined);
                  setShowVaxModal(true);
                }}
                className="flex items-center gap-2 bg-white border border-neutral-300 text-neutral-700 px-4 py-2 rounded-md hover:bg-neutral-50 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Add VAX Event
              </button>
              <button
                onClick={() => {
                  setPrefilledResidentId(undefined);
                  setEditingAbtEvent(undefined);
                  setShowAbtModal(true);
                }}
                className="flex items-center gap-2 bg-white border border-neutral-300 text-neutral-700 px-4 py-2 rounded-md hover:bg-neutral-50 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Add ABX Event
              </button>
              <button
                onClick={() => {
                  setPrefilledResidentId(undefined);
                  setEditingIpEvent(undefined);
                  setShowIpModal(true);
                }}
                className="flex items-center gap-2 bg-white border border-neutral-300 text-neutral-700 px-4 py-2 rounded-md hover:bg-neutral-50 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Add IP Event
              </button>
              <button
                onClick={() => handleOpenModal()}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Add Historical Resident
              </button>
            </div>
          </div>

          <div className="border-b border-neutral-200">
            <nav className="flex -mb-px">
              <button
                className={`px-6 py-3 text-sm font-medium border-b-2 ${activeTab === 'residents' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'}`}
                onClick={() => setActiveTab('residents')}
              >
                Historical Residents
              </button>
              <button
                className={`px-6 py-3 text-sm font-medium border-b-2 ${activeTab === 'ip-history' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'}`}
                onClick={() => setActiveTab('ip-history')}
              >
                Global IP History
              </button>
              <button
                className={`px-6 py-3 text-sm font-medium border-b-2 ${activeTab === 'abx-history' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'}`}
                onClick={() => setActiveTab('abx-history')}
              >
                Global ABX History
              </button>
              <button
                className={`px-6 py-3 text-sm font-medium border-b-2 ${activeTab === 'vax-history' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'}`}
                onClick={() => setActiveTab('vax-history')}
              >
                Global VAX History
              </button>
            </nav>
          </div>

          {activeTab === 'residents' && (
            <>
              <HistoricalCsvUploader />

              <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
                <div className="p-4 border-b border-neutral-200 bg-neutral-50">
                  <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <input
                      type="text"
                      placeholder="Search by name or MRN..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border border-neutral-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500">
                      <tr>
                        <th className="px-6 py-3 font-medium">Name</th>
                        <th className="px-6 py-3 font-medium">MRN</th>
                        <th className="px-6 py-3 font-medium">DOB</th>
                        <th className="px-6 py-3 font-medium">Last Unit/Room</th>
                        <th className="px-6 py-3 font-medium">Discharged At</th>
                        <th className="px-6 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {filteredResidents.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-8 text-center text-neutral-500">
                            No historical residents found.
                          </td>
                        </tr>
                      ) : (
                        filteredResidents.map(resident => (
                          <tr key={resident.mrn} className="hover:bg-neutral-50">
                            <td className="px-6 py-4 font-medium text-neutral-900">{resident.displayName}</td>
                            <td className="px-6 py-4 text-neutral-600">{resident.mrn}</td>
                            <td className="px-6 py-4 text-neutral-600">{resident.dob || '-'}</td>
                            <td className="px-6 py-4 text-neutral-600">
                              {resident.lastKnownUnit || '-'} {resident.lastKnownRoom ? `/ ${resident.lastKnownRoom}` : ''}
                            </td>
                            <td className="px-6 py-4 text-neutral-600">
                              {resident.dischargedAt ? new Date(resident.dischargedAt).toLocaleDateString() : '-'}
                            </td>
                            <td className="px-6 py-4 text-right space-x-4">
                              <button
                                onClick={() => setSelectedResident(resident)}
                                className="text-indigo-600 hover:text-indigo-900 font-medium text-sm"
                              >
                                View Events
                              </button>
                              <button
                                onClick={() => handleOpenModal(resident)}
                                className="text-indigo-600 hover:text-indigo-900 font-medium text-sm"
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeTab === 'ip-history' && (
            <GlobalIpHistory 
              onEditIpEvent={(event) => {
                setPrefilledResidentId(event.residentRef.id);
                setEditingIpEvent(event);
                setShowIpModal(true);
              }}
            />
          )}

          {activeTab === 'abx-history' && (
            <GlobalAbtHistory 
              onEditAbtEvent={(event) => {
                setPrefilledResidentId(event.residentRef.id);
                setEditingAbtEvent(event);
                setShowAbtModal(true);
              }}
            />
          )}

          {activeTab === 'vax-history' && (
            <GlobalVaxHistory
              onEditVaxEvent={(event) => {
                setPrefilledResidentId(event.residentRef.id);
                setEditingVaxEvent(event);
                setShowVaxModal(true);
              }}
            />
          )}
        </>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-50 shrink-0">
              <h2 className="text-lg font-bold text-neutral-900">
                {editingResident ? 'Edit Historical Resident' : 'Add Historical Resident'}
              </h2>
              <button onClick={handleCloseModal} className="text-neutral-400 hover:text-neutral-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <form id="historical-resident-form" onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">First Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.firstName}
                      onChange={e => setFormData({...formData, firstName: e.target.value})}
                      className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Last Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.lastName}
                      onChange={e => setFormData({...formData, lastName: e.target.value})}
                      className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">MRN *</label>
                    <input
                      type="text"
                      required
                      disabled={!!editingResident}
                      value={formData.mrn}
                      onChange={e => setFormData({...formData, mrn: e.target.value})}
                      className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-neutral-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Date of Birth</label>
                    <input
                      type="date"
                      value={formData.dob}
                      onChange={e => setFormData({...formData, dob: e.target.value})}
                      className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Last Known Unit</label>
                    <input
                      type="text"
                      value={formData.lastKnownUnit}
                      onChange={e => setFormData({...formData, lastKnownUnit: e.target.value})}
                      className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Last Known Room</label>
                    <input
                      type="text"
                      value={formData.lastKnownRoom}
                      onChange={e => setFormData({...formData, lastKnownRoom: e.target.value})}
                      className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Last Known Attending MD</label>
                    <input
                      type="text"
                      value={formData.lastKnownAttendingMD}
                      onChange={e => setFormData({...formData, lastKnownAttendingMD: e.target.value})}
                      className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Discharged At</label>
                    <input
                      type="date"
                      value={formData.dischargedAt ? formData.dischargedAt.split('T')[0] : ''}
                      onChange={e => {
                        const dateStr = e.target.value;
                        setFormData({...formData, dischargedAt: dateStr ? new Date(dateStr).toISOString() : ''});
                      }}
                      className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Notes</label>
                  <textarea
                    rows={3}
                    value={formData.notes}
                    onChange={e => setFormData({...formData, notes: e.target.value})}
                    className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
              </form>
            </div>
            
            <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="historical-resident-form"
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
              >
                Save Resident
              </button>
            </div>
          </div>
        </div>
      )}
      {showIpModal && (
        <HistoricalIpEventModal
          prefilledResidentId={prefilledResidentId}
          existingEvent={editingIpEvent}
          onClose={() => setShowIpModal(false)}
        />
      )}
      {showAbtModal && (
        <HistoricalAbtEventModal
          prefilledResidentId={prefilledResidentId}
          existingEvent={editingAbtEvent}
          onClose={() => setShowAbtModal(false)}
        />
      )}
      {showVaxModal && (
        <HistoricalVaxEventModal
          prefilledResidentId={prefilledResidentId}
          existingEvent={editingVaxEvent}
          onClose={() => setShowVaxModal(false)}
        />
      )}
    </div>
  );
};
