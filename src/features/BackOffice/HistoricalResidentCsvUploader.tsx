import React, { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, Upload, XCircle } from 'lucide-react';
import { useDatabase, useFacilityData } from '../../app/providers';
import { Resident } from '../../domain/models';
import {
  HistoricalResidentStagingData,
  HistoricalResidentStagingRow,
  parseHistoricalResidentCsv,
  normalizeUsDateToIso
} from '../../parsers/historicalResidentCsvParser';

const HISTORICAL_RESIDENT_TEMPLATE = `Resident Id,Resident Last Name,Resident First Name,Gender,Admission Date,Allergies,Primary Physician,Primary Diagnosis,Location Floor,Location Unit,Location Room,Location Bed
000123,Doe,Jane,Female,2/2/2021,Penicillin,Dr. Watson,CHF,2,North,201,B
000124,Smith,John,M,12/15/2020,,Dr. Lee,COPD,1,South,102,A`;

type Summary = { created: number; merged: number; skipped: number; errors: number } | null;

const STATUS_META: Record<HistoricalResidentStagingRow['status'], { label: string; className: string }> = {
  NEW: { label: '🟢 NEW', className: 'bg-emerald-50 text-emerald-700' },
  'DUPLICATE-HISTORICAL': { label: '🔵 DUPLICATE-HISTORICAL', className: 'bg-blue-50 text-blue-700' },
  'CONFLICT-ACTIVE': { label: '🟡 CONFLICT-ACTIVE', className: 'bg-amber-50 text-amber-700' },
  ERROR: { label: '🔴 ERROR', className: 'bg-red-50 text-red-700' }
};

const EDITABLE_FIELDS: Array<keyof HistoricalResidentStagingData> = [
  'mrn',
  'firstName',
  'lastName',
  'sex',
  'admissionDate',
  'allergies',
  'lastKnownAttendingMD',
  'primaryDiagnosis'
];

