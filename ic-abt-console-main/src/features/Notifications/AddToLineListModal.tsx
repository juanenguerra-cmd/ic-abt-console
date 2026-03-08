import React, { useState, useMemo, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { useFacilityData, useDatabase } from '../../app/providers';
import { AppNotification, LineListEvent, SymptomClass, SymptomTag } from '../../domain/models';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  notification: AppNotification;
  onClose: () => void;
  onSaved?: () => void;
}

/** Derive a human-readable label and SymptomClass from the notification message/payload. */
function deriveSymptomClass(notif: AppNotification): {
  label: string;
  symptomClass: SymptomClass;
} {
  if (notif.payload?.symptomClass) {
    const sc = notif.payload.symptomClass;
    return { label: sc === 'gi' ? 'GI' : 'Respiratory', symptomClass: sc };
  }
  const msg = (notif.message || '').toLowerCase();
  if (msg.includes('resp') || msg.includes('pneumonia') || msg.includes('covid') || msg.includes('influenza') || msg.includes('rsv') || msg.includes('uri') || msg.includes('cough') || msg.includes('bronchitis')) {
    return { label: 'Respiratory', symptomClass: 'resp' };
  }
  if (msg.includes('gi') || msg.includes('diarrhea') || msg.includes('vomit') || msg.includes('gastro') || msg.includes('c. diff') || msg.includes('cdiff') || msg.includes('norovirus') || msg.includes('nausea')) {
    return { label: 'GI', symptomClass: 'gi' };
  }
  return { label: 'Respiratory', symptomClass: 'resp' };
}

const MS_96H = 96 * 60 * 60 * 1000;

