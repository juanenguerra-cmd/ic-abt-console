import React, { useState, useMemo, useRef, useEffect } from "react";
import { useFacilityData, useDatabase } from "../../app/providers";
import { Resident, ResidentNote } from "../../domain/models";
import { Search, Filter, AlertCircle, Shield, Activity, Syringe, Thermometer, Send, User, X, Upload, Plus } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { CensusParserModal } from "./CensusParserModal";
import { AbtCourseModal } from "./AbtCourseModal";
import { IpEventModal } from "./IpEventModal";
import { VaxEventModal } from "./VaxEventModal";
import { ResidentProfileModal } from "./ResidentProfileModal";

export const ResidentBoard: React.FC = () => {
  const { store } = useFacilityData();
  const { updateDB } = useDatabase();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [filterActiveOnly, setFilterActiveOnly] = useState(false);
  const [filterAbtOnly, setFilterAbtOnly] = useState(false);
  
  const [selectedResidentId, setSelectedResidentId] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showCensusModal, setShowCensusModal] = useState(false);
  
  const [showAbtModal, setShowAbtModal] = useState(false);
  const [editingAbtId, setEditingAbtId] = useState<string | null>(null);
  
  const [showIpModal, setShowIpModal] = useState(false);
  const [editingIpId, setEditingIpId] = useState<string | null>(null);
  
  const [showVaxModal, setShowVaxModal] = useState(false);
  const [editingVaxId, setEditingVaxId] = useState<string | null>(null);

  // Notes Panel State
  const [noteInput, setNoteInput] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [cursorPos, setCursorPos] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const residents = Object.values(store.residents) as Resident[];
  const activeInfections = (Object.values(store.infections) as any[]).filter(i => i.status === 'active');
  const activeABTs = (Object.values(store.abts) as any[]).filter(a => a.status === 'active');
  const vaxEvents = Object.values(store.vaxEvents) as any[];
  // Assuming symptom events would be in store, but we don't have them in schema. We'll mock or omit.
  
  // Calculate age
  const getAge = (dob?: string) => {
    if (!dob) return "?";
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Filter logic
  const filteredResidents = useMemo(() => {
    return residents.filter(r => {
      // Global Search
      const matchesSearch = 
        r.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || 
        r.mrn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.currentRoom && r.currentRoom.toLowerCase().includes(searchQuery.toLowerCase()));
      
      if (!matchesSearch) return false;

      // Toggles
      if (filterActiveOnly && r.status !== "Active") return false;
      
      if (filterAbtOnly) {
        const hasAbt = activeABTs.some(a => a.residentRef.kind === "mrn" && a.residentRef.id === r.mrn);
        if (!hasAbt) return false;
      }

      return true;
    });
  }, [residents, searchQuery, filterActiveOnly, filterAbtOnly, activeABTs]);

  // Group by Unit
  // The prompt asks for Unit 2, Unit 3, Unit 4. We'll group dynamically based on currentUnit.
  const units = useMemo(() => {
    const groups: Record<string, Resident[]> = {};
    filteredResidents.forEach(r => {
      const unit = r.currentUnit || "Unassigned";
      if (!groups[unit]) groups[unit] = [];
      groups[unit].push(r);
    });
    
    // Sort each unit by room
    Object.keys(groups).forEach(unit => {
      groups[unit].sort((a, b) => (a.currentRoom || "").localeCompare(b.currentRoom || ""));
    });
    
    return groups;
  }, [filteredResidents]);

  // Mention Logic
  const mentionableResidents = residents
    .filter(r => r.displayName.toLowerCase().includes(mentionQuery.toLowerCase()) || r.mrn.includes(mentionQuery))
    .slice(0, 5);

  const handleNoteInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart;
    setNoteInput(val);
    setCursorPos(pos);

    const textBeforeCursor = val.slice(0, pos);
    const lastAt = textBeforeCursor.lastIndexOf("@");
    
    if (lastAt !== -1) {
      const charBeforeAt = lastAt > 0 ? textBeforeCursor[lastAt - 1] : " ";
      if (/\s/.test(charBeforeAt)) {
        const query = textBeforeCursor.slice(lastAt + 1);
        if (query.length < 30 && !query.includes('\n')) {
          setMentionQuery(query);
          setShowMentions(true);
          return;
        }
      }
    }
    setShowMentions(false);
  };

  const insertMention = (resident: Resident) => {
    const textBeforeCursor = noteInput.slice(0, cursorPos);
    const lastAt = textBeforeCursor.lastIndexOf("@");
    const textAfterCursor = noteInput.slice(cursorPos);
    
    const newText = noteInput.slice(0, lastAt) + `@${resident.lastName}, ${resident.firstName || ''} (${resident.currentRoom || 'No Room'}) ` + textAfterCursor;
    
    setNoteInput(newText);
    setShowMentions(false);
    
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newCursorPos = lastAt + newText.length - textAfterCursor.length;
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 10);
  };

  const submitNote = () => {
    if (!noteInput.trim() || !selectedResidentId) return;

    updateDB((draft) => {
      const facilityId = draft.data.facilities.activeFacilityId;
      const noteId = uuidv4();
      
      draft.data.facilityData[facilityId].notes[noteId] = {
        id: noteId,
        residentRef: { kind: "mrn", id: selectedResidentId },
        noteType: "general",
        body: noteInput,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });

    setNoteInput("");
  };

  const selectedResidentNotes = useMemo(() => {
    if (!selectedResidentId) return [];
    return (Object.values(store.notes) as any[])
      .filter(n => n.residentRef.kind === "mrn" && n.residentRef.id === selectedResidentId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [store.notes, selectedResidentId]);

  const selectedResident = selectedResidentId ? store.residents[selectedResidentId] : null;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-neutral-100">
      {/* Top Bar */}
      <div className="bg-white border-b border-neutral-200 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-neutral-900">Resident Board</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input 
              type="text" 
              placeholder="Search name, MRN, room..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-1.5 border border-neutral-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 w-64"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowCensusModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-sm font-medium hover:bg-indigo-100 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Update Census
          </button>
          <div className="h-6 w-px bg-neutral-300 mx-1"></div>
          <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
            <input 
              type="checkbox" 
              checked={filterActiveOnly}
              onChange={e => setFilterActiveOnly(e.target.checked)}
              className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
            />
            Active Only
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
            <input 
              type="checkbox" 
              checked={filterAbtOnly}
              onChange={e => setFilterAbtOnly(e.target.checked)}
              className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
            />
            ABT Only
          </label>
        </div>
      </div>

      {/* Main Layout: 4 Columns */}
      <div className="flex flex-1 overflow-hidden">
        {/* Unit Columns */}
        <div className="flex-1 flex overflow-x-auto p-4 gap-4">
          {(Object.entries(units) as [string, Resident[]][]).map(([unitName, unitResidents]) => (
            <div key={unitName} className="flex flex-col w-80 shrink-0 bg-neutral-50 rounded-xl border border-neutral-200 overflow-hidden">
              <div className="bg-white px-4 py-3 border-b border-neutral-200 flex justify-between items-center shrink-0">
                <h2 className="font-bold text-neutral-800">{unitName}</h2>
                <span className="bg-neutral-200 text-neutral-700 text-xs font-bold px-2 py-0.5 rounded-full">
                  {unitResidents.length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {unitResidents.map(resident => {
                  const hasAllergies = resident.allergies && resident.allergies.length > 0;
                  const isActive = resident.status === "Active";
                  const hasABT = activeABTs.some(a => a.residentRef.kind === "mrn" && a.residentRef.id === resident.mrn);
                  const hasIP = activeInfections.some(i => i.residentRef.kind === "mrn" && i.residentRef.id === resident.mrn);
                  const vaxDue = vaxEvents.some(v => v.residentRef.kind === "mrn" && v.residentRef.id === resident.mrn && (v.status === "due" || v.status === "overdue"));
                  const hasSymptom = false; // Mocked for now as SymptomEvent is not in the schema
                  
                  const isSelected = selectedResidentId === resident.mrn;

                  return (
                    <div 
                      key={resident.mrn}
                      onClick={() => {
                        setSelectedResidentId(resident.mrn);
                        // If already selected, maybe open profile? Or just double click?
                        // The prompt says "clicking a tile opens the resident profile".
                        // So we set selected AND open modal.
                        setShowProfileModal(true);
                      }}
                      className={`bg-white border rounded-lg p-3 cursor-pointer transition-all shadow-sm hover:shadow-md ${
                        isSelected ? "border-indigo-500 ring-1 ring-indigo-500" : "border-neutral-200"
                      }`}
                    >
                      {/* Header Row */}
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="text-sm font-bold text-neutral-900 truncate pr-2" title={resident.displayName}>
                          {resident.displayName}
                        </h4>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedResidentId(resident.mrn);
                              setEditingAbtId(null);
                              setShowAbtModal(true);
                            }}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                            title="Add ABT"
                          >
                            <Activity className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedResidentId(resident.mrn);
                              setEditingIpId(null);
                              setShowIpModal(true);
                            }}
                            className="p-1 text-amber-600 hover:bg-amber-50 rounded"
                            title="Add IP Event"
                          >
                            <Shield className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedResidentId(resident.mrn);
                              setEditingVaxId(null);
                              setShowVaxModal(true);
                            }}
                            className="p-1 text-purple-600 hover:bg-purple-50 rounded"
                            title="Add Vaccination"
                          >
                            <Syringe className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-bold text-neutral-700 bg-neutral-100 px-1.5 py-0.5 rounded shrink-0 ml-1">
                            {resident.currentRoom || "N/A"}
                          </span>
                        </div>
                      </div>
                      
                      {/* Sub-row */}
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs text-neutral-500 font-mono">{resident.mrn}</span>
                        <span className="text-xs text-neutral-500">{getAge(resident.dob)} yrs</span>
                      </div>

                      {/* Chip Row */}
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {hasAllergies && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500 text-white shadow-sm uppercase tracking-wider">
                            Allergies
                          </span>
                        )}
                        {isActive && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500 text-white shadow-sm uppercase tracking-wider">
                            Active
                          </span>
                        )}
                        {hasABT && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500 text-white shadow-sm uppercase tracking-wider">
                            ABT
                          </span>
                        )}
                        {hasIP && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-white shadow-sm uppercase tracking-wider">
                            IP
                          </span>
                        )}
                        {vaxDue && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500 text-white shadow-sm uppercase tracking-wider">
                            Vax Due
                          </span>
                        )}
                        {hasSymptom && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-500 text-white shadow-sm uppercase tracking-wider">
                            Symptom
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Right Notes Panel */}
        <div className="w-80 shrink-0 bg-white border-l border-neutral-200 flex flex-col">
          <div className="px-4 py-3 border-b border-neutral-200 bg-neutral-50 shrink-0 flex flex-col gap-2">
            <h2 className="font-bold text-neutral-800 truncate">
              {selectedResident ? selectedResident.displayName : "Select a Resident"}
            </h2>
            {selectedResident && (
              <div className="flex gap-2">
                <button 
                  onClick={() => { setEditingAbtId(null); setShowAbtModal(true); }}
                  className="flex-1 flex items-center justify-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 hover:bg-emerald-200 py-1.5 rounded transition-colors"
                >
                  <Plus className="w-3 h-3" /> ABT
                </button>
                <button 
                  onClick={() => { setEditingIpId(null); setShowIpModal(true); }}
                  className="flex-1 flex items-center justify-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 py-1.5 rounded transition-colors"
                >
                  <Plus className="w-3 h-3" /> IP
                </button>
                <button 
                  onClick={() => { setEditingVaxId(null); setShowVaxModal(true); }}
                  className="flex-1 flex items-center justify-center gap-1 text-xs font-medium text-purple-700 bg-purple-100 hover:bg-purple-200 py-1.5 rounded transition-colors"
                >
                  <Plus className="w-3 h-3" /> Vax
                </button>
              </div>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-neutral-50/50">
            {!selectedResidentId ? (
              <div className="text-center text-neutral-400 py-8 text-sm">
                Click a resident tile to view and add notes.
              </div>
            ) : selectedResidentNotes.length === 0 ? (
              <div className="text-center text-neutral-400 py-8 text-sm">
                No notes for this resident.
              </div>
            ) : (
              selectedResidentNotes.map(note => (
                <div key={note.id} className="bg-white p-3 rounded-lg shadow-sm border border-neutral-200">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-semibold text-neutral-700">Staff</span>
                    <span className="text-[10px] text-neutral-400">
                      {new Date(note.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-800 whitespace-pre-wrap">{note.body}</p>
                </div>
              ))
            )}
          </div>

          {/* Composer */}
          <div className="p-3 bg-white border-t border-neutral-200 relative shrink-0">
            {showMentions && mentionableResidents.length > 0 && (
              <div className="absolute bottom-full left-3 mb-2 w-[calc(100%-24px)] bg-white rounded-lg shadow-xl border border-neutral-200 overflow-hidden z-10">
                <ul className="divide-y divide-neutral-100 max-h-48 overflow-y-auto">
                  {mentionableResidents.map(r => (
                    <li 
                      key={r.mrn}
                      onClick={() => insertMention(r)}
                      className="px-3 py-2 hover:bg-indigo-50 cursor-pointer flex items-center gap-2"
                    >
                      <User className="w-4 h-4 text-indigo-400 shrink-0" />
                      <div className="truncate">
                        <p className="text-sm font-medium text-neutral-900 truncate">{r.lastName}, {r.firstName}</p>
                        <p className="text-[10px] text-neutral-500">{r.currentRoom}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="flex flex-col gap-2">
              <textarea
                ref={inputRef}
                value={noteInput}
                onChange={handleNoteInput}
                disabled={!selectedResidentId}
                placeholder={selectedResidentId ? "Type a note... Use @ to tag others" : "Select a resident first"}
                className="w-full min-h-[80px] p-2 text-sm border border-neutral-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 resize-none disabled:bg-neutral-50 disabled:cursor-not-allowed"
              />
              <button
                onClick={submitNote}
                disabled={!noteInput.trim() || !selectedResidentId}
                className="self-end px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <Send className="w-4 h-4" />
                Save
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Resident Profile Modal */}
      {showProfileModal && selectedResidentId && (
        <ResidentProfileModal
          residentId={selectedResidentId}
          onClose={() => setShowProfileModal(false)}
          onAddAbt={() => { setEditingAbtId(null); setShowAbtModal(true); }}
          onAddIp={() => { setEditingIpId(null); setShowIpModal(true); }}
          onAddVax={() => { setEditingVaxId(null); setShowVaxModal(true); }}
          onEditAbt={(id) => { setEditingAbtId(id); setShowAbtModal(true); }}
          onEditIp={(id) => { setEditingIpId(id); setShowIpModal(true); }}
          onEditVax={(id) => { setEditingVaxId(id); setShowVaxModal(true); }}
        />
      )}

      {/* Census Parser Modal */}
      {showCensusModal && (
        <CensusParserModal onClose={() => setShowCensusModal(false)} />
      )}

      {/* ABT Course Modal */}
      {showAbtModal && selectedResidentId && (
        <AbtCourseModal 
          residentId={selectedResidentId}
          existingAbt={editingAbtId ? store.abts[editingAbtId] : undefined}
          onClose={() => {
            setShowAbtModal(false);
            setEditingAbtId(null);
          }} 
        />
      )}

      {/* IP Event Modal */}
      {showIpModal && selectedResidentId && (
        <IpEventModal 
          residentId={selectedResidentId}
          existingIp={editingIpId ? store.infections[editingIpId] : undefined}
          onClose={() => {
            setShowIpModal(false);
            setEditingIpId(null);
          }} 
        />
      )}

      {/* Vax Event Modal */}
      {showVaxModal && selectedResidentId && (
        <VaxEventModal 
          residentId={selectedResidentId}
          existingVax={editingVaxId ? store.vaxEvents[editingVaxId] : undefined}
          onClose={() => {
            setShowVaxModal(false);
            setEditingVaxId(null);
          }} 
        />
      )}
    </div>
  );
};
