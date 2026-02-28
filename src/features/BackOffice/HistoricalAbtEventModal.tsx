import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { useDatabase, useFacilityData } from '../../app/providers';
import { ABTCourse, Resident } from '../../domain/models';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  onClose: () => void;
  prefilledResidentId?: string;
  existingEvent?: ABTCourse;
}

export const HistoricalAbtEventModal: React.FC<Props> = ({ onClose, prefilledResidentId, existingEvent }) => {
  const { updateDB } = useDatabase();
  const { store, activeFacilityId } = useFacilityData();

  const [residentId, setResidentId] = useState(prefilledResidentId || existingEvent?.residentRef.id || '');
  const [medication, setMedication] = useState(existingEvent?.medication || '');
  const [medicationClass, setMedicationClass] = useState(existingEvent?.medicationClass || '');
  const [route, setRoute] = useState(existingEvent?.route || 'PO');
  const [dose, setDose] = useState(existingEvent?.dose || '');
  const [frequency, setFrequency] = useState(existingEvent?.frequency || '');
  const [startDate, setStartDate] = useState(existingEvent?.startDate ? new Date(existingEvent.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(existingEvent?.endDate ? new Date(existingEvent.endDate).toISOString().split('T')[0] : '');
  const [indication, setIndication] = useState(existingEvent?.indication || '');
  const [syndromeCategory, setSyndromeCategory] = useState(existingEvent?.syndromeCategory || '');
  const [infectionSource, setInfectionSource] = useState(existingEvent?.infectionSource || '');
  const [cultureCollected, setCultureCollected] = useState(existingEvent?.cultureCollected || false);
  const [diagnostics, setDiagnostics] = useState(existingEvent?.diagnostics ? JSON.stringify(existingEvent.diagnostics) : '');
  const [prescriber, setPrescriber] = useState(existingEvent?.prescriber || '');
  const [unit, setUnit] = useState(existingEvent?.locationSnapshot?.unit || '');
  const [room, setRoom] = useState(existingEvent?.locationSnapshot?.room || '');
  const [status, setStatus] = useState<'completed' | 'ongoing-at-discharge' | 'discontinued'>((existingEvent?.status as any) || 'completed');
  const [notes, setNotes] = useState(existingEvent?.notes || '');

  const allResidents = Object.values(store.residents || {}) as Resident[];

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!residentId) {
      alert('Please select a resident.');
      return;
    }

    updateDB(draft => {
      const facilityData = draft.data.facilityData[activeFacilityId];
      if (!facilityData.abts) facilityData.abts = {};

      const id = existingEvent?.id || uuidv4();
      
      const fullNotes = [
        `Source: manual-historical`,
        notes
      ].filter(Boolean).join('\n');

      let parsedDiagnostics = undefined;
      if (diagnostics) {
        try {
          parsedDiagnostics = JSON.parse(diagnostics);
        } catch (e) {
          // ignore
        }
      }

      const event: ABTCourse = {
        id,
        residentRef: { kind: 'mrn', id: residentId },
        status: status as any,
        medication,
        medicationClass,
        route,
        dose,
        frequency,
        startDate: new Date(startDate).toISOString(),
        endDate: endDate ? new Date(endDate).toISOString() : undefined,
        indication,
        syndromeCategory,
        infectionSource,
        cultureCollected,
        diagnostics: parsedDiagnostics,
        prescriber,
        locationSnapshot: { unit, room },
        notes: fullNotes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      facilityData.abts[id] = event;
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-50 shrink-0">
          <h2 className="text-lg font-bold text-neutral-900">
            {existingEvent ? 'Edit Historical ABX Event' : 'Add Historical ABX Event'}
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          <form id="historical-abt-form" onSubmit={handleSave} className="space-y-4">
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
                <label className="block text-sm font-medium text-neutral-700 mb-1">Medication Name *</label>
                <input
                  type="text"
                  required
                  value={medication}
                  onChange={e => setMedication(e.target.value)}
                  className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Medication Class</label>
                <input
                  type="text"
                  value={medicationClass}
                  onChange={e => setMedicationClass(e.target.value)}
                  className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Route</label>
                <select
                  value={route}
                  onChange={e => setRoute(e.target.value)}
                  className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="PO">PO</option>
                  <option value="IV">IV</option>
                  <option value="IM">IM</option>
                  <option value="Topical">Topical</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Dose</label>
                <input
                  type="text"
                  value={dose}
                  onChange={e => setDose(e.target.value)}
                  className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Frequency</label>
                <input
                  type="text"
                  value={frequency}
                  onChange={e => setFrequency(e.target.value)}
                  className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Start Date *</label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">End Date / Planned Stop Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Indication</label>
                <input
                  type="text"
                  value={indication}
                  onChange={e => setIndication(e.target.value)}
                  className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Syndrome</label>
                <input
                  type="text"
                  value={syndromeCategory}
                  onChange={e => setSyndromeCategory(e.target.value)}
                  className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Source of Infection</label>
                <input
                  type="text"
                  value={infectionSource}
                  onChange={e => setInfectionSource(e.target.value)}
                  className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Indication Category</label>
                <select
                  value={syndromeCategory}
                  onChange={e => setSyndromeCategory(e.target.value)}
                  className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="">Select...</option>
                  <option value="UTI">UTI</option>
                  <option value="LRTI">LRTI</option>
                  <option value="SSI">SSI</option>
                  <option value="BSI">BSI</option>
                  <option value="GI">GI</option>
                  <option value="Skin">Skin</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Prescriber / Provider</label>
                <input
                  type="text"
                  value={prescriber}
                  onChange={e => setPrescriber(e.target.value)}
                  className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Status *</label>
                <select
                  required
                  value={status}
                  onChange={e => setStatus(e.target.value as any)}
                  className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="completed">Completed</option>
                  <option value="ongoing-at-discharge">Ongoing at Discharge</option>
                  <option value="discontinued">Discontinued</option>
                </select>
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

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="cultureCollected"
                checked={cultureCollected}
                onChange={e => setCultureCollected(e.target.checked)}
                className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="cultureCollected" className="text-sm font-medium text-neutral-700">
                Culture Collected
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Diagnostics (JSON format optional)</label>
              <input
                type="text"
                value={diagnostics}
                onChange={e => setDiagnostics(e.target.value)}
                className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
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
            form="historical-abt-form"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
          >
            <Save className="w-4 h-4" />
            Save ABX Event
          </button>
        </div>
      </div>
    </div>
  );
};
