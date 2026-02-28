import React, { useState, useMemo } from 'react';
import { X, Save } from 'lucide-react';
import { useDatabase, useFacilityData } from '../../app/providers';
import { IPEvent, Resident } from '../../domain/models';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  onClose: () => void;
  prefilledResidentId?: string;
  existingEvent?: IPEvent;
}

export const HistoricalIpEventModal: React.FC<Props> = ({ onClose, prefilledResidentId, existingEvent }) => {
  const { updateDB } = useDatabase();
  const { store, activeFacilityId } = useFacilityData();

  const [residentId, setResidentId] = useState(prefilledResidentId || existingEvent?.residentRef.id || '');
  const [precautionType, setPrecautionType] = useState(existingEvent?.isolationType || 'Contact');
  const [infectionType, setInfectionType] = useState(existingEvent?.infectionSite || '');
  const [organism, setOrganism] = useState(existingEvent?.organism || '');
  const [onsetDate, setOnsetDate] = useState(existingEvent?.onsetDate ? new Date(existingEvent.onsetDate).toISOString().split('T')[0] : (existingEvent?.createdAt ? new Date(existingEvent.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]));
  const [resolutionDate, setResolutionDate] = useState(existingEvent?.resolvedAt ? new Date(existingEvent.resolvedAt).toISOString().split('T')[0] : '');
  const [unit, setUnit] = useState(existingEvent?.locationSnapshot?.unit || '');
  const [room, setRoom] = useState(existingEvent?.locationSnapshot?.room || '');
  const [deviceType, setDeviceType] = useState('None');
  const [status, setStatus] = useState<'resolved' | 'ongoing-at-discharge' | 'transferred'>((existingEvent?.status as any) || 'resolved');
  const [notes, setNotes] = useState(existingEvent?.notes || '');

  // Extract device type from notes if editing
  useMemo(() => {
    if (existingEvent?.notes) {
      const match = existingEvent.notes.match(/Device Type: (.*?)(\n|$)/);
      if (match) {
        setDeviceType(match[1]);
      }
    }
  }, [existingEvent]);

  const allResidents = Object.values(store.residents || {}) as Resident[];

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!residentId) {
      alert('Please select a resident.');
      return;
    }

    updateDB(draft => {
      const facilityData = draft.data.facilityData[activeFacilityId];
      if (!facilityData.infections) facilityData.infections = {};

      const id = existingEvent?.id || uuidv4();
      
      const fullNotes = [
        `Source: manual-historical`,
        deviceType !== 'None' ? `Device Type: ${deviceType}` : null,
        notes
      ].filter(Boolean).join('\n');

      const event: IPEvent = {
        id,
        residentRef: { kind: 'mrn', id: residentId },
        status: status as any,
        isolationType: precautionType,
        infectionSite: infectionType,
        organism: organism,
        locationSnapshot: { unit, room },
        notes: fullNotes,
        onsetDate: new Date(onsetDate).toISOString(),
        createdAt: existingEvent?.createdAt || new Date(onsetDate).toISOString(),
        updatedAt: new Date().toISOString(),
        resolvedAt: resolutionDate ? new Date(resolutionDate).toISOString() : undefined,
      };

      facilityData.infections[id] = event;
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-50 shrink-0">
          <h2 className="text-lg font-bold text-neutral-900">
            {existingEvent ? 'Edit Historical IP Event' : 'Add Historical IP Event'}
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          <form id="historical-ip-form" onSubmit={handleSave} className="space-y-4">
            {!prefilledResidentId && !existingEvent && (
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Resident *</label>
                <select
                  required
                  value={residentId}
                  onChange={e => setResidentId(e.target.value)}
                  className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="">Select a resident...</option>
                  {allResidents.map(r => (
                    <option key={r.mrn} value={r.mrn}>
                      {r.displayName} (MRN: {r.mrn}) {r.isHistorical ? '[Historical]' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Precaution Type *</label>
                <select
                  required
                  value={precautionType}
                  onChange={e => setPrecautionType(e.target.value)}
                  className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="Contact">Contact</option>
                  <option value="Droplet">Droplet</option>
                  <option value="Airborne">Airborne</option>
                  <option value="Enhanced Barrier">Enhanced Barrier</option>
                  <option value="EBP">EBP</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Status *</label>
                <select
                  required
                  value={status}
                  onChange={e => setStatus(e.target.value as any)}
                  className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="resolved">Resolved</option>
                  <option value="ongoing-at-discharge">Ongoing at Discharge</option>
                  <option value="transferred">Transferred</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Infection Type / Syndrome *</label>
                <input
                  type="text"
                  required
                  value={infectionType}
                  onChange={e => setInfectionType(e.target.value)}
                  className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Organism</label>
                <input
                  type="text"
                  value={organism}
                  onChange={e => setOrganism(e.target.value)}
                  className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Onset Date *</label>
                <input
                  type="date"
                  required
                  value={onsetDate}
                  onChange={e => setOnsetDate(e.target.value)}
                  className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Resolution/Discontinue Date</label>
                <input
                  type="date"
                  value={resolutionDate}
                  onChange={e => setResolutionDate(e.target.value)}
                  className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Unit at time of event</label>
                <input
                  type="text"
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Room at time of event</label>
                <input
                  type="text"
                  value={room}
                  onChange={e => setRoom(e.target.value)}
                  className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Device Type</label>
              <select
                value={deviceType}
                onChange={e => setDeviceType(e.target.value)}
                className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="Urinary Catheter">Urinary Catheter</option>
                <option value="Feeding Tube">Feeding Tube</option>
                <option value="IV">IV</option>
                <option value="None">None</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Notes</label>
              <textarea
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
          </form>
        </div>
        
        <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="historical-ip-form"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
          >
            <Save className="w-4 h-4" />
            Save IP Event
          </button>
        </div>
      </div>
    </div>
  );
};
