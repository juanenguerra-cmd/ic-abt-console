import React from 'react';
import { EditableCell, RowModel } from './LineListReportTab';

interface Props {
  rows: RowModel[];
  facilityName: string;
  startDate: string;
  endDate: string;
}

const MIN_ROWS = 15;

export const ILILineListTable: React.FC<Props> = ({ rows, facilityName, startDate, endDate }) => {
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

  return (
    <div style={{ overflowX: 'auto' }}>
      {/* Report Header */}
      <div className="report-header" style={{ textAlign: 'center', marginBottom: '8px' }}>
        <h1 style={{ fontSize: '13pt', fontWeight: 'bold', margin: '0 0 4px 0' }}>
          INFLUENZA-LIKE ILLNESS (ILI) LINE LIST
        </h1>
        <div className="meta" style={{ fontSize: '9pt' }}>
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
      </div>

      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '6.5pt', fontFamily: 'Arial, sans-serif' }}>
        <colgroup>
          <col style={{ width: '28px' }} />  {/* Rm */}
          <col style={{ width: '24px' }} />  {/* Age */}
          <col style={{ width: '80px' }} />  {/* Resident */}
          {/* Sex */}
          <col style={{ width: '16px' }} />
          <col style={{ width: '16px' }} />
          {/* Flu Vax */}
          <col style={{ width: '16px' }} />
          <col style={{ width: '16px' }} />
          {/* Pneumo Vax */}
          <col style={{ width: '16px' }} />
          <col style={{ width: '16px' }} />
          {/* Predisposing Factors x7 */}
          <col style={{ width: '16px' }} />
          <col style={{ width: '16px' }} />
          <col style={{ width: '16px' }} />
          <col style={{ width: '16px' }} />
          <col style={{ width: '16px' }} />
          <col style={{ width: '16px' }} />
          <col style={{ width: '16px' }} />
          {/* Onset Date */}
          <col style={{ width: '44px' }} />
          {/* Symptoms x6 */}
          <col style={{ width: '24px' }} />
          <col style={{ width: '16px' }} />
          <col style={{ width: '16px' }} />
          <col style={{ width: '16px' }} />
          <col style={{ width: '16px' }} />
          <col style={{ width: '16px' }} />
          {/* Right side */}
          <col style={{ width: '24px' }} />  {/* Duration Fever */}
          <col style={{ width: '34px' }} />  {/* Hosp Date */}
          <col style={{ width: '34px' }} />  {/* Date Died */}
          <col style={{ width: '44px' }} />  {/* Lab Results */}
          <col style={{ width: '44px' }} />  {/* Antibiotic */}
          <col style={{ width: '16px' }} />  {/* X-Ray */}
          <col style={{ width: '16px' }} />  {/* Pneumonia */}
        </colgroup>
        <thead>
          {/* ROW 1 — Group labels */}
          <tr>
            <th rowSpan={2} style={{ border: '1px solid #000', padding: '2px', fontSize: '6pt', fontWeight: 'bold' }}>Rm</th>
            <th rowSpan={2} style={{ border: '1px solid #000', padding: '2px', fontSize: '6pt', fontWeight: 'bold' }}>Age</th>
            <th rowSpan={2} style={{ border: '1px solid #000', padding: '2px', fontSize: '6pt', fontWeight: 'bold' }}>Resident</th>
            <th colSpan={2} style={{ border: '1px solid #000', padding: '2px', fontSize: '6pt', fontWeight: 'bold' }}>Sex</th>
            <th colSpan={2} style={{ border: '1px solid #000', padding: '2px', fontSize: '6pt', fontWeight: 'bold' }}>Influenza Vaccine</th>
            <th colSpan={2} style={{ border: '1px solid #000', padding: '2px', fontSize: '6pt', fontWeight: 'bold' }}>Pneum. Vaccine</th>
            <th colSpan={7} style={{ border: '1px solid #000', padding: '2px', fontSize: '6pt', fontWeight: 'bold' }}>Predisposing Factors</th>
            <th rowSpan={2} style={{ border: '1px solid #000', padding: '2px', fontSize: '6pt', fontWeight: 'bold' }}>Date of Onset</th>
            <th colSpan={6} style={{ border: '1px solid #000', padding: '2px', fontSize: '6pt', fontWeight: 'bold' }}>Symptoms</th>
            <th rowSpan={2} className="rotate" style={{ border: '1px solid #000', padding: '2px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '50px', fontSize: '5.5pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Duration of Fever</th>
            <th rowSpan={2} className="rotate" style={{ border: '1px solid #000', padding: '2px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '50px', fontSize: '5.5pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Hosp. Date</th>
            <th rowSpan={2} className="rotate" style={{ border: '1px solid #000', padding: '2px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '50px', fontSize: '5.5pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Date Died</th>
            <th rowSpan={2} style={{ border: '1px solid #000', padding: '2px', fontSize: '6pt', fontWeight: 'bold' }}>Lab Results</th>
            <th rowSpan={2} style={{ border: '1px solid #000', padding: '2px', fontSize: '6pt', fontWeight: 'bold' }}>Antibiotic</th>
            <th rowSpan={2} className="rotate" style={{ border: '1px solid #000', padding: '2px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '50px', fontSize: '5.5pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}>X-Ray</th>
            <th rowSpan={2} className="rotate" style={{ border: '1px solid #000', padding: '2px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '50px', fontSize: '5.5pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Pneumonia</th>
          </tr>
          {/* ROW 2 — Sub-labels */}
          <tr>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '50px', fontSize: '5.5pt', fontWeight: 'bold' }}>M</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '50px', fontSize: '5.5pt', fontWeight: 'bold' }}>F</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '50px', fontSize: '5.5pt', fontWeight: 'bold' }}>Y</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '50px', fontSize: '5.5pt', fontWeight: 'bold' }}>N</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '50px', fontSize: '5.5pt', fontWeight: 'bold' }}>Y</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '50px', fontSize: '5.5pt', fontWeight: 'bold' }}>N</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '50px', fontSize: '5.5pt', fontWeight: 'bold' }}>CVD</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '50px', fontSize: '5.5pt', fontWeight: 'bold' }}>COPD</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '50px', fontSize: '5.5pt', fontWeight: 'bold' }}>DM</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '50px', fontSize: '5.5pt', fontWeight: 'bold' }}>Anemia</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '50px', fontSize: '5.5pt', fontWeight: 'bold' }}>Renal</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '50px', fontSize: '5.5pt', fontWeight: 'bold' }}>CA</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '50px', fontSize: '5.5pt', fontWeight: 'bold' }}>Steroids</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '50px', fontSize: '5.5pt', fontWeight: 'bold' }}>Highest Temp</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '50px', fontSize: '5.5pt', fontWeight: 'bold' }}>Cough</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '50px', fontSize: '5.5pt', fontWeight: 'bold' }}>Congestion</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '50px', fontSize: '5.5pt', fontWeight: 'bold' }}>Pharyngitis</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '50px', fontSize: '5.5pt', fontWeight: 'bold' }}>Rhinitis</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '50px', fontSize: '5.5pt', fontWeight: 'bold' }}>Headache</th>
          </tr>
        </thead>
        <tbody>
          {paddedRows.map((row, i) => (
            <tr key={i}>
              <EditableCell value={row.room} autoFilled={!!row.room} />
              <EditableCell value={row.age} autoFilled={!!row.age} />
              <EditableCell value={row.name} autoFilled={!!row.name} style={{ textAlign: 'left' }} />
              {/* Sex */}
              <EditableCell value={row.sex === 'M' ? '●' : ''} autoFilled={!!row.sex} />
              <EditableCell value={row.sex === 'F' ? '●' : ''} autoFilled={!!row.sex} />
              {/* Flu Vax */}
              <EditableCell value={row.fluVax === 'Y' ? '●' : ''} autoFilled={row.fluVax !== ''} />
              <EditableCell value={row.fluVax === 'N' ? '●' : ''} autoFilled={row.fluVax !== ''} />
              {/* Pneumo Vax */}
              <EditableCell value={row.pneuVax === 'Y' ? '●' : ''} autoFilled={row.pneuVax !== ''} />
              <EditableCell value={row.pneuVax === 'N' ? '●' : ''} autoFilled={row.pneuVax !== ''} />
              {/* Predisposing Factors — no data source, blank */}
              <EditableCell value="" />
              <EditableCell value="" />
              <EditableCell value="" />
              <EditableCell value="" />
              <EditableCell value="" />
              <EditableCell value="" />
              <EditableCell value="" />
              {/* Onset Date */}
              <EditableCell value={row.onsetDate} autoFilled={!!row.onsetDate} />
              {/* Symptoms */}
              <EditableCell value="" /> {/* Highest Temp — manual */}
              <EditableCell value={row.symptoms.includes('cough') ? '●' : ''} autoFilled={row.symptoms.length > 0} />
              <EditableCell value={row.symptoms.includes('congestion') ? '●' : ''} autoFilled={row.symptoms.length > 0} />
              <EditableCell value={row.symptoms.includes('sore_throat') ? '●' : ''} autoFilled={row.symptoms.length > 0} />
              <EditableCell value={row.symptoms.includes('runny_nose') ? '●' : ''} autoFilled={row.symptoms.length > 0} />
              <EditableCell value={(row.symptoms as string[]).includes('headache') ? '●' : ''} autoFilled={row.symptoms.length > 0} />
              {/* Right side manual blanks except Antibiotic */}
              <EditableCell value="" /> {/* Duration of Fever */}
              <EditableCell value="" /> {/* Hosp. Date */}
              <EditableCell value="" /> {/* Date Died */}
              <EditableCell value="" /> {/* Lab Results */}
              <EditableCell value={row.abt} autoFilled={!!row.abt} />
              <EditableCell value="" /> {/* X-Ray */}
              <EditableCell value="" /> {/* Pneumonia */}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
