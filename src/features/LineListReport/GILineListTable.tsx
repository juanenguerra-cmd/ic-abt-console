import React from 'react';
import { Pencil } from 'lucide-react';
import { EditableCell } from './ILILineListTable';
import { useLineListOverrides } from '../../hooks/useLineListOverrides';

export interface GIRowModel {
  eventId?: string;
  room: string;
  unit: string;
  age: string;
  name: string;
  sex: string;
  onsetDate: string;
  fever: string;
  symptoms: string[];
  isolationInitiated: string;
  providerNotified: string;
  testOrdered: string;
  abt: string;
  disposition: string;
  notes: string;
}

interface GILineListTableProps {
  rows: GIRowModel[];
  facilityName: string;
  startDate: string;
  endDate: string;
  facilityId: string;
  onEditRow?: (eventId: string) => void;
}

const MIN_ROWS = 20;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function GILineListTable({ rows, facilityName, startDate, endDate, facilityId, onEditRow }: GILineListTableProps) {
  const { overrides, saveOverride } = useLineListOverrides({
    outbreakId: 'global',
    facilityId,
    template: 'gi',
  });

  const displayRows = [...rows];
  while (displayRows.length < MIN_ROWS) {
    displayRows.push({
      room: '', unit: '', age: '', name: '', sex: '', onsetDate: '',
      fever: '', symptoms: [], isolationInitiated: '',
      providerNotified: '', testOrdered: '', abt: '',
      disposition: '', notes: '',
    });
  }

  const getVal = (row: GIRowModel, index: number, colKey: string, defaultVal: string) => {
    const rowKey = row.eventId || `row-${index}`;
    const overrideKey = `${rowKey}::${colKey}`;
    return overrides[overrideKey] !== undefined ? overrides[overrideKey] : defaultVal;
  };

  const handleSave = (row: GIRowModel, index: number, colKey: string, val: string) => {
    const rowKey = row.eventId || `row-${index}`;
    saveOverride(rowKey, colKey, val);
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      {/* Report header */}
      <table style={{ borderCollapse: 'collapse', width: '100%', fontFamily: 'Arial, sans-serif', fontSize: '8pt', marginBottom: '4px' }}>
        <tbody>
          <tr>
            <td style={{ border: '1px solid #000', padding: '3px 6px', fontWeight: 700, fontSize: '10pt', textAlign: 'center' }} colSpan={21}>
              GASTROENTERITIS LINE LIST FORM
            </td>
          </tr>
          <tr>
            <td style={{ border: '1px solid #000', padding: '3px 6px' }} colSpan={11}>
              <strong>Facility Name: </strong>
              <span
                contentEditable
                suppressContentEditableWarning
                style={{ outline: 'none', minWidth: '200px', display: 'inline-block' }}
                dangerouslySetInnerHTML={{ __html: facilityName }}
              />
            </td>
            <td style={{ border: '1px solid #000', padding: '3px 6px' }} colSpan={5}>
              <strong>Contact Person: </strong>
              <span
                contentEditable
                suppressContentEditableWarning
                style={{ outline: 'none', minWidth: '120px', display: 'inline-block' }}
                dangerouslySetInnerHTML={{ __html: '' }}
              />
            </td>
            <td style={{ border: '1px solid #000', padding: '3px 6px' }} colSpan={5}>
              <strong>Email: </strong>
              <span
                contentEditable
                suppressContentEditableWarning
                style={{ outline: 'none', minWidth: '150px', display: 'inline-block' }}
                dangerouslySetInnerHTML={{ __html: '' }}
              />
            </td>
          </tr>
          <tr>
            <td style={{ border: '1px solid #000', padding: '3px 6px' }} colSpan={21}>
              <strong>Date Range: </strong>
              <span
                contentEditable
                suppressContentEditableWarning
                style={{ outline: 'none', minWidth: '200px', display: 'inline-block' }}
                dangerouslySetInnerHTML={{ __html: `${startDate} – ${endDate}` }}
              />
            </td>
          </tr>
        </tbody>
      </table>

      {/* Data table */}
      <table style={{ borderCollapse: 'collapse', width: '100%', fontFamily: 'Arial, sans-serif', fontSize: '7pt' }}>
        <thead>
          {/* Header Row 1 — group labels */}
          <tr style={{ background: '#f0f0f0' }}>
            <th style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }} rowSpan={2}>Case Initials</th>
            <th style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }} rowSpan={2}>Unit</th>
            <th style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }} rowSpan={2}>Room #</th>
            <th style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }} rowSpan={2}>Symptom Onset Date</th>
            <th style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }} colSpan={12}>Severity</th>
            <th style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }} colSpan={2}>Treatment</th>
            <th style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }} colSpan={5}>Lab Testing</th>
            <th className="no-print" style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }} rowSpan={2}>Edit</th>
          </tr>
          {/* Header Row 2 — sub-labels */}
          <tr style={{ background: '#f0f0f0' }}>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', height: '55px', fontSize: '6pt' }}>Fever°</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', height: '55px', fontSize: '6pt' }}>Tmax</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', height: '55px', fontSize: '6pt' }}>Nausea</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', height: '55px', fontSize: '6pt' }}>Vomiting</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', height: '55px', fontSize: '6pt' }}>Diarrhea</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', height: '55px', fontSize: '6pt' }}>Abd. Cramps</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', height: '55px', fontSize: '6pt' }}>Duration</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', height: '55px', fontSize: '6pt' }}>Physician Seen</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', height: '55px', fontSize: '6pt' }}>Hospitalized</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', height: '55px', fontSize: '6pt' }}>Hospital Name</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', height: '55px', fontSize: '6pt' }}>Died</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', height: '55px', fontSize: '6pt' }}>Date of Death</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', height: '55px', fontSize: '6pt' }}>Antibiotic Y/N/U</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', height: '55px', fontSize: '6pt' }}>Antidiarrheal Y/N/U</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', height: '55px', fontSize: '6pt' }}>Lab Y/N/U</th>
            <th style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontSize: '6pt' }}>Specimen Type</th>
            <th style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontSize: '6pt' }}>Collect Date</th>
            <th style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontSize: '6pt' }}>Type of Test</th>
            <th style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontSize: '6pt' }}>Result</th>
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row, i) => {
            const initials = getInitials(row.name);
            return (
              <tr key={i}>
                <EditableCell value={getVal(row, i, 'initials', initials)} autoFilled={!!initials} onChange={(v) => handleSave(row, i, 'initials', v)} />
                <EditableCell value={getVal(row, i, 'unit', row.unit)} autoFilled={!!row.unit} onChange={(v) => handleSave(row, i, 'unit', v)} />
                <EditableCell value={getVal(row, i, 'room', row.room)} autoFilled={!!row.room} onChange={(v) => handleSave(row, i, 'room', v)} />
                <EditableCell value={getVal(row, i, 'onsetDate', row.onsetDate)} autoFilled={!!row.onsetDate} onChange={(v) => handleSave(row, i, 'onsetDate', v)} />
                {/* Severity */}
                <EditableCell value={getVal(row, i, 'fever', row.fever)} autoFilled={row.fever !== '' && row.fever !== 'U'} onChange={(v) => handleSave(row, i, 'fever', v)} />
                <EditableCell value={getVal(row, i, 'tmax', '')} onChange={(v) => handleSave(row, i, 'tmax', v)} />
                <EditableCell value={getVal(row, i, 'nausea', row.symptoms.includes('nausea') ? 'Y' : 'U')} autoFilled={row.symptoms.includes('nausea')} onChange={(v) => handleSave(row, i, 'nausea', v)} />
                <EditableCell value={getVal(row, i, 'vomiting', row.symptoms.includes('vomiting') ? 'Y' : 'U')} autoFilled={row.symptoms.includes('vomiting')} onChange={(v) => handleSave(row, i, 'vomiting', v)} />
                <EditableCell value={getVal(row, i, 'diarrhea', row.symptoms.includes('diarrhea') ? 'Y' : 'U')} autoFilled={row.symptoms.includes('diarrhea')} onChange={(v) => handleSave(row, i, 'diarrhea', v)} />
                <EditableCell value={getVal(row, i, 'cramps', row.symptoms.includes('stomach_cramping') ? 'Y' : 'U')} autoFilled={row.symptoms.includes('stomach_cramping')} onChange={(v) => handleSave(row, i, 'cramps', v)} />
                <EditableCell value={getVal(row, i, 'duration', '')} onChange={(v) => handleSave(row, i, 'duration', v)} />
                <EditableCell value={getVal(row, i, 'physicianSeen', row.providerNotified)} autoFilled={!!row.providerNotified} onChange={(v) => handleSave(row, i, 'physicianSeen', v)} />
                <EditableCell value={getVal(row, i, 'hospitalized', '')} onChange={(v) => handleSave(row, i, 'hospitalized', v)} />
                <EditableCell value={getVal(row, i, 'hospitalName', '')} onChange={(v) => handleSave(row, i, 'hospitalName', v)} />
                <EditableCell value={getVal(row, i, 'died', '')} onChange={(v) => handleSave(row, i, 'died', v)} />
                <EditableCell value={getVal(row, i, 'dateOfDeath', '')} onChange={(v) => handleSave(row, i, 'dateOfDeath', v)} />
                {/* Treatment */}
                <EditableCell value={getVal(row, i, 'antibiotic', row.abt ? 'Y' : 'U')} autoFilled={!!row.abt} onChange={(v) => handleSave(row, i, 'antibiotic', v)} />
                <EditableCell value={getVal(row, i, 'antidiarrheal', 'U')} onChange={(v) => handleSave(row, i, 'antidiarrheal', v)} />
                {/* Lab */}
                <EditableCell value={getVal(row, i, 'labTesting', row.testOrdered === 'Y' ? 'Y' : 'U')} autoFilled={row.testOrdered === 'Y'} onChange={(v) => handleSave(row, i, 'labTesting', v)} />
                <EditableCell value={getVal(row, i, 'specimenType', '')} onChange={(v) => handleSave(row, i, 'specimenType', v)} />
                <EditableCell value={getVal(row, i, 'collectDate', '')} onChange={(v) => handleSave(row, i, 'collectDate', v)} />
                <EditableCell value={getVal(row, i, 'typeOfTest', '')} onChange={(v) => handleSave(row, i, 'typeOfTest', v)} />
                <EditableCell value={getVal(row, i, 'result', '')} onChange={(v) => handleSave(row, i, 'result', v)} />
                <td className="no-print" style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }}>
                  {row.eventId && (
                    <button
                      onClick={() => onEditRow?.(row.eventId!)}
                      className="p-1 text-neutral-400 hover:text-indigo-600 rounded"
                      title="Edit entry"
                      aria-label="Edit line list entry"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
