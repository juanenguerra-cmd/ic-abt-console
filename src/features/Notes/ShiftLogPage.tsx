import React, { useState, useMemo } from "react";
import { useFacilityData, useDatabase } from "../../app/providers";
import { Resident, ShiftLogEntry } from "../../domain/models";
import { v4 as uuidv4 } from "uuid";
import { useNavigate } from "react-router-dom";
import {
  Plus, X, Search, Filter, Send, Clock, Tag, AlertTriangle, Info,
  ChevronDown, ChevronUp, ExternalLink
} from "lucide-react";

const SHIFT_OPTIONS: ShiftLogEntry['shift'][] = ['Day', 'Night'];
const TAG_OPTIONS: Array<ShiftLogEntry['tags'][number]> = ['Outbreak', 'Isolation', 'Lab', 'ABT', 'Supply', 'Education'];
const PRIORITY_OPTIONS: ShiftLogEntry['priority'][] = ['FYI', 'Action Needed'];

const TAG_COLORS: Record<string, string> = {
  Outbreak: 'bg-red-100 text-red-700 border-red-200',
  Isolation: 'bg-amber-100 text-amber-700 border-amber-200',
  Lab: 'bg-blue-100 text-blue-700 border-blue-200',
  ABT: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Supply: 'bg-purple-100 text-purple-700 border-purple-200',
  Education: 'bg-indigo-100 text-indigo-700 border-indigo-200',
};

