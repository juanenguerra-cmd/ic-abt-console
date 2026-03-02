import React from 'react';
import { EditableCell, RowModel } from './LineListReportTab';
import { OnsetDateCell } from './OnsetDateCell';
import { useCorrectOnsetDate } from '../hooks/useCorrectOnsetDate';
import { useLineListOverrides } from '../../../hooks/useLineListOverrides';

interface Props {
  rows: RowModel[];
  facilityName: string;
  startDate: string;
  endDate: string;
  outbreakId: string;
  facilityId: string;
}

const MIN_ROWS = 15;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}

export const GILineListTable: React.FC<Props> = ({ rows, facilityName, startDate, endDate, outbreakId, facilityId }) => {
  const { correctOnset } = useCorrectOnsetDate();
  const { overrides, saveOverride } = useLineListOverrides({
    outbreakId,
    facilityId,
    template: 'gi',
  });

  const paddedRows: RowModel[] = [...rows];
  while (paddedRows.length < MIN_ROWS) {
    paddedRows.push({
      room: '', unit: '', age: '', name: '', sex: '',
      onsetDate: '', fluVax: '', pneuVax: '',
      fever: '', symptoms: [], isolationInitiated: '',
      providerNotified: '', testOrdered: '', abt: '',
      disposition: '', notes: '',
    });
  }

  const getVal = (row: RowModel, index: number, colKey: string, defaultVal: string) => {
    const rowKey = row.eventId || `row-${index}`;
    const overrideKey = `${rowKey}::${colKey}`;
    return overrides[overrideKey] !== undefined ? overrides[overrideKey] : defaultVal;
  };

  const handleSave = (row: RowModel, index: number, colKey: string, val: string) => {
    const rowKey = row.eventId || `row-${index}`;
    saveOverride(rowKey, colKey, val);
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      {/* Report Header */}
      <div className="report-header" style={{ textAlign: 'center', marginBottom: '8px' }}>
        <h1 style={{ fontSize: '13pt', fontWeight: 'bold', margin: '0 0 4px 0' }}>
          GASTROENTERITIS LINE LIST FORM
        </h1>
        <div className="meta" style={{ fontSize: '9pt' }}>
          <strong>Facility Name:</strong>{' '}
          <span
            contentEditable
            suppressContentEditableWarning
            style={{ borderBottom: '1px solid #999', minWidth: '120px', display: 'inline-block' }}
          >
            {facilityName}
          </span>
          {'  '}
          <strong>Date Range:</strong>{' '}
          <span
            contentEditable
            suppressContentEditableWarning
            style={{ borderBottom: '1px solid #999', minWidth: '80px', display: 'inline-block' }}
          >
            {startDate}
          </span>
          {' — '}
          <span
            contentEditable
            suppressContentEditableWarning
            style={{ borderBottom: '1px solid #999', minWidth: '80px', display: 'inline-block' }}
          >
            {endDate}
          </span>
        </div>
        <div className="meta" style={{ fontSize: '9pt', marginTop: '4px' }}>
          <strong>Contact Person:</strong>{' '}
          <span
            contentEditable
            suppressContentEditableWarning
            style={{ borderBottom: '1px solid #999', minWidth: '100px', display: 'inline-block' }}
          >
            {''}
          </span>
          {'  '}
          <strong>Email:</strong>{' '}
          <span
            contentEditable
            suppressContentEditableWarning
            style={{ borderBottom: '1px solid #999', minWidth: '120px', display: 'inline-block' }}
          >
            {''}
          </span>
        </div>
      </div>

      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '6.5pt', fontFamily: 'Arial, sans-serif' }}>
        <colgroup>
          <col style={{ width: '32px' }} /> {/* Case Initials */}
          <col style={{ width: '44px' }} /> {/* Unit */}
          <col style={{ width: '28px' }} /> {/* Room # */}
          <col style={{ width: '44px' }} /> {/* Onset Date */}
          {/* Severity */}
          <col style={{ width: '16px' }} /> {/* Fever */}
          <col style={{ width: '24px' }} /> {/* T max */}
          <col style={{ width: '16px' }} /> {/* Nausea */}
          <col style={{ width: '16px' }} /> {/* Vomiting */}
          <col style={{ width: '16px' }} /> {/* Diarrhea */}
          <col style={{ width: '16px' }} /> {/* Abdominal Cramps */}
          <col style={{ width: '24px' }} /> {/* Duration */}
          <col style={{ width: '16px' }} /> {/* Physician Seen */}
          <col style={{ width: '16px' }} /> {/* Hospitalized */}
          <col style={{ width: '44px' }} /> {/* Hospital Name */}
          <col style={{ width: '16px' }} /> {/* Died */}
          <col style={{ width: '44px' }} /> {/* Date of Death */}
          {/* Treatment */}
          <col style={{ width: '16px' }} /> {/* Antibiotic */}
          <col style={{ width: '16px' }} /> {/* Antidiarrheal */}
          {/* Lab Testing */}
          <col style={{ width: '16px' }} /> {/* Lab Y/N/U */}
          <col style={{ width: '44px' }} /> {/* Specimen Type */}
          <col style={{ width: '44px' }} /> {/* Collect Date */}
          <col style={{ width: '44px' }} /> {/* Type of Test */}
          <col style={{ width: '44px' }} /> {/* Result */}
        </colgroup>
        <thead>
          {/* ROW 1 — Group labels */}
          <tr>
            <th rowSpan={2} style={{ border: '1px solid #000', padding: '2px', fontSize: '6pt', fontWeight: 'bold' }}>Case Initials</th>
            <th rowSpan={2} style={{ border: '1px solid #000', padding: '2px', fontSize: '6pt', fontWeight: 'bold' }}>Unit</th>
            <th rowSpan={2} style={{ border: '1px solid #000', padding: '2px', fontSize: '6pt', fontWeight: 'bold' }}>Room #</th>
            <th rowSpan={2} style={{ border: '1px solid #000', padding: '2px', fontSize: '6pt', fontWeight: 'bold' }}>Symptom Onset Date</th>
            <th colSpan={12} style={{ border: '1px solid #000', padding: '2px', fontSize: '6pt', fontWeight: 'bold' }}>Severity</th>
            <th colSpan={2} style={{ border: '1px solid #000', padding: '2px', fontSize: '6pt', fontWeight: 'bold' }}>Treatment</th>
            <th colSpan={5} style={{ border: '1px solid #000', padding: '2px', fontSize: '6pt', fontWeight: 'bold' }}>Lab Testing</th>
          </tr>
          {/* ROW 2 — Sub-labels */}
          <tr>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '50px', fontSize: '5.5pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Fever Y/N/U</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '50px', fontSize: '5.5pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}>T max°</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '50px', fontSize: '5.5pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Nausea Y/N/U</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '50px', fontSize: '5.5pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Vomiting Y/N/U</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '50px', fontSize: '5.5pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Diarrhea Y/N/U</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '50px', fontSize: '5.5pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Abdominal Cramps Y/N/U</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '50px', fontSize: '5.5pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Duration</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '50px', fontSize: '5.5pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Physician Seen Y/N/U</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '50px', fontSize: '5.5pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Hospitalized Y/N/U</th>
            <th style={{ border: '1px solid #000', padding: '2px', fontSize: '5.5pt', fontWeight: 'bold' }}>Hospital Name</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '50px', fontSize: '5.5pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Died Y/N/U</th>
            <th style={{ border: '1px solid #000', padding: '2px', fontSize: '5.5pt', fontWeight: 'bold' }}>Date of Death</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '50px', fontSize: '5.5pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Antibiotic Y/N/U</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '50px', fontSize: '5.5pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Antidiarrheal Medication Y/N/U</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '50px', fontSize: '5.5pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Lab Testing Y/N/U</th>
            <th style={{ border: '1px solid #000', padding: '2px', fontSize: '5.5pt', fontWeight: 'bold' }}>Specimen Type</th>
            <th style={{ border: '1px solid #000', padding: '2px', fontSize: '5.5pt', fontWeight: 'bold' }}>Collect Date</th>
            <th style={{ border: '1px solid #000', padding: '2px', fontSize: '5.5pt', fontWeight: 'bold' }}>Type of Test</th>
            <th style={{ border: '1px solid #000', padding: '2px', fontSize: '5.5pt', fontWeight: 'bold' }}>Result</th>
          </tr>
        </thead>
        <tbody>
          {paddedRows.map((row, i) => (
            <tr key={i}>
              <EditableCell value={getVal(row, i, 'initials', getInitials(row.name))} autoFilled={!!row.name} onChange={(v) => handleSave(row, i, 'initials', v)} />
              <EditableCell value={getVal(row, i, 'unit', row.unit)} autoFilled={!!row.unit} onChange={(v) => handleSave(row, i, 'unit', v)} />
              <EditableCell value={getVal(row, i, 'room', row.room)} autoFilled={!!row.room} onChange={(v) => handleSave(row, i, 'room', v)} />
              {row.eventId ? (
                <OnsetDateCell
                  eventId={row.eventId}
                  originalDate={row.onsetDateISO ?? ''}
                  onCorrected={correctOnset}
                />
              ) : (
                <EditableCell value={getVal(row, i, 'onsetDate', '')} onChange={(v) => handleSave(row, i, 'onsetDate', v)} />
              )}
              {/* Severity */}
              <EditableCell value={getVal(row, i, 'fever', row.fever)} autoFilled={row.fever !== '' && row.fever !== 'U'} onChange={(v) => handleSave(row, i, 'fever', v)} />
              <EditableCell value={getVal(row, i, 'tmax', '')} onChange={(v) => handleSave(row, i, 'tmax', v)} /> {/* T max */}
              <EditableCell value={getVal(row, i, 'nausea', row.symptoms.includes('nausea') ? 'Y' : 'U')} autoFilled={row.symptoms.length > 0} onChange={(v) => handleSave(row, i, 'nausea', v)} />
              <EditableCell value={getVal(row, i, 'vomiting', row.symptoms.includes('vomiting') ? 'Y' : 'U')} autoFilled={row.symptoms.length > 0} onChange={(v) => handleSave(row, i, 'vomiting', v)} />
              <EditableCell value={getVal(row, i, 'diarrhea', row.symptoms.includes('diarrhea') ? 'Y' : 'U')} autoFilled={row.symptoms.length > 0} onChange={(v) => handleSave(row, i, 'diarrhea', v)} />
              <EditableCell value={getVal(row, i, 'cramps', row.symptoms.includes('stomach_cramping') ? 'Y' : 'U')} autoFilled={row.symptoms.length > 0} onChange={(v) => handleSave(row, i, 'cramps', v)} />
              <EditableCell value={getVal(row, i, 'duration', '')} onChange={(v) => handleSave(row, i, 'duration', v)} /> {/* Duration */}
              <EditableCell value={getVal(row, i, 'physicianSeen', row.providerNotified)} autoFilled={!!row.providerNotified && row.providerNotified !== 'U'} onChange={(v) => handleSave(row, i, 'physicianSeen', v)} />
              <EditableCell value={getVal(row, i, 'hospitalized', '')} onChange={(v) => handleSave(row, i, 'hospitalized', v)} /> {/* Hospitalized */}
              <EditableCell value={getVal(row, i, 'hospitalName', '')} onChange={(v) => handleSave(row, i, 'hospitalName', v)} /> {/* Hospital Name */}
              <EditableCell value={getVal(row, i, 'died', '')} onChange={(v) => handleSave(row, i, 'died', v)} /> {/* Died */}
              <EditableCell value={getVal(row, i, 'dateOfDeath', '')} onChange={(v) => handleSave(row, i, 'dateOfDeath', v)} /> {/* Date of Death */}
              {/* Treatment */}
              <EditableCell value={getVal(row, i, 'antibiotic', row.abt ? 'Y' : 'U')} autoFilled={!!row.abt} onChange={(v) => handleSave(row, i, 'antibiotic', v)} />
              <EditableCell value={getVal(row, i, 'antidiarrheal', 'U')} onChange={(v) => handleSave(row, i, 'antidiarrheal', v)} /> {/* Antidiarrheal */}
              {/* Lab Testing */}
              <EditableCell value={getVal(row, i, 'labTesting', row.testOrdered === 'Y' ? 'Y' : 'U')} autoFilled={row.testOrdered === 'Y'} onChange={(v) => handleSave(row, i, 'labTesting', v)} />
              <EditableCell value={getVal(row, i, 'specimenType', '')} onChange={(v) => handleSave(row, i, 'specimenType', v)} /> {/* Specimen Type */}
              <EditableCell value={getVal(row, i, 'collectDate', '')} onChange={(v) => handleSave(row, i, 'collectDate', v)} /> {/* Collect Date */}
              <EditableCell value={getVal(row, i, 'typeOfTest', '')} onChange={(v) => handleSave(row, i, 'typeOfTest', v)} /> {/* Type of Test */}
              <EditableCell value={getVal(row, i, 'result', '')} onChange={(v) => handleSave(row, i, 'result', v)} /> {/* Result */}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
