import React, { useState } from 'react';

interface OnsetDateCellProps {
  eventId: string;
  originalDate: string;
  onCorrected: (eventId: string, newDateISO: string) => Promise<void>;
}

function displayFormatted(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso.includes('T') ? iso : `${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

export function OnsetDateCell({ eventId, originalDate, onCorrected }: OnsetDateCellProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState((originalDate ?? '').split('T')[0]);
  const [saving, setSaving] = useState(false);
  const [corrected, setCorrected] = useState(false);

  const handleConfirm = async (newISO: string) => {
    if (!newISO || newISO === ((originalDate ?? '').split('T')[0])) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onCorrected(eventId, newISO);
      setValue(newISO);
      setCorrected(true);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  const classes = [
    'onset-date-cell',
    corrected ? 'onset-corrected' : 'autofill',
  ].join(' ');

  return (
    <td
      className={classes}
      onClick={() => !editing && setEditing(true)}
      title="Click to correct onset date"
    >
      {editing ? (
        <input
          type="date"
          autoFocus
          defaultValue={value}
          className="onset-date-input"
          onBlur={(e) => handleConfirm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleConfirm((e.target as HTMLInputElement).value);
            }
            if (e.key === 'Escape') setEditing(false);
          }}
        />
      ) : (
        <div className="onset-date-display">
          {saving ? (
            <span className="onset-saving">Saving…</span>
          ) : (
            <>
              <span className="onset-current">{displayFormatted(value)}</span>
              {corrected && (
                <span className="onset-original">
                  orig: {displayFormatted(originalDate)}
                </span>
              )}
              <span className="onset-edit-hint">✎</span>
            </>
          )}
        </div>
      )}
    </td>
  );
}
