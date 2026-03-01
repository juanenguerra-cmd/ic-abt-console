import React from 'react';
import { EditableCell } from './ILILineListTable';

export interface GIRowModel {
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
}

const MIN_ROWS = 20;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function GILineListTable({ rows, facilityName, startDate, endDate }: GILineListTableProps) {
  const displayRows = [...rows];
  while (displayRows.length < MIN_ROWS) {
    displayRows.push({
      room: '', unit: '', age: '', name: '', sex: '', onsetDate: '',
      fever: '', symptoms: [], isolationInitiated: '',
      providerNotified: '', testOrdered: '', abt: '',
      disposition: '', notes: '',
    });
  }

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
                <EditableCell value={initials} autoFilled={!!initials} />
                <EditableCell value={row.unit} autoFilled={!!row.unit} />
                <EditableCell value={row.room} autoFilled={!!row.room} />
                <EditableCell value={row.onsetDate} autoFilled={!!row.onsetDate} />
                {/* Severity */}
                <EditableCell value={row.fever} autoFilled={row.fever !== '' && row.fever !== 'U'} />
                <EditableCell value="" />
                <EditableCell value={row.symptoms.includes('nausea') ? 'Y' : 'U'} autoFilled={row.symptoms.includes('nausea')} />
                <EditableCell value={row.symptoms.includes('vomiting') ? 'Y' : 'U'} autoFilled={row.symptoms.includes('vomiting')} />
                <EditableCell value={row.symptoms.includes('diarrhea') ? 'Y' : 'U'} autoFilled={row.symptoms.includes('diarrhea')} />
                <EditableCell value={row.symptoms.includes('stomach_cramping') ? 'Y' : 'U'} autoFilled={row.symptoms.includes('stomach_cramping')} />
                <EditableCell value="" />
                <EditableCell value={row.providerNotified} autoFilled={!!row.providerNotified} />
                <EditableCell value="" />
                <EditableCell value="" />
                <EditableCell value="" />
                <EditableCell value="" />
                {/* Treatment */}
                <EditableCell value={row.abt ? 'Y' : 'U'} autoFilled={!!row.abt} />
                <EditableCell value="U" />
                {/* Lab */}
                <EditableCell value={row.testOrdered === 'Y' ? 'Y' : 'U'} autoFilled={row.testOrdered === 'Y'} />
                <EditableCell value="" />
                <EditableCell value="" />
                <EditableCell value="" />
                <EditableCell value="" />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
