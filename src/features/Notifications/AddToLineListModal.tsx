import React, { useState, useMemo } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { useFacilityData, useDatabase } from '../../app/providers';
import { AppNotification, LineListEvent, SymptomClass } from '../../domain/models';
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

    updateDB(draft => {
      const fd = draft.data.facilityData[activeFacilityId];
      let recordId: string;

      if (existingEntry) {
        // Update existing entry — append notes
        recordId = existingEntry.id;
        const existing = fd.lineListEvents?.[existingEntry.id];
        if (existing) {
          existing.notes = [existing.notes, notes].filter(Boolean).join('\n');
          existing.updatedAt = now;
        }
      } else {
        // Create new LineListEvent (no IPEvent or isolation)
        const lineListEvent: LineListEvent = {
          id: uuidv4(),
          facilityId: activeFacilityId,
          residentId: notification.residentId,
          symptomClass: derivedSymptomClass,
          onsetDateISO: now,
          symptoms: [],
          isolationInitiated: false,
          isolationStatus: undefined,
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <h2 className="text-lg font-bold text-neutral-900">Add to Line List</h2>
          <button onClick={onClose} className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-md">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
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

          {/* Symptom class */}
          <div>
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Symptom Class (Detected)</p>
            <p className="text-sm text-neutral-900">{symptomClass}</p>
          </div>

          {/* Detected at */}
          <div>
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Detected At</p>
            <p className="text-sm text-neutral-900">{new Date(notification.createdAtISO).toLocaleString()}</p>
          </div>

          {/* Dedup notice */}
          {existingEntry && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800">
                An active line list entry for this resident and symptom class already exists within the last 96 hours.
                Any notes you add will be appended to that entry.
              </p>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Clinical context, additional details..."
              className="w-full border border-neutral-300 rounded-md text-sm px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-neutral-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
          >
            <Save className="w-4 h-4" />
            {existingEntry ? 'Update Entry' : 'Add to Line List'}
          </button>
        </div>
      </div>
    </div>
  );
};
