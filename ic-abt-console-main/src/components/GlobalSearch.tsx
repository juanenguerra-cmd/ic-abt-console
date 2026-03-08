import React, { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, Users, UserCheck, AlertCircle } from "lucide-react";
import { useFacilityData } from "../app/providers";
import { Resident, Staff } from "../domain/models";
import { useNavigate } from "react-router-dom";

interface SearchResult {
  id: string;
  type: "resident" | "staff" | "outbreak";
  title: string;
  subtitle: string;
  navigateTo: string;
  navigateState?: object;
}

export const GlobalSearch: React.FC = () => {
  const { store } = useFacilityData();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const results: SearchResult[] = React.useMemo(() => {
    if (!query.trim() || query.length < 2) return [];
    const q = query.toLowerCase();
    const out: SearchResult[] = [];

    // Search residents
    (Object.values(store.residents || {}) as Resident[]).filter(r => !r.isHistorical && !r.backOfficeOnly).forEach(r => {
      if (
        r.displayName?.toLowerCase().includes(q) ||
        r.mrn?.toLowerCase().includes(q) ||
        r.currentRoom?.toLowerCase().includes(q)
      ) {
        out.push({
          id: r.mrn,
          type: "resident",
          title: r.displayName,
          subtitle: `MRN: ${r.mrn}${r.currentRoom ? ` · Room ${r.currentRoom}` : ""}${r.currentUnit ? ` · ${r.currentUnit}` : ""}`,
          navigateTo: "/resident-board",
          navigateState: { selectedResidentId: r.mrn, openProfile: true },
        });
      }
    });

    // Search staff
    (Object.values(store.staff || {}) as Staff[]).forEach(s => {
      if (
        s.displayName?.toLowerCase().includes(q) ||
        s.role?.toLowerCase().includes(q) ||
        (s as any).department?.toLowerCase().includes(q)
      ) {
        out.push({
          id: s.id,
          type: "staff",
          title: s.displayName,
          subtitle: `${s.role || "Staff"}${(s as any).department ? ` · ${(s as any).department}` : ""} · ${s.status}`,
          navigateTo: "/staff",
        });
      }
    });

    // Search outbreaks
    (Object.values(store.outbreaks || {}) as any[]).forEach(ob => {
      if (
        ob.name?.toLowerCase().includes(q) ||
        ob.pathogen?.toLowerCase().includes(q) ||
        ob.unit?.toLowerCase().includes(q)
      ) {
        out.push({
          id: ob.id,
          type: "outbreak",
          title: ob.name || ob.pathogen || "Outbreak",
          subtitle: `Outbreak · ${ob.unit || "Unknown unit"} · ${ob.status || "Active"}`,
          navigateTo: "/outbreaks",
        });
      }
    });

    return out.slice(0, 10);
  }, [query, store]);

  // Reset active index when results change
  useEffect(() => { setActiveIndex(-1); }, [results]);

  const handleSelect = (result: SearchResult) => {
    navigate(result.navigateTo, result.navigateState ? { state: result.navigateState } : undefined);
    setQuery("");
    setIsOpen(false);
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setQuery("");
      setIsOpen(false);
      inputRef.current?.blur();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0 && results[activeIndex]) {
      handleSelect(results[activeIndex]);
    }
  }, [results, activeIndex]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Open on keyboard shortcut (/)
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const isEditable = active?.tagName === "INPUT" || active?.tagName === "TEXTAREA" || active?.getAttribute("contenteditable") === "true";
      if (e.key === "/" && !isEditable) {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };
    document.addEventListener("keydown", handleGlobalKey);
    return () => document.removeEventListener("keydown", handleGlobalKey);
  }, []);

  const getIcon = (type: SearchResult["type"]) => {
    switch (type) {
      case "resident": return <Users className="w-4 h-4 text-indigo-500 shrink-0" />;
      case "staff": return <UserCheck className="w-4 h-4 text-emerald-500 shrink-0" />;
      case "outbreak": return <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />;
    }
  };

  return (
    <div ref={containerRef} className="relative" role="search" aria-label="Global search">
      <div className="relative flex items-center">
        <Search className="absolute left-3 w-4 h-4 text-neutral-400 pointer-events-none" aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          aria-label="Search residents, staff, and outbreaks"
          aria-autocomplete="list"
          aria-expanded={isOpen && results.length > 0}
          aria-haspopup="listbox"
          aria-controls="global-search-results"
          placeholder='Search… (press / to focus)'
          value={query}
          onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="pl-9 pr-8 py-1.5 w-48 sm:w-64 border border-neutral-300 rounded-md text-sm bg-neutral-50 focus:bg-white focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 focus:outline-none transition-all"
        />
        {query && (
          <button
            aria-label="Clear search"
            onClick={() => { setQuery(""); setIsOpen(false); inputRef.current?.focus(); }}
            className="absolute right-2 p-0.5 text-neutral-400 hover:text-neutral-600 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {isOpen && query.length >= 2 && (
        <div
          id="global-search-results"
          role="listbox"
          aria-label="Search results"
          className="absolute top-full left-0 mt-1 w-80 bg-white rounded-lg shadow-xl border border-neutral-200 z-50 overflow-hidden"
        >
          {results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-neutral-500 text-center">
              No results for "{query}"
            </div>
          ) : (
            <ul className="max-h-72 overflow-y-auto divide-y divide-neutral-100">
              {results.map((result, index) => (
                <li key={`${result.type}-${result.id}`} role="option" aria-selected={index === activeIndex}>
                  <button
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors focus:outline-none ${index === activeIndex ? "bg-indigo-50" : "hover:bg-neutral-50"}`}
                  >
                    {getIcon(result.type)}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-neutral-900 truncate">{result.title}</p>
                      <p className="text-xs text-neutral-500 truncate">{result.subtitle}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="px-4 py-2 border-t border-neutral-100 bg-neutral-50 text-xs text-neutral-400 flex justify-between">
            <span>{results.length} result{results.length !== 1 ? "s" : ""}</span>
            <span>Press Esc to close</span>
          </div>
        </div>
      )}
    </div>
  );
};
