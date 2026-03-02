// IC-ABT Console — Home Page
import React, { useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useFacilityData, useDatabase } from "../../app/providers";
import { Resident, ShiftLogEntry } from "../../domain/models";
import { v4 as uuidv4 } from "uuid";
import {
  LayoutDashboard, Users, Map, MessageSquare, PenSquare, Bell, AlertCircle,
  FileText, Activity, ClipboardCheck, FileBarChart, Inbox, BookOpen, Database,
  Settings, Plus, X, Send, Home,
} from "lucide-react";

// ─── Constants ───────────────────────────────────────────────────────────────

const LS_PINNED_KEY = "icn_pinned_navs";
const DEFAULT_PINNED = ["dashboard", "outbreaks", "notifications"];

// ─── Types ───────────────────────────────────────────────────────────────────

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  to: string;
}

type RouteDestination = "Shift Log" | "IP Review" | "ABT Note";

interface TaggedResident {
  mrn: string;
  name: string;
  unit: string;
  room: string;
}

interface MiniFeedEntry {
  id: string;
  timestamp: string;
  firstTag: TaggedResident | null;
  destination: RouteDestination;
  preview: string;
}

// ─── Nav catalogue (all 17 items) ────────────────────────────────────────────

const ALL_NAV_ITEMS: NavItem[] = [
  { id: "dashboard",       label: "Dashboard",         icon: LayoutDashboard, to: "/" },
  { id: "resident-board",  label: "Resident Board",    icon: Users,           to: "/resident-board" },
  { id: "floor-map",       label: "Floor Map",         icon: Map,             to: "/floor-map" },
  { id: "staff",           label: "Staff",             icon: Users,           to: "/staff" },
  { id: "shift-log",       label: "Shift Log",         icon: MessageSquare,   to: "/chat" },
  { id: "note-generator",  label: "Note Generator",    icon: PenSquare,       to: "/note-generator" },
  { id: "notifications",   label: "Notifications",     icon: Bell,            to: "/notifications" },
  { id: "outbreaks",       label: "Outbreaks",         icon: AlertCircle,     to: "/outbreaks" },
  { id: "reports",         label: "Reports",           icon: FileText,        to: "/reports" },
  { id: "antibiogram",     label: "Antibiogram",       icon: Activity,        to: "/reports/antibiogram" },
  { id: "linelist-report", label: "Line List Report",  icon: FileText,        to: "/linelist-report" },
  { id: "audit-center",    label: "Audit Center",      icon: ClipboardCheck,  to: "/audit-center" },
  { id: "report-builder",  label: "Report Builder",    icon: FileBarChart,    to: "/report-builder" },
  { id: "quarantine",      label: "Quarantine Inbox",  icon: Inbox,           to: "/quarantine" },
  { id: "user-guide",      label: "User Guide",        icon: BookOpen,        to: "/user-guide" },
  { id: "back-office",     label: "Back Office",       icon: Database,        to: "/back-office" },
  { id: "settings",        label: "Settings",          icon: Settings,        to: "/settings" },
];

// ─── localStorage helpers ────────────────────────────────────────────────────