export const ShiftLogPage: React.FC = () => {
  const { store, activeFacilityId } = useFacilityData();
  const { updateDB } = useDatabase();
  const navigate = useNavigate();

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formShift, setFormShift] = useState<ShiftLogEntry['shift']>('Day');
  const [formUnit, setFormUnit] = useState('');
  const [formTags, setFormTags] = useState<Set<ShiftLogEntry['tags'][number]>>(new Set());
  const [formPriority, setFormPriority] = useState<ShiftLogEntry['priority']>('FYI');
  const [formBody, setFormBody] = useState('');
  const [formResidentRefs, setFormResidentRefs] = useState<Array<{ mrn: string; name: string }>>([]);
  const [formOutbreakRef, setFormOutbreakRef] = useState<{ id: string; name: string } | undefined>();
  const [residentSearch, setResidentSearch] = useState('');
  const [showResidentSearch, setShowResidentSearch] = useState(false);

  // Filter/search state
  const [searchText, setSearchText] = useState('');
  const [filterShift, setFilterShift] = useState<string>('all');
  const [filterUnit, setFilterUnit] = useState<string>('all');
  const [filterTag, setFilterTag] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterLast24h, setFilterLast24h] = useState(false);

  const residents = (Object.values(store.residents || {}) as Resident[]).filter(r => !r.isHistorical && !r.backOfficeOnly);
  const outbreaks = Object.values(store.outbreaks || {}) as any[];
  const units = useMemo(() => {
    const s = new Set<string>();
    residents.forEach(r => { if (r.currentUnit?.trim()) s.add(r.currentUnit.trim()); });
    return Array.from(s).sort();
  }, [residents]);

  const entries = useMemo(() => Object.values(store.shiftLog || {}), [store.shiftLog]) as ShiftLogEntry[];

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const filteredEntries = useMemo(() => {
    return entries
      .filter(e => {
        if (filterShift !== 'all' && e.shift !== filterShift) return false;
        if (filterUnit !== 'all' && e.unit !== filterUnit) return false;
        if (filterTag !== 'all' && !e.tags.includes(filterTag as any)) return false;
        if (filterPriority !== 'all' && e.priority !== filterPriority) return false;
        if (filterLast24h && e.createdAtISO < twentyFourHoursAgo) return false;
        if (searchText.trim()) {
          const q = searchText.toLowerCase();
          const bodyMatch = e.body.toLowerCase().includes(q);
          const mrnMatch = e.residentRefs?.some(r => r.mrn.includes(q) || r.name.toLowerCase().includes(q));
          // Detect LAST, FIRST pattern
          const namePattern = /^([A-Z][a-z]+),\s*([A-Z][a-z]+)$/;
          const nameMatch = namePattern.test(searchText.trim()) &&
            e.residentRefs?.some(r => r.name.toLowerCase().includes(q));
          if (!bodyMatch && !mrnMatch && !nameMatch) return false;
        }
        return true;
      })
      .sort((a, b) => b.createdAtISO.localeCompare(a.createdAtISO));
  }, [entries, filterShift, filterUnit, filterTag, filterPriority, filterLast24h, searchText, twentyFourHoursAgo]);

  const filteredResidents = useMemo(() => {
    if (!residentSearch.trim()) return [];
    const q = residentSearch.toLowerCase();
    return residents
      .filter(r => r.displayName.toLowerCase().includes(q) || r.mrn.includes(q))
      .slice(0, 6);
  }, [residents, residentSearch]);

  const toggleTag = (tag: ShiftLogEntry['tags'][number]) => {
    setFormTags(prev => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag); else next.add(tag);
      return next;
    });
  };

  const addResidentRef = (resident: Resident) => {
    if (!formResidentRefs.find(r => r.mrn === resident.mrn)) {
      setFormResidentRefs(prev => [...prev, { mrn: resident.mrn, name: resident.displayName }]);
    }
    setResidentSearch('');
    setShowResidentSearch(false);
  };

  const handleSubmit = () => {
    if (!formBody.trim()) return;
    const entry: ShiftLogEntry = {
      id: uuidv4(),
      facilityId: activeFacilityId,
      createdAtISO: new Date().toISOString(),
      shift: formShift,
      unit: formUnit || undefined,
      tags: Array.from(formTags),
      priority: formPriority,
      body: formBody.trim(),
      residentRefs: formResidentRefs.length > 0 ? formResidentRefs : undefined,
      outbreakRef: formOutbreakRef,
    };
    updateDB(draft => {
      const fd = draft.data.facilityData[activeFacilityId];
      if (!fd.shiftLog) fd.shiftLog = {};
      fd.shiftLog[entry.id] = entry;
    });
    // Reset form
    setFormBody('');
    setFormResidentRefs([]);
    setFormOutbreakRef(undefined);
    setFormTags(new Set());
    setShowForm(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-neutral-100">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Shift Log</h1>
          <p className="text-sm text-neutral-500">Handoff notes with resident and outbreak references</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Entry
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-white border-b border-neutral-200 px-6 py-2 flex flex-wrap items-center gap-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
          <input
            type="search"
            placeholder="Search entries, MRN, name..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="pl-7 pr-3 py-1 border border-neutral-300 rounded-md text-xs focus:ring-indigo-500 focus:border-indigo-500 w-48"
          />
        </div>

        <select value={filterShift} onChange={e => setFilterShift(e.target.value)} className="text-xs border border-neutral-300 rounded-md px-2 py-1 focus:ring-indigo-500 focus:border-indigo-500">
          <option value="all">All Shifts</option>
          {SHIFT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select value={filterUnit} onChange={e => setFilterUnit(e.target.value)} className="text-xs border border-neutral-300 rounded-md px-2 py-1 focus:ring-indigo-500 focus:border-indigo-500">
          <option value="all">All Units</option>
          {units.map(u => <option key={u} value={u}>{u}</option>)}
        </select>

        <select value={filterTag} onChange={e => setFilterTag(e.target.value)} className="text-xs border border-neutral-300 rounded-md px-2 py-1 focus:ring-indigo-500 focus:border-indigo-500">
          <option value="all">All Tags</option>
          {TAG_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="text-xs border border-neutral-300 rounded-md px-2 py-1 focus:ring-indigo-500 focus:border-indigo-500">
          <option value="all">Any Priority</option>
          <option value="Action Needed">Action Needed</option>
          <option value="FYI">FYI</option>
        </select>

        <button
          onClick={() => setFilterLast24h(v => !v)}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${filterLast24h ? 'bg-blue-100 border-blue-400 text-blue-800' : 'bg-white border-neutral-300 text-neutral-600'}`}
        >
          Last 24h
        </button>

        <span className="ml-auto text-xs text-neutral-400">{filteredEntries.length} entries</span>
      </div>

      {/* Entries list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-neutral-400 space-y-2">
            <Clock className="w-12 h-12 opacity-30" />
            <p className="text-base font-medium">No shift log entries</p>
            <p className="text-sm">Add an entry to start the handoff log.</p>
          </div>
        ) : (
          filteredEntries.map(entry => (
            <div key={entry.id} className={`bg-white rounded-lg border p-4 shadow-sm ${entry.priority === 'Action Needed' ? 'border-red-200' : 'border-neutral-200'}`}>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {/* Shift badge */}
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${entry.shift === 'Day' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}>
                  {entry.shift} Shift
                </span>
                {/* Unit badge */}
                {entry.unit && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-neutral-100 text-neutral-600 border border-neutral-200">
                    {entry.unit}
                  </span>
                )}
                {/* Priority badge */}
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border flex items-center gap-1 ${entry.priority === 'Action Needed' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-neutral-50 text-neutral-500 border-neutral-200'}`}>
                  {entry.priority === 'Action Needed' && <AlertTriangle className="w-2.5 h-2.5" />}
                  {entry.priority}
                </span>
                {/* Tag badges */}
                {entry.tags.map(tag => (
                  <span key={tag} className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${TAG_COLORS[tag] || 'bg-neutral-100 text-neutral-600 border-neutral-200'}`}>
                    {tag}
                  </span>
                ))}
                <span className="ml-auto text-[10px] text-neutral-400">
                  {new Date(entry.createdAtISO).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <p className="text-sm text-neutral-800 whitespace-pre-wrap mb-2">{entry.body}</p>

              {/* Resident refs */}
              {entry.residentRefs && entry.residentRefs.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {entry.residentRefs.map(ref => (
                    <button
                      key={ref.mrn}
                      onClick={() => navigate('/resident-board', { state: { selectedResidentId: ref.mrn, openProfile: true } })}
                      className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full hover:underline"
                      title={`Open ${ref.name} in Resident Board`}
                    >
                      <ExternalLink className="w-3 h-3" />
                      {ref.name} ({ref.mrn})
                    </button>
                  ))}
                </div>
              )}

              {/* Outbreak ref */}
              {entry.outbreakRef && (
                <button
                  onClick={() => navigate('/outbreaks')}
                  className="mt-1 flex items-center gap-1 text-xs text-red-600 hover:text-red-800 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full hover:underline"
                  title="Open in Outbreak Manager"
                >
                  <ExternalLink className="w-3 h-3" />
                  Outbreak: {entry.outbreakRef.name}
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* New Entry Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50 shrink-0">
              <h2 className="text-lg font-bold text-neutral-900">New Shift Log Entry</h2>
              <button onClick={() => setShowForm(false)} className="text-neutral-400 hover:text-neutral-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto space-y-4">
              {/* Shift + Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Shift</label>
                  <select value={formShift} onChange={e => setFormShift(e.target.value as any)} className="w-full text-sm border border-neutral-300 rounded-md px-2 py-1.5 focus:ring-indigo-500 focus:border-indigo-500">
                    {SHIFT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Priority</label>
                  <select value={formPriority} onChange={e => setFormPriority(e.target.value as any)} className="w-full text-sm border border-neutral-300 rounded-md px-2 py-1.5 focus:ring-indigo-500 focus:border-indigo-500">
                    {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              {/* Unit */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Unit (optional)</label>
                <select value={formUnit} onChange={e => setFormUnit(e.target.value)} className="w-full text-sm border border-neutral-300 rounded-md px-2 py-1.5 focus:ring-indigo-500 focus:border-indigo-500">
                  <option value="">All / Not unit-specific</option>
                  {units.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Tags</label>
                <div className="flex flex-wrap gap-2">
                  {TAG_OPTIONS.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors ${formTags.has(tag) ? TAG_COLORS[tag] : 'bg-white border-neutral-300 text-neutral-600 hover:bg-neutral-50'}`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Body */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Note</label>
                <textarea
                  value={formBody}
                  onChange={e => setFormBody(e.target.value)}
                  placeholder="Enter handoff note..."
                  rows={4}
                  className="w-full text-sm border border-neutral-300 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Resident refs */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Link Residents (optional)</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {formResidentRefs.map(ref => (
                    <span key={ref.mrn} className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                      {ref.name}
                      <button onClick={() => setFormResidentRefs(prev => prev.filter(r => r.mrn !== ref.mrn))} className="hover:text-red-500">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search resident name or MRN..."
                    value={residentSearch}
                    onFocus={() => setShowResidentSearch(true)}
                    onBlur={() => setTimeout(() => setShowResidentSearch(false), 150)}
                    onChange={e => { setResidentSearch(e.target.value); setShowResidentSearch(true); }}
                    className="w-full text-sm border border-neutral-300 rounded-md px-3 py-1.5 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {showResidentSearch && filteredResidents.length > 0 && (
                    <ul className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-neutral-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
                      {filteredResidents.map(r => (
                        <li
                          key={r.mrn}
                          onMouseDown={() => addResidentRef(r)}
                          className="px-3 py-2 text-sm hover:bg-indigo-50 cursor-pointer"
                        >
                          {r.displayName} <span className="text-neutral-400 text-xs">({r.mrn})</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Outbreak ref */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Link Outbreak (optional)</label>
                <select
                  value={formOutbreakRef?.id || ''}
                  onChange={e => {
                    const outbreak = outbreaks.find((o: any) => o.id === e.target.value);
                    setFormOutbreakRef(outbreak ? { id: outbreak.id, name: outbreak.name || outbreak.pathogen || 'Outbreak' } : undefined);
                  }}
                  className="w-full text-sm border border-neutral-300 rounded-md px-2 py-1.5 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">No outbreak reference</option>
                  {outbreaks.filter((o: any) => o.status !== 'closed').map((o: any) => (
                    <option key={o.id} value={o.id}>{o.name || o.pathogen || 'Outbreak'}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-neutral-200 flex justify-end gap-3 shrink-0 bg-neutral-50">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-neutral-700 border border-neutral-300 rounded-md hover:bg-neutral-50">Cancel</button>
              <button
                onClick={handleSubmit}
                disabled={!formBody.trim()}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Save Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
