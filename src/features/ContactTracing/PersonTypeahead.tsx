import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useFacilityData } from '../../app/providers';
import { Search } from 'lucide-react';

export type PersonRef =
  | { kind: 'resident'; mrn: string }
  | { kind: 'staff'; staffId: string };

interface Suggestion {
  personRef: PersonRef;
  displayName: string;
  tag: 'Resident' | 'Staff';
  identifier: string;
  secondary?: string; // unit/role
}

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  onSelect: (personRef: PersonRef) => void;
  filterKind?: 'resident' | 'staff' | 'any';
  /** Set of already-added identifiers (mrn or staffId) to show "Already added" */
  disabledIds?: Set<string>;
  placeholder?: string;
}

/** Score a candidate name against a query: 2 = startsWith, 1 = contains, 0 = no match. */
function scoreMatch(name: string, query: string): number {
  const n = name.toLowerCase();
  const q = query.toLowerCase();
  if (n.startsWith(q)) return 2;
  if (n.includes(q)) return 1;
  return 0;
}

export const PersonTypeahead: React.FC<Props> = ({
  query,
  onQueryChange,
  onSelect,
  filterKind = 'any',
  disabledIds = new Set(),
  placeholder = 'Search resident or staff…',
}) => {
  const { store } = useFacilityData();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions: Suggestion[] = React.useMemo(() => {
    if (!query.trim()) return [];

    const q = query.trim();
    const results: (Suggestion & { score: number })[] = [];

    if (filterKind !== 'staff') {
      Object.values(store.residents || {}).forEach((r) => {
        const nameScore = scoreMatch(r.displayName, q);
        const mrnScore = scoreMatch(r.mrn, q);
        const score = Math.max(nameScore, mrnScore);
        if (score === 0) return;
        results.push({
          personRef: { kind: 'resident', mrn: r.mrn },
          displayName: r.displayName,
          tag: 'Resident',
          identifier: r.mrn,
          secondary: [r.currentUnit, r.currentRoom].filter(Boolean).join(' / ') || undefined,
          score,
        });
      });
    }

    if (filterKind !== 'resident') {
      Object.values(store.staff || {}).forEach((s) => {
        const nameScore = scoreMatch(s.displayName, q);
        const idScore = s.employeeId ? scoreMatch(s.employeeId, q) : 0;
        const score = Math.max(nameScore, idScore);
        if (score === 0) return;
        results.push({
          personRef: { kind: 'staff', staffId: s.id },
          displayName: s.displayName,
          tag: 'Staff',
          identifier: s.employeeId || s.id,
          secondary: s.role || s.department,
          score,
        });
      });
    }

    // Sort: higher score first, then alphabetical
    return results
      .sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName))
      .slice(0, 8);
  }, [query, store.residents, store.staff, filterKind]);

  useEffect(() => {
    setActiveIndex(0);
    setOpen(suggestions.length > 0);
  }, [suggestions]);

  const handleSelect = useCallback((s: Suggestion) => {
    const id = s.personRef.kind === 'resident' ? s.personRef.mrn : s.personRef.staffId;
    if (disabledIds.has(id)) return;
    onSelect(s.personRef);
    onQueryChange('');
    setOpen(false);
  }, [onSelect, onQueryChange, disabledIds]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions[activeIndex]) handleSelect(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
          placeholder={placeholder}
          className="w-full pl-9 pr-3 py-2 border border-neutral-300 rounded-md text-sm focus:ring-teal-500 focus:border-teal-500"
          autoComplete="off"
        />
      </div>
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-neutral-200 rounded-md shadow-lg max-h-64 overflow-y-auto">
          {suggestions.map((s, idx) => {
            const id = s.personRef.kind === 'resident' ? s.personRef.mrn : s.personRef.staffId;
            const isDisabled = disabledIds.has(id);
            return (
              <li
                key={id}
                className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${idx === activeIndex ? 'bg-teal-50' : 'hover:bg-neutral-50'} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
                onMouseEnter={() => setActiveIndex(idx)}
              >
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-sm text-neutral-900">{s.displayName}</span>
                  {s.secondary && (
                    <span className="ml-2 text-xs text-neutral-500">{s.secondary}</span>
                  )}
                  {isDisabled && (
                    <span className="ml-2 text-xs text-amber-600 font-medium">Already added</span>
                  )}
                </div>
                <span className={`shrink-0 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${s.tag === 'Resident' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {s.tag}
                </span>
                <span className="shrink-0 text-xs text-neutral-400 font-mono">{s.identifier}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
