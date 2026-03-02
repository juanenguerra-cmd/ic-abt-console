import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFacilityData, useDatabase } from '../app/providers';
import { Resident, ShiftLogEntry } from '../domain/models';
import { v4 as uuidv4 } from 'uuid';
import {
  Star, Plus, X, Send, LayoutDashboard, Users, AlertCircle,
  FileText, Map, MessageSquare, ClipboardCheck, FileBarChart,
  Inbox, Activity, PenSquare, Bell, BookOpen, Database, Settings, Home
} from 'lucide-react';

// All pinnable navigation items
const ALL_NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
  { id: 'resident-board', label: 'Resident Board', path: '/resident-board', icon: Users, color: 'bg-blue-50 text-blue-600 border-blue-100' },
  { id: 'outbreaks', label: 'Outbreaks', path: '/outbreaks', icon: AlertCircle, color: 'bg-red-50 text-red-600 border-red-100' },
  { id: 'linelist', label: 'Line List', path: '/linelist-report', icon: FileText, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
  { id: 'floor-map', label: 'Floor Map', path: '/floor-map', icon: Map, color: 'bg-teal-50 text-teal-600 border-teal-100' },
  { id: 'shift-log', label: 'Shift Log', path: '/chat', icon: MessageSquare, color: 'bg-violet-50 text-violet-600 border-violet-100' },
  { id: 'reports', label: 'Reports', path: '/reports', icon: Activity, color: 'bg-orange-50 text-orange-600 border-orange-100' },
  { id: 'audit-center', label: 'Audit Center', path: '/audit-center', icon: ClipboardCheck, color: 'bg-pink-50 text-pink-600 border-pink-100' },
  { id: 'report-builder', label: 'Report Builder', path: '/report-builder', icon: FileBarChart, color: 'bg-cyan-50 text-cyan-600 border-cyan-100' },
  { id: 'notifications', label: 'Notifications', path: '/notifications', icon: Bell, color: 'bg-yellow-50 text-yellow-600 border-yellow-100' },
  { id: 'staff', label: 'Staff', path: '/staff', icon: Users, color: 'bg-sky-50 text-sky-600 border-sky-100' },
  { id: 'quarantine', label: 'Quarantine', path: '/quarantine', icon: Inbox, color: 'bg-rose-50 text-rose-600 border-rose-100' },
  { id: 'note-generator', label: 'Note Generator', path: '/note-generator', icon: PenSquare, color: 'bg-purple-50 text-purple-600 border-purple-100' },
  { id: 'user-guide', label: 'User Guide', path: '/user-guide', icon: BookOpen, color: 'bg-gray-50 text-gray-600 border-gray-100' },
  { id: 'settings', label: 'Settings', path: '/settings', icon: Settings, color: 'bg-neutral-50 text-neutral-600 border-neutral-200' },
  { id: 'back-office', label: 'Back Office', path: '/back-office', icon: Database, color: 'bg-slate-50 text-slate-600 border-slate-200' },
];

const DEFAULT_PINNED = ['dashboard', 'outbreaks', 'linelist'];
const LS_PINNED_KEY = 'ic_home_pinned_favorites';

const TAG_OPTIONS: Array<ShiftLogEntry['tags'][number]> = ['Outbreak', 'Isolation', 'Lab', 'ABT', 'Supply', 'Education'];