export const AddToLineListModal: React.FC<Props> = ({ notification, onClose, onSaved }) => {
  const { store, activeFacilityId } = useFacilityData();
  const { updateDB } = useDatabase();

  const resident = notification.residentId ? store.residents[notification.residentId] : undefined;
  const { label: symptomClass, symptomClass: derivedSymptomClass } = useMemo(
    () => deriveSymptomClass(notification),
    [notification]
  );

  const [notes, setNotes] = useState('');
  const [onsetDate, setOnsetDate] = useState(new Date().toISOString().slice(0, 10));
  const [checkedSymptoms, setCheckedSymptoms] = useState<SymptomTag[]>(notification.payload?.symptoms || []);
  const [fever, setFever] = useState<boolean | undefined>(undefined);
  const [isolationInitiated, setIsolationInitiated] = useState(false);
  const [isolationStatus, setIsolationStatus] = useState<string>('');
  const [providerNotified, setProviderNotified] = useState(false);
  const [testOrdered, setTestOrdered] = useState(false);

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

  /** Check if an active LineListEvent for same resident+symptomClass exists within 96h (dedup). */
  const existingEntry = useMemo<LineListEvent | undefined>(() => {
    if (!notification.residentId) return undefined;
    const cutoff = Date.now() - MS_96H;
    return Object.values(store.lineListEvents || {}).find(
      ev =>
        ev.residentId === notification.residentId &&
        ev.symptomClass === derivedSymptomClass &&
        new Date(ev.createdAt).getTime() >= cutoff
    );
  }, [store.lineListEvents, notification.residentId, derivedSymptomClass]);

  const handleSave = () => {
    if (!notification.residentId) return;

    const now = new Date().toISOString();

    const onsetDateISO = onsetDate.includes('T') ? onsetDate : `${onsetDate}T00:00:00`;

    updateDB(draft => {
      const fd = draft.data.facilityData[activeFacilityId];
      let recordId: string;

      if (existingEntry) {
        // Update existing entry
        recordId = existingEntry.id;
        const existing = fd.lineListEvents?.[existingEntry.id];
        if (existing) {
          existing.notes = [existing.notes, notes].filter(Boolean).join('\n');
          existing.onsetDateISO = onsetDateISO;
          existing.symptoms = [...checkedSymptoms];
          existing.fever = fever;
          existing.isolationInitiated = isolationInitiated;
          existing.isolationStatus = isolationInitiated && isolationStatus ? isolationStatus : undefined;
          existing.providerNotified = providerNotified;
          existing.testOrdered = testOrdered;
          existing.updatedAt = now;
        }
      } else {
        // Create new LineListEvent
        const lineListEvent: LineListEvent = {
          id: uuidv4(),
          facilityId: activeFacilityId,
          residentId: notification.residentId,
          symptomClass: derivedSymptomClass,
          onsetDateISO,
          symptoms: [...checkedSymptoms],
          fever,
          isolationInitiated,
          isolationStatus: isolationInitiated && isolationStatus ? isolationStatus : undefined,
          providerNotified,
          testOrdered,
          notes: notes || undefined,
          sourceNotificationId: notification.id,
          createdAt: now,
          updatedAt: now,
        };
        fd.lineListEvents = fd.lineListEvents ?? {};
        fd.lineListEvents[lineListEvent.id] = lineListEvent;
        recordId = lineListEvent.id;
      }

      // Mark notification as acted
      if (fd.notifications[notification.id]) {
        fd.notifications[notification.id].actedAt = now;
        fd.notifications[notification.id].lineListRecordId = recordId;
        fd.notifications[notification.id].status = 'read';
      }
    });

    onSaved?.();
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

  const currentSymptomsList = derivedSymptomClass === 'resp' ? respSymptoms : giSymptoms;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 shrink-0">
          <h2 className="text-lg font-bold text-neutral-900">Add to Line List</h2>
          <button onClick={onClose} className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-md">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Resident */}
          <div>
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Resident</p>
            <p className="text-sm font-medium text-neutral-900">{resident?.displayName || notification.residentId || 'Unknown'}</p>
            {resident && (
              <p className="text-xs text-neutral-500">
                {[resident.currentUnit, resident.currentRoom].filter(Boolean).join(' – ')}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Symptom class */}
            <div>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Symptom Class</p>
              <p className="text-sm text-neutral-900">{symptomClass}</p>
            </div>

            {/* Onset Date */}
            <div>
              <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                Onset Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={onsetDate}
                onChange={(e) => setOnsetDate(e.target.value)}
                className="w-full border border-neutral-300 rounded-md text-sm px-2 py-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* SECTION C — Symptoms */}
          <section>
            <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
              Symptoms
            </h3>
            <div className="grid grid-cols-2 gap-2">
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
              <div className="mt-3 p-2 bg-neutral-50 border border-neutral-200 rounded-md">
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Fever confirmed?
                </label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="feverConfirmed"
                      checked={fever === true}
                      onChange={() => setFever(true)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-neutral-700">Yes</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="feverConfirmed"
                      checked={fever === false}
                      onChange={() => setFever(false)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-neutral-700">No</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="feverConfirmed"
                      checked={fever === undefined}
                      onChange={() => setFever(undefined)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-neutral-700">Unknown</span>
                  </label>
                </div>
              </div>
            )}
          </section>

          {/* SECTION D — Clinical Actions */}
          <section>
            <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
              Clinical Actions
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-700">Isolation Initiated</span>
                <div className="flex gap-3">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      checked={isolationInitiated === true}
                      onChange={() => setIsolationInitiated(true)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-neutral-700">Yes</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      checked={isolationInitiated === false}
                      onChange={() => {
                        setIsolationInitiated(false);
                        setIsolationStatus('');
                      }}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-neutral-700">No</span>
                  </label>
                </div>
              </div>

              {isolationInitiated && (
                <div className="pl-3 border-l-2 border-indigo-100">
                  <select
                    value={isolationStatus}
                    onChange={(e) => setIsolationStatus(e.target.value)}
                    className="w-full border border-neutral-300 rounded-md text-xs px-2 py-1 focus:ring-indigo-500 focus:border-indigo-500"
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
                <div className="flex gap-3">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      checked={providerNotified === true}
                      onChange={() => setProviderNotified(true)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-neutral-700">Yes</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      checked={providerNotified === false}
                      onChange={() => setProviderNotified(false)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-neutral-700">No</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-700">Test Ordered</span>
                <div className="flex gap-3">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      checked={testOrdered === true}
                      onChange={() => setTestOrdered(true)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-neutral-700">Yes</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      checked={testOrdered === false}
                      onChange={() => setTestOrdered(false)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-neutral-700">No</span>
                  </label>
                </div>
              </div>
            </div>
          </section>

          {/* Dedup notice */}
          {existingEntry && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800">
                An active line list entry for this resident and symptom class already exists within the last 96 hours.
                Saving will update the existing entry.
              </p>
            </div>
          )}

          {/* Notes */}
          <section>
            <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
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
            disabled={!onsetDate}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {existingEntry ? 'Update Entry' : 'Add to Line List'}
          </button>
        </div>
      </div>
    </div>
  );
};
