import React from 'react';
import { Pencil } from 'lucide-react';
import { useLineListOverrides } from '../../hooks/useLineListOverrides';

interface EditableCellProps {
  value: string;
  autoFilled?: boolean;
  className?: string;
  colSpan?: number;
  onChange?: (value: string) => void;
}

export function EditableCell({ value, autoFilled, className, colSpan, onChange }: EditableCellProps) {
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
      onBlur={(e) => {
        if (onChange) {
          onChange(e.currentTarget.textContent || '');
        }
      }}
    />
  );
}

export interface ILIRowModel {
  eventId?: string;
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
  facilityId: string;
  onEditRow?: (eventId: string) => void;
}

const MIN_ROWS = 20;

export function ILILineListTable({ rows, facilityName, startDate, endDate, facilityId, onEditRow }: ILILineListTableProps) {
  const { overrides, saveOverride } = useLineListOverrides({
    outbreakId: 'global',
    facilityId,
    template: 'ili',
  });

  const displayRows = [...rows];
  while (displayRows.length < MIN_ROWS) {
    displayRows.push({
      room: '', unit: '', age: '', name: '', sex: '', onsetDate: '',
      fluVax: '', pneuVax: '', fever: '', symptoms: [],
      isolationInitiated: '', providerNotified: '', testOrdered: '',
      abt: '', disposition: '', notes: '',
    });
  }

  const getVal = (row: ILIRowModel, index: number, colKey: string, defaultVal: string) => {
    const rowKey = row.eventId || `row-${index}`;
    const overrideKey = `${rowKey}::${colKey}`;
    return overrides[overrideKey] !== undefined ? overrides[overrideKey] : defaultVal;
  };

  const handleSave = (row: ILIRowModel, index: number, colKey: string, val: string) => {
    const rowKey = row.eventId || `row-${index}`;
    saveOverride(rowKey, colKey, val);
  };

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
            <th className="no-print" style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }} rowSpan={2}>Edit</th>
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
              <EditableCell value={getVal(row, i, 'room', row.room)} autoFilled={!!row.room} onChange={(v) => handleSave(row, i, 'room', v)} />
              <EditableCell value={getVal(row, i, 'age', row.age)} autoFilled={!!row.age} onChange={(v) => handleSave(row, i, 'age', v)} />
              <EditableCell value={getVal(row, i, 'name', row.name)} autoFilled={!!row.name} onChange={(v) => handleSave(row, i, 'name', v)} />
              {/* Sex */}
              <EditableCell value={getVal(row, i, 'sexM', row.sex === 'M' ? '●' : '')} autoFilled={!!row.sex} onChange={(v) => handleSave(row, i, 'sexM', v)} />
              <EditableCell value={getVal(row, i, 'sexF', row.sex === 'F' ? '●' : '')} autoFilled={!!row.sex} onChange={(v) => handleSave(row, i, 'sexF', v)} />
              {/* Flu vax Y / N */}
              <EditableCell value={getVal(row, i, 'fluVaxY', row.fluVax === 'Y' ? '●' : '')} autoFilled={row.fluVax !== ''} onChange={(v) => handleSave(row, i, 'fluVaxY', v)} />
              <EditableCell value={getVal(row, i, 'fluVaxN', row.fluVax === 'N' ? '●' : '')} autoFilled={row.fluVax !== ''} onChange={(v) => handleSave(row, i, 'fluVaxN', v)} />
              {/* Pneumo vax Y / N */}
              <EditableCell value={getVal(row, i, 'pneuVaxY', row.pneuVax === 'Y' ? '●' : '')} autoFilled={row.pneuVax !== ''} onChange={(v) => handleSave(row, i, 'pneuVaxY', v)} />
              <EditableCell value={getVal(row, i, 'pneuVaxN', row.pneuVax === 'N' ? '●' : '')} autoFilled={row.pneuVax !== ''} onChange={(v) => handleSave(row, i, 'pneuVaxN', v)} />
              {/* Predisposing factors: all blank */}
              <EditableCell value={getVal(row, i, 'cvd', '')} onChange={(v) => handleSave(row, i, 'cvd', v)} />
              <EditableCell value={getVal(row, i, 'copd', '')} onChange={(v) => handleSave(row, i, 'copd', v)} />
              <EditableCell value={getVal(row, i, 'dm', '')} onChange={(v) => handleSave(row, i, 'dm', v)} />
              <EditableCell value={getVal(row, i, 'anemia', '')} onChange={(v) => handleSave(row, i, 'anemia', v)} />
              <EditableCell value={getVal(row, i, 'renal', '')} onChange={(v) => handleSave(row, i, 'renal', v)} />
              <EditableCell value={getVal(row, i, 'ca', '')} onChange={(v) => handleSave(row, i, 'ca', v)} />
              <EditableCell value={getVal(row, i, 'steroids', '')} onChange={(v) => handleSave(row, i, 'steroids', v)} />
              {/* Onset date */}
              <EditableCell value={getVal(row, i, 'onsetDate', row.onsetDate)} autoFilled={!!row.onsetDate} onChange={(v) => handleSave(row, i, 'onsetDate', v)} />
              {/* Symptoms */}
              <EditableCell value={getVal(row, i, 'highestTemp', row.symptoms.includes('fever') || row.fever === 'Y' ? '●' : '')} autoFilled={row.symptoms.includes('fever') || row.fever === 'Y'} onChange={(v) => handleSave(row, i, 'highestTemp', v)} />
              <EditableCell value={getVal(row, i, 'cough', row.symptoms.includes('cough') ? '●' : '')} autoFilled onChange={(v) => handleSave(row, i, 'cough', v)} />
              <EditableCell value={getVal(row, i, 'congestion', row.symptoms.includes('congestion') ? '●' : '')} autoFilled onChange={(v) => handleSave(row, i, 'congestion', v)} />
              <EditableCell value={getVal(row, i, 'pharyngitis', row.symptoms.includes('sore_throat') ? '●' : '')} autoFilled onChange={(v) => handleSave(row, i, 'pharyngitis', v)} />
              <EditableCell value={getVal(row, i, 'rhinitis', row.symptoms.includes('runny_nose') ? '●' : '')} autoFilled onChange={(v) => handleSave(row, i, 'rhinitis', v)} />
              <EditableCell value={getVal(row, i, 'bodyAches', row.symptoms.includes('body_aches') ? '●' : '')} autoFilled onChange={(v) => handleSave(row, i, 'bodyAches', v)} />
              {/* Right side manual blanks except Antibiotic */}
              <EditableCell value={getVal(row, i, 'durationFever', '')} onChange={(v) => handleSave(row, i, 'durationFever', v)} />
              <EditableCell value={getVal(row, i, 'hospDate', '')} onChange={(v) => handleSave(row, i, 'hospDate', v)} />
              <EditableCell value={getVal(row, i, 'dateDied', '')} onChange={(v) => handleSave(row, i, 'dateDied', v)} />
              <EditableCell value={getVal(row, i, 'labResults', '')} onChange={(v) => handleSave(row, i, 'labResults', v)} />
              <EditableCell value={getVal(row, i, 'antibiotic', row.abt)} autoFilled={!!row.abt} onChange={(v) => handleSave(row, i, 'antibiotic', v)} />
              <EditableCell value={getVal(row, i, 'xray', '')} onChange={(v) => handleSave(row, i, 'xray', v)} />
              <EditableCell value={getVal(row, i, 'pneumonia', '')} onChange={(v) => handleSave(row, i, 'pneumonia', v)} />
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
