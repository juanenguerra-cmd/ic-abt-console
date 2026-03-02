import React, { useState, useMemo, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { useFacilityData, useDatabase } from '../../app/providers';
import { LineListEvent, SymptomClass, SymptomTag } from '../../domain/models';

interface ManualAddLineListModalProps {
  symptomClass: SymptomClass;
  onClose: () => void;
  onSaved: (newEventId: string) => void;
}

const MS_96H = 96 * 60 * 60 * 1000;

export const ManualAddLineListModal: React.FC<ManualAddLineListModalProps> = ({
  symptomClass,
  onClose,
  onSaved,
}) => {
  const { store, activeFacilityId } = useFacilityData();
  const { updateDB } = useDatabase();

  const [residentId, setResidentId] = useState('');
  const [onsetDate, setOnsetDate] = useState(new Date().toISOString().slice(0, 10));
  const [checkedSymptoms, setCheckedSymptoms] = useState<SymptomTag[]>([]);
  const [fever, setFever] = useState<boolean | undefined>(undefined);
  const [isolationInitiated, setIsolationInitiated] = useState(false);
  const [isolationStatus, setIsolationStatus] = useState<string>('');
  const [providerNotified, setProviderNotified] = useState(false);
  const [testOrdered, setTestOrdered] = useState(false);
  const [testType, setTestType] = useState('');
  const [disposition, setDisposition] = useState('');
  const [notes, setNotes] = useState('');

  const residents = useMemo(() => {
    return Object.values(store.residents).sort((a, b) =>
      a.displayName.localeCompare(b.displayName)
    );
  }, [store.residents]);

  const selectedResident = residentId ? store.residents[residentId] : null;

  const existingEntry = useMemo<LineListEvent | undefined>(() => {
    if (!residentId) return undefined;
    const cutoff = Date.now() - MS_96H;
    return Object.values(store.lineListEvents || {}).find(
      (ev) =>
        ev.residentId === residentId &&
        ev.symptomClass === symptomClass &&
        new Date(ev.createdAt).getTime() >= cutoff
    );
  }, [store.lineListEvents, residentId, symptomClass]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSymptomToggle = (sym: SymptomTag) => {
    setCheckedSymptoms((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym]
    );
  };

  const handleSave = () => {
    if (!residentId || !onsetDate) return;

    const now = new Date().toISOString();
    const onsetDateISO = onsetDate.includes('T') ? onsetDate : `${onsetDate}T00:00:00`;

    const newEvent: LineListEvent = {
      id: crypto.randomUUID(),
      facilityId: activeFacilityId,
      residentId,
      symptomClass,
      onsetDateISO,
      symptoms: [...checkedSymptoms],
      fever,
      isolationInitiated,
      isolationStatus: isolationInitiated && isolationStatus ? isolationStatus : undefined,
      providerNotified,
      testOrdered,
      disposition: disposition || undefined,
      notes: notes || undefined,
      sourceNotificationId: undefined,
      createdAt: now,
      updatedAt: now,
    };

    updateDB(
      (draft) => {
        const fd = draft.data.facilityData[activeFacilityId];
        fd.lineListEvents = fd.lineListEvents ?? {};
        fd.lineListEvents[newEvent.id] = newEvent;
      },
      { action: 'create', entityType: 'lineListEvent', entityId: newEvent.id }
    );

    onSaved(newEvent.id);
    onClose();
  };

  const respSymptoms: { label: string; value: SymptomTag }[] = [
    { label: 'Fever', value: 'fever' },
    { label: 'Cough', value: 'cough' },
    { label: 'Shortness of breath', value: 'shortness_of_breath' },
    { label: 'Sore throat', value: 'sore_throat' },
    { label: 'Runny nose/congestion', value: 'congestion' },
    { label: 'Myalgia/body aches', value: 'body_aches' },
    { label: 'Headache', value: 'headache' },
    { label: 'Fatigue', value: 'fatigue' },
    { label: 'Chills', value: 'chills' },
    { label: 'Loss of taste/smell', value: 'loss_of_taste_smell' },
    { label: 'Chest pain', value: 'chest_pain' },
    { label: 'Wheezing', value: 'wheezing' },
  ];

  const giSymptoms: { label: string; value: SymptomTag }[] = [
    { label: 'Fever', value: 'fever' },
    { label: 'Diarrhea (≥3 loose stools/24h)', value: 'diarrhea' },
    { label: 'Vomiting', value: 'vomiting' },
    { label: 'Nausea', value: 'nausea' },
    { label: 'Abdominal cramps', value: 'stomach_cramping' },
    { label: 'Loss of appetite', value: 'loss_of_appetite' },
    { label: 'Blood in stool', value: 'blood_in_stool' },
  ];

  const currentSymptomsList = symptomClass === 'resp' ? respSymptoms : giSymptoms;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 shrink-0">
          <h2 className="text-lg font-bold text-neutral-900">Add Line List Entry</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
          {/* SECTION A — Resident */}
          <section>
            <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
              Section A — Resident
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Resident <span className="text-red-500">*</span>
                </label>
                <select
                  value={residentId}
                  onChange={(e) => setResidentId(e.target.value)}
                  className="w-full border border-neutral-300 rounded-md text-sm px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Select a resident...</option>
                  {residents.map((r) => (
                    <option key={r.mrn} value={r.mrn}>
                      {r.displayName} — {r.currentUnit || 'No Unit'} / {r.currentRoom || 'No Room'}
                    </option>
                  ))}
                </select>
              </div>
              {selectedResident && (
                <div className="flex gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800">
                    Unit: {selectedResident.currentUnit || 'N/A'}
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800">
                    Room: {selectedResident.currentRoom || 'N/A'}
                  </span>
                </div>
              )}
            </div>
          </section>

          {existingEntry && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800">
                An active entry for this resident exists within the last 96 hours. Saving will create
                a new separate entry. Consider editing the existing one.
              </p>
            </div>
          )}

          {/* SECTION B — Onset & Classification */}
          <section>
            <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
              Section B — Onset & Classification
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Onset Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={onsetDate}
                  onChange={(e) => setOnsetDate(e.target.value)}
                  className="w-full border border-neutral-300 rounded-md text-sm px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Symptom Class
                </label>
                <div className="inline-flex items-center px-3 py-2 rounded-md text-sm font-medium bg-neutral-100 text-neutral-800 border border-neutral-200">
                  {symptomClass === 'resp' ? 'Respiratory (ILI)' : 'GI'}
                </div>
              </div>
            </div>
          </section>

          {/* SECTION C — Symptoms */}
          <section>
            <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
              Section C — Symptoms
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {currentSymptomsList.map((sym) => (
                <label key={sym.value} className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkedSymptoms.includes(sym.value)}
                    onChange={() => handleSymptomToggle(sym.value)}
                    className="mt-1 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-neutral-700">{sym.label}</span>
                </label>
              ))}
            </div>

            {checkedSymptoms.includes('fever') && (
              <div className="mt-4 p-3 bg-neutral-50 border border-neutral-200 rounded-md">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Fever confirmed?
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="feverConfirmed"
                      checked={fever === true}
                      onChange={() => setFever(true)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-neutral-700">Yes</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="feverConfirmed"
                      checked={fever === false}
                      onChange={() => setFever(false)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-neutral-700">No</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="feverConfirmed"
                      checked={fever === undefined}
                      onChange={() => setFever(undefined)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-neutral-700">Unknown</span>
                  </label>
                </div>
              </div>
            )}
          </section>

          {/* SECTION D — Clinical Actions */}
          <section>
            <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
              Section D — Clinical Actions
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-700">Isolation Initiated</span>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={isolationInitiated === true}
                      onChange={() => setIsolationInitiated(true)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-neutral-700">Yes</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={isolationInitiated === false}
                      onChange={() => {
                        setIsolationInitiated(false);
                        setIsolationStatus('');
                      }}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-neutral-700">No</span>
                  </label>
                </div>
              </div>

              {isolationInitiated && (
                <div className="pl-4 border-l-2 border-indigo-100">
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Isolation Type
                  </label>
                  <select
                    value={isolationStatus}
                    onChange={(e) => setIsolationStatus(e.target.value)}
                    className="w-full border border-neutral-300 rounded-md text-sm px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Select type...</option>
                    <option value="contact">Contact</option>
                    <option value="droplet">Droplet</option>
                    <option value="contact_droplet">Contact + Droplet</option>
                    <option value="airborne">Airborne</option>
                    <option value="protective">Protective</option>
                  </select>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-700">Provider Notified</span>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={providerNotified === true}
                      onChange={() => setProviderNotified(true)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-neutral-700">Yes</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={providerNotified === false}
                      onChange={() => setProviderNotified(false)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-neutral-700">No</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-700">Test Ordered</span>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={testOrdered === true}
                      onChange={() => setTestOrdered(true)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-neutral-700">Yes</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={testOrdered === false}
                      onChange={() => {
                        setTestOrdered(false);
                        setTestType('');
                      }}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-neutral-700">No</span>
                  </label>
                </div>
              </div>

              {testOrdered && (
                <div className="pl-4 border-l-2 border-indigo-100">
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Test Type (optional)
                  </label>
                  <input
                    type="text"
                    value={testType}
                    onChange={(e) => setTestType(e.target.value)}
                    placeholder="e.g., PCR, Rapid Antigen"
                    className="w-full border border-neutral-300 rounded-md text-sm px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              )}
            </div>
          </section>

          {/* SECTION E — Outcome */}
          <section>
            <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
              Section E — Outcome
            </h3>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Disposition
              </label>
              <select
                value={disposition}
                onChange={(e) => setDisposition(e.target.value)}
                className="w-full border border-neutral-300 rounded-md text-sm px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Select disposition...</option>
                <option value="Monitoring in place">Monitoring in place</option>
                <option value="Hospitalized">Hospitalized</option>
                <option value="Recovered">Recovered</option>
                <option value="Expired">Expired</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </section>

          {/* SECTION F — Notes */}
          <section>
            <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
              Section F — Notes
            </h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Clinical context, additional details..."
              className="w-full border border-neutral-300 rounded-md text-sm px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
            />
          </section>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-neutral-200 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!residentId || !onsetDate}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            Save to Line List
          </button>
        </div>
      </div>
    </div>
  );
};
