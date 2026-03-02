import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useFacilityData, useDatabase } from "../../app/providers";
import { Resident, ShiftLogEntry } from "../../domain/models";
import {
  Send, MessageSquare, User, Hash, ArrowLeft,
  LayoutDashboard, Users, Map, Clock, FileText, Bell, AlertCircle, Activity,
  ClipboardCheck, FileBarChart, Inbox, BookOpen, Database, Settings,
  Star, Plus, X,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { PINNED_NAVS, RECENT_TAGS } from "../../constants/storageKeys";

// ── Nav items (same icons as Sidebar) ──────────────────────────────────────
const ALL_NAV_ITEMS = [
  { id: "dashboard",       label: "Dashboard",       path: "/dashboard",       icon: LayoutDashboard },
  { id: "resident-board",  label: "Resident Board",  path: "/resident-board",  icon: Users },
  { id: "floor-map",       label: "Floor Map",       path: "/floor-map",       icon: Map },
  { id: "staff",           label: "Staff",           path: "/staff",           icon: Users },
  { id: "shift-log",       label: "Shift Log",       path: "/chat",            icon: Clock },
  { id: "note-generator",  label: "Note Generator",  path: "/note-generator",  icon: FileText },
  { id: "notifications",   label: "Notifications",   path: "/notifications",   icon: Bell },
  { id: "outbreaks",       label: "Outbreaks",       path: "/outbreaks",       icon: AlertCircle },
  { id: "reports",         label: "Reports",         path: "/reports",         icon: Activity },
  { id: "antibiogram",     label: "Antibiogram",     path: "/reports/antibiogram", icon: Activity },
  { id: "line-list-report",label: "Line List Report",path: "/linelist-report", icon: FileText },
  { id: "audit-center",    label: "Audit Center",    path: "/audit-center",    icon: ClipboardCheck },
  { id: "report-builder",  label: "Report Builder",  path: "/report-builder",  icon: FileBarChart },
  { id: "quarantine-inbox",label: "Quarantine Inbox",path: "/quarantine",      icon: Inbox },
  { id: "user-guide",      label: "User Guide",      path: "/user-guide",      icon: BookOpen },
  { id: "back-office",     label: "Back Office",     path: "/back-office",     icon: Database },
  { id: "settings",        label: "Settings",        path: "/settings",        icon: Settings },
];

const DEFAULT_PINNED = ["dashboard", "outbreaks", "notifications"];

function loadPinned(): string[] {
  try {
    const raw = localStorage.getItem(PINNED_NAVS);
    if (raw !== null) return JSON.parse(raw);
  } catch {}
  return DEFAULT_PINNED;
}

function savePinned(ids: string[]): void {
  localStorage.setItem(PINNED_NAVS, JSON.stringify(ids));
}

function loadRecentTags(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_TAGS);
    if (raw !== null) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveRecentTags(tags: string[]): void {
  localStorage.setItem(RECENT_TAGS, JSON.stringify(tags));
}

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { store, activeFacilityId } = useFacilityData();
  const { db, updateDB } = useDatabase();

  // ── Pinned Favorites ────────────────────────────────────────────────────
  const [pinnedIds, setPinnedIds] = useState<string[]>(loadPinned);
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPicker]);

  const togglePin = useCallback((id: string) => {
    setPinnedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      savePinned(next);
      return next;
    });
  }, []);

  const pinnedItems = useMemo(
    () =>
      pinnedIds
        .map((id) => ALL_NAV_ITEMS.find((n) => n.id === id))
        .filter(Boolean) as typeof ALL_NAV_ITEMS,
    [pinnedIds]
  );

  // ── Quick Note state ─────────────────────────────────────────────────────
  const [input, setInput] = useState("");
  const [cursorPos, setCursorPos] = useState(0);
  const [routeTo, setRouteTo] = useState<"Shift Log" | "IP Review" | "ABT Note">("Shift Log");
  const [recentTags, setRecentTags] = useState<string[]>(loadRecentTags);

  // @mention state
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionHighlight, setMentionHighlight] = useState(0);

  // #hashtag state
  const [showHashtags, setShowHashtags] = useState(false);
  const [hashtagQuery, setHashtagQuery] = useState("");
  const [hashtagHighlight, setHashtagHighlight] = useState(0);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Residents for @mention autocomplete
  const residents = useMemo(
    () =>
      (Object.values(store.residents) as Resident[]).filter(
        (r) => !r.isHistorical && !r.backOfficeOnly
      ),
    [store.residents]
  );

  const filteredResidents = useMemo(
    () =>
      residents
        .filter(
          (r) =>
            r.displayName.toLowerCase().includes(mentionQuery.toLowerCase()) ||
            r.mrn.includes(mentionQuery)
        )
        .slice(0, 6),
    [residents, mentionQuery]
  );

  // Hashtag library from facility data (same source as ResidentBoard SettingsModal)
  const hashtagLibrary: string[] = useMemo(
    () => db.data.facilities.byId[activeFacilityId]?.hashtagCategories ?? [],
    [db.data.facilities.byId, activeFacilityId]
  );

  const filteredHashtags = useMemo(
    () =>
      hashtagLibrary
        .filter((h) => h.toLowerCase().includes(hashtagQuery.toLowerCase()))
        .slice(0, 6),
    [hashtagLibrary, hashtagQuery]
  );

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart ?? val.length;

    setInput(val);
    setCursorPos(pos);

    const textBeforeCursor = val.slice(0, pos);

    const lastAt = textBeforeCursor.lastIndexOf("@");
    if (lastAt !== -1) {
      const charBeforeAt = lastAt > 0 ? textBeforeCursor[lastAt - 1] : " ";
      if (/\s/.test(charBeforeAt) || lastAt === 0) {
        const query = textBeforeCursor.slice(lastAt + 1);
        if (query.length < 30 && !query.includes("\n") && !/\s/.test(query)) {
          setMentionQuery(query);
          setMentionHighlight(0);
          setShowMentions(true);
          setShowHashtags(false);
          return;
        }
      }
    }

    const lastHash = textBeforeCursor.lastIndexOf("#");
    if (lastHash !== -1) {
      const charBeforeHash = lastHash > 0 ? textBeforeCursor[lastHash - 1] : " ";
      if (/\s/.test(charBeforeHash) || lastHash === 0) {
        const query = textBeforeCursor.slice(lastHash + 1);
        if (query.length < 30 && !query.includes("\n") && !/\s/.test(query)) {
          setHashtagQuery(query);
          setHashtagHighlight(0);
          setShowHashtags(true);
          setShowMentions(false);
          return;
        }
      }
    }

    setShowMentions(false);
    setShowHashtags(false);
  };

  const insertMention = (resident: Resident) => {
    const textBeforeCursor = input.slice(0, cursorPos);
    const lastAt = textBeforeCursor.lastIndexOf("@");
    const textAfterCursor = input.slice(cursorPos);
    const mentionText = `@${resident.displayName} `;
    const newText = input.slice(0, lastAt) + mentionText + textAfterCursor;

    setInput(newText);
    setShowMentions(false);

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newPos = lastAt + mentionText.length;
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    }, 10);
  };

  const insertHashtag = (hashtag: string) => {
    const textBeforeCursor = input.slice(0, cursorPos);
    const lastHash = textBeforeCursor.lastIndexOf("#");
    const textAfterCursor = input.slice(cursorPos);
    const normalized = hashtag.startsWith("#") ? hashtag : `#${hashtag}`;
    const insertText = `${normalized} `;
    const newText = input.slice(0, lastHash) + insertText + textAfterCursor;

    setInput(newText);
    setShowHashtags(false);

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newPos = lastHash + insertText.length;
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    }, 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions && filteredResidents.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionHighlight((h) => Math.min(h + 1, filteredResidents.length - 1)); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setMentionHighlight((h) => Math.max(h - 1, 0)); return; }
      if (e.key === "Enter")     { e.preventDefault(); insertMention(filteredResidents[mentionHighlight]); return; }
      if (e.key === "Escape")    { e.preventDefault(); setShowMentions(false); return; }
    }

    if (showHashtags && filteredHashtags.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setHashtagHighlight((h) => Math.min(h + 1, filteredHashtags.length - 1)); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setHashtagHighlight((h) => Math.max(h - 1, 0)); return; }
      if (e.key === "Enter")     { e.preventDefault(); insertHashtag(filteredHashtags[hashtagHighlight]); return; }
      if (e.key === "Escape")    { e.preventDefault(); setShowHashtags(false); return; }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (!input.trim()) return;

    const mentionedResidents: Resident[] = [];
    residents.forEach((r) => {
      if (input.includes(`@${r.displayName}`)) mentionedResidents.push(r);
    });

    const hashtagMatches = input.match(/#[\w-]+/g) ?? [];
    const hashtags = Array.from(new Set(hashtagMatches));

    if (routeTo === "Shift Log") {
      updateDB((draft) => {
        const facilityId = draft.data.facilities.activeFacilityId;
        const entryId = uuidv4();
        if (!draft.data.facilityData[facilityId].shiftLog) {
          draft.data.facilityData[facilityId].shiftLog = {};
        }
        const entry: ShiftLogEntry = {
          id: entryId,
          facilityId,
          createdAtISO: new Date().toISOString(),
          shift: new Date().getHours() >= 7 && new Date().getHours() < 19 ? "Day" : "Night",
          tags: [],
          priority: "FYI",
          body: input,
          residentRefs:
            mentionedResidents.length > 0
              ? mentionedResidents.map((r) => ({ mrn: r.mrn, name: r.displayName }))
              : undefined,
          hashtags: hashtags.length > 0 ? hashtags : undefined,
        };
        draft.data.facilityData[facilityId].shiftLog![entryId] = entry;
      });
    } else if (routeTo === "IP Review") {
      const firstMrn = mentionedResidents[0]?.mrn;
      navigate(`/ip-reviews/new${firstMrn ? `?residentMrn=${firstMrn}` : ""}`);
    } else if (routeTo === "ABT Note") {
      const firstMrn = mentionedResidents[0]?.mrn;
      navigate(`/abt-events/new${firstMrn ? `?residentMrn=${firstMrn}` : ""}`);
    }

    // Update recent tags
    const newTagNames = mentionedResidents.map((r) => r.displayName);
    if (newTagNames.length > 0) {
      setRecentTags((prev) => {
        const merged = [
          ...newTagNames,
          ...prev.filter((n) => !newTagNames.includes(n)),
        ].slice(0, 5);
        saveRecentTags(merged);
        return merged;
      });
    }

    setInput("");
  };

  const reinsertTag = (name: string) => {
    setInput((prev) => prev + (prev === "" || prev.endsWith(" ") ? "" : " ") + `@${name} `);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 text-neutral-600 hover:bg-neutral-100 rounded-md"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
              Quick Note
            </h2>
            <p className="text-sm text-neutral-500">
              Use{" "}
              <span className="font-mono font-bold text-indigo-600">@</span> to tag
              residents ·{" "}
              <span className="font-mono font-bold text-emerald-600">#</span> for
              hashtags
            </p>
          </div>
        </div>
      </div>

      {/* ── PINNED FAVORITES ─────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-visible">
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-100">
          <div className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            PINNED FAVORITES
          </div>
          <div className="relative" ref={pickerRef}>
            <button
              onClick={() => setShowPicker((p) => !p)}
              className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
              aria-label="Add shortcut"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Shortcut
            </button>
            {showPicker && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-neutral-200 py-1 z-50 max-h-72 overflow-y-auto">
                {ALL_NAV_ITEMS.map((item) => {
                  const pinned = pinnedIds.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => { if (!pinned) { togglePin(item.id); setShowPicker(false); } }}
                      disabled={pinned}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-sm transition-colors ${
                        pinned
                          ? "text-neutral-400 cursor-default"
                          : "text-neutral-700 hover:bg-neutral-50"
                      }`}
                    >
                      <span>{item.label}</span>
                      {pinned && <span className="text-xs text-amber-500">✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="p-4">
          {pinnedItems.length === 0 ? (
            <p className="text-sm text-neutral-400 py-2 text-center">
              No pinned items. Click <strong>Add Shortcut</strong> to add shortcuts.
            </p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {pinnedItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.id} className="relative group">
                    <button
                      onClick={() => navigate(item.path)}
                      className="rounded-xl border bg-white shadow-sm hover:shadow-md cursor-pointer transition p-4 flex flex-col items-center gap-2 w-28 h-24"
                      aria-label={`Go to ${item.label}`}
                    >
                      <Icon className="w-6 h-6 text-indigo-600" />
                      <span className="text-xs font-medium text-neutral-700 text-center leading-tight">{item.label}</span>
                    </button>
                    <button
                      onClick={() => togglePin(item.id)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white border border-neutral-200 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-50 hover:border-red-300"
                      aria-label={`Unpin ${item.label}`}
                    >
                      <X className="w-3 h-3 text-neutral-500 hover:text-red-500" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── QUICK NOTE / CHAT BOX ────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-visible">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-neutral-100">
          <MessageSquare className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-semibold text-neutral-700">QUICK NOTE</span>
        </div>
        <div className="p-4 space-y-3">
          {/* Textarea with @mention and #hashtag dropdowns */}
          <div className="relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Type a note... use @ to tag a resident, # to tag a category"
              rows={3}
              className="w-full text-sm border border-neutral-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
              style={{ minHeight: "4.5rem", maxHeight: "9rem" }}
            />

            {/* @mention dropdown */}
            {showMentions && filteredResidents.length > 0 && (
              <div className="absolute left-0 top-full mt-1 z-50 bg-white border rounded-lg shadow-lg divide-y text-sm w-64 max-h-48 overflow-y-auto">
                {filteredResidents.map((r, idx) => (
                  <button
                    key={r.mrn}
                    onMouseDown={(e) => { e.preventDefault(); insertMention(r); }}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${idx === mentionHighlight ? "bg-indigo-50" : "hover:bg-neutral-50"}`}
                  >
                    <div className="bg-indigo-100 p-1 rounded-full shrink-0">
                      <User className="w-3.5 h-3.5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-neutral-900">{r.displayName}</p>
                      <p className="text-xs text-neutral-500">{r.currentUnit} · {r.currentRoom}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* #hashtag dropdown — shown only when library has entries */}
            {showHashtags && filteredHashtags.length > 0 && (
              <div className="absolute left-0 top-full mt-1 z-50 bg-white border rounded-lg shadow-lg divide-y text-sm w-64 max-h-48 overflow-y-auto">
                {filteredHashtags.map((tag, idx) => (
                  <button
                    key={tag}
                    onMouseDown={(e) => { e.preventDefault(); insertHashtag(tag); }}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${idx === hashtagHighlight ? "bg-emerald-50" : "hover:bg-neutral-50"}`}
                  >
                    <div className="bg-emerald-100 p-1 rounded-full shrink-0">
                      <Hash className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <p className="text-sm font-medium text-neutral-900">{tag}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Route to + Submit */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500 shrink-0">Route to:</span>
            <select
              value={routeTo}
              onChange={(e) => setRouteTo(e.target.value as typeof routeTo)}
              className="text-xs border border-neutral-300 rounded px-2 py-1 bg-white text-neutral-700 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="Shift Log">Shift Log</option>
              <option value="IP Review">IP Review</option>
              <option value="ABT Note">ABT Note</option>
            </select>
            <button
              onClick={handleSubmit}
              disabled={!input.trim()}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
              Submit
            </button>
          </div>

          {/* Recent Tags */}
          {recentTags.length > 0 && (
            <div className="text-xs text-neutral-400 pt-1 border-t border-neutral-100">
              <span className="font-medium text-neutral-500">Recent Tags: </span>
              {recentTags.map((name, i) => (
                <span key={name}>
                  <button
                    onClick={() => reinsertTag(name)}
                    className="text-indigo-500 hover:underline"
                  >
                    @{name}
                  </button>
                  {i < recentTags.length - 1 && <span className="mx-1">·</span>}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
