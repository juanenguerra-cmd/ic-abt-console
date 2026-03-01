import React, { useState, useEffect } from 'react';
import { X, ClipboardList, AlertCircle, CheckCircle2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import {
  AppNotification,
  LineListEvent,
  SymptomClass,
  SymptomTag,
  RespSymptomTag,
  GISymptomTag,
  LineListDisposition,
  Resident,
} from '../../domain/models';
import { useFacilityData, useDatabase } from '../../app/providers';

// ─── Symptom options ──────────────────────────────────────────────────────────

const RESP_SYMPTOMS: { tag: RespSymptomTag; label: string }[] = [
  { tag: 'cough', label: 'Cough' },
  { tag: 'fever', label: 'Fever' },
  { tag: 'shortness_of_breath', label: 'Shortness of Breath' },
  { tag: 'sore_throat', label: 'Sore Throat' },
  { tag: 'runny_nose', label: 'Runny Nose' },
  { tag: 'congestion', label: 'Congestion' },
  { tag: 'body_aches', label: 'Body Aches' },
  { tag: 'loss_of_smell_taste', label: 'Loss of Smell/Taste' },
  { tag: 'chills', label: 'Chills' },
  { tag: 'fatigue', label: 'Fatigue' },
];

const GI_SYMPTOMS: { tag: GISymptomTag; label: string }[] = [
  { tag: 'diarrhea', label: 'Diarrhea' },
  { tag: 'nausea', label: 'Nausea' },
  { tag: 'vomiting', label: 'Vomiting' },
  { tag: 'stomach_cramping', label: 'Stomach Cramping' },
  { tag: 'loss_of_appetite', label: 'Loss of Appetite' },
  { tag: 'fever', label: 'Fever' },
];

const DISPOSITIONS: { value: LineListDisposition; label: string }[] = [
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'hospital_transfer', label: 'Hospital Transfer' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'other', label: 'Other' },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface AddToLineListModalProps {
  notification: AppNotification;
  onClose: () => void;
  onSaved: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const AddToLineListModal: React.FC<AddToLineListModalProps> = ({
  notification,
  onClose,
  onSaved,
}) => {
  const { store, activeFacilityId } = useFacilityData();
  const { updateDB } = useDatabase();

  const payload = notification.payload;
  const residentId = payload?.residentId ?? notification.residentId ?? '';
  const symptomClass: SymptomClass = payload?.symptomClass ?? 'resp';
  const detectedAt = payload?.detectedAt ?? notification.createdAtISO;

  const resident: Resident | undefined = residentId ? store.residents?.[residentId] : undefined;

  // ─── Form state ───────────────────────────────────────────────────────────

  const [onsetDateISO, setOnsetDateISO] = useState<string>(
    detectedAt ? detectedAt.slice(0, 16) : new Date().toISOString().slice(0, 16)
  );
  const [selectedSymptoms, setSelectedSymptoms] = useState<Set<SymptomTag>>(new Set());
  const [fever, setFever] = useState<boolean>(false);
  const [isolationInitiated, setIsolationInitiated] = useState<boolean>(false);
  const [isolationStatus, setIsolationStatus] = useState<string>('');
  const [testOrdered, setTestOrdered] = useState<boolean>(false);
  const [providerNotified, setProviderNotified] = useState<boolean>(false);
  const [disposition, setDisposition] = useState<LineListDisposition | ''>('');
  const [notes, setNotes] = useState<string>(payload?.notesSnippet ?? '');

  const [errors, setErrors] = useState<string[]>([]);
  const [duplicateEntry, setDuplicateEntry] = useState<LineListEvent | null>(null);
  const [showDupeConfirm, setShowDupeConfirm] = useState(false);

  // ─── Duplicate check ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!residentId) return;
    const ninetySixHoursAgo = new Date(Date.now() - 96 * 60 * 60 * 1000);
    const existing = (Object.values(store.lineListEvents ?? {}) as LineListEvent[]).find(
      (e: LineListEvent) =>
        e.residentId === residentId &&
        e.symptomClass === symptomClass &&
        new Date(e.createdAt) > ninetySixHoursAgo
    );
    setDuplicateEntry(existing ?? null);
  }, [residentId, symptomClass, store.lineListEvents]);

  // ─── Symptom options ──────────────────────────────────────────────────────

  const symptomOptions =
    symptomClass === 'resp'
      ? RESP_SYMPTOMS
      : GI_SYMPTOMS;

  const toggleSymptom = (tag: SymptomTag) => {
    setSelectedSymptoms((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  };

  // ─── Validation ───────────────────────────────────────────────────────────

  const validate = (): boolean => {
    const errs: string[] = [];
    if (!residentId) errs.push('Resident is required.');
    if (!onsetDateISO) errs.push('Symptom onset date/time is required.');
    if (selectedSymptoms.size === 0) errs.push('At least one symptom must be selected.');
    setErrors(errs);
    return errs.length === 0;
  };

  // ─── Save ─────────────────────────────────────────────────────────────────

  const buildRecord = (existingId?: string): LineListEvent => {
    const now = new Date().toISOString();
    return {
      id: existingId ?? uuidv4(),
      facilityId: activeFacilityId,
      residentId,
      symptomClass,
      onsetDateISO: new Date(onsetDateISO).toISOString(),
      symptoms: Array.from(selectedSymptoms) as SymptomTag[],
      fever,
      isolationInitiated,
      isolationStatus: isolationStatus || undefined,
      testOrdered,
      providerNotified,
      disposition: disposition || undefined,
      notes: notes || undefined,
      sourceNotificationId: notification.id,
      sourceEventId: payload?.sourceEventId,
      createdAt: existingId && duplicateEntry ? duplicateEntry.createdAt : now,
      updatedAt: now,
    };
  };

  const persistSave = (record: LineListEvent) => {
    updateDB((draft: any) => {
      const facilityData = draft.data.facilityData[activeFacilityId];
      if (!facilityData.lineListEvents) facilityData.lineListEvents = {};
      facilityData.lineListEvents[record.id] = record;

      // Mark notification as acted
      if (facilityData.notifications?.[notification.id]) {
        facilityData.notifications[notification.id].status = 'read';
        facilityData.notifications[notification.id].actedAt = new Date().toISOString();
        facilityData.notifications[notification.id].lineListRecordId = record.id;
      }
    });
    onSaved();
  };

  const handleSave = () => {
    if (!validate()) return;

    if (duplicateEntry && !showDupeConfirm) {
      setShowDupeConfirm(true);
      return;
    }

    const record = buildRecord(showDupeConfirm && duplicateEntry ? duplicateEntry.id : undefined);
    persistSave(record);
  };

  const handleCreateNew = () => {
    const record = buildRecord(); // no existingId → new record
    persistSave(record);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-blue-50 shrink-0">
          <div className="flex items-center gap-3">
            <ClipboardList className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-neutral-900">Add to Line List</h2>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                symptomClass === 'resp'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-green-100 text-green-700'
              }`}
            >
              {symptomClass === 'resp' ? 'Respiratory' : 'GI'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-white/50 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Resident info (read-only) */}
          <div className="bg-neutral-50 rounded-lg border border-neutral-200 p-4 space-y-1">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Resident</p>
            <p className="text-base font-bold text-neutral-900">{resident?.displayName ?? residentId}</p>
            <div className="flex flex-wrap gap-4 text-xs text-neutral-600">
              {resident?.mrn && <span>MRN: {resident.mrn}</span>}
              {(resident?.currentUnit || resident?.currentRoom) && (
                <span>
                  Location: {resident.currentUnit ?? 'Unknown'}
                  {resident.currentRoom ? ` — ${resident.currentRoom}` : ''}
                </span>
              )}
              <span>
                Detected: {new Date(detectedAt).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Duplicate warning */}
          {duplicateEntry && !showDupeConfirm && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                An active{' '}
                <strong>{symptomClass === 'resp' ? 'Respiratory' : 'GI'}</strong> line list
                entry already exists for this resident within the last 96 hours (created{' '}
                {new Date(duplicateEntry.createdAt).toLocaleString()}). Saving will{' '}
                <strong>update</strong> that existing entry by default.
              </p>
            </div>
          )}

          {/* Dupe confirm dialog */}
          {showDupeConfirm && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold text-amber-900">
                Duplicate entry detected. What would you like to do?
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => { const record = buildRecord(duplicateEntry!.id); persistSave(record); }}
                  className="px-3 py-1.5 bg-amber-600 text-white rounded-md text-sm font-medium hover:bg-amber-700 transition-colors"
                >
                  Update existing entry
                </button>
                <button
                  type="button"
                  onClick={handleCreateNew}
                  className="px-3 py-1.5 bg-white border border-amber-300 text-amber-800 rounded-md text-sm font-medium hover:bg-amber-50 transition-colors"
                >
                  Create new entry
                </button>
                <button
                  type="button"
                  onClick={() => setShowDupeConfirm(false)}
                  className="px-3 py-1.5 bg-white border border-neutral-300 text-neutral-700 rounded-md text-sm font-medium hover:bg-neutral-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Validation errors */}
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
              {errors.map((e, i) => (
                <p key={i} className="text-xs text-red-700 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  {e}
                </p>
              ))}
            </div>
          )}

          {/* Onset date */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Symptom Onset Date / Time <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={onsetDateISO}
              onChange={(e) => setOnsetDateISO(e.target.value)}
              className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Symptoms checklist */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Symptoms <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(symptomOptions as { tag: SymptomTag; label: string }[]).map(({ tag, label }) => (
                <label
                  key={tag}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer text-sm transition-colors ${
                    selectedSymptoms.has(tag)
                      ? 'bg-blue-50 border-blue-400 text-blue-800'
                      : 'bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedSymptoms.has(tag)}
                    onChange={() => toggleSymptom(tag)}
                    className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Fever toggle */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="fever"
              checked={fever}
              onChange={(e) => setFever(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="fever" className="text-sm font-medium text-neutral-700">
              Fever present?
            </label>
          </div>

          {/* Isolation */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isolationInitiated"
                checked={isolationInitiated}
                onChange={(e) => setIsolationInitiated(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="isolationInitiated" className="text-sm font-medium text-neutral-700">
                Isolation initiated?
              </label>
            </div>
            {isolationInitiated && (
              <input
                type="text"
                placeholder="Isolation status / type (optional)"
                value={isolationStatus}
                onChange={(e) => setIsolationStatus(e.target.value)}
                className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>

          {/* Test & provider */}
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="testOrdered"
                checked={testOrdered}
                onChange={(e) => setTestOrdered(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="testOrdered" className="text-sm font-medium text-neutral-700">
                Test ordered?
              </label>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="providerNotified"
                checked={providerNotified}
                onChange={(e) => setProviderNotified(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="providerNotified" className="text-sm font-medium text-neutral-700">
                Provider notified?
              </label>
            </div>
          </div>

          {/* Disposition */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Disposition
            </label>
            <select
              value={disposition}
              onChange={(e) => setDisposition(e.target.value as LineListDisposition | '')}
              className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Select disposition —</option>
              {DISPOSITIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Onset narrative / notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              placeholder="Optional notes about symptom onset, context, or clinical details…"
            />
          </div>
        </div>

        {/* Footer */}
        {!showDupeConfirm && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200 bg-neutral-50 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Save to Line List
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
