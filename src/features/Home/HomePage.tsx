import React, { useState, useRef } from "react";
import { useFacilityData, useDatabase } from "../../app/providers";
import { Resident, ShiftLogEntry } from "../../domain/models";
import { Send, MessageSquare, User, Hash } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

export const HomePage: React.FC = () => {
  const { store, activeFacilityId } = useFacilityData();
  const { db, updateDB } = useDatabase();

  const [input, setInput] = useState("");
  const [cursorPos, setCursorPos] = useState(0);

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
  const residents = (Object.values(store.residents) as Resident[]).filter(
    (r) => !r.isHistorical && !r.backOfficeOnly
  );
  const filteredResidents = residents
    .filter(
      (r) =>
        r.displayName.toLowerCase().includes(mentionQuery.toLowerCase()) ||
        r.mrn.includes(mentionQuery)
    )
    .slice(0, 6);

  // Hashtag library from Settings (facility.hashtagCategories — same source as ResidentBoard)
  const hashtagLibrary: string[] =
    db.data.facilities.byId[activeFacilityId]?.hashtagCategories ?? [];
  const filteredHashtags = hashtagLibrary
    .filter((h) => h.toLowerCase().includes(hashtagQuery.toLowerCase()))
    .slice(0, 6);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart ?? val.length;

    setInput(val);
    setCursorPos(pos);

    const textBeforeCursor = val.slice(0, pos);

    // Check for @ trigger (whitespace or start of input before @)
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

    // Check for # trigger (whitespace or start of input before #)
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
    // Ensure the stored tag starts with # (library entries already start with #)
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
    // Keyboard navigation for @mention dropdown
    if (showMentions && filteredResidents.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionHighlight((h) => Math.min(h + 1, filteredResidents.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionHighlight((h) => Math.max(h - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        insertMention(filteredResidents[mentionHighlight]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowMentions(false);
        return;
      }
    }

    // Keyboard navigation for #hashtag dropdown
    if (showHashtags && filteredHashtags.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHashtagHighlight((h) => Math.min(h + 1, filteredHashtags.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHashtagHighlight((h) => Math.max(h - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        insertHashtag(filteredHashtags[hashtagHighlight]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowHashtags(false);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (!input.trim()) return;

    // Extract mentioned residents
    const mentionedResidents: Resident[] = [];
    residents.forEach((r) => {
      if (input.includes(`@${r.displayName}`)) {
        mentionedResidents.push(r);
      }
    });

    // Extract hashtags from body text for pass-through storage
    const hashtagMatches = input.match(/#[\w-]+/g) ?? [];
    const hashtags = Array.from(new Set(hashtagMatches));

    updateDB((draft) => {
      const facilityId = draft.data.facilities.activeFacilityId;
      const now = new Date().toISOString();
      const entryId = uuidv4();

      if (!draft.data.facilityData[facilityId].shiftLog) {
        draft.data.facilityData[facilityId].shiftLog = {};
      }

      const entry: ShiftLogEntry = {
        id: entryId,
        facilityId,
        createdAtISO: now,
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

    setInput("");
  };

  // Recent entries feed
  const recentEntries = (Object.values(store.shiftLog || {}) as ShiftLogEntry[])
    .sort(
      (a, b) =>
        new Date(b.createdAtISO).getTime() - new Date(a.createdAtISO).getTime()
    )
    .slice(0, 20);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50">
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

      {/* Feed */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-neutral-50/50">
        {recentEntries.length === 0 ? (
          <div className="text-center text-neutral-400 py-12">
            <p>No notes yet. Start typing below!</p>
          </div>
        ) : (
          recentEntries.map((entry) => (
            <div
              key={entry.id}
              className="bg-white p-4 rounded-lg shadow-sm border border-neutral-200"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex flex-wrap items-center gap-2">
                  {entry.residentRefs?.map((ref) => (
                    <span
                      key={ref.mrn}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800"
                    >
                      {ref.name}
                    </span>
                  ))}
                  {entry.hashtags?.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800"
                    >
                      {tag}
                    </span>
                  ))}
                  <span className="text-xs text-neutral-400">
                    {new Date(entry.createdAtISO).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
              <p className="text-sm text-neutral-800 whitespace-pre-wrap">
                {entry.body}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-neutral-200 relative">
        {/* @mention dropdown */}
        {showMentions && filteredResidents.length > 0 && (
          <div className="absolute bottom-full left-4 mb-2 w-64 bg-white rounded-lg shadow-xl border border-neutral-200 overflow-hidden z-10 max-h-60 overflow-y-auto">
            <ul className="divide-y divide-neutral-100">
              {filteredResidents.map((r, idx) => (
                <li
                  key={r.mrn}
                  onClick={() => insertMention(r)}
                  className={`px-4 py-3 cursor-pointer flex items-center gap-3 transition-colors ${
                    idx === mentionHighlight
                      ? "bg-indigo-50"
                      : "hover:bg-indigo-50"
                  }`}
                >
                  <div className="bg-indigo-100 p-1.5 rounded-full shrink-0">
                    <User className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-900">
                      {r.displayName}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {r.currentUnit} · {r.currentRoom}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* #hashtag dropdown — shown only when library has entries (graceful degradation) */}
        {showHashtags && filteredHashtags.length > 0 && (
          <div className="absolute bottom-full left-4 mb-2 w-72 bg-white rounded-lg shadow-xl border border-neutral-200 overflow-hidden z-10 max-h-60 overflow-y-auto">
            <ul className="divide-y divide-neutral-100">
              {filteredHashtags.map((tag, idx) => (
                <li
                  key={tag}
                  onClick={() => insertHashtag(tag)}
                  className={`px-4 py-3 cursor-pointer flex items-center gap-3 transition-colors ${
                    idx === hashtagHighlight
                      ? "bg-emerald-50"
                      : "hover:bg-emerald-50"
                  }`}
                >
                  <div className="bg-emerald-100 p-1.5 rounded-full shrink-0">
                    <Hash className="w-4 h-4 text-emerald-600" />
                  </div>
                  <p className="text-sm font-medium text-neutral-900">{tag}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Type a note… Use @ for residents, # for hashtags"
            className="flex-1 min-h-[80px] p-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim()}
            className="self-end p-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-neutral-400 mt-2 text-right">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};