function loadPinned(): string[] {
  try {
    const raw = localStorage.getItem(LS_PINNED_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch {
    // ignore parse errors
  }
  return [...DEFAULT_PINNED];
}

function savePinned(ids: string[]) {
  localStorage.setItem(LS_PINNED_KEY, JSON.stringify(ids));
}

// ─── HomePage component ───────────────────────────────────────────────────────

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { store, activeFacilityId } = useFacilityData();
  const { db, updateDB } = useDatabase();

  // ── Section 1: Pinned Favorites ────────────────────────────────────────────
  const [pinned, setPinned] = useState<string[]>(loadPinned);
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const addDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  React.useEffect(() => {
    if (!showAddDropdown) return;
    const handler = (e: MouseEvent) => {
      if (addDropdownRef.current && !addDropdownRef.current.contains(e.target as Node)) {
        setShowAddDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showAddDropdown]);

  const pin = (id: string) => {
    if (pinned.includes(id)) return;
    const next = [...pinned, id];
    setPinned(next);
    savePinned(next);
    setShowAddDropdown(false);
  };

  const unpin = (id: string) => {
    const next = pinned.filter((p) => p !== id);
    setPinned(next);
    savePinned(next);
  };

  const pinnedItems = pinned
    .map((id) => ALL_NAV_ITEMS.find((n) => n.id === id))
    .filter(Boolean) as NavItem[];

  const unpinnedItems = ALL_NAV_ITEMS.filter((n) => !pinned.includes(n.id));

  // ── Section 2: Quick Note / Chat Box ───────────────────────────────────────
  const residents = useMemo(
    () => Object.values(store.residents || {}) as Resident[],
    [store.residents]
  );
  const hashtagCategories: string[] =
    db.data.facilities.byId[activeFacilityId]?.hashtagCategories || [];

  const [noteInput, setNoteInput] = useState("");
  const [routeTo, setRouteTo] = useState<RouteDestination>("Shift Log");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [showHashtags, setShowHashtags] = useState(false);
  const [hashtagQuery, setHashtagQuery] = useState("");
  const [cursorPos, setCursorPos] = useState(0);
  const [taggedResidents, setTaggedResidents] = useState<TaggedResident[]>([]);
  const [miniFeed, setMiniFeed] = useState<MiniFeedEntry[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const mentionableResidents = useMemo(
    () =>
      residents
        .filter(
          (r) =>
            r.displayName.toLowerCase().includes(mentionQuery.toLowerCase()) ||
            r.mrn.includes(mentionQuery)
        )
        .slice(0, 5),
    [residents, mentionQuery]
  );

  const filteredHashtags = useMemo(
    () =>
      hashtagCategories
        .filter((h) => h.toLowerCase().includes(hashtagQuery.toLowerCase()))
        .slice(0, 5),
    [hashtagCategories, hashtagQuery]
  );

  const handleNoteInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart;
    setNoteInput(val);
    setCursorPos(pos);

    const textBeforeCursor = val.slice(0, pos);

    // @mention detection
    const lastAt = textBeforeCursor.lastIndexOf("@");
    if (lastAt !== -1) {
      const charBefore = lastAt > 0 ? textBeforeCursor[lastAt - 1] : " ";
      if (/\s/.test(charBefore)) {
        const query = textBeforeCursor.slice(lastAt + 1);
        if (query.length < 30 && !query.includes("\n")) {
          setMentionQuery(query);
          setShowMentions(true);
          setShowHashtags(false);
          return;
        }
      }
    }

    // #hashtag detection
    const lastHash = textBeforeCursor.lastIndexOf("#");
    if (lastHash !== -1) {
      const charBefore = lastHash > 0 ? textBeforeCursor[lastHash - 1] : " ";
      if (/\s/.test(charBefore)) {
        const query = textBeforeCursor.slice(lastHash + 1);
        if (query.length < 30 && !query.includes("\n")) {
          setHashtagQuery(query);
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
    const textBeforeCursor = noteInput.slice(0, cursorPos);
    const lastAt = textBeforeCursor.lastIndexOf("@");
    const textAfterCursor = noteInput.slice(cursorPos);
    const tag = `@${resident.lastName}, ${resident.firstName || ""} (${resident.currentRoom || "No Room"}) `;
    const newText = noteInput.slice(0, lastAt) + tag + textAfterCursor;
    setNoteInput(newText);
    setShowMentions(false);

    const tagged: TaggedResident = {
      mrn: resident.mrn,
      name: resident.displayName,
      unit: resident.currentUnit || "",
      room: resident.currentRoom || "",
    };
    setTaggedResidents((prev) => {
      if (prev.find((t) => t.mrn === resident.mrn)) return prev;
      return [...prev, tagged];
    });

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newPos = lastAt + tag.length;
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    }, 10);
  };

  const insertHashtag = (hashtag: string) => {
    const textBeforeCursor = noteInput.slice(0, cursorPos);
    const lastHash = textBeforeCursor.lastIndexOf("#");
    const textAfterCursor = noteInput.slice(cursorPos);
    const newText = noteInput.slice(0, lastHash) + `${hashtag} ` + textAfterCursor;
    setNoteInput(newText);
    setShowHashtags(false);

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newPos = lastHash + hashtag.length + 1;
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    }, 10);
  };

  const extractHashtags = (text: string): string[] =>
    (text.match(/#\w+/g) || []);

  /** Determine shift based on current hour: Day = 07:00–18:59, Night = 19:00–06:59 */
  const getCurrentShift = (): ShiftLogEntry["shift"] => {
    const hour = new Date().getHours();
    return hour >= 7 && hour < 19 ? "Day" : "Night";
  };

  const handleSubmit = () => {
    if (!noteInput.trim()) return;
    const firstTag = taggedResidents.length > 0 ? taggedResidents[0] : null;

    if (routeTo === "Shift Log") {
      const residentRefs = taggedResidents.map((t) => ({ mrn: t.mrn, name: t.name }));
      const hashtags = extractHashtags(noteInput);
      const entry: ShiftLogEntry = {
        id: uuidv4(),
        facilityId: activeFacilityId,
        createdAtISO: new Date().toISOString(),
        shift: getCurrentShift(),
        tags: [],
        priority: "FYI",
        body: noteInput.trim(),
        residentRefs: residentRefs.length > 0 ? residentRefs : undefined,
      };
      // hashtags are embedded in body; include them as tags if they match known categories
      const knownTagMap: Record<string, ShiftLogEntry["tags"][number]> = {
        "#outbreak": "Outbreak",
        "#isolation": "Isolation",
        "#lab": "Lab",
        "#abt": "ABT",
        "#supply": "Supply",
        "#education": "Education",
      };
      hashtags.forEach((h) => {
        const mapped = knownTagMap[h.toLowerCase()];
        if (mapped && !entry.tags.includes(mapped)) entry.tags.push(mapped);
      });
      updateDB((draft) => {
        const fd = draft.data.facilityData[activeFacilityId];
        if (!fd.shiftLog) fd.shiftLog = {};
        fd.shiftLog[entry.id] = entry;
      });
    } else if (routeTo === "IP Review") {
      navigate("/resident-board", {
        state: {
          selectedResidentId: firstTag?.mrn ?? null,
          openModal: "ip",
        },
      });
    } else if (routeTo === "ABT Note") {
      navigate("/resident-board", {
        state: {
          selectedResidentId: firstTag?.mrn ?? null,
          openModal: "abt",
        },
      });
    }

    // Update mini feed
    const feedEntry: MiniFeedEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      firstTag,
      destination: routeTo,
      preview: noteInput.slice(0, 80),
    };
    setMiniFeed((prev) => [feedEntry, ...prev].slice(0, 5));

    // Reset
    setNoteInput("");
    setTaggedResidents([]);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-8 max-w-4xl mx-auto">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
          <Home className="w-5 h-5 text-indigo-600" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Home</h1>
          <p className="text-sm text-neutral-500">Your workspace at a glance</p>
        </div>
      </div>

      {/* ── Section 1: Pinned Shortcuts ───────────────────────────────────── */}
      <section aria-labelledby="pinned-heading">
        <h2
          id="pinned-heading"
          className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3"
        >
          Pinned Shortcuts
        </h2>
        <div className="flex flex-wrap gap-3 items-start">
          {pinnedItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.id} className="relative group">
                <button
                  onClick={() => navigate(item.to)}
                  aria-label={`Go to ${item.label}`}
                  className="flex flex-col items-center gap-2 px-5 py-4 bg-white border border-neutral-200 rounded-xl shadow-sm hover:shadow-md hover:border-indigo-300 hover:bg-indigo-50 transition-all min-w-[96px] active:scale-95"
                >
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <Icon className="w-5 h-5 text-indigo-600" aria-hidden="true" />
                  </div>
                  <span className="text-xs font-medium text-neutral-700 text-center leading-tight">
                    {item.label}
                  </span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    unpin(item.id);
                  }}
                  aria-label={`Unpin ${item.label}`}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-neutral-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                >
                  <X className="w-3 h-3" aria-hidden="true" />
                </button>
              </div>
            );
          })}

          {/* Add Shortcut */}
          <div className="relative" ref={addDropdownRef}>
            <button
              onClick={() => setShowAddDropdown((p) => !p)}
              aria-label="Add shortcut"
              aria-haspopup="listbox"
              aria-expanded={showAddDropdown}
              className="flex flex-col items-center gap-2 px-5 py-4 border-2 border-dashed border-neutral-300 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-all min-w-[96px] active:scale-95 text-neutral-400 hover:text-indigo-600"
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center">
                <Plus className="w-6 h-6" aria-hidden="true" />
              </div>
              <span className="text-xs font-medium text-center leading-tight">
                Add Shortcut
              </span>
            </button>
            {showAddDropdown && (
              <div
                role="listbox"
                aria-label="Available shortcuts"
                className="absolute top-full mt-2 left-0 z-50 w-52 bg-white border border-neutral-200 rounded-xl shadow-lg py-1 max-h-64 overflow-y-auto"
              >
                {unpinnedItems.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-neutral-400">
                    All shortcuts pinned
                  </p>
                ) : (
                  unpinnedItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        role="option"
                        aria-selected={false}
                        onClick={() => pin(item.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                      >
                        <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                        {item.label}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Section 2: Quick Note ─────────────────────────────────────────── */}
      <section aria-labelledby="quicknote-heading">
        <h2
          id="quicknote-heading"
          className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3"
        >
          Quick Note
        </h2>
        <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-visible">
          {/* Composer */}
          <div className="p-4 relative">
            {/* @mention autocomplete */}
            {showMentions && mentionableResidents.length > 0 && (
              <div className="absolute bottom-full left-4 mb-2 w-72 bg-white border border-neutral-200 rounded-lg shadow-lg z-50 overflow-hidden">
                {mentionableResidents.map((r) => (
                  <button
                    key={r.mrn}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertMention(r);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-indigo-50 text-left"
                  >
                    <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-semibold text-indigo-600 shrink-0">
                      {(r.firstName?.[0] ?? "") + (r.lastName?.[0] ?? "")}
                    </div>
                    <div>
                      <p className="font-medium text-neutral-800">{r.displayName}</p>
                      <p className="text-xs text-neutral-400">
                        MRN {r.mrn} · {r.currentRoom || "No Room"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* #hashtag autocomplete */}
            {showHashtags && filteredHashtags.length > 0 && (
              <div className="absolute bottom-full left-4 mb-2 w-56 bg-white border border-neutral-200 rounded-lg shadow-lg z-50 overflow-hidden">
                {filteredHashtags.map((h) => (
                  <button
                    key={h}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertHashtag(h);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-indigo-50 text-left"
                  >
                    <span className="text-indigo-500 font-medium">#</span>
                    <span className="text-neutral-700">{h.replace(/^#/, "")}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Textarea */}
            <textarea
              ref={inputRef}
              value={noteInput}
              onChange={handleNoteInput}
              placeholder="Type a note… Use @ to tag a resident, # for hashtags"
              rows={4}
              className="w-full p-3 text-sm border border-neutral-200 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none resize-none"
            />

            {/* Tagged resident chips */}
            {taggedResidents.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {taggedResidents.map((t) => (
                  <span
                    key={t.mrn}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full font-medium"
                  >
                    @{t.name}
                    <button
                      onClick={() =>
                        setTaggedResidents((prev) =>
                          prev.filter((p) => p.mrn !== t.mrn)
                        )
                      }
                      aria-label={`Remove tag for ${t.name}`}
                      className="hover:text-indigo-900"
                    >
                      <X className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Route to + Submit */}
            <div className="flex items-center gap-3 mt-3">
              <label
                htmlFor="home-route-to"
                className="text-sm font-medium text-neutral-600 shrink-0"
              >
                Route to:
              </label>
              <select
                id="home-route-to"
                value={routeTo}
                onChange={(e) => setRouteTo(e.target.value as RouteDestination)}
                className="flex-1 text-sm border border-neutral-200 rounded-md px-3 py-1.5 focus:ring-2 focus:ring-indigo-400 outline-none bg-white"
              >
                <option value="Shift Log">Shift Log</option>
                <option value="IP Review">IP Review</option>
                <option value="ABT Note">ABT Note</option>
              </select>
              <button
                onClick={handleSubmit}
                disabled={!noteInput.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
              >
                <Send className="w-4 h-4" aria-hidden="true" />
                Submit
              </button>
            </div>
          </div>

          {/* Mini Feed */}
          {miniFeed.length > 0 && (
            <div className="border-t border-neutral-100">
              <p className="px-4 py-2 text-xs font-semibold text-neutral-400 uppercase tracking-wide">
                Recent
              </p>
              <ul className="divide-y divide-neutral-50" aria-label="Recent notes">
                {miniFeed.map((entry) => (
                  <li key={entry.id} className="px-4 py-2.5 flex items-start gap-3">
                    <span className="text-xs text-neutral-400 shrink-0 mt-0.5 font-mono">
                      {formatTime(entry.timestamp)}
                    </span>
                    <div className="flex-1 min-w-0">
                      {entry.firstTag && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded font-medium mr-1">
                          @{entry.firstTag.name}
                        </span>
                      )}
                      <span className="text-xs text-neutral-600">{entry.preview}</span>
                    </div>
                    <span
                      className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                        entry.destination === "Shift Log"
                          ? "bg-emerald-100 text-emerald-700"
                          : entry.destination === "IP Review"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-purple-100 text-purple-700"
                      }`}
                    >
                      {entry.destination}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
