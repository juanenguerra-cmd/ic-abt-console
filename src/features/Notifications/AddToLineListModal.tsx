import React, { useState, useMemo } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { useFacilityData, useDatabase } from '../../app/providers';
import { AppNotification, IPEvent } from '../../domain/models';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  notification: AppNotification;
  onClose: () => void;
}

/** Derive a human-readable symptom class and infectionCategory from the notification message/refs. */
function deriveSymptomClass(notif: AppNotification): {
  label: string;
  infectionCategory: string;
  infectionSite: string;
} {
  const msg = (notif.message || '').toLowerCase();
  if (msg.includes('resp') || msg.includes('pneumonia') || msg.includes('covid') || msg.includes('influenza') || msg.includes('rsv') || msg.includes('uri') || msg.includes('cough') || msg.includes('bronchitis')) {
    return { label: 'Respiratory', infectionCategory: 'Pneumonia', infectionSite: 'Respiratory Tract' };
  }
  if (msg.includes('gi') || msg.includes('diarrhea') || msg.includes('vomit') || msg.includes('gastro') || msg.includes('c. diff') || msg.includes('cdiff') || msg.includes('norovirus') || msg.includes('nausea')) {
    return { label: 'GI', infectionCategory: 'GI', infectionSite: 'GI Tract' };
  }
  if (msg.includes('uti') || msg.includes('urinary') || msg.includes('cystitis') || msg.includes('pyelonephritis')) {
    return { label: 'UTI', infectionCategory: 'UTI', infectionSite: 'Urinary Tract' };
  }
  return { label: 'Unknown', infectionCategory: 'Other', infectionSite: 'Other' };
}

const MS_96H = 96 * 60 * 60 * 1000;

export const AddToLineListModal: React.FC<Props> = ({ notification, onClose }) => {
  const { store, activeFacilityId } = useFacilityData();
  const { updateDB } = useDatabase();

  const resident = notification.residentId ? store.residents[notification.residentId] : undefined;
  const { label: symptomClass, infectionCategory, infectionSite } = useMemo(
    () => deriveSymptomClass(notification),
    [notification]
  );

  const [notes, setNotes] = useState('');
  const [isolationType, setIsolationType] = useState('Contact');

  /** Check if an active IPEvent for same resident+category exists within 96h (dedup). */
  const existingEntry = useMemo<IPEvent | undefined>(() => {
    if (!notification.residentId) return undefined;
    const cutoff = Date.now() - MS_96H;
    return Object.values(store.infections || {}).find(
      ip =>
        ip.residentRef.kind === 'mrn' &&
        ip.residentRef.id === notification.residentId &&
        ip.status === 'active' &&
        ip.infectionCategory === infectionCategory &&
        new Date(ip.createdAt).getTime() >= cutoff
    );
  }, [store.infections, notification.residentId, infectionCategory]);

  const handleSave = () => {
    if (!notification.residentId) return;

    const now = new Date().toISOString();
    const ipId = existingEntry ? existingEntry.id : uuidv4();

    updateDB(draft => {
      const fd = draft.data.facilityData[activeFacilityId];

      if (existingEntry) {
        // Update existing entry — append notes
        const existing = fd.infections[ipId];
        if (existing) {
          existing.notes = [existing.notes, notes].filter(Boolean).join('\n');
          existing.updatedAt = now;
        }
      } else {
        // Create new IPEvent
        fd.infections[ipId] = {
          id: ipId,
          residentRef: { kind: 'mrn', id: notification.residentId },
          status: 'active',
          infectionCategory,
          infectionSite,
          isolationType,
          locationSnapshot:
            resident?.currentUnit || resident?.currentRoom
              ? { unit: resident.currentUnit ?? undefined, room: resident.currentRoom ?? undefined, capturedAt: now }
              : undefined,
          notes: notes || undefined,
          createdAt: now,
          updatedAt: now,
        } satisfies IPEvent;
      }

      // Mark notification as acted
      if (fd.notifications[notification.id]) {
        fd.notifications[notification.id].actedAt = now;
        fd.notifications[notification.id].lineListEventId = ipId;
        fd.notifications[notification.id].status = 'read';
      }
    });

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

          {/* Isolation type (only for new entries) */}
          {!existingEntry && (
            <div>
              <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                Isolation / Precaution Type
              </label>
              <select
                value={isolationType}
                onChange={e => setIsolationType(e.target.value)}
                className="w-full border border-neutral-300 rounded-md text-sm px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {['Contact', 'Droplet', 'Airborne', 'Contact + Droplet', 'Droplet + Contact', 'Standard', 'None'].map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
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
