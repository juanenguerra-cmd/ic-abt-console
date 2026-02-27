import React, { useState, useRef } from 'react';
import { useFacilityData, useDatabase } from '../../app/providers';
import { Staff, StaffVaxEvent, FitTestEvent } from '../../domain/models';
import { Plus, Upload, Download, Edit2, X, Check, ChevronDown, ChevronRight, Syringe, Shield } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface UploadResult {
  added: number;
  updated: number;
  deactivated: number;
  errors: string[];
}

interface StaffEditState {
  displayName: string;
  role: string;
  department: string;
  type: string;
  hireDate: string;
  status: 'active' | 'inactive';
}

const SAMPLE_CSV = `Name,Position,Department,Type,Hire Date\nJane Doe,RN,Nursing,Full-Time,2022-01-15\nJohn Smith,CNA,Nursing,Part-Time,2023-06-01`;

const StaffPage: React.FC = () => {
  const { store, activeFacilityId } = useFacilityData();
  const { updateDB } = useDatabase();
  const staffList = Object.values(store.staff) as Staff[];
  const staffVaxEvents = Object.values(store.staffVaxEvents || {}) as StaffVaxEvent[];
  const fitTestEvents = Object.values(store.fitTestEvents || {}) as FitTestEvent[];

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<StaffEditState | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNewStaffForm, setShowNewStaffForm] = useState(false);
  const [newStaff, setNewStaff] = useState<StaffEditState>({
    displayName: '', role: '', department: '', type: '', hireDate: '', status: 'active'
  });

  // Vaccine form state per-staff
  const [vaxForm, setVaxForm] = useState<{ staffId: string; vaccine: string; status: string; date: string } | null>(null);
  const [fitForm, setFitForm] = useState<{ staffId: string; status: string; date: string } | null>(null);

  const downloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'staff_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string): Array<Record<string, string>> => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = vals[i] || ''; });
      return row;
    });
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      const result: UploadResult = { added: 0, updated: 0, deactivated: 0, errors: [] };

      const csvNames = new Set<string>();
      const validRows: Array<Record<string, string>> = [];

      rows.forEach((row, idx) => {
        const name = row['Name']?.trim();
        if (!name) {
          result.errors.push(`Row ${idx + 2}: Name is required`);
          return;
        }
        csvNames.add(name.toLowerCase());
        validRows.push(row);
      });

      updateDB(draft => {
        const facilityStore = draft.data.facilityData[activeFacilityId];

        validRows.forEach(row => {
          const name = row['Name'].trim();
          const nameLower = name.toLowerCase();
          const existing = Object.values(facilityStore.staff).find(
            s => s.displayName.toLowerCase().trim() === nameLower
          );
          if (existing) {
            existing.role = row['Position'] || existing.role;
            (existing as any).department = row['Department'] || (existing as any).department;
            (existing as any).type = row['Type'] || (existing as any).type;
            existing.hireDate = row['Hire Date'] || existing.hireDate;
            result.updated++;
          } else {
            const id = uuidv4();
            facilityStore.staff[id] = {
              id,
              facilityId: activeFacilityId,
              displayName: name,
              role: row['Position'] || '',
              status: 'active',
              hireDate: row['Hire Date'] || undefined,
            } as Staff & { department?: string; type?: string };
            (facilityStore.staff[id] as any).department = row['Department'] || '';
            (facilityStore.staff[id] as any).type = row['Type'] || '';
            result.added++;
          }
        });

        // Deactivate missing staff
        Object.values(facilityStore.staff).forEach(s => {
          if (!csvNames.has(s.displayName.toLowerCase().trim()) && s.status === 'active') {
            s.status = 'inactive';
            result.deactivated++;
          }
        });
      });

      setUploadResult(result);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const startEdit = (staff: Staff) => {
    setEditingId(staff.id);
    setEditState({
      displayName: staff.displayName,
      role: staff.role || '',
      department: (staff as any).department || '',
      type: (staff as any).type || '',
      hireDate: staff.hireDate || '',
      status: staff.status,
    });
  };

  const saveEdit = () => {
    if (!editingId || !editState) return;
    updateDB(draft => {
      const s = draft.data.facilityData[activeFacilityId].staff[editingId];
      if (s) {
        s.displayName = editState.displayName;
        s.role = editState.role;
        (s as any).department = editState.department;
        (s as any).type = editState.type;
        s.hireDate = editState.hireDate || undefined;
        s.status = editState.status;
      }
    });
    setEditingId(null);
    setEditState(null);
  };

  const addNewStaff = () => {
    if (!newStaff.displayName.trim()) { alert('Name is required'); return; }
    updateDB(draft => {
      const id = uuidv4();
      const facilityStore = draft.data.facilityData[activeFacilityId];
      facilityStore.staff[id] = {
        id,
        facilityId: activeFacilityId,
        displayName: newStaff.displayName,
        role: newStaff.role,
        status: newStaff.status,
        hireDate: newStaff.hireDate || undefined,
      } as any;
      (facilityStore.staff[id] as any).department = newStaff.department;
      (facilityStore.staff[id] as any).type = newStaff.type;
    });
    setNewStaff({ displayName: '', role: '', department: '', type: '', hireDate: '', status: 'active' });
    setShowNewStaffForm(false);
  };

  const saveVax = () => {
    if (!vaxForm || !vaxForm.vaccine || !vaxForm.status) return;
    updateDB(draft => {
      const facilityStore = draft.data.facilityData[activeFacilityId];
      if (!facilityStore.staffVaxEvents) facilityStore.staffVaxEvents = {};
      const id = uuidv4();
      facilityStore.staffVaxEvents[id] = {
        id,
        staffId: vaxForm.staffId,
        vaccine: vaxForm.vaccine,
        status: vaxForm.status as any,
        dateGiven: vaxForm.status === 'given' ? vaxForm.date : undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });
    setVaxForm(null);
  };

  const saveFit = () => {
    if (!fitForm || !fitForm.status || !fitForm.date) return;
    updateDB(draft => {
      const facilityStore = draft.data.facilityData[activeFacilityId];
      if (!facilityStore.fitTestEvents) facilityStore.fitTestEvents = {};
      const id = uuidv4();
      facilityStore.fitTestEvents[id] = {
        id,
        staffId: fitForm.staffId,
        date: fitForm.date,
        maskType: '',
        maskSize: '',
        passed: fitForm.status === 'Pass',
        nextDueDate: '',
        notes: fitForm.status === 'Declined' ? 'Declined' : undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });
    setFitForm(null);
  };

  const getLatestVax = (staffId: string, vaccine: string) => {
    return staffVaxEvents
      .filter(v => v.staffId === staffId && v.vaccine === vaccine)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  };

  const getLatestFit = (staffId: string) => {
    return fitTestEvents
      .filter(f => f.staffId === staffId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <header className="flex items-center justify-between pb-4 border-b border-neutral-200">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Staff Management</h1>
          <p className="text-sm text-neutral-500">Manage staff records, vaccinations, and FIT testing.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={downloadTemplate} className="flex items-center gap-2 px-3 py-2 bg-white border border-neutral-300 text-neutral-700 rounded-md hover:bg-neutral-50 text-sm font-medium">
            <Download className="w-4 h-4" />
            CSV Template
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 bg-white border border-neutral-300 text-neutral-700 rounded-md hover:bg-neutral-50 text-sm font-medium">
            <Upload className="w-4 h-4" />
            Upload CSV
          </button>
          <input ref={fileInputRef} type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
          <button onClick={() => setShowNewStaffForm(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium active:scale-95">
            <Plus className="w-4 h-4" />
            New Staff
          </button>
        </div>
      </header>

      {uploadResult && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4 text-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-semibold text-green-800">CSV Upload Complete</p>
              <p className="text-green-700">Added: {uploadResult.added} | Updated: {uploadResult.updated} | Deactivated: {uploadResult.deactivated}</p>
              {uploadResult.errors.length > 0 && (
                <ul className="mt-2 list-disc list-inside text-red-700">
                  {uploadResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
            <button onClick={() => setUploadResult(null)} className="text-green-600 hover:text-green-800"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {showNewStaffForm && (
        <div className="mt-4 bg-white border border-indigo-200 rounded-lg p-4">
          <h3 className="font-semibold text-neutral-800 mb-3">New Staff Member</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {(['displayName', 'role', 'department', 'type', 'hireDate'] as const).map(field => (
              <div key={field}>
                <label className="block text-xs font-medium text-neutral-600 mb-1 capitalize">{field === 'displayName' ? 'Name *' : field === 'hireDate' ? 'Hire Date' : field}</label>
                <input
                  type={field === 'hireDate' ? 'date' : 'text'}
                  value={newStaff[field]}
                  onChange={e => setNewStaff(prev => ({ ...prev, [field]: e.target.value }))}
                  className="w-full border border-neutral-300 rounded-md p-1.5 text-sm"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={addNewStaff} className="px-3 py-1.5 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700">Add</button>
            <button onClick={() => setShowNewStaffForm(false)} className="px-3 py-1.5 bg-white border border-neutral-300 rounded-md text-sm hover:bg-neutral-50">Cancel</button>
          </div>
        </div>
      )}

      <div className="mt-6 bg-white rounded-lg shadow-sm border border-neutral-200/50 overflow-hidden">
        <table className="w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold text-neutral-500 uppercase w-6"></th>
              <th className="px-4 py-3 text-left text-xs font-bold text-neutral-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-neutral-500 uppercase">Role / Dept</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-neutral-500 uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-neutral-500 uppercase">Hire Date</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-neutral-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-neutral-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-neutral-200">
            {staffList.map((staff) => {
              const isEditing = editingId === staff.id;
              const isExpanded = expandedId === staff.id;
              const latestFit = getLatestFit(staff.id);
              return (
                <React.Fragment key={staff.id}>
                  <tr className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <button onClick={() => setExpandedId(isExpanded ? null : staff.id)} className="text-neutral-400 hover:text-neutral-600">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input value={editState!.displayName} onChange={e => setEditState(p => p ? { ...p, displayName: e.target.value } : p)} className="border border-neutral-300 rounded px-2 py-1 text-sm w-full" />
                      ) : (
                        <span className="text-sm font-medium text-neutral-900">{staff.displayName}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex gap-1">
                          <input placeholder="Role" value={editState!.role} onChange={e => setEditState(p => p ? { ...p, role: e.target.value } : p)} className="border border-neutral-300 rounded px-2 py-1 text-sm w-full" />
                          <input placeholder="Dept" value={editState!.department} onChange={e => setEditState(p => p ? { ...p, department: e.target.value } : p)} className="border border-neutral-300 rounded px-2 py-1 text-sm w-full" />
                        </div>
                      ) : (
                        <span className="text-sm text-neutral-500">{staff.role}{(staff as any).department ? ` / ${(staff as any).department}` : ''}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input value={editState!.type} onChange={e => setEditState(p => p ? { ...p, type: e.target.value } : p)} className="border border-neutral-300 rounded px-2 py-1 text-sm w-24" />
                      ) : (
                        <span className="text-sm text-neutral-500">{(staff as any).type || '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input type="date" value={editState!.hireDate} onChange={e => setEditState(p => p ? { ...p, hireDate: e.target.value } : p)} className="border border-neutral-300 rounded px-2 py-1 text-sm" />
                      ) : (
                        <span className="text-sm text-neutral-500">{staff.hireDate || '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <select value={editState!.status} onChange={e => setEditState(p => p ? { ...p, status: e.target.value as any } : p)} className="border border-neutral-300 rounded px-2 py-1 text-sm">
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      ) : (
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${staff.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {staff.status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex gap-1">
                          <button onClick={saveEdit} className="text-green-600 hover:text-green-800"><Check className="w-4 h-4" /></button>
                          <button onClick={() => { setEditingId(null); setEditState(null); }} className="text-red-500 hover:text-red-700"><X className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <button onClick={() => startEdit(staff)} className="text-indigo-600 hover:text-indigo-900"><Edit2 className="w-4 h-4" /></button>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={7} className="bg-neutral-50 px-8 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Vaccine History */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-semibold text-neutral-700 flex items-center gap-1"><Syringe className="w-4 h-4" /> Vaccine History</h4>
                              <button onClick={() => setVaxForm({ staffId: staff.id, vaccine: 'Influenza', status: 'given', date: new Date().toISOString().split('T')[0] })} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">+ Add</button>
                            </div>
                            {(['Influenza', 'Pneumonia', 'Covid-19'] as const).map(vax => {
                              const latest = getLatestVax(staff.id, vax);
                              return (
                                <div key={vax} className="flex items-center justify-between py-1 border-b border-neutral-200 last:border-0 text-sm">
                                  <span className="text-neutral-700">{vax}</span>
                                  {latest ? (
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${latest.status === 'given' ? 'bg-green-100 text-green-800' : latest.status === 'declined' ? 'bg-red-100 text-red-800' : 'bg-neutral-100 text-neutral-700'}`}>
                                      {latest.status} {latest.dateGiven ? `(${latest.dateGiven})` : ''}
                                    </span>
                                  ) : <span className="text-neutral-400 text-xs">Not recorded</span>}
                                </div>
                              );
                            })}
                            {vaxForm?.staffId === staff.id && (
                              <div className="mt-2 flex items-end gap-2 flex-wrap">
                                <select value={vaxForm.vaccine} onChange={e => setVaxForm(p => p ? { ...p, vaccine: e.target.value } : p)} className="border border-neutral-300 rounded px-2 py-1 text-sm">
                                  <option>Influenza</option>
                                  <option>Pneumonia</option>
                                  <option>Covid-19</option>
                                </select>
                                <select value={vaxForm.status} onChange={e => setVaxForm(p => p ? { ...p, status: e.target.value } : p)} className="border border-neutral-300 rounded px-2 py-1 text-sm">
                                  <option value="given">Given</option>
                                  <option value="declined">Declined</option>
                                  <option value="contraindicated">History</option>
                                </select>
                                <input type="date" value={vaxForm.date} onChange={e => setVaxForm(p => p ? { ...p, date: e.target.value } : p)} className="border border-neutral-300 rounded px-2 py-1 text-sm" />
                                <button onClick={saveVax} className="px-2 py-1 bg-indigo-600 text-white rounded text-sm">Save</button>
                                <button onClick={() => setVaxForm(null)} className="px-2 py-1 bg-white border border-neutral-300 rounded text-sm">Cancel</button>
                              </div>
                            )}
                          </div>
                          {/* Fit Testing */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-semibold text-neutral-700 flex items-center gap-1"><Shield className="w-4 h-4" /> Face Fit Testing</h4>
                              <button onClick={() => setFitForm({ staffId: staff.id, status: 'Pass', date: new Date().toISOString().split('T')[0] })} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">+ Add</button>
                            </div>
                            {latestFit ? (
                              <div className="text-sm">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${latestFit.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                  {latestFit.notes === 'Declined' ? 'Declined' : latestFit.passed ? 'Pass' : 'Fail'}
                                </span>
                                <span className="text-neutral-500 ml-2">{latestFit.date}</span>
                              </div>
                            ) : <p className="text-neutral-400 text-xs">Not recorded</p>}
                            {fitForm?.staffId === staff.id && (
                              <div className="mt-2 flex items-end gap-2 flex-wrap">
                                <select value={fitForm.status} onChange={e => setFitForm(p => p ? { ...p, status: e.target.value } : p)} className="border border-neutral-300 rounded px-2 py-1 text-sm">
                                  <option value="Pass">Pass</option>
                                  <option value="Fail">Fail</option>
                                  <option value="Declined">Declined</option>
                                </select>
                                <input type="date" value={fitForm.date} onChange={e => setFitForm(p => p ? { ...p, date: e.target.value } : p)} className="border border-neutral-300 rounded px-2 py-1 text-sm" />
                                <button onClick={saveFit} className="px-2 py-1 bg-indigo-600 text-white rounded text-sm">Save</button>
                                <button onClick={() => setFitForm(null)} className="px-2 py-1 bg-white border border-neutral-300 rounded text-sm">Cancel</button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {staffList.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-neutral-400 text-sm">No staff records found. Add staff or upload a CSV.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StaffPage;
