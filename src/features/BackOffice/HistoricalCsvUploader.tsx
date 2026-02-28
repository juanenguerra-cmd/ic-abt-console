import React, { useState, useRef } from 'react';
import { Download, Upload, CheckCircle, AlertTriangle, XCircle, UserPlus, Link as LinkIcon } from 'lucide-react';
import { downloadTemplate } from '../../utils/csvTemplates';
import { parseHistoricalCsv, StagingRow } from '../../parsers/historicalCsvParser';
import { useDatabase, useFacilityData } from '../../app/providers';
import { Resident, IPEvent, ABTCourse, VaxEvent } from '../../domain/models';
import { v4 as uuidv4 } from 'uuid';

export const HistoricalCsvUploader: React.FC = () => {
  const { store } = useFacilityData();
  const { updateDB } = useDatabase();
  const [stagingRows, setStagingRows] = useState<StagingRow[]>([]);
  const [uploadType, setUploadType] = useState<'IP' | 'ABX' | 'VAX' | null>(null);
  const [overrideErrors, setOverrideErrors] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allResidents = Object.values(store.residents || {}) as Resident[];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'IP' | 'ABX' | 'VAX') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const rows = await parseHistoricalCsv(file, type, allResidents);
      setStagingRows(rows);
      setUploadType(type);
    } catch (error) {
      console.error('Error parsing CSV:', error);
      alert('Failed to parse CSV file.');
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpdateRow = (id: string, updates: Partial<StagingRow>) => {
    setStagingRows(prev => prev.map(row => row.id === id ? { ...row, ...updates } : row));
  };

  const handleUpdateData = (id: string, field: string, value: string) => {
    setStagingRows(prev => prev.map(row => {
      if (row.id === id) {
        return { ...row, data: { ...row.data, [field]: value } };
      }
      return row;
    }));
  };

  const commitImport = () => {
    const hasErrors = stagingRows.some(r => r.status === 'ERROR' && !r.skip);
    if (hasErrors) {
      if (!window.confirm('There are rows with errors. Are you sure you want to commit? Error rows will be skipped.')) {
        return;
      }
    }

    let imported = 0;
    let skipped = 0;
    let duplicates = 0;
    let newResidents = 0;

    updateDB(draft => {
      const facilityId = draft.data.facilities.activeFacilityId;
      const facilityData = draft.data.facilityData[facilityId];

      if (!facilityData.residents) facilityData.residents = {};
      if (!facilityData.infections) facilityData.infections = {};
      if (!facilityData.abts) facilityData.abts = {};
      if (!facilityData.vaxEvents) facilityData.vaxEvents = {};

      stagingRows.forEach(row => {
        if (row.skip || row.status === 'ERROR') {
          skipped++;
          return;
        }

        let targetMrn = row.linkedMrn;

        // Create new historical resident if needed
        if (row.createAsHistorical && row.status === 'NEW' && !targetMrn) {
          const mrn = row.data.mrn?.trim();
          if (mrn) {
            targetMrn = mrn;
            if (!facilityData.residents[mrn]) {
              const names = row.data.residentName?.trim().split(' ') || ['Unknown', 'Unknown'];
              const lastName = names.length > 1 ? names.pop()! : names[0];
              const firstName = names.join(' ');

              facilityData.residents[mrn] = {
                mrn,
                firstName,
                lastName,
                displayName: row.data.residentName?.trim() || mrn,
                dob: row.data.dob,
                isHistorical: true,
                backOfficeOnly: true,
                historicalSource: 'csv_import',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                identityAliases: []
              };
              newResidents++;
            }
          }
        }

        if (!targetMrn) {
          skipped++;
          return;
        }

        // Write events
        if (row.type === 'IP') {
          // Check duplicate
          const isDuplicate = Object.values(facilityData.infections).some(ip => 
            ip.residentRef.id === targetMrn && 
            ip.infectionSite === row.data.infectionType &&
            ip.createdAt === row.data.onsetDate // simplistic duplicate check
          );

          if (isDuplicate) {
            duplicates++;
          } else {
            const id = uuidv4();
            facilityData.infections[id] = {
              id,
              residentRef: { kind: 'mrn', id: targetMrn },
              infectionSite: row.data.infectionType,
              isolationType: row.data.isolationType,
              organism: row.data.organism,
              status: row.data.status as any || 'resolved',
              onsetDate: row.data.onsetDate ? new Date(row.data.onsetDate).toISOString() : undefined,
              createdAt: row.data.onsetDate ? new Date(row.data.onsetDate).toISOString() : new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            imported++;
          }
        } else if (row.type === 'ABX') {
          const isDuplicate = Object.values(facilityData.abts).some(abt => 
            abt.residentRef.id === targetMrn && 
            abt.medication === row.data.medicationName &&
            abt.startDate === (row.data.startDate ? new Date(row.data.startDate).toISOString() : undefined)
          );

          if (isDuplicate) {
            duplicates++;
          } else {
            const id = uuidv4();
            facilityData.abts[id] = {
              id,
              residentRef: { kind: 'mrn', id: targetMrn },
              medication: row.data.medicationName,
              medicationClass: row.data.medicationClass,
              route: row.data.route,
              frequency: row.data.frequency,
              indication: row.data.indication,
              syndromeCategory: row.data.syndrome,
              infectionSource: row.data.sourceOfInfection,
              cultureCollected: row.data.cultureCollected === 'Yes',
              status: row.data.status as any || 'documented-historical',
              startDate: row.data.startDate ? new Date(row.data.startDate).toISOString() : undefined,
              endDate: row.data.endDate ? new Date(row.data.endDate).toISOString() : undefined,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            imported++;
          }
        } else if (row.type === 'VAX') {
          const isDuplicate = Object.values(facilityData.vaxEvents).some(vax => 
            vax.residentRef.id === targetMrn && 
            vax.vaccine === row.data.vaccineType &&
            vax.dateGiven === (row.data.administeredDate ? new Date(row.data.administeredDate).toISOString() : undefined)
          );

          if (isDuplicate) {
            duplicates++;
          } else {
            const id = uuidv4();
            facilityData.vaxEvents[id] = {
              id,
              residentRef: { kind: 'mrn', id: targetMrn },
              vaccine: row.data.vaccineType,
              status: row.data.status as any || 'documented-historical',
              administeredDate: row.data.administeredDate ? new Date(row.data.administeredDate).toISOString() : undefined,
              dateGiven: row.data.administeredDate ? new Date(row.data.administeredDate).toISOString() : undefined,
              source: "csv-import",
              notes: row.data.notes,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            imported++;
          }
        }
      });
    });

    alert(`Import Complete!\nImported: ${imported}\nSkipped: ${skipped}\nDuplicates: ${duplicates}\nNew Residents Created: ${newResidents}`);
    setStagingRows([]);
    setUploadType(null);
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'MATCHED': return <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800"><CheckCircle className="w-3 h-3" /> MATCHED</span>;
      case 'WARNING': return <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800"><AlertTriangle className="w-3 h-3" /> WARNING</span>;
      case 'ERROR': return <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800"><XCircle className="w-3 h-3" /> ERROR</span>;
      case 'NEW': return <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800"><UserPlus className="w-3 h-3" /> NEW</span>;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* IP Upload */}
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex flex-col gap-3">
          <h3 className="font-bold text-neutral-900">IP Historical Data</h3>
          <p className="text-xs text-neutral-500 flex-1">Upload historical infection events.</p>
          <div className="flex gap-2">
            <button onClick={() => downloadTemplate('IP')} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-neutral-100 text-neutral-700 rounded-md text-sm hover:bg-neutral-200">
              <Download className="w-4 h-4" /> Template
            </button>
            <label className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-md text-sm hover:bg-indigo-100 cursor-pointer">
              <Upload className="w-4 h-4" /> Upload
              <input type="file" accept=".csv" className="hidden" onChange={(e) => handleFileUpload(e, 'IP')} />
            </label>
          </div>
        </div>

        {/* ABX Upload */}
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex flex-col gap-3">
          <h3 className="font-bold text-neutral-900">ABX Historical Data</h3>
          <p className="text-xs text-neutral-500 flex-1">Upload historical antibiotic courses.</p>
          <div className="flex gap-2">
            <button onClick={() => downloadTemplate('ABX')} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-neutral-100 text-neutral-700 rounded-md text-sm hover:bg-neutral-200">
              <Download className="w-4 h-4" /> Template
            </button>
            <label className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-md text-sm hover:bg-indigo-100 cursor-pointer">
              <Upload className="w-4 h-4" /> Upload
              <input type="file" accept=".csv" className="hidden" onChange={(e) => handleFileUpload(e, 'ABX')} />
            </label>
          </div>
        </div>

        {/* VAX Upload */}
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex flex-col gap-3">
          <h3 className="font-bold text-neutral-900">VAX Historical Data</h3>
          <p className="text-xs text-neutral-500 flex-1">Upload historical vaccination events.</p>
          <div className="flex gap-2">
            <button onClick={() => downloadTemplate('VAX')} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-neutral-100 text-neutral-700 rounded-md text-sm hover:bg-neutral-200">
              <Download className="w-4 h-4" /> Template
            </button>
            <label className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-md text-sm hover:bg-indigo-100 cursor-pointer">
              <Upload className="w-4 h-4" /> Upload
              <input type="file" accept=".csv" className="hidden" onChange={(e) => handleFileUpload(e, 'VAX')} />
            </label>
          </div>
        </div>
      </div>

      {stagingRows.length > 0 && (
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-neutral-200 bg-neutral-50 flex justify-between items-center">
            <h3 className="font-bold text-neutral-900">Staging Review ({uploadType})</h3>
            <div className="flex gap-3 items-center">
              {stagingRows.some(r => r.status === 'ERROR' && !r.skip) && (
                <label className="flex items-center gap-1 text-sm text-red-600 font-medium">
                  <input 
                    type="checkbox" 
                    checked={overrideErrors} 
                    onChange={(e) => setOverrideErrors(e.target.checked)}
                    className="rounded border-red-300 text-red-600"
                  />
                  Override Errors
                </label>
              )}
              <button 
                onClick={() => setStagingRows([])}
                className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900"
              >
                Cancel
              </button>
              <button 
                onClick={commitImport}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                disabled={stagingRows.some(r => r.status === 'ERROR' && !r.skip) && !overrideErrors}
              >
                Commit Import
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                  <th className="px-4 py-3 font-medium">MRN</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">DOB</th>
                  {uploadType === 'IP' && (
                    <>
                      <th className="px-4 py-3 font-medium">Infection Type</th>
                      <th className="px-4 py-3 font-medium">Onset Date</th>
                    </>
                  )}
                  {uploadType === 'ABX' && (
                    <>
                      <th className="px-4 py-3 font-medium">Medication</th>
                      <th className="px-4 py-3 font-medium">Start Date</th>
                    </>
                  )}
                  {uploadType === 'VAX' && (
                    <>
                      <th className="px-4 py-3 font-medium">Vaccine</th>
                      <th className="px-4 py-3 font-medium">Admin Date</th>
                    </>
                  )}
                  <th className="px-4 py-3 font-medium">Unit</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Errors</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {stagingRows.map(row => (
                  <tr key={row.id} className={`hover:bg-neutral-50 ${row.skip ? 'opacity-50 bg-neutral-100' : ''}`}>
                    <td className="px-4 py-3">{renderStatusBadge(row.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1 text-xs cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={row.skip} 
                            onChange={(e) => handleUpdateRow(row.id, { skip: e.target.checked })}
                            className="rounded border-neutral-300"
                          />
                          Skip
                        </label>
                        {row.status === 'NEW' && (
                          <label className="flex items-center gap-1 text-xs cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={row.createAsHistorical} 
                              onChange={(e) => handleUpdateRow(row.id, { createAsHistorical: e.target.checked })}
                              className="rounded border-neutral-300"
                            />
                            Create Hist.
                          </label>
                        )}
                        {(row.status === 'WARNING' || row.status === 'ERROR') && (
                          <button 
                            onClick={() => {
                              const mrn = prompt('Enter existing MRN to link:');
                              if (mrn) {
                                const matched = allResidents.find(r => r.mrn === mrn);
                                if (matched) {
                                  handleUpdateRow(row.id, { linkedMrn: mrn, status: 'MATCHED', errors: [] });
                                } else {
                                  alert('MRN not found.');
                                }
                              }
                            }}
                            className="text-indigo-600 hover:text-indigo-800 text-xs flex items-center gap-1"
                          >
                            <LinkIcon className="w-3 h-3" /> Link
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input 
                        type="text" 
                        value={row.data.mrn || ''} 
                        onChange={(e) => handleUpdateData(row.id, 'mrn', e.target.value)}
                        className="w-24 border-transparent hover:border-neutral-300 focus:border-indigo-500 rounded px-1 py-0.5 text-sm"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input 
                        type="text" 
                        value={row.data.residentName || ''} 
                        onChange={(e) => handleUpdateData(row.id, 'residentName', e.target.value)}
                        className="w-32 border-transparent hover:border-neutral-300 focus:border-indigo-500 rounded px-1 py-0.5 text-sm"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input 
                        type="text" 
                        value={row.data.dob || ''} 
                        onChange={(e) => handleUpdateData(row.id, 'dob', e.target.value)}
                        className="w-24 border-transparent hover:border-neutral-300 focus:border-indigo-500 rounded px-1 py-0.5 text-sm"
                      />
                    </td>
                    {uploadType === 'IP' && (
                      <>
                        <td className="px-4 py-3">
                          <input 
                            type="text" 
                            value={row.data.infectionType || ''} 
                            onChange={(e) => handleUpdateData(row.id, 'infectionType', e.target.value)}
                            className="w-24 border-transparent hover:border-neutral-300 focus:border-indigo-500 rounded px-1 py-0.5 text-sm"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input 
                            type="text" 
                            value={row.data.onsetDate || ''} 
                            onChange={(e) => handleUpdateData(row.id, 'onsetDate', e.target.value)}
                            className="w-24 border-transparent hover:border-neutral-300 focus:border-indigo-500 rounded px-1 py-0.5 text-sm"
                          />
                        </td>
                      </>
                    )}
                    {uploadType === 'ABX' && (
                      <>
                        <td className="px-4 py-3">
                          <input 
                            type="text" 
                            value={row.data.medicationName || ''} 
                            onChange={(e) => handleUpdateData(row.id, 'medicationName', e.target.value)}
                            className="w-24 border-transparent hover:border-neutral-300 focus:border-indigo-500 rounded px-1 py-0.5 text-sm"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input 
                            type="text" 
                            value={row.data.startDate || ''} 
                            onChange={(e) => handleUpdateData(row.id, 'startDate', e.target.value)}
                            className="w-24 border-transparent hover:border-neutral-300 focus:border-indigo-500 rounded px-1 py-0.5 text-sm"
                          />
                        </td>
                      </>
                    )}
                    {uploadType === 'VAX' && (
                      <>
                        <td className="px-4 py-3">
                          <input 
                            type="text" 
                            value={row.data.vaccineType || ''} 
                            onChange={(e) => handleUpdateData(row.id, 'vaccineType', e.target.value)}
                            className="w-24 border-transparent hover:border-neutral-300 focus:border-indigo-500 rounded px-1 py-0.5 text-sm"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input 
                            type="text" 
                            value={row.data.administeredDate || ''} 
                            onChange={(e) => handleUpdateData(row.id, 'administeredDate', e.target.value)}
                            className="w-24 border-transparent hover:border-neutral-300 focus:border-indigo-500 rounded px-1 py-0.5 text-sm"
                          />
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3">
                      <input 
                        type="text" 
                        value={row.data.unit || ''} 
                        onChange={(e) => handleUpdateData(row.id, 'unit', e.target.value)}
                        className="w-20 border-transparent hover:border-neutral-300 focus:border-indigo-500 rounded px-1 py-0.5 text-sm"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input 
                        type="text" 
                        value={row.data.status || ''} 
                        onChange={(e) => handleUpdateData(row.id, 'status', e.target.value)}
                        className="w-20 border-transparent hover:border-neutral-300 focus:border-indigo-500 rounded px-1 py-0.5 text-sm"
                      />
                    </td>
                    <td className="px-4 py-3 text-red-600 text-xs max-w-xs truncate" title={row.errors.join(', ')}>
                      {row.errors.join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
