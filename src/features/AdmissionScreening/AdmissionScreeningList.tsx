import React, { useState, useMemo } from 'react';
import { AdmissionScreeningRecord } from '../../domain/models';
import { Search, Plus, Edit, Printer, ChevronDown, ChevronUp } from 'lucide-react';

/** Maximum days from admission before a screening is considered late (72 hours). */
const MAX_SCREENING_DAYS = 3;

interface Props {
  screenings: AdmissionScreeningRecord[];
  onNew: () => void;
  onOpen: (record: AdmissionScreeningRecord) => void;
}

type SortField = 'screeningDate' | 'admitDate' | 'name';

const AdmissionScreeningList: React.FC<Props> = ({ screenings, onNew, onOpen }) => {
  const [search, setSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('screeningDate');
  const [sortAsc, setSortAsc] = useState(false);

  const units = useMemo(() => {
    const s = new Set<string>();
    screenings.forEach(r => { if (r.unit?.trim()) s.add(r.unit.trim()); });
    return Array.from(s).sort();
  }, [screenings]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return screenings
      .filter(r => {
        if (q) {
          const name = (r.name ?? '').toLowerCase();
          const mrn = (r.mrn ?? '').toLowerCase();
          if (!name.includes(q) && !mrn.includes(q)) return false;
        }
        if (unitFilter !== 'all' && r.unit !== unitFilter) return false;
        if (statusFilter !== 'all' && r.screeningStatus !== statusFilter) return false;
        return true;
      })
      .sort((a, b) => {
        let va = '';
        let vb = '';
        if (sortField === 'screeningDate') {
          va = a.screeningDate ?? a.createdAt ?? '';
          vb = b.screeningDate ?? b.createdAt ?? '';
        } else if (sortField === 'admitDate') {
          va = a.admitDate ?? '';
          vb = b.admitDate ?? '';
        } else {
          va = a.name ?? '';
          vb = b.name ?? '';
        }
        const cmp = va.localeCompare(vb);
        return sortAsc ? cmp : -cmp;
      });
  }, [screenings, search, unitFilter, statusFilter, sortField, sortAsc]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(p => !p);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortAsc ? <ChevronUp className="w-3 h-3 inline ml-0.5" /> : <ChevronDown className="w-3 h-3 inline ml-0.5" />;
  };

  const statusBadge = (status: string | undefined) => {
    if (status === 'completed')
      return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">Completed</span>;
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Draft</span>;
  };

  const lateFlag = (r: AdmissionScreeningRecord) => {
    const days = r.daysSinceAdmit;
    if (days !== null && days !== undefined && days > MAX_SCREENING_DAYS) {
      return <span className="ml-1 text-xs text-red-600 font-semibold" title="Screening completed more than 72h after admission">⚠ &gt;72h</span>;
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or MRN…"
            className="w-full pl-8 pr-3 py-1.5 border border-neutral-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <select
          value={unitFilter}
          onChange={e => setUnitFilter(e.target.value)}
          className="border border-neutral-300 rounded-md px-2 py-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="all">All Units</option>
          {units.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-neutral-300 rounded-md px-2 py-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="completed">Completed</option>
        </select>
        <button
          onClick={onNew}
          className="ml-auto inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          New Screening
        </button>
      </div>

      {/* Count */}
      <p className="text-sm text-neutral-500">{filtered.length} record{filtered.length !== 1 ? 's' : ''} found</p>

      {/* Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200 text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th
                  className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase cursor-pointer hover:text-neutral-800"
                  onClick={() => toggleSort('name')}
                >
                  Resident <SortIcon field="name" />
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">MRN</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Unit / Room</th>
                <th
                  className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase cursor-pointer hover:text-neutral-800"
                  onClick={() => toggleSort('admitDate')}
                >
                  Admit Date <SortIcon field="admitDate" />
                </th>
                <th
                  className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase cursor-pointer hover:text-neutral-800"
                  onClick={() => toggleSort('screeningDate')}
                >
                  Screened <SortIcon field="screeningDate" />
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Completed By</th>
                <th className="px-4 py-2 text-xs font-medium text-neutral-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-neutral-400 italic">
                    No admission screenings found.
                  </td>
                </tr>
              ) : (
                filtered.map(r => (
                  <tr key={r.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-2 font-medium text-neutral-900 whitespace-nowrap">
                      {r.name ?? '—'}
                      {lateFlag(r)}
                    </td>
                    <td className="px-4 py-2 text-neutral-600 whitespace-nowrap">{r.mrn ?? '—'}</td>
                    <td className="px-4 py-2 text-neutral-600 whitespace-nowrap">{[r.unit, r.room].filter(Boolean).join(' / ') || '—'}</td>
                    <td className="px-4 py-2 text-neutral-600 whitespace-nowrap">{r.admitDate ?? '—'}</td>
                    <td className="px-4 py-2 text-neutral-600 whitespace-nowrap">{r.screeningDate ?? '—'}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{statusBadge(r.screeningStatus)}</td>
                    <td className="px-4 py-2 text-neutral-600 whitespace-nowrap">{r.completedBy ?? '—'}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onOpen(r)}
                          title="Open / Edit"
                          className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { onOpen(r); setTimeout(() => window.print(), 300); }}
                          title="Print"
                          className="p-1 text-neutral-500 hover:bg-neutral-100 rounded"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdmissionScreeningList;
