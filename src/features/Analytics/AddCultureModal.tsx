import React, { useState } from 'react';
import { X, FlaskConical, Plus, Trash2, CheckCircle } from 'lucide-react';
import { CultureResult, SensitivityResult } from '../../domain/models';
import { v4 as uuidv4 } from 'uuid';
import { todayLocalDateInputValue } from '../../lib/dateUtils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  facilityId: string;
  onSave: (result: CultureResult) => void;
  onClose: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SOURCE_OPTIONS = ['Urine', 'Blood', 'Sputum / BAL', 'Wound', 'CSF', 'Stool', 'Tissue Biopsy', 'Other'];

const COMMON_ORGANISMS = [
  'Escherichia coli',
  'Klebsiella pneumoniae',
  'Enterococcus faecalis',
  'Enterococcus faecium',
  'Proteus mirabilis',
  'Pseudomonas aeruginosa',
  'Staphylococcus aureus (MSSA)',
  'Staphylococcus aureus (MRSA)',
  'Streptococcus pneumoniae',
  'Streptococcus agalactiae',
  'Enterobacter cloacae',
  'Serratia marcescens',
  'Clostridioides difficile',
  'Candida albicans',
  'Other (enter below)',
];

const COMMON_ANTIBIOTICS = [
  'Ampicillin',
  'Amoxicillin-clavulanate',
  'Piperacillin-tazobactam',
  'Cefazolin',
  'Ceftriaxone',
  'Cefepime',
  'Imipenem',
  'Meropenem',
  'Ertapenem',
  'Aztreonam',
  'Gentamicin',
  'Tobramycin',
  'Ciprofloxacin',
  'Levofloxacin',
  'TMP-SMX',
  'Nitrofurantoin',
  'Tetracycline',
  'Doxycycline',
  'Clindamycin',
  'Metronidazole',
  'Vancomycin',
  'Linezolid',
  'Daptomycin',
  'Tigecycline',
];

// ─── Component ────────────────────────────────────────────────────────────────

const AddCultureModal: React.FC<Props> = ({ facilityId, onSave, onClose }) => {
  const [collectionDate, setCollectionDate] = useState(todayLocalDateInputValue());
  const [source, setSource] = useState('');
  const [organism, setOrganism] = useState('');
  const [organismOther, setOrganismOther] = useState('');
  const [sensitivities, setSensitivities] = useState<SensitivityResult[]>([]);
  const [newAntibiotic, setNewAntibiotic] = useState('');
  const [newResult, setNewResult] = useState<'S' | 'I' | 'R'>('S');
  const [newMic, setNewMic] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  const finalOrganism = organism === 'Other (enter below)' ? organismOther.trim() : organism;

  const addSensitivity = () => {
    if (!newAntibiotic.trim()) return;
    setSensitivities((prev) => [
      ...prev,
      { antibiotic: newAntibiotic.trim(), result: newResult, mic: newMic.trim() || undefined },
    ]);
    setNewAntibiotic('');
    setNewMic('');
    setNewResult('S');
  };

  const removeSensitivity = (index: number) => {
    setSensitivities((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!collectionDate || !source || !finalOrganism) return;
    const now = new Date().toISOString();
    const record: CultureResult = {
      id: uuidv4(),
      facilityId,
      collectionDate,
      source: source === 'Other' ? source : source,
      organism: finalOrganism,
      sensitivities,
      notes: notes.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };
    onSave(record);
    setIsSaved(true);
    setTimeout(onClose, 800);
  };

  const isReady = !!collectionDate && !!source && !!finalOrganism;

  const resultLabel = (r: 'S' | 'I' | 'R') =>
    r === 'S' ? 'Susceptible' : r === 'I' ? 'Intermediate' : 'Resistant';

  const resultStyle = (r: 'S' | 'I' | 'R') =>
    r === 'S'
      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
      : r === 'I'
      ? 'bg-amber-100 text-amber-800 border-amber-300'
      : 'bg-red-100 text-red-800 border-red-300';

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-50 shrink-0">
          <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-blue-600" />
            Add Lab Culture Result
          </h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-5">

          {/* Collection Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Collection Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={collectionDate}
                onChange={(e) => setCollectionDate(e.target.value)}
                className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Specimen Source <span className="text-red-500">*</span>
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select...</option>
                {SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Organism */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Organism Identified <span className="text-red-500">*</span>
            </label>
            <select
              value={organism}
              onChange={(e) => setOrganism(e.target.value)}
              className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select organism...</option>
              {COMMON_ORGANISMS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            {organism === 'Other (enter below)' && (
              <input
                type="text"
                value={organismOther}
                onChange={(e) => setOrganismOther(e.target.value)}
                placeholder="Enter organism name..."
                className="mt-2 w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            )}
          </div>

          {/* Sensitivities */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Antibiotic Sensitivities (S / I / R)
            </label>

            {/* Add row */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <div className="flex-1 min-w-[160px]">
                <input
                  type="text"
                  list="abt-list"
                  value={newAntibiotic}
                  onChange={(e) => setNewAntibiotic(e.target.value)}
                  placeholder="Antibiotic name..."
                  className="w-full border border-neutral-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <datalist id="abt-list">
                  {COMMON_ANTIBIOTICS.map((a) => <option key={a} value={a} />)}
                </datalist>
              </div>
              <select
                value={newResult}
                onChange={(e) => setNewResult(e.target.value as 'S' | 'I' | 'R')}
                className="border border-neutral-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="S">S — Susceptible</option>
                <option value="I">I — Intermediate</option>
                <option value="R">R — Resistant</option>
              </select>
              <input
                type="text"
                value={newMic}
                onChange={(e) => setNewMic(e.target.value)}
                placeholder="MIC (opt)"
                className="w-24 border border-neutral-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={addSensitivity}
                disabled={!newAntibiotic.trim()}
                className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            {/* Sensitivity list */}
            {sensitivities.length > 0 ? (
              <div className="border border-neutral-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-neutral-600">Antibiotic</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-neutral-600">Result</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-neutral-600">MIC</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {sensitivities.map((s, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-medium text-neutral-800">{s.antibiotic}</td>
                        <td className="px-3 py-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded border ${resultStyle(s.result)}`}>
                            {s.result} — {resultLabel(s.result)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-neutral-500">{s.mic || '—'}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeSensitivity(i)}
                            className="text-neutral-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-neutral-400 italic py-2">
                No sensitivities added yet. Use the fields above to add antibiotic results.
              </p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g., Mixed flora, ESBL confirmed, preliminary result..."
              className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
            />
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-200 flex justify-end gap-3 shrink-0 bg-neutral-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-neutral-300 rounded-lg text-sm text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            Cancel
          </button>
          {isSaved ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium">
              <CheckCircle className="w-4 h-4" />
              Saved
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={!isReady}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Save Culture Result
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddCultureModal;