export const HistoricalResidentCsvUploader: React.FC = () => {
  const { store } = useFacilityData();
  const { updateDB } = useDatabase();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<HistoricalResidentStagingRow[]>([]);
  const [headerErrors, setHeaderErrors] = useState<string[]>([]);
  const [summary, setSummary] = useState<Summary>(null);

  const residents = useMemo(() => Object.values(store.residents || {}) as Resident[], [store.residents]);

  const recomputeStatus = (data: HistoricalResidentStagingData): { status: HistoricalResidentStagingRow['status']; errors: string[]; linkedResidentMrn?: string } => {
    const errors: string[] = [];
    if (!data.mrn.trim()) errors.push('Missing MRN (Resident Id).');
    if (!data.firstName.trim()) errors.push('Missing first name.');
    if (!data.lastName.trim()) errors.push('Missing last name.');

    const dateValue = data.admissionDate.trim();
    let normalizedDate = dateValue;
    if (dateValue) {
      const isoDateMatch = /^\d{4}-\d{2}-\d{2}$/.test(dateValue);
      if (!isoDateMatch) {
        const parsed = normalizeUsDateToIso(dateValue);
        if (!parsed) errors.push('Invalid Admission Date. Use MM/DD/YYYY.');
        else normalizedDate = parsed;
      }
    }

    data.admissionDate = normalizedDate;

    if (errors.length > 0) return { status: 'ERROR', errors };

    const existing = residents.find((resident) => resident.mrn === data.mrn);
    if (!existing) return { status: 'NEW', errors: [] };
    if (existing.backOfficeOnly || existing.isHistorical) {
      return { status: 'DUPLICATE-HISTORICAL', errors: [], linkedResidentMrn: existing.mrn };
    }
    return { status: 'CONFLICT-ACTIVE', errors: [], linkedResidentMrn: existing.mrn };
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([HISTORICAL_RESIDENT_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'historical_residents_template.csv';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleUpload = async (file?: File) => {
    if (!file) return;

    try {
      const parsed = await parseHistoricalResidentCsv(file, residents);
      setRows(parsed.rows);
      setHeaderErrors(parsed.missingRequiredHeaders);
      setSummary(null);
    } catch (error) {
      console.error('Unable to parse historical residents CSV', error);
      alert('Unable to parse the CSV file. Please check the file format.');
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateRow = (id: string, updater: (row: HistoricalResidentStagingRow) => HistoricalResidentStagingRow) => {
    setRows((prev) => prev.map((row) => (row.id === id ? updater(row) : row)));
  };

  const updateField = (id: string, field: keyof HistoricalResidentStagingData, value: string) => {
    updateRow(id, (row) => {
      const nextData = { ...row.data, [field]: value.trim() };
      const recalculated = recomputeStatus(nextData);
      const nextStatus = recalculated.status;
      return {
        ...row,
        data: nextData,
        status: nextStatus,
        errors: recalculated.errors,
        linkedResidentMrn: recalculated.linkedResidentMrn,
        duplicateAction: nextStatus === 'DUPLICATE-HISTORICAL' ? row.duplicateAction : 'skip',
        conflictAction: nextStatus === 'CONFLICT-ACTIVE' ? row.conflictAction : 'skip',
        editedFields: row.editedFields.includes(field) ? row.editedFields : [...row.editedFields, field]
      };
    });
  };

  const autoFixDates = () => {
    setRows((prev) =>
      prev.map((row) => {
        const normalized = normalizeUsDateToIso(row.data.admissionDate);
        if (normalized && normalized !== row.data.admissionDate) {
          const nextData = { ...row.data, admissionDate: normalized };
          const recalculated = recomputeStatus(nextData);
          return {
            ...row,
            data: nextData,
            status: recalculated.status,
            errors: recalculated.errors,
            linkedResidentMrn: recalculated.linkedResidentMrn
          };
        }
        return row;
      })
    );
  };

  const skipAllByStatus = (status: HistoricalResidentStagingRow['status']) => {
    setRows((prev) => prev.map((row) => (row.status === status ? { ...row, skip: true } : row)));
  };

  const hasBlockingErrors = rows.some((row) => row.status === 'ERROR' && !row.skip);

  const commitImport = () => {
    let created = 0;
    let merged = 0;
    let skipped = 0;
    let errors = 0;

    updateDB((draft) => {
      const facilityId = draft.data.facilities.activeFacilityId;
      const facilityData = draft.data.facilityData[facilityId];
      facilityData.residents = facilityData.residents || {};

      rows.forEach((row) => {
        if (row.skip) {
          skipped += 1;
          return;
        }

        if (row.status === 'ERROR') {
          errors += 1;
          return;
        }

        const existing = facilityData.residents[row.data.mrn];
        const now = new Date().toISOString();

        if (row.status === 'NEW') {
          if (existing) {
            skipped += 1;
            return;
          }

          facilityData.residents[row.data.mrn] = {
            mrn: row.data.mrn,
            firstName: row.data.firstName,
            lastName: row.data.lastName,
            displayName: `${row.data.lastName}, ${row.data.firstName}`,
            sex: row.data.sex || undefined,
            admissionDate: row.data.admissionDate || undefined,
            allergies: row.data.allergies ? [row.data.allergies] : undefined,
            primaryDiagnosis: row.data.primaryDiagnosis || undefined,
            lastKnownAttendingMD: row.data.lastKnownAttendingMD || undefined,
            attendingMD: row.data.lastKnownAttendingMD || undefined,
            isHistorical: true,
            backOfficeOnly: true,
            historicalSource: 'csv-import',
            identityAliases: [],
            createdAt: now,
            updatedAt: now
          };
          created += 1;
          return;
        }

        if (row.status === 'DUPLICATE-HISTORICAL') {
          if (!existing || row.duplicateAction !== 'merge-fill-blanks') {
            skipped += 1;
            return;
          }

          const editableFields: Array<{ field: keyof HistoricalResidentStagingData; residentField: keyof Resident }> = [
            { field: 'firstName', residentField: 'firstName' },
            { field: 'lastName', residentField: 'lastName' },
            { field: 'sex', residentField: 'sex' },
            { field: 'admissionDate', residentField: 'admissionDate' },
            { field: 'lastKnownAttendingMD', residentField: 'lastKnownAttendingMD' },
            { field: 'primaryDiagnosis', residentField: 'primaryDiagnosis' }
          ];

          editableFields.forEach(({ field, residentField }) => {
            const incoming = row.data[field]?.trim();
            if (!incoming) return;
            const existingValue = String(existing[residentField] ?? '').trim();
            const canOverwrite = row.editedFields.includes(field);
            if (!existingValue || canOverwrite) {
              (existing[residentField] as string | undefined) = incoming;
            }
          });

          if (row.data.allergies.trim()) {
            const hasExistingAllergies = Array.isArray(existing.allergies) && existing.allergies.length > 0;
            const allowOverwrite = row.editedFields.includes('allergies');
            if (!hasExistingAllergies || allowOverwrite) {
              existing.allergies = [row.data.allergies.trim()];
            }
          }

          if (row.editedFields.includes('firstName') || row.editedFields.includes('lastName') || !existing.displayName) {
            existing.displayName = `${existing.lastName || row.data.lastName}, ${existing.firstName || row.data.firstName}`;
          }
          existing.backOfficeOnly = true;
          existing.isHistorical = true;
          existing.historicalSource = 'csv-import';
          existing.updatedAt = now;
          merged += 1;
          return;
        }

        if (row.status === 'CONFLICT-ACTIVE') {
          skipped += 1;
        }
      });
    });

    setSummary({ created, merged, skipped, errors });
    setRows([]);
  };

  return (
    <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-neutral-200 bg-neutral-50 flex flex-wrap gap-3 items-center justify-between">
        <div>
          <h3 className="font-bold text-neutral-900">Upload Historic Residents</h3>
          <p className="text-sm text-neutral-500">Back Office-only resident import with staging review and edit controls.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleDownloadTemplate} className="px-3 py-2 text-sm rounded-md bg-neutral-100 text-neutral-700 hover:bg-neutral-200 inline-flex items-center gap-1">
            <Download className="w-4 h-4" /> Download Template CSV
          </button>
          <label className="px-3 py-2 text-sm rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 cursor-pointer inline-flex items-center gap-1">
            <Upload className="w-4 h-4" /> Upload CSV
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(event) => handleUpload(event.target.files?.[0])}
            />
          </label>
        </div>
      </div>

      {headerErrors.length > 0 && (
        <div className="px-4 py-3 text-sm text-red-700 bg-red-50 border-b border-red-200">
          Missing required headers: {headerErrors.join(', ')}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="p-4 border-b border-neutral-200 flex flex-wrap gap-2 items-center">
            <button onClick={() => skipAllByStatus('CONFLICT-ACTIVE')} className="px-3 py-1.5 text-xs rounded-md border border-neutral-300 hover:bg-neutral-50">
              Skip all conflicts
            </button>
            <button onClick={() => skipAllByStatus('DUPLICATE-HISTORICAL')} className="px-3 py-1.5 text-xs rounded-md border border-neutral-300 hover:bg-neutral-50">
              Skip all duplicates
            </button>
            <button onClick={autoFixDates} className="px-3 py-1.5 text-xs rounded-md border border-neutral-300 hover:bg-neutral-50">
              Auto-fix dates
            </button>
            <div className="ml-auto flex gap-2">
              <button onClick={() => setRows([])} className="px-3 py-2 text-sm rounded-md text-neutral-600 hover:text-neutral-900">Cancel</button>
              <button
                onClick={commitImport}
                disabled={hasBlockingErrors}
                className="px-3 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Commit Import
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600">
                <tr>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Skip</th>
                  <th className="px-3 py-2">MRN</th>
                  <th className="px-3 py-2">First Name</th>
                  <th className="px-3 py-2">Last Name</th>
                  <th className="px-3 py-2">Sex</th>
                  <th className="px-3 py-2">Admission Date</th>
                  <th className="px-3 py-2">Allergies</th>
                  <th className="px-3 py-2">Primary Physician</th>
                  <th className="px-3 py-2">Primary Diagnosis</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Errors</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {rows.map((row) => (
                  <tr key={row.id} className={row.skip ? 'opacity-60' : ''}>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-1 rounded-full text-[11px] font-medium ${STATUS_META[row.status].className}`}>{STATUS_META[row.status].label}</span>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={row.skip}
                        onChange={(event) => updateRow(row.id, (target) => ({ ...target, skip: event.target.checked }))}
                      />
                    </td>
                    {EDITABLE_FIELDS.map((field) => (
                      <td key={field} className="px-3 py-2">
                        <input
                          value={row.data[field]}
                          onChange={(event) => updateField(row.id, field, event.target.value)}
                          className="w-36 border border-neutral-300 rounded px-2 py-1 text-xs"
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      {row.status === 'DUPLICATE-HISTORICAL' && (
                        <select
                          className="border border-neutral-300 rounded px-2 py-1"
                          value={row.duplicateAction}
                          onChange={(event) => updateRow(row.id, (target) => ({ ...target, duplicateAction: event.target.value as HistoricalResidentStagingRow['duplicateAction'] }))}
                        >
                          <option value="skip">Skip</option>
                          <option value="merge-fill-blanks">Merge fill blanks</option>
                        </select>
                      )}
                      {row.status === 'CONFLICT-ACTIVE' && (
                        <select
                          className="border border-neutral-300 rounded px-2 py-1"
                          value={row.conflictAction}
                          onChange={(event) => updateRow(row.id, (target) => ({ ...target, conflictAction: event.target.value as HistoricalResidentStagingRow['conflictAction'] }))}
                        >
                          <option value="skip">Skip</option>
                          <option value="link">Link (no overwrite)</option>
                        </select>
                      )}
                      {(row.status === 'NEW' || row.status === 'ERROR') && <span className="text-neutral-400">-</span>}
                    </td>
                    <td className="px-3 py-2 text-red-600">{row.errors.join(' ') || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {summary && (
        <div className="p-4 border-t border-neutral-200 bg-neutral-50 text-sm grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="flex items-center gap-2 text-emerald-700"><CheckCircle2 className="w-4 h-4" /> Created: {summary.created}</div>
          <div className="flex items-center gap-2 text-blue-700"><CheckCircle2 className="w-4 h-4" /> Merged: {summary.merged}</div>
          <div className="flex items-center gap-2 text-amber-700"><AlertTriangle className="w-4 h-4" /> Skipped: {summary.skipped}</div>
          <div className="flex items-center gap-2 text-red-700"><XCircle className="w-4 h-4" /> Errors: {summary.errors}</div>
        </div>
      )}
    </div>
  );
};