function loadPinned(): string[] {
  try {
    const raw = localStorage.getItem(LS_PINNED_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_PINNED;
}

function savePinned(ids: string[]) {
  localStorage.setItem(LS_PINNED_KEY, JSON.stringify(ids));
}

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { store, activeFacilityId } = useFacilityData();
  const { updateDB } = useDatabase();

  // ── Pinned Favorites ──────────────────────────────────────────────
  const [pinnedIds, setPinnedIds] = useState<string[]>(loadPinned);
  const [showPinPicker, setShowPinPicker] = useState(false);
  const pinPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPinPicker) return;
    const handler = (e: MouseEvent) => {
      if (pinPickerRef.current && !pinPickerRef.current.contains(e.target as Node)) {
        setShowPinPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPinPicker]);

  const togglePin = useCallback((id: string) => {
    setPinnedIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      savePinned(next);
      return next;
    });
  }, []);

  const pinnedItems = useMemo(
    () => pinnedIds.map(id => ALL_NAV_ITEMS.find(n => n.id === id)).filter(Boolean) as typeof ALL_NAV_ITEMS,
    [pinnedIds]
  );

  // ── Quick Note state ──────────────────────────────────────────────
  const [noteText, setNoteText] = useState('');
  const ROUTE_TO = 'Shift Log';
  const [selectedTags, setSelectedTags] = useState<Set<ShiftLogEntry['tags'][number]>>(new Set());
  const [mentionSearch, setMentionSearch] = useState('');
  const [showMentionDrop, setShowMentionDrop] = useState(false);
  const [mentionedResidents, setMentionedResidents] = useState<Array<{ mrn: string; name: string }>>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionDropRef = useRef<HTMLDivElement>(null);

  const residents = useMemo(
    () => (Object.values(store.residents || {}) as Resident[]).filter(r => !r.isHistorical && !r.backOfficeOnly),
    [store.residents]
  );

  // Close mention dropdown on outside click
  useEffect(() => {
    if (!showMentionDrop) return;
    const handler = (e: MouseEvent) => {
      if (mentionDropRef.current && !mentionDropRef.current.contains(e.target as Node) &&
          textareaRef.current && !textareaRef.current.contains(e.target as Node)) {
        setShowMentionDrop(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMentionDrop]);

  const mentionResults = useMemo(() => {
    if (!mentionSearch.trim()) return residents.slice(0, 6);
    const q = mentionSearch.toLowerCase();
    return residents.filter(r => r.displayName.toLowerCase().includes(q) || r.mrn.includes(q)).slice(0, 6);
  }, [residents, mentionSearch]);

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNoteText(val);
    // Detect @ trigger
    const caretPos = e.target.selectionStart ?? val.length;
    const textBeforeCaret = val.slice(0, caretPos);
    const atMatch = textBeforeCaret.match(/@(\w*)$/);
    if (atMatch) {
      setMentionSearch(atMatch[1]);
      setShowMentionDrop(true);
    } else {
      setShowMentionDrop(false);
    }
  };

  const insertMention = (resident: Resident) => {
    // Replace the trailing @... with @Name
    const val = noteText;
    const caretPos = textareaRef.current?.selectionStart ?? val.length;
    const textBeforeCaret = val.slice(0, caretPos);
    const replaced = textBeforeCaret.replace(/@(\w*)$/, `@${resident.displayName} `);
    const newText = replaced + val.slice(caretPos);
    setNoteText(newText);
    setShowMentionDrop(false);
    setMentionedResidents(prev =>
      prev.find(r => r.mrn === resident.mrn) ? prev : [...prev, { mrn: resident.mrn, name: resident.displayName }]
    );
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const toggleTag = (tag: ShiftLogEntry['tags'][number]) => {
    setSelectedTags(prev => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag); else next.add(tag);
      return next;
    });
  };

  const handleSubmit = () => {
    const body = noteText.trim();
    if (!body) return;
    const entry: ShiftLogEntry = {
      id: uuidv4(),
      facilityId: activeFacilityId,
      createdAtISO: new Date().toISOString(),
      shift: new Date().getHours() < 19 ? 'Day' : 'Night',
      tags: Array.from(selectedTags),
      priority: 'FYI',
      body,
      residentRefs: mentionedResidents.length > 0 ? mentionedResidents : undefined,
    };
    updateDB(draft => {
      const fd = draft.data.facilityData[activeFacilityId];
      if (!fd.shiftLog) fd.shiftLog = {};
      fd.shiftLog[entry.id] = entry;
    });
    setNoteText('');
    setMentionedResidents([]);
    setSelectedTags(new Set());
  };

  // Recent mentions: most recently @-tagged residents from shift log
  const recentMentions = useMemo((): string[] => {
    const entries = Object.values(store.shiftLog || {}) as ShiftLogEntry[];
    const seen: Record<string, string> = {};
    entries
      .sort((a, b) => b.createdAtISO.localeCompare(a.createdAtISO))
      .forEach(e => {
        (e.residentRefs || []).forEach(r => {
          if (!(r.mrn in seen)) seen[r.mrn] = r.name;
        });
      });
    return Object.values(seen).slice(0, 5);
  }, [store.shiftLog]);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-2">
        <Home className="w-5 h-5 text-neutral-500" />
        <h1 className="text-xl font-bold text-neutral-900">Home</h1>
      </div>

      {/* ── PINNED FAVORITES ─────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-100">
          <div className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            PINNED FAVORITES
          </div>
          <div className="relative" ref={pinPickerRef}>
            <button
              onClick={() => setShowPinPicker(p => !p)}
              className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
              aria-label="Pin more items"
            >
              <Plus className="w-3.5 h-3.5" />
              Pin More
            </button>
            {showPinPicker && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-lg shadow-lg border border-neutral-200 py-1 z-10">
                {ALL_NAV_ITEMS.map(item => {
                  const pinned = pinnedIds.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => togglePin(item.id)}
                      className="w-full flex items-center justify-between px-3 py-1.5 text-sm hover:bg-neutral-50 transition-colors"
                    >
                      <span className="text-neutral-700">{item.label}</span>
                      {pinned && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="p-4">
          {pinnedItems.length === 0 ? (
            <p className="text-sm text-neutral-400 py-2 text-center">No pinned items. Click <strong>Pin More</strong> to add shortcuts.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {pinnedItems.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.path)}
                    className={`flex flex-col items-center gap-1.5 w-24 py-3 rounded-lg border cursor-pointer hover:shadow-md transition-all active:scale-95 ${item.color}`}
                    aria-label={`Go to ${item.label}`}
                  >
                    <Icon className="w-6 h-6" />
                    <span className="text-xs font-medium text-center leading-tight">{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── QUICK NOTE / CHAT BOX ────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-neutral-100">
          <MessageSquare className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-semibold text-neutral-700">QUICK NOTE / CHAT BOX</span>
        </div>
        <div className="p-4 space-y-3">
          {/* Textarea with mention detection */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={noteText}
              onChange={handleNoteChange}
              placeholder={`Type a note… use @ to mention a resident, # for tags`}
              rows={3}
              className="w-full text-sm border border-neutral-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
            />
            {showMentionDrop && mentionResults.length > 0 && (
              <div
                ref={mentionDropRef}
                className="absolute left-0 top-full mt-1 w-64 bg-white rounded-lg shadow-lg border border-neutral-200 py-1 z-10"
              >
                {mentionResults.map(r => (
                  <button
                    key={r.mrn}
                    onMouseDown={e => { e.preventDefault(); insertMention(r); }}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-neutral-50 transition-colors"
                  >
                    <span className="font-medium text-neutral-800">{r.displayName}</span>
                    <span className="ml-2 text-xs text-neutral-400">#{r.mrn}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tag pills */}
          <div className="flex flex-wrap gap-1.5">
            {TAG_OPTIONS.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                  selectedTags.has(tag)
                    ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                    : 'bg-white border-neutral-300 text-neutral-500 hover:bg-neutral-50'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>

          {/* Route to + Submit */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-neutral-500 shrink-0">Route to:</span>
            <select
              value={ROUTE_TO}
              disabled
              className="text-xs border border-neutral-200 rounded px-2 py-1 bg-neutral-50 text-neutral-700"
            >
              <option value="Shift Log">Shift Log</option>
            </select>
            <button
              onClick={handleSubmit}
              disabled={!noteText.trim()}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
              Submit
            </button>
          </div>

          {/* Recent Tags */}
          {recentMentions.length > 0 && (
            <div className="text-xs text-neutral-400 pt-1 border-t border-neutral-100">
              <span className="font-medium text-neutral-500">Recent Tags: </span>
              {recentMentions.map((name, i) => (
                <span key={name}>
                  <button
                    onClick={() => setNoteText(prev => prev + (prev.endsWith(' ') || prev === '' ? '' : ' ') + `@${name} `)}
                    className="text-indigo-500 hover:underline"
                  >
                    @{name}
                  </button>
                  {i < recentMentions.length - 1 && <span className="mx-1">·</span>}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default HomePage;
