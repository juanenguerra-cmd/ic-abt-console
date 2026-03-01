import React from 'react';

interface EditableCellProps {
  value: string;
  autoFilled?: boolean;
  className?: string;
  colSpan?: number;
}

export function EditableCell({ value, autoFilled, className, colSpan }: EditableCellProps) {
  return (
    <td
      colSpan={colSpan}
      contentEditable
      suppressContentEditableWarning
      className={[
        'editable-cell',
        autoFilled ? 'autofill' : '',
        className ?? '',
      ].join(' ')}
      dangerouslySetInnerHTML={{ __html: value }}
    />
  );
}

export interface ILIRowModel {
  room: string;
  unit: string;
  age: string;
  name: string;
  sex: string;
  onsetDate: string;
  fluVax: string;
  pneuVax: string;
  fever: string;
  symptoms: string[];
  isolationInitiated: string;
  providerNotified: string;
  testOrdered: string;
  abt: string;
  disposition: string;
  notes: string;
}

interface ILILineListTableProps {
  rows: ILIRowModel[];
  facilityName: string;
  startDate: string;
  endDate: string;
}

const MIN_ROWS = 20;

export function ILILineListTable({ rows, facilityName, startDate, endDate }: ILILineListTableProps) {
  const displayRows = [...rows];
  while (displayRows.length < MIN_ROWS) {
    displayRows.push({
      room: '', unit: '', age: '', name: '', sex: '', onsetDate: '',
      fluVax: '', pneuVax: '', fever: '', symptoms: [],
      isolationInitiated: '', providerNotified: '', testOrdered: '',
      abt: '', disposition: '', notes: '',
    });
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      {/* Report header */}
      <table style={{ borderCollapse: 'collapse', width: '100%', fontFamily: 'Arial, sans-serif', fontSize: '8pt', marginBottom: '4px' }}>
        <tbody>
          <tr>
            <td style={{ border: '1px solid #000', padding: '3px 6px', fontWeight: 700, fontSize: '10pt', textAlign: 'center' }} colSpan={27}>
              INFLUENZA-LIKE ILLNESS LINE LIST
            </td>
          </tr>
          <tr>
            <td style={{ border: '1px solid #000', padding: '3px 6px' }} colSpan={14}>
              <strong>Facility: </strong>
              <span
                contentEditable
                suppressContentEditableWarning
                style={{ outline: 'none', minWidth: '200px', display: 'inline-block' }}
                dangerouslySetInnerHTML={{ __html: facilityName }}
              />
            </td>
            <td style={{ border: '1px solid #000', padding: '3px 6px' }} colSpan={13}>
              <strong>Date: </strong>
              <span
                contentEditable
                suppressContentEditableWarning
                style={{ outline: 'none', minWidth: '150px', display: 'inline-block' }}
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
            <th style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }} rowSpan={2}>Rm</th>
            <th style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }} rowSpan={2}>Age</th>
            <th style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }} rowSpan={2}>Resident Name</th>
            <th style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }} colSpan={2}>Sex (M/F)</th>
            <th style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }} colSpan={2}>Influenza Vaccine (Y/N)</th>
            <th style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }} colSpan={2}>Pneum. Vaccine (Y/N)</th>
            <th style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }} colSpan={7}>Predisposing Factors</th>
            <th style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }} rowSpan={2}>Date of Onset</th>
            <th style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }} colSpan={6}>Symptoms</th>
            <th style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }} rowSpan={2}>Duration of Fever</th>
            <th style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }} rowSpan={2}>Hosp. Date</th>
            <th style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }} rowSpan={2}>Date Died</th>
            <th style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }} rowSpan={2}>Lab Results</th>
            <th style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }} rowSpan={2}>Antibiotic</th>
            <th style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }} rowSpan={2}>X-Ray</th>
            <th style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }} rowSpan={2}>Pneumonia</th>
          </tr>
          {/* Header Row 2 — sub-labels */}
          <tr style={{ background: '#f0f0f0' }}>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', height: '55px', fontSize: '6pt' }}>M</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', height: '55px', fontSize: '6pt' }}>F</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', height: '55px', fontSize: '6pt' }}>Y</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', height: '55px', fontSize: '6pt' }}>N</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', height: '55px', fontSize: '6pt' }}>Y</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', height: '55px', fontSize: '6pt' }}>N</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', height: '55px', fontSize: '6pt' }}>CVD</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', height: '55px', fontSize: '6pt' }}>COPD</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', height: '55px', fontSize: '6pt' }}>DM</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', height: '55px', fontSize: '6pt' }}>Anemia</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', height: '55px', fontSize: '6pt' }}>Renal</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', height: '55px', fontSize: '6pt' }}>CA</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', height: '55px', fontSize: '6pt' }}>Steroids</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', height: '55px', fontSize: '6pt' }}>Highest Temp</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', height: '55px', fontSize: '6pt' }}>Cough</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', height: '55px', fontSize: '6pt' }}>Congestion</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', height: '55px', fontSize: '6pt' }}>Pharyngitis</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', height: '55px', fontSize: '6pt' }}>Rhinitis</th>
            <th className="rotate" style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', height: '55px', fontSize: '6pt' }}>Body Aches</th>
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row, i) => (
            <tr key={i}>
              <EditableCell value={row.room} autoFilled={!!row.room} />
              <EditableCell value={row.age} autoFilled={!!row.age} />
              <EditableCell value={row.name} autoFilled={!!row.name} />
              {/* Sex */}
              <EditableCell value={row.sex === 'M' ? '●' : ''} autoFilled={!!row.sex} />
              <EditableCell value={row.sex === 'F' ? '●' : ''} autoFilled={!!row.sex} />
              {/* Flu vax Y / N */}
              <EditableCell value={row.fluVax === 'Y' ? '●' : ''} autoFilled={row.fluVax !== ''} />
              <EditableCell value={row.fluVax === 'N' ? '●' : ''} autoFilled={row.fluVax !== ''} />
              {/* Pneumo vax Y / N */}
              <EditableCell value={row.pneuVax === 'Y' ? '●' : ''} autoFilled={row.pneuVax !== ''} />
              <EditableCell value={row.pneuVax === 'N' ? '●' : ''} autoFilled={row.pneuVax !== ''} />
              {/* Predisposing factors: all blank */}
              <EditableCell value="" />
              <EditableCell value="" />
              <EditableCell value="" />
              <EditableCell value="" />
              <EditableCell value="" />
              <EditableCell value="" />
              <EditableCell value="" />
              {/* Onset date */}
              <EditableCell value={row.onsetDate} autoFilled={!!row.onsetDate} />
              {/* Symptoms */}
              <EditableCell value={row.symptoms.includes('fever') || row.fever === 'Y' ? '●' : ''} autoFilled={row.symptoms.includes('fever') || row.fever === 'Y'} />
              <EditableCell value={row.symptoms.includes('cough') ? '●' : ''} autoFilled />
              <EditableCell value={row.symptoms.includes('congestion') ? '●' : ''} autoFilled />
              <EditableCell value={row.symptoms.includes('sore_throat') ? '●' : ''} autoFilled />
              <EditableCell value={row.symptoms.includes('runny_nose') ? '●' : ''} autoFilled />
              <EditableCell value={row.symptoms.includes('body_aches') ? '●' : ''} autoFilled />
              {/* Right side manual blanks except Antibiotic */}
              <EditableCell value="" />
              <EditableCell value="" />
              <EditableCell value="" />
              <EditableCell value="" />
              <EditableCell value={row.abt} autoFilled={!!row.abt} />
              <EditableCell value="" />
              <EditableCell value="" />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
