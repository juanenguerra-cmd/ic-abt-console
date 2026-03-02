import React, { useState, useRef, useMemo } from "react";
import { useFacilityData, useDatabase } from "../../app/providers";
import { Resident, ShiftLogEntry } from "../../domain/models";
import { v4 as uuidv4 } from "uuid";
import { useNavigate } from "react-router-dom";
import { Send, User, Hash, ChevronDown } from "lucide-react";

interface ResidentTag {
  residentId: string;
  name: string;
  mrn: string;
  unit: string;
  room: string;
}

type RouteTarget = 'Shift Log' | 'IP Review' | 'ABT Note';

const ROUTE_OPTIONS: RouteTarget[] = ['Shift Log', 'IP Review', 'ABT Note'];

const SHIFT_LOG_TAGS: Array<ShiftLogEntry['tags'][number]> = [
  'Outbreak', 'Isolation', 'Lab', 'ABT', 'Supply', 'Education',
];

const MAX_MENTION_QUERY_LENGTH = 30;

export const HomePage: React.FC = () => {
  const { store, activeFacilityId } = useFacilityData();
  const { updateDB, db } = useDatabase();
  const navigate = useNavigate();

  const [noteInput, setNoteInput] = useState("");
  const [routeTo, setRouteTo] = useState<RouteTarget>('Shift Log');
  const [showRouteMenu, setShowRouteMenu] = useState(false);

  // @mention state
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [cursorPos, setCursorPos] = useState(0);
  const [tags, setTags] = useState<ResidentTag[]>([]);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  const residents = useMemo(
    () => (Object.values(store.residents || {}) as Resident[]).filter(r => !r.isHistorical && !r.backOfficeOnly),
    [store.residents]
  );

  // Filter residents for @mention autocomplete:
  // matches first name, last name, or last-name initials (e.g. "@SD" → "Smith, Donna")
  const filteredMentions = useMemo(() => {
    if (!mentionQuery) return residents.slice(0, 6);
    const q = mentionQuery.toLowerCase();
    return residents.filter(r => {
      const firstName = (r.firstName || "").toLowerCase();
      const lastName = (r.lastName || "").toLowerCase();
      const initials = `${lastName[0] || ""}${firstName[0] || ""}`.toLowerCase();
      return (
        firstName.startsWith(q) ||
        lastName.startsWith(q) ||
        initials === q
      );
    }).slice(0, 6);
  }, [residents, mentionQuery]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart ?? val.length;
    setNoteInput(val);
    setCursorPos(pos);

    const textBeforeCursor = val.slice(0, pos);
    const lastAt = textBeforeCursor.lastIndexOf("@");
    if (lastAt !== -1) {
      const charBeforeAt = lastAt > 0 ? textBeforeCursor[lastAt - 1] : " ";
      if (/\s/.test(charBeforeAt) || lastAt === 0) {
        const query = textBeforeCursor.slice(lastAt + 1);
        if (query.length < MAX_MENTION_QUERY_LENGTH && !query.includes("\n") && !query.includes(" ")) {
          setMentionQuery(query);
          setShowMentions(true);
          return;
        }
      }
    }
    setShowMentions(false);
  };

  const insertMention = (r: Resident) => {
    const tag: ResidentTag = {
      residentId: r.mrn,
      name: `${r.lastName}, ${r.firstName || ""}`.trim().replace(/,$/, ""),
      mrn: r.mrn,
      unit: r.currentUnit || "",
      room: r.currentRoom || "",
    };

    const textBeforeCursor = noteInput.slice(0, cursorPos);
    const lastAt = textBeforeCursor.lastIndexOf("@");
    const textAfterCursor = noteInput.slice(cursorPos);
    const tagText = `@${tag.name} `;
    const newText = noteInput.slice(0, lastAt) + tagText + textAfterCursor;

    setNoteInput(newText);
    setTags(prev => {
      if (prev.some(t => t.residentId === tag.residentId)) return prev;
      return [...prev, tag];
    });
    setShowMentions(false);

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newPos = lastAt + tagText.length;
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    }, 10);
  };

  const extractHashtags = (text: string): string[] => {
    const matches = text.match(/#\w+/g) ?? [];
    return [...new Set(matches)];
  };

  const handleSubmit = () => {
    const body = noteInput.trim();
    if (!body) return;

    const hashtags = extractHashtags(body);
    const primaryTag = tags[0];

    if (routeTo === 'Shift Log') {
      updateDB(draft => {
        const facilityId = draft.data.facilities.activeFacilityId;
        const id = uuidv4();
        const entry: ShiftLogEntry = {
          id,
          facilityId,
          createdAtISO: new Date().toISOString(),
          shift: 'Day',
          tags: hashtags
            .map(h => h.replace('#', '') as ShiftLogEntry['tags'][number])
            .filter(h => (SHIFT_LOG_TAGS as string[]).includes(h)),
          priority: 'FYI',
          body,
          residentRefs: tags.map(t => ({ mrn: t.mrn, name: t.name })),
        };
        if (!draft.data.facilityData[facilityId].shiftLog) {
          (draft.data.facilityData[facilityId] as any).shiftLog = {};
        }
        (draft.data.facilityData[facilityId] as any).shiftLog[id] = entry;
      });
      setNoteInput("");
      setTags([]);
    } else if (routeTo === 'IP Review') {
      navigate('/outbreaks', {
        state: {
          prefillMrn: primaryTag?.mrn,
          prefillName: primaryTag?.name,
          prefillUnit: primaryTag?.unit,
          prefillRoom: primaryTag?.room,
          note: body,
        },
      });
    } else if (routeTo === 'ABT Note') {
      navigate('/resident-board', {
        state: {
          selectedResidentId: primaryTag?.mrn,
          openModal: 'abt',
          note: body,
        },
      });
    }
  };

  const facilityName = db.data.facilities.byId[activeFacilityId]?.name ?? 'Facility';

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 px-6 py-4 shrink-0">
        <h1 className="text-xl font-bold text-neutral-900">{facilityName}</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Quick note. Use <span className="font-mono font-bold text-indigo-600">@</span> to tag a resident,{" "}
          <span className="font-mono font-bold text-indigo-600">#</span> to classify the note.
        </p>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex items-end justify-center p-6">
        <div className="w-full max-w-2xl bg-white rounded-xl shadow-sm border border-neutral-200 overflow-visible">
          {/* Tagged residents chips */}
          {tags.length > 0 && (
            <div className="px-4 pt-3 flex flex-wrap gap-2">
              {tags.map(t => (
                <span
                  key={t.residentId}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                >
                  <User className="w-3 h-3" />
                  {t.name}
                  {t.room && <span className="text-indigo-500">· {t.room}</span>}
                  <button
                    onClick={() => setTags(prev => prev.filter(x => x.residentId !== t.residentId))}
                    className="ml-1 text-indigo-400 hover:text-indigo-700"
                    aria-label={`Remove tag ${t.name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Input area */}
          <div className="p-4 relative">
            {/* @mention dropdown */}
            {showMentions && filteredMentions.length > 0 && (
              <div className="absolute bottom-full left-4 mb-2 w-72 bg-white rounded-lg shadow-xl border border-neutral-200 overflow-hidden z-20">
                <ul className="divide-y divide-neutral-100 max-h-52 overflow-y-auto">
                  {filteredMentions.map(r => (
                    <li
                      key={r.mrn}
                      onClick={() => insertMention(r)}
                      className="px-3 py-2.5 hover:bg-indigo-50 cursor-pointer flex items-center gap-2"
                    >
                      <User className="w-4 h-4 text-indigo-400 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-neutral-900">
                          {r.lastName}, {r.firstName}
                        </p>
                        <p className="text-xs text-neutral-400">
                          MRN {r.mrn} · {r.currentUnit} · {r.currentRoom}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <textarea
              ref={inputRef}
              value={noteInput}
              onChange={handleInput}
              placeholder="Type a note… @resident #hashtag"
              rows={4}
              className="w-full p-3 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
            />

            {/* Footer: Route-to selector + Send */}
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-1 text-xs text-neutral-400">
                <Hash className="w-3.5 h-3.5" />
                <span>Hashtags: free-text only</span>
              </div>

              <div className="flex items-center gap-2">
                {/* Route-to dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowRouteMenu(v => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-md transition-colors"
                  >
                    Route to: {routeTo}
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  {showRouteMenu && (
                    <ul className="absolute bottom-full right-0 mb-1 w-40 bg-white rounded-lg shadow-lg border border-neutral-200 overflow-hidden z-20">
                      {ROUTE_OPTIONS.map(opt => (
                        <li
                          key={opt}
                          onClick={() => { setRouteTo(opt); setShowRouteMenu(false); }}
                          className={`px-3 py-2 text-sm cursor-pointer hover:bg-indigo-50 ${routeTo === opt ? 'font-semibold text-indigo-700' : 'text-neutral-700'}`}
                        >
                          {opt}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={!noteInput.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4" />
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
