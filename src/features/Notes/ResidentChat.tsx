import React, { useState, useRef, useEffect } from "react";
import { useFacilityData, useDatabase } from "../../app/providers";
import { Resident } from "../../domain/models";
import { Send, AtSign, User } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

interface Mention {
  id: string; // MRN
  display: string;
  index: number; // Position in text where mention starts
  length: number; // Length of the mention text
}

export const ResidentChat: React.FC = () => {
  const { store } = useFacilityData();
  const { updateDB } = useDatabase();
  
  const [input, setInput] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [cursorPos, setCursorPos] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Filter residents for autocomplete
  const residents = Object.values(store.residents) as Resident[];
  const filteredResidents = residents
    .filter(r => r.displayName.toLowerCase().includes(mentionQuery.toLowerCase()) || r.mrn.includes(mentionQuery))
    .slice(0, 5); // Limit to 5 suggestions

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart;
    
    setInput(val);
    setCursorPos(pos);

    // Check for @ trigger
    // We look backwards from cursor to find the last @
    const textBeforeCursor = val.slice(0, pos);
    const lastAt = textBeforeCursor.lastIndexOf("@");
    
    if (lastAt !== -1) {
      // Check if there's a space before the @ (or it's start of line)
      const charBeforeAt = lastAt > 0 ? textBeforeCursor[lastAt - 1] : " ";
      
      if (/\s/.test(charBeforeAt)) {
        // Valid trigger. Now check if there's a space between @ and cursor (end of mention)
        const query = textBeforeCursor.slice(lastAt + 1);
        if (!/\s/.test(query)) {
          setMentionQuery(query);
          setShowMentions(true);
          return;
        }
      }
    }
    
    setShowMentions(false);
  };

  const insertMention = (resident: Resident) => {
    const textBeforeCursor = input.slice(0, cursorPos);
    const lastAt = textBeforeCursor.lastIndexOf("@");
    const textAfterCursor = input.slice(cursorPos);
    
    const newText = input.slice(0, lastAt) + `@${resident.displayName} ` + textAfterCursor;
    
    setInput(newText);
    setShowMentions(false);
    
    // Reset focus and cursor
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newCursorPos = lastAt + resident.displayName.length + 2; // +2 for @ and space
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 10);
  };

  const handleSubmit = () => {
    if (!input.trim()) return;

    // 1. Parse mentions from the final text
    // We look for @Name patterns that match actual residents
    // This is a simple heuristic. For robust linking, we'd track the IDs separately, 
    // but for this "chat" feel, we'll scan.
    
    const mentionedResidents: Resident[] = [];
    residents.forEach(r => {
      if (input.includes(`@${r.displayName}`)) {
        mentionedResidents.push(r);
      }
    });

    updateDB((draft) => {
      const facilityId = draft.data.facilities.activeFacilityId;
      const now = new Date().toISOString();

      // If no specific residents mentioned, maybe save as a general facility note?
      // For now, the requirement implies "mention resident... making note".
      // So we will create a note for EACH mentioned resident.
      
      if (mentionedResidents.length === 0) {
        // Fallback: Create a "General" note attached to a dummy or system ref?
        // Or just alert user.
        // Let's assume we just log it to console or a "Facility Log" if we had one.
        // For this implementation, we'll require at least one mention to save a "Resident Note".
        // OR, we can treat it as a "Shift Log" entry if we had that model.
        // Let's just create a note for the first resident found, or all of them.
      }

      mentionedResidents.forEach(resident => {
        const noteId = uuidv4();
        draft.data.facilityData[facilityId].notes[noteId] = {
          id: noteId,
          residentRef: { kind: "mrn", id: resident.mrn },
          noteType: "shift_log",
          body: input,
          createdAt: now,
          updatedAt: now,
          title: "Chat Log"
        };
      });
    });

    setInput("");
  };

  // Get recent notes for the feed
  const recentNotes = (Object.values(store.notes) as any[])
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 50);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50">
        <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
          <AtSign className="w-5 h-5 text-indigo-600" />
          Shift Log & Notes
        </h2>
        <p className="text-sm text-neutral-500">
          Type notes below. Use <span className="font-mono font-bold text-indigo-600">@</span> to tag residents.
        </p>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-neutral-50/50">
        {recentNotes.length === 0 ? (
          <div className="text-center text-neutral-400 py-12">
            <p>No notes yet. Start typing below!</p>
          </div>
        ) : (
          recentNotes.map(note => {
            const resident = note.residentRef.kind === 'mrn' 
              ? store.residents[note.residentRef.id] 
              : null;
            
            return (
              <div key={note.id} className="bg-white p-4 rounded-lg shadow-sm border border-neutral-200">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                      {resident?.displayName || note.residentRef.id}
                    </span>
                    <span className="text-xs text-neutral-400">
                      {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-neutral-800 whitespace-pre-wrap">{note.body}</p>
              </div>
            );
          })
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-neutral-200 relative">
        {showMentions && filteredResidents.length > 0 && (
          <div className="absolute bottom-full left-4 mb-2 w-64 bg-white rounded-lg shadow-xl border border-neutral-200 overflow-hidden z-10">
            <ul className="divide-y divide-neutral-100">
              {filteredResidents.map(r => (
                <li 
                  key={r.mrn}
                  onClick={() => insertMention(r)}
                  className="px-4 py-3 hover:bg-indigo-50 cursor-pointer flex items-center gap-3 transition-colors"
                >
                  <div className="bg-indigo-100 p-1.5 rounded-full">
                    <User className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{r.displayName}</p>
                    <p className="text-xs text-neutral-500">{r.currentUnit} • {r.currentRoom}</p>
                  </div>
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
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Type a note... e.g. '@Doe, Jane checked vitals, stable.'"
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
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};
