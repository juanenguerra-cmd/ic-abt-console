import React, { useState, useMemo } from 'react';
import { useDatabase, useFacilityData } from '../../app/providers';
import { Resident, ABTCourse, IPEvent } from '../../domain/models';
import { Save, FileText, Copy } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useSearchParams } from 'react-router-dom';

const NOTE_TEMPLATES = {
  ABT_STEWARDSHIP: 'On [Today], antibiotic stewardship review completed for [displayName]... Current antibiotic therapy includes [medication] initiated on [startDate] for [syndromeCategory].',
  INFECTION_REVIEW: 'On [Today], infection surveillance completed for [displayName] related to [infectionCategory]. Resident is on [isolationType] precautions.',
  ADMISSION_SCREENING: 'Admission infection prevention screening completed for [displayName] admitted on [admissionDate]. Resident is [isolationType / "not on isolation"].',
};

type NoteType = keyof typeof NOTE_TEMPLATES;

export const NoteGenerator: React.FC = () => {
  const { store, activeFacilityId } = useFacilityData();
  const { updateDB } = useDatabase();
  const [searchParams] = useSearchParams();

  const [selectedMrn, setSelectedMrn] = useState<string>('');
  const [noteType, setNoteType] = useState<NoteType>('ABT_STEWARDSHIP');
  const [noteContent, setNoteContent] = useState('');

  React.useEffect(() => {
    const mrn = searchParams.get('mrn');
    const incomingType = searchParams.get('noteType');
    if (mrn && store.residents[mrn]) setSelectedMrn(mrn);
    if (incomingType && incomingType in NOTE_TEMPLATES) setNoteType(incomingType as NoteType);
  }, [searchParams, store.residents]);

  const residents = Object.values(store.residents) as Resident[];

  const generateNote = () => {
    if (!selectedMrn) {
      alert('Please select a resident.');
      return;
    }

    const resident = store.residents[selectedMrn];
    if (!resident) return;

    let template = NOTE_TEMPLATES[noteType];
    let generatedNote = template;

    const today = new Date().toLocaleDateString();
    generatedNote = generatedNote.replace(/\[Today\]/g, today);
    generatedNote = generatedNote.replace(/\[displayName\]/g, resident.displayName);
    generatedNote = generatedNote.replace(/\[admissionDate\]/g, resident.admissionDate || 'N/A');

    switch (noteType) {
      case 'ABT_STEWARDSHIP':
        const activeAbt = (Object.values(store.abts) as ABTCourse[]).find(a => a.residentRef.id === selectedMrn && a.status === 'active');
        generatedNote = generatedNote.replace(/\[medication\]/g, activeAbt?.medication || 'N/A');
        generatedNote = generatedNote.replace(/\[startDate\]/g, activeAbt?.startDate || 'N/A');
        generatedNote = generatedNote.replace(/\[syndromeCategory\]/g, activeAbt?.syndromeCategory || 'N/A');
        break;
      case 'INFECTION_REVIEW':
        const activeIp = (Object.values(store.infections) as IPEvent[]).find(i => i.residentRef.id === selectedMrn && i.status === 'active');
        generatedNote = generatedNote.replace(/\[infectionCategory\]/g, activeIp?.infectionCategory || 'N/A');
        generatedNote = generatedNote.replace(/\[isolationType\]/g, activeIp?.isolationType || 'Standard');
        break;
      case 'ADMISSION_SCREENING':
        const admissionIp = (Object.values(store.infections) as IPEvent[]).find(i => i.residentRef.id === selectedMrn && i.status === 'active');
        generatedNote = generatedNote.replace(/\[isolationType \/ "not on isolation"\]/g, admissionIp?.isolationType || 'not on isolation');
        break;
    }
    setNoteContent(generatedNote);
  };

  const handleSaveNote = () => {
    if (!selectedMrn || !noteContent.trim()) {
      alert('Please select a resident and generate note content.');
      return;
    }

    updateDB(draft => {
      const facilityData = draft.data.facilityData[activeFacilityId];
      const noteId = uuidv4();
      facilityData.notes[noteId] = {
        id: noteId,
        residentRef: { kind: 'mrn', id: selectedMrn },
        noteType: 'Generated Note',
        title: `${noteType.replace(/_/g, ' ')} Note`,
        body: noteContent,
        derived: true,
        generator: { name: 'NoteGenerator', version: '1.0' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });

    alert('Note saved to Shift Log!');
    setSelectedMrn('');
    setNoteContent('');
  };

  const handleCopy = async () => {
    if (!noteContent.trim()) return;
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      alert('Clipboard is unavailable. Please copy the note manually.');
      return;
    }
    try {
      await navigator.clipboard.writeText(noteContent);
      alert('Note copied to clipboard.');
    } catch {
      alert('Unable to copy to clipboard. Please copy the note manually.');
    }
  };

  return (
    <div className="p-6 bg-neutral-100 h-full">
      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 flex flex-col h-full">
        <div className="px-6 py-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-50">
          <h2 className="text-xl font-bold text-neutral-900">Automated Progress Note Generator</h2>
        </div>

        <div className="p-6 space-y-6 flex-1 flex flex-col">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Select Resident</label>
              <select
                value={selectedMrn}
                onChange={e => setSelectedMrn(e.target.value)}
                className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="" disabled>-- Select a Resident --</option>
                {residents.map(r => (
                  <option key={r.mrn} value={r.mrn}>{r.displayName} (MRN: {r.mrn})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Select Note Type</label>
              <select
                value={noteType}
                onChange={e => setNoteType(e.target.value as NoteType)}
                className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="ABT_STEWARDSHIP">ABT Stewardship</option>
                <option value="INFECTION_REVIEW">Infection Review</option>
                <option value="ADMISSION_SCREENING">Admission Screening</option>
              </select>
            </div>
            <div className="self-end">
              <button
                onClick={generateNote}
                disabled={!selectedMrn}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-neutral-300 text-sm font-medium"
              >
                <FileText className="w-4 h-4" />
                Generate Note
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col">
            <label className="block text-sm font-medium text-neutral-700 mb-1">Note Content</label>
            <textarea
              value={noteContent}
              onChange={e => setNoteContent(e.target.value)}
              className="w-full flex-1 border border-neutral-300 rounded-md p-3 text-sm focus:ring-indigo-500 focus:border-indigo-500 font-mono"
              placeholder="Generated note will appear here..."
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={handleCopy}
              disabled={!noteContent.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-600 text-white rounded-md hover:bg-neutral-700 disabled:bg-neutral-300 text-sm font-medium"
            >
              <Copy className="w-4 h-4" />
              Copy to Clipboard
            </button>
            <button
              onClick={handleSaveNote}
              disabled={!noteContent.trim() || !selectedMrn}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:bg-neutral-300 text-sm font-medium"
            >
              <Save className="w-4 h-4" />
              Save to Shift Log
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
