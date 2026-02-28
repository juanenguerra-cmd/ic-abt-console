import React, { useMemo, useState } from 'react';
import { X, Save } from 'lucide-react';
import { useDatabase, useFacilityData } from '../../app/providers';
import { Resident, VaxEvent } from '../../domain/models';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  onClose: () => void;
  prefilledResidentId?: string;
  existingEvent?: VaxEvent;
}

const VACCINE_TYPES = ['Influenza', 'COVID-19', 'Pneumococcal', 'Shingles', 'Other'] as const;
const DOSE_OPTIONS: NonNullable<VaxEvent['dose']>[] = ['1st', '2nd', 'Booster', 'Single'];
const SITE_OPTIONS: NonNullable<VaxEvent['administrationSite']>[] = ['In-House', 'Outside Provider', 'Other'];
const STATUS_OPTIONS: VaxEvent['status'][] = ['given', 'declined', 'contraindicated', 'documented-historical'];

export const HistoricalVaxEventModal: React.FC<Props> = ({ onClose, prefilledResidentId, existingEvent }) => {
  const { updateDB } = useDatabase();
  const { store, activeFacilityId } = useFacilityData();

  const [residentId, setResidentId] = useState(prefilledResidentId || existingEvent?.residentRef.id || '');
  const [residentQuery, setResidentQuery] = useState('');
  const [vaccine, setVaccine] = useState(existingEvent?.vaccine || 'Influenza');
  const [administeredDate, setAdministeredDate] = useState(
    (existingEvent?.administeredDate || existingEvent?.dateGiven)?.split('T')[0] || new Date().toISOString().split('T')[0],
  );
  const [dose, setDose] = useState<VaxEvent['dose']>(existingEvent?.dose || 'Single');
  const [lotNumber, setLotNumber] = useState(existingEvent?.lotNumber || '');
  const [administeredBy, setAdministeredBy] = useState(existingEvent?.administeredBy || '');
  const [administrationSite, setAdministrationSite] = useState<VaxEvent['administrationSite']>(existingEvent?.administrationSite || 'In-House');
  const [status, setStatus] = useState<VaxEvent['status']>(existingEvent?.status || 'documented-historical');
  const [notes, setNotes] = useState(existingEvent?.notes || '');

  const allResidents = useMemo(() => Object.values(store.residents || {}) as Resident[], [store.residents]);
  const filteredResidents = useMemo(() => {
    const q = residentQuery.trim().toLowerCase();
    if (!q) return allResidents;
    return allResidents.filter(r => r.displayName.toLowerCase().includes(q) || r.mrn.toLowerCase().includes(q));
  }, [residentQuery, allResidents]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!residentId) return alert('Please select a resident.');
    if (!administeredDate) return alert('Administered date is required.');

    const duplicate = (Object.values(store.vaxEvents || {}) as VaxEvent[]).find(v =>
      v.id !== existingEvent?.id &&
      v.residentRef.id === residentId &&
      v.vaccine === vaccine &&
      (v.administeredDate || v.dateGiven)?.split('T')[0] === administeredDate,
    );

    if (duplicate && !window.confirm('A matching VAX event already exists for this resident/date/type. Create anyway?')) {
      return;
    }

    updateDB(draft => {
      const facilityData = draft.data.facilityData[activeFacilityId];
      if (!facilityData.vaxEvents) facilityData.vaxEvents = {};
      const id = existingEvent?.id || uuidv4();
      const now = new Date().toISOString();
      const res = facilityData.residents[residentId];

      facilityData.vaxEvents[id] = {
        id,
        residentRef: { kind: 'mrn', id: residentId },
        vaccine,
        status,
        administeredDate: new Date(administeredDate).toISOString(),
        dateGiven: new Date(administeredDate).toISOString(),
        dose: dose || undefined,
        lotNumber: lotNumber || undefined,
        administeredBy: administeredBy || undefined,
        administrationSite: administrationSite || undefined,
        source: 'manual-historical',
        locationSnapshot: {
          unit: res?.currentUnit || res?.lastKnownUnit,
          room: res?.currentRoom || res?.lastKnownRoom,
          attendingMD: res?.attendingMD || res?.lastKnownAttendingMD,
          capturedAt: now,
        },
        notes: notes || undefined,
        createdAt: existingEvent?.createdAt || now,
        updatedAt: now,
      };
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-50 shrink-0">
          <h2 className="text-lg font-bold text-neutral-900">{existingEvent ? 'Edit VAX Event' : 'Add VAX Event'}</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 overflow-y-auto">
          <form id="historical-vax-form" onSubmit={handleSave} className="space-y-4">
            {!prefilledResidentId && !existingEvent && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-neutral-700">Resident *</label>
                <input
                  type="text"
                  value={residentQuery}
                  onChange={e => setResidentQuery(e.target.value)}
                  placeholder="Search resident by name or MRN"
                  className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
                <select
                  required
                  value={residentId}
                  onChange={e => setResidentId(e.target.value)}
                  className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="">Select a resident...</option>
                  {filteredResidents.map(r => (
                    <option key={r.mrn} value={r.mrn}>{r.displayName} (MRN: {r.mrn}) {(r.backOfficeOnly || r.isHistorical) ? '[Historical]' : ''}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Vaccine Type *</label>
                <select value={vaccine} onChange={e => setVaccine(e.target.value)} className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                  {VACCINE_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Administered Date *</label>
                <input type="date" required value={administeredDate} onChange={e => setAdministeredDate(e.target.value)} className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Dose</label>
                <select value={dose || ''} onChange={e => setDose((e.target.value || undefined) as VaxEvent['dose'])} className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                  <option value="">Select dose...</option>
                  {DOSE_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Administration Site</label>
                <select value={administrationSite || ''} onChange={e => setAdministrationSite((e.target.value || undefined) as VaxEvent['administrationSite'])} className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                  <option value="">Select site...</option>
                  {SITE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Lot Number</label>
                <input type="text" value={lotNumber} onChange={e => setLotNumber(e.target.value)} className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Administered By</label>
                <input type="text" value={administeredBy} onChange={e => setAdministeredBy(e.target.value)} className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value as VaxEvent['status'])} className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Notes</label>
              <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} className="w-full border-neutral-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
            </div>
          </form>
        </div>

        <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50 flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50">Cancel</button>
          <button type="submit" form="historical-vax-form" className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">
            <Save className="w-4 h-4" />
            Save VAX Event
          </button>
        </div>
      </div>
    </div>
  );
};
