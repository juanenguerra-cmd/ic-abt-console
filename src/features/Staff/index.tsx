import React, { useState, useRef } from 'react';
import { useFacilityData, useDatabase } from '../../app/providers';
import { Staff, StaffVaxEvent, FitTestEvent } from '../../domain/models';
import { Plus, Upload, Download, Edit2, X, Check, ChevronDown, ChevronRight, Syringe, Shield, Users, CheckSquare, Square, ChevronDown as ChevronDownSmall } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonTable } from '../../components/SkeletonLoader';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkMenu, setShowBulkMenu] = useState(false);
  const bulkMenuRef = useRef<HTMLDivElement>(null);

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
        maskType: 'N/A',
        maskSize: 'N/A',
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

  const getFieldLabel = (field: 'displayName' | 'role' | 'department' | 'type' | 'hireDate'): string => {
    if (field === 'displayName') return 'Name *';
    if (field === 'hireDate') return 'Hire Date';
    return field.charAt(0).toUpperCase() + field.slice(1);
  };

  // Filtered + searched staff list
  const filteredStaff = staffList.filter(s => {
    const matchesSearch = !searchQuery ||
      s.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.role?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s as any).department?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || s.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const allFilteredIds = filteredStaff.map(s => s.id);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedIds.has(id));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allFilteredIds));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkSetStatus = (status: 'active' | 'inactive') => {
    updateDB(draft => {
      const facilityStore = draft.data.facilityData[activeFacilityId];
      selectedIds.forEach(id => {
        if (facilityStore.staff[id]) {
          facilityStore.staff[id].status = status;
        }
      });
    });
    setSelectedIds(new Set());
    setShowBulkMenu(false);
  };

  const bulkMarkVaccine = (vaccine: string, vaxStatus: 'given' | 'declined' | 'contraindicated') => {
    const date = new Date().toISOString().split('T')[0];
    updateDB(draft => {
      const facilityStore = draft.data.facilityData[activeFacilityId];
      if (!facilityStore.staffVaxEvents) facilityStore.staffVaxEvents = {};
      selectedIds.forEach(staffId => {
        const id = uuidv4();
        facilityStore.staffVaxEvents[id] = {
          id,
          staffId,
          vaccine,
          status: vaxStatus,
          dateGiven: vaxStatus === 'given' ? date : undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });
    });
    setSelectedIds(new Set());
    setShowBulkMenu(false);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-neutral-200 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Staff Management</h1>
          <p className="text-sm text-neutral-500">Manage staff records, vaccinations, and FIT testing.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={downloadTemplate} aria-label="Download CSV template" className="flex items-center gap-2 px-3 py-2 bg-white border border-neutral-300 text-neutral-700 rounded-md hover:bg-neutral-50 text-sm font-medium">
            <Download className="w-4 h-4" aria-hidden="true" />
            CSV Template
          </button>
          <button onClick={() => fileInputRef.current?.click()} aria-label="Upload staff CSV" className="flex items-center gap-2 px-3 py-2 bg-white border border-neutral-300 text-neutral-700 rounded-md hover:bg-neutral-50 text-sm font-medium">
            <Upload className="w-4 h-4" aria-hidden="true" />
            Upload CSV
          </button>
          <input ref={fileInputRef} type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" aria-label="Staff CSV file input" />
          <button onClick={() => setShowNewStaffForm(true)} aria-label="Add new staff member" className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium active:scale-95">
            <Plus className="w-4 h-4" aria-hidden="true" />
            New Staff
          </button>
        </div>
      </header>

      {/* Search and filter bar */}
      <div className="mt-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="search"
            aria-label="Search staff by name, role, or department"
            placeholder="Search by name, role, or department…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-4 pr-4 py-2 border border-neutral-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="staff-status-filter" className="text-sm text-neutral-600 whitespace-nowrap">Status:</label>
          <select
            id="staff-status-filter"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
            className="border border-neutral-300 rounded-md px-2 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Bulk actions toolbar */}
      {someSelected && (
        <div
          role="toolbar"
          aria-label="Bulk actions"
          className="mt-3 flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2"
        >
          <span className="text-sm font-medium text-indigo-800">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <button
              onClick={() => bulkSetStatus('active')}
              aria-label="Set selected staff to active"
              className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              Set Active
            </button>
            <button
              onClick={() => bulkSetStatus('inactive')}
              aria-label="Set selected staff to inactive"
              className="px-3 py-1.5 text-xs font-medium bg-neutral-600 text-white rounded-md hover:bg-neutral-700 transition-colors"
            >
              Set Inactive
            </button>
            <div className="relative" ref={bulkMenuRef}>
              <button
                onClick={() => setShowBulkMenu(p => !p)}
                aria-haspopup="menu"
                aria-expanded={showBulkMenu}
                aria-label="More bulk vaccine actions"
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
              >
                <Syringe className="w-3.5 h-3.5" aria-hidden="true" />
                Mark Vaccine
                <ChevronDownSmall className="w-3 h-3" aria-hidden="true" />
              </button>
              {showBulkMenu && (
                <div role="menu" className="absolute right-0 top-full mt-1 w-52 bg-white rounded-md shadow-lg border border-neutral-200 py-1 z-20">
                  {(['Influenza', 'Pneumonia', 'Covid-19'] as const).map(vax => (
                    <button
                      key={vax}
                      role="menuitem"
                      onClick={() => bulkMarkVaccine(vax, 'given')}
                      className="w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                    >
                      {vax} — Given today
                    </button>
                  ))}
                  <div className="border-t border-neutral-100 my-1" />
                  {(['Influenza', 'Pneumonia', 'Covid-19'] as const).map(vax => (
                    <button
                      key={`${vax}-declined`}
                      role="menuitem"
                      onClick={() => bulkMarkVaccine(vax, 'declined')}
                      className="w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                    >
                      {vax} — Declined
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => setSelectedIds(new Set())}
              aria-label="Clear selection"
              className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900"
            >
              Clear
            </button>
          </div>
        </div>
      )}

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
        <div className="mt-4 bg-white border border-indigo-200 rounded-lg p-4" role="form" aria-label="New staff member form">
          <h3 className="font-semibold text-neutral-800 mb-3">New Staff Member</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {(['displayName', 'role', 'department', 'type', 'hireDate'] as const).map(field => {
              const labelText = getFieldLabel(field);
              const inputId = `new-staff-${field}`;
              return (
                <div key={field}>
                  <label htmlFor={inputId} className="block text-xs font-medium text-neutral-600 mb-1">{labelText}</label>
                  <input
                    id={inputId}
                    type={field === 'hireDate' ? 'date' : 'text'}
                    value={newStaff[field]}
                    onChange={e => setNewStaff(prev => ({ ...prev, [field]: e.target.value }))}
                    className="w-full border border-neutral-300 rounded-md p-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                    aria-required={field === 'displayName'}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={addNewStaff} className="px-3 py-1.5 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700">Add Staff</button>
            <button onClick={() => setShowNewStaffForm(false)} className="px-3 py-1.5 bg-white border border-neutral-300 rounded-md text-sm hover:bg-neutral-50">Cancel</button>
          </div>
        </div>
      )}

      <div className="mt-6 bg-white rounded-lg shadow-sm border border-neutral-200/50 overflow-hidden">
        <table className="w-full divide-y divide-neutral-200" aria-label="Staff roster">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold text-neutral-500 uppercase w-8">
                <button
                  onClick={toggleSelectAll}
                  aria-label={allSelected ? "Deselect all staff" : "Select all visible staff"}
                  className="text-neutral-400 hover:text-neutral-700"
                >
                  {allSelected ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4" />}
                </button>
              </th>
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
            {filteredStaff.map((staff) => {
              const isEditing = editingId === staff.id;
              const isExpanded = expandedId === staff.id;
              const isSelected = selectedIds.has(staff.id);
              const latestFit = getLatestFit(staff.id);
              return (
                <React.Fragment key={staff.id}>
                  <tr className={`hover:bg-neutral-50 ${isSelected ? 'bg-indigo-50' : ''}`}>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleSelectOne(staff.id)}
                        aria-label={isSelected ? `Deselect ${staff.displayName}` : `Select ${staff.displayName}`}
                        aria-pressed={isSelected}
                        className="text-neutral-400 hover:text-neutral-700"
                      >
                        {isSelected ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : staff.id)}
                        aria-label={isExpanded ? `Collapse ${staff.displayName}` : `Expand ${staff.displayName}`}
                        aria-expanded={isExpanded}
                        className="text-neutral-400 hover:text-neutral-600"
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          aria-label="Staff name"
                          value={editState!.displayName}
                          onChange={e => setEditState(p => p ? { ...p, displayName: e.target.value } : p)}
                          className="border border-neutral-300 rounded px-2 py-1 text-sm w-full"
                        />
                      ) : (
                        <span className="text-sm font-medium text-neutral-900">{staff.displayName}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex gap-1">
                          <input aria-label="Role" placeholder="Role" value={editState!.role} onChange={e => setEditState(p => p ? { ...p, role: e.target.value } : p)} className="border border-neutral-300 rounded px-2 py-1 text-sm w-full" />
                          <input aria-label="Department" placeholder="Dept" value={editState!.department} onChange={e => setEditState(p => p ? { ...p, department: e.target.value } : p)} className="border border-neutral-300 rounded px-2 py-1 text-sm w-full" />
                        </div>
                      ) : (
                        <span className="text-sm text-neutral-500">{staff.role}{(staff as any).department ? ` / ${(staff as any).department}` : ''}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input aria-label="Staff type" value={editState!.type} onChange={e => setEditState(p => p ? { ...p, type: e.target.value } : p)} className="border border-neutral-300 rounded px-2 py-1 text-sm w-24" />
                      ) : (
                        <span className="text-sm text-neutral-500">{(staff as any).type || '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input aria-label="Hire date" type="date" value={editState!.hireDate} onChange={e => setEditState(p => p ? { ...p, hireDate: e.target.value } : p)} className="border border-neutral-300 rounded px-2 py-1 text-sm" />
                      ) : (
                        <span className="text-sm text-neutral-500">{staff.hireDate || '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <select aria-label="Employment status" value={editState!.status} onChange={e => setEditState(p => p ? { ...p, status: e.target.value as any } : p)} className="border border-neutral-300 rounded px-2 py-1 text-sm">
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
                          <button onClick={saveEdit} aria-label="Save changes" className="text-green-600 hover:text-green-800"><Check className="w-4 h-4" /></button>
                          <button onClick={() => { setEditingId(null); setEditState(null); }} aria-label="Cancel editing" className="text-red-500 hover:text-red-700"><X className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <button onClick={() => startEdit(staff)} aria-label={`Edit ${staff.displayName}`} className="text-indigo-600 hover:text-indigo-900"><Edit2 className="w-4 h-4" /></button>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={8} className="bg-neutral-50 px-8 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Vaccine History */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-semibold text-neutral-700 flex items-center gap-1"><Syringe className="w-4 h-4" aria-hidden="true" /> Vaccine History</h4>
                              <button onClick={() => setVaxForm({ staffId: staff.id, vaccine: 'Influenza', status: 'given', date: new Date().toISOString().split('T')[0] })} aria-label="Add vaccine record" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">+ Add</button>
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
                                <label className="sr-only" htmlFor={`vax-select-${staff.id}`}>Vaccine</label>
                                <select id={`vax-select-${staff.id}`} value={vaxForm.vaccine} onChange={e => setVaxForm(p => p ? { ...p, vaccine: e.target.value } : p)} className="border border-neutral-300 rounded px-2 py-1 text-sm">
                                  <option>Influenza</option>
                                  <option>Pneumonia</option>
                                  <option>Covid-19</option>
                                </select>
                                <label className="sr-only" htmlFor={`vax-status-${staff.id}`}>Vaccine status</label>
                                <select id={`vax-status-${staff.id}`} value={vaxForm.status} onChange={e => setVaxForm(p => p ? { ...p, status: e.target.value } : p)} className="border border-neutral-300 rounded px-2 py-1 text-sm">
                                  <option value="given">Given</option>
                                  <option value="declined">Declined</option>
                                  <option value="contraindicated">History</option>
                                </select>
                                <label className="sr-only" htmlFor={`vax-date-${staff.id}`}>Date given</label>
                                <input id={`vax-date-${staff.id}`} type="date" value={vaxForm.date} onChange={e => setVaxForm(p => p ? { ...p, date: e.target.value } : p)} className="border border-neutral-300 rounded px-2 py-1 text-sm" />
                                <button onClick={saveVax} className="px-2 py-1 bg-indigo-600 text-white rounded text-sm">Save</button>
                                <button onClick={() => setVaxForm(null)} className="px-2 py-1 bg-white border border-neutral-300 rounded text-sm">Cancel</button>
                              </div>
                            )}
                          </div>
                          {/* Fit Testing */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-semibold text-neutral-700 flex items-center gap-1"><Shield className="w-4 h-4" aria-hidden="true" /> Face Fit Testing</h4>
                              <button onClick={() => setFitForm({ staffId: staff.id, status: 'Pass', date: new Date().toISOString().split('T')[0] })} aria-label="Add fit test record" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">+ Add</button>
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
                                <label className="sr-only" htmlFor={`fit-status-${staff.id}`}>Fit test result</label>
                                <select id={`fit-status-${staff.id}`} value={fitForm.status} onChange={e => setFitForm(p => p ? { ...p, status: e.target.value } : p)} className="border border-neutral-300 rounded px-2 py-1 text-sm">
                                  <option value="Pass">Pass</option>
                                  <option value="Fail">Fail</option>
                                  <option value="Declined">Declined</option>
                                </select>
                                <label className="sr-only" htmlFor={`fit-date-${staff.id}`}>Fit test date</label>
                                <input id={`fit-date-${staff.id}`} type="date" value={fitForm.date} onChange={e => setFitForm(p => p ? { ...p, date: e.target.value } : p)} className="border border-neutral-300 rounded px-2 py-1 text-sm" />
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
            {filteredStaff.length === 0 && staffList.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <EmptyState
                    icon={<Users className="w-16 h-16 text-neutral-300" />}
                    title="No staff records yet"
                    description="Get started by adding a staff member manually or uploading a CSV roster. Use the CSV Template button to download a sample file."
                    action={
                      <button
                        onClick={() => setShowNewStaffForm(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium"
                      >
                        <Plus className="w-4 h-4" aria-hidden="true" />
                        Add First Staff Member
                      </button>
                    }
                  />
                </td>
              </tr>
            )}
            {filteredStaff.length === 0 && staffList.length > 0 && (
              <tr>
                <td colSpan={8}>
                  <EmptyState
                    title="No matching staff"
                    description={`No staff match "${searchQuery || filterStatus}". Try adjusting your search or filter.`}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StaffPage;
