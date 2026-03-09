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

export const ILILineListTable: React.FC<Props> = ({ rows, facilityName, startDate, endDate, outbreakId, facilityId }) => {
  const { correctOnset } = useCorrectOnsetDate();
  const { overrides, saveOverride } = useLineListOverrides({
    outbreakId,
    facilityId,
    template: 'ili',
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
              <EditableCell value={getVal(row, i, 'room', row.room)} autoFilled={!!row.room} onChange={(v) => handleSave(row, i, 'room', v)} />
              <EditableCell value={getVal(row, i, 'age', row.age)} autoFilled={!!row.age} onChange={(v) => handleSave(row, i, 'age', v)} />
              <EditableCell value={getVal(row, i, 'name', row.name)} autoFilled={!!row.name} style={{ textAlign: 'left' }} onChange={(v) => handleSave(row, i, 'name', v)} />
              {/* Sex */}
              <EditableCell value={getVal(row, i, 'sexM', row.sex === 'M' ? '●' : '')} autoFilled={!!row.sex} onChange={(v) => handleSave(row, i, 'sexM', v)} />
              <EditableCell value={getVal(row, i, 'sexF', row.sex === 'F' ? '●' : '')} autoFilled={!!row.sex} onChange={(v) => handleSave(row, i, 'sexF', v)} />
              {/* Flu Vax */}
              <EditableCell value={getVal(row, i, 'fluVaxY', row.fluVax === 'Y' ? '●' : '')} autoFilled={row.fluVax !== ''} onChange={(v) => handleSave(row, i, 'fluVaxY', v)} />
              <EditableCell value={getVal(row, i, 'fluVaxN', row.fluVax === 'N' ? '●' : '')} autoFilled={row.fluVax !== ''} onChange={(v) => handleSave(row, i, 'fluVaxN', v)} />
              {/* Pneumo Vax */}
              <EditableCell value={getVal(row, i, 'pneuVaxY', row.pneuVax === 'Y' ? '●' : '')} autoFilled={row.pneuVax !== ''} onChange={(v) => handleSave(row, i, 'pneuVaxY', v)} />
              <EditableCell value={getVal(row, i, 'pneuVaxN', row.pneuVax === 'N' ? '●' : '')} autoFilled={row.pneuVax !== ''} onChange={(v) => handleSave(row, i, 'pneuVaxN', v)} />
              {/* Predisposing Factors — no data source, blank */}
              <EditableCell value={getVal(row, i, 'pfCvd', '')} onChange={(v) => handleSave(row, i, 'pfCvd', v)} />
              <EditableCell value={getVal(row, i, 'pfCopd', '')} onChange={(v) => handleSave(row, i, 'pfCopd', v)} />
              <EditableCell value={getVal(row, i, 'pfDm', '')} onChange={(v) => handleSave(row, i, 'pfDm', v)} />
              <EditableCell value={getVal(row, i, 'pfAnemia', '')} onChange={(v) => handleSave(row, i, 'pfAnemia', v)} />
              <EditableCell value={getVal(row, i, 'pfRenal', '')} onChange={(v) => handleSave(row, i, 'pfRenal', v)} />
              <EditableCell value={getVal(row, i, 'pfCa', '')} onChange={(v) => handleSave(row, i, 'pfCa', v)} />
              <EditableCell value={getVal(row, i, 'pfSteroids', '')} onChange={(v) => handleSave(row, i, 'pfSteroids', v)} />
              {/* Onset Date */}
              {row.eventId ? (
                <OnsetDateCell
                  eventId={row.eventId}
                  originalDate={row.onsetDateISO ?? ''}
                  onCorrected={correctOnset}
                />
              ) : (
                <EditableCell value={getVal(row, i, 'onsetDate', '')} onChange={(v) => handleSave(row, i, 'onsetDate', v)} />
              )}
              {/* Symptoms */}
              <EditableCell value={getVal(row, i, 'highestTemp', '')} onChange={(v) => handleSave(row, i, 'highestTemp', v)} /> {/* Highest Temp — manual */}
              <EditableCell value={getVal(row, i, 'symCough', row.symptoms.includes('cough') ? '●' : '')} autoFilled={row.symptoms.length > 0} onChange={(v) => handleSave(row, i, 'symCough', v)} />
              <EditableCell value={getVal(row, i, 'symCongestion', row.symptoms.includes('congestion') ? '●' : '')} autoFilled={row.symptoms.length > 0} onChange={(v) => handleSave(row, i, 'symCongestion', v)} />
              <EditableCell value={getVal(row, i, 'symSoreThroat', row.symptoms.includes('sore_throat') ? '●' : '')} autoFilled={row.symptoms.length > 0} onChange={(v) => handleSave(row, i, 'symSoreThroat', v)} />
              <EditableCell value={getVal(row, i, 'symRunnyNose', row.symptoms.includes('runny_nose') ? '●' : '')} autoFilled={row.symptoms.length > 0} onChange={(v) => handleSave(row, i, 'symRunnyNose', v)} />
              <EditableCell value={getVal(row, i, 'symHeadache', (row.symptoms as string[]).includes('headache') ? '●' : '')} autoFilled={row.symptoms.length > 0} onChange={(v) => handleSave(row, i, 'symHeadache', v)} />
              {/* Right side manual blanks except Antibiotic */}
              <EditableCell value={getVal(row, i, 'durationFever', '')} onChange={(v) => handleSave(row, i, 'durationFever', v)} /> {/* Duration of Fever */}
              <EditableCell value={getVal(row, i, 'hospDate', '')} onChange={(v) => handleSave(row, i, 'hospDate', v)} /> {/* Hosp. Date */}
              <EditableCell value={getVal(row, i, 'dateDied', '')} onChange={(v) => handleSave(row, i, 'dateDied', v)} /> {/* Date Died */}
              <EditableCell value={getVal(row, i, 'labResults', '')} onChange={(v) => handleSave(row, i, 'labResults', v)} /> {/* Lab Results */}
              <EditableCell value={getVal(row, i, 'abt', row.abt)} autoFilled={!!row.abt} onChange={(v) => handleSave(row, i, 'abt', v)} />
              <EditableCell value={getVal(row, i, 'xray', '')} onChange={(v) => handleSave(row, i, 'xray', v)} /> {/* X-Ray */}
              <EditableCell value={getVal(row, i, 'pneumonia', '')} onChange={(v) => handleSave(row, i, 'pneumonia', v)} /> {/* Pneumonia */}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
