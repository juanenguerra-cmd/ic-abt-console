import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AdmissionScreeningRecord, Resident } from '../../domain/models';
import { X, AlertTriangle, CheckCircle, Search, Printer } from 'lucide-react';
import { useFacilityData } from '../../app/providers';
import { isActiveCensusResident } from '../../utils/countCardDataHelpers';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Maximum days from admission before a screening is considered late (72 hours). */
const MAX_SCREENING_DAYS = 3;

// ─── Resident search helpers ──────────────────────────────────────────────────

interface ResidentOption {
  mrn: string;
  displayName: string;
  room: string | null;
  unit: string | null;
  admissionDate: string | null;
}

function scoreResidentMatch(r: ResidentOption, query: string): number {
  const q = query.toLowerCase();
  const name = r.displayName.toLowerCase();
  const mrn = r.mrn.toLowerCase();
  const room = (r.room ?? '').toLowerCase();
  if (name.startsWith(q) || mrn.startsWith(q) || room.startsWith(q)) return 2;
  if (name.includes(q) || mrn.includes(q) || room.includes(q)) return 1;
  return 0;
}

function toResidentOption(r: Resident): ResidentOption {
  return {
    mrn: r.mrn ?? '',
    displayName: r.displayName ?? r.mrn ?? '',
    room: r.currentRoom ?? null,
    unit: r.currentUnit ?? null,
    admissionDate: r.admissionDate ?? null,
  };
}

const ResidentSearchInput: React.FC<{
  residents: ResidentOption[];
  onSelect: (r: ResidentOption) => void;
}> = ({ residents, onSelect }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = React.useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return residents
      .map(r => ({ r, score: scoreResidentMatch(r, q) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.r.displayName.localeCompare(b.r.displayName))
      .slice(0, 8)
      .map(({ r }) => r);
  }, [query, residents]);

  useEffect(() => {
    setActiveIndex(0);
    setOpen(suggestions.length > 0 && query.trim().length > 0);
  }, [suggestions, query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = useCallback((r: ResidentOption) => {
    onSelect(r);
    setQuery('');
    setOpen(false);
  }, [onSelect]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions[activeIndex]) handleSelect(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
          placeholder={residents.length > 0 ? 'Search by name, MRN, or room…' : 'No active residents — enter manually below'}
          aria-label={residents.length > 0 ? 'Search active census residents by name, MRN, or room' : 'No active residents available — enter resident details manually below'}
          className="w-full pl-9 pr-3 py-1.5 border border-neutral-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
          autoComplete="off"
        />
      </div>
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-neutral-200 rounded-md shadow-lg max-h-56 overflow-y-auto">
          {suggestions.map((s, idx) => (
            <li
              key={s.mrn}
              className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${idx === activeIndex ? 'bg-indigo-50' : 'hover:bg-neutral-50'}`}
              onMouseDown={e => { e.preventDefault(); handleSelect(s); }}
              onMouseEnter={() => setActiveIndex(idx)}
            >
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-sm text-neutral-900">{s.displayName}</span>
                {s.unit && <span className="ml-2 text-xs text-neutral-500">{s.unit}{s.room ? ` / ${s.room}` : ''}</span>}
              </div>
              <span className="shrink-0 text-xs text-neutral-400 font-mono">{s.mrn}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

function calcDaysSinceAdmit(admitDate: string | null | undefined, screeningDate: string | null | undefined): number | null {
  if (!admitDate) return null;
  const admit = new Date(admitDate);
  const screen = screeningDate ? new Date(screeningDate) : new Date();
  if (isNaN(admit.getTime()) || isNaN(screen.getTime())) return null;
  const diff = Math.floor((screen.getTime() - admit.getTime()) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff : null;
}

type DraftRecord = Omit<AdmissionScreeningRecord, 'id' | 'createdAt' | 'updatedAt'>;

const EMPTY_DRAFT: DraftRecord = {
  residentId: null,
  mrn: null,
  name: null,
  room: null,
  unit: null,
  admitDate: null,
  screeningDate: new Date().toISOString().split('T')[0],
  daysSinceAdmit: null,
  screeningStatus: 'draft',
  completedBy: null,
  completedByTitle: null,
  notes: null,
  admissionSource: null,
  recentHospitalization: null,
  transferFromFacility: null,
  currentSymptoms: [],
  currentDiagnosis: null,
  isolationStatus: null,
  precautionType: null,
  mdroHistory: null,
  mdroOrganism: null,
  recentAntibiotics: null,
  antibioticDetails: null,
  devicesPresent: [],
  vaccinationReviewed: null,
  vaccinationNotes: null,
  followUpActions: null,
  recommendations: null,
};

const SYMPTOM_OPTIONS = [
  'Fever', 'Cough', 'Shortness of breath', 'Sore throat', 'Runny nose',
  'Nausea / Vomiting', 'Diarrhea', 'Rash', 'Wound drainage', 'Confusion / AMS',
  'Urinary symptoms', 'Other',
];

const DEVICE_OPTIONS = [
  'Urinary catheter', 'PICC', 'Central venous catheter', 'Peripheral IV',
  'Feeding tube', 'Tracheostomy', 'Ventilator', 'Wound VAC', 'Other',
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <div className="bg-neutral-100 px-4 py-2 border-b border-neutral-200 mt-6 first:mt-0">
    <h3 className="text-xs font-bold text-neutral-600 uppercase tracking-wider">{title}</h3>
  </div>
);

const FormRow: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
  <div className="grid grid-cols-3 gap-4 items-start py-2 px-4 border-b border-neutral-100 last:border-b-0">
    <label className="text-sm font-medium text-neutral-700 pt-1">
      {label}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    <div className="col-span-2">{children}</div>
  </div>
);

const TextInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}> = ({ value, onChange, placeholder, readOnly }) => (
  <input
    type="text"
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    readOnly={readOnly}
    className={`w-full border border-neutral-300 rounded-md px-3 py-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500 ${readOnly ? 'bg-neutral-50 text-neutral-500' : ''}`}
  />
);

const DateInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
}> = ({ value, onChange }) => (
  <input
    type="date"
    value={value}
    onChange={e => onChange(e.target.value)}
    className="border border-neutral-300 rounded-md px-3 py-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500"
  />
);

const YesNoSelect: React.FC<{
  value: boolean | null | undefined;
  onChange: (v: boolean | null) => void;
}> = ({ value, onChange }) => (
  <select
    value={value === true ? 'yes' : value === false ? 'no' : ''}
    onChange={e => onChange(e.target.value === 'yes' ? true : e.target.value === 'no' ? false : null)}
    className="border border-neutral-300 rounded-md px-3 py-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500"
  >
    <option value="">— Select —</option>
    <option value="yes">Yes</option>
    <option value="no">No</option>
  </select>
);

const CheckboxGroup: React.FC<{
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}> = ({ options, selected, onChange }) => {
  const toggle = (opt: string) => {
    if (selected.includes(opt)) onChange(selected.filter(s => s !== opt));
    else onChange([...selected, opt]);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <label key={opt} className="inline-flex items-center gap-1 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={selected.includes(opt)}
            onChange={() => toggle(opt)}
            className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
          />
          {opt}
        </label>
      ))}
    </div>
  );
};

const Textarea: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}> = ({ value, onChange, placeholder, rows = 2 }) => (
  <textarea
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    rows={rows}
    className="w-full border border-neutral-300 rounded-md px-3 py-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500 resize-none"
  />
);

// ─── Main Form ────────────────────────────────────────────────────────────────

interface Props {
  record?: AdmissionScreeningRecord | null;
  onSave: (draft: DraftRecord) => void;
  onClose: () => void;
}

const AdmissionScreeningForm: React.FC<Props> = ({ record, onSave, onClose }) => {
  const { store } = useFacilityData();

  const activeResidents: ResidentOption[] = React.useMemo(() => {
    try {
      return Object.values(store.residents || {})
        .filter((r): r is Resident => !!r && isActiveCensusResident(r))
        .map(toResidentOption);
    } catch (err) {
      console.warn('[AdmissionScreeningForm] Failed to load active residents for typeahead:', err);
      return [];
    }
  }, [store.residents]);

  const [draft, setDraft] = useState<DraftRecord>(() => {
    if (record) {
      const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = record;
      return {
        ...EMPTY_DRAFT,
        ...rest,
        currentSymptoms: rest.currentSymptoms ?? [],
        devicesPresent: rest.devicesPresent ?? [],
      };
    }
    return { ...EMPTY_DRAFT };
  });

  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  // Auto-calculate daysSinceAdmit
  useEffect(() => {
    const days = calcDaysSinceAdmit(draft.admitDate, draft.screeningDate);
    setDraft(prev => ({ ...prev, daysSinceAdmit: days }));
  }, [draft.admitDate, draft.screeningDate]);

  const set = useCallback(<K extends keyof DraftRecord>(field: K, value: DraftRecord[K]) => {
    setDraft(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  }, []);

  const handleResidentSelect = useCallback((r: ResidentOption) => {
    setDraft(prev => ({
      ...prev,
      residentId: r.mrn || null,
      name: r.displayName || prev.name,
      mrn: r.mrn || null,
      room: r.room ?? prev.room,
      unit: r.unit ?? prev.unit,
      admitDate: r.admissionDate ?? prev.admitDate,
    }));
    setSaved(false);
  }, []);

  const validate = (): boolean => {
    const errs: string[] = [];
    if (!draft.name?.trim()) errs.push('Resident name is required.');
    if (!draft.screeningDate) errs.push('Screening date is required.');
    setErrors(errs);
    return errs.length === 0;
  };

  const handleSave = (status: 'draft' | 'completed') => {
    if (!validate()) return;
    onSave({ ...draft, screeningStatus: status });
    setSaved(true);
  };

  const isLate = (draft.daysSinceAdmit ?? 0) > MAX_SCREENING_DAYS && draft.admitDate;

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 overflow-y-auto print:static print:inset-auto print:bg-transparent print:p-0 print:block">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[95vh] overflow-hidden flex flex-col print:shadow-none print:max-h-none print:rounded-none print:w-full">

        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-indigo-50 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-indigo-900">IP Admission Screening Form</h2>
            <p className="text-xs text-indigo-600 mt-0.5">Complete within 72 hours of admission</p>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 print:overflow-visible">

          {/* Alerts */}
          {errors.length > 0 && (
            <div className="mx-4 mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex gap-2 items-start">
              <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <div className="space-y-0.5">
                {errors.map((e, i) => <p key={i} className="text-sm text-red-700">{e}</p>)}
              </div>
            </div>
          )}

          {isLate && (
            <div className="mx-4 mt-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 flex gap-2 items-center text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Screening is being completed {draft.daysSinceAdmit} day{(draft.daysSinceAdmit ?? 0) !== 1 ? 's' : ''} after admission (more than 72 hours).
            </div>
          )}

          {saved && (
            <div className="mx-4 mt-3 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 flex gap-2 items-center text-sm text-emerald-800">
              <CheckCircle className="w-4 h-4 shrink-0" />
              Saved successfully.
            </div>
          )}

          {/* Section 1: Resident Header */}
          <div className="border border-neutral-200 rounded-lg mx-4 mt-4 overflow-hidden">
            <SectionHeader title="Resident Information" />
            <FormRow label="Search Census">
              <div className="print:hidden">
                <ResidentSearchInput
                  residents={activeResidents}
                  onSelect={handleResidentSelect}
                />
              </div>
              {draft.residentId && (
                <div className="mt-1 flex items-center gap-2 print:hidden">
                  <span className="text-xs text-indigo-600 font-medium">Linked: {draft.name ?? draft.residentId}</span>
                  <button
                    type="button"
                    onClick={() => { set('residentId', null); }}
                    className="text-xs text-neutral-400 hover:text-red-500 underline"
                  >
                    Clear
                  </button>
                </div>
              )}
            </FormRow>
            <FormRow label="Resident Name" required>
              <TextInput value={draft.name ?? ''} onChange={v => set('name', v || null)} placeholder="Full name" />
            </FormRow>
            <FormRow label="MRN">
              <TextInput value={draft.mrn ?? ''} onChange={v => set('mrn', v || null)} placeholder="Medical record number" />
            </FormRow>
            <div className="grid grid-cols-2">
              <FormRow label="Room">
                <TextInput value={draft.room ?? ''} onChange={v => set('room', v || null)} placeholder="Room number" />
              </FormRow>
              <FormRow label="Unit">
                <TextInput value={draft.unit ?? ''} onChange={v => set('unit', v || null)} placeholder="Unit name" />
              </FormRow>
            </div>
            <div className="grid grid-cols-2">
              <FormRow label="Admission Date">
                <DateInput value={draft.admitDate ?? ''} onChange={v => set('admitDate', v || null)} />
              </FormRow>
              <FormRow label="Screening Date" required>
                <DateInput value={draft.screeningDate ?? ''} onChange={v => set('screeningDate', v || null)} />
              </FormRow>
            </div>
            <FormRow label="Days Since Admission">
              <TextInput
                value={draft.daysSinceAdmit !== null && draft.daysSinceAdmit !== undefined ? String(draft.daysSinceAdmit) : '—'}
                onChange={() => undefined}
                readOnly
              />
            </FormRow>
            <div className="grid grid-cols-2">
              <FormRow label="Completed By">
                <TextInput value={draft.completedBy ?? ''} onChange={v => set('completedBy', v || null)} placeholder="Clinician name" />
              </FormRow>
              <FormRow label="Title / Role">
                <TextInput value={draft.completedByTitle ?? ''} onChange={v => set('completedByTitle', v || null)} placeholder="RN, LVN, DON…" />
              </FormRow>
            </div>
          </div>

          {/* Section 2: Admission Source */}
          <div className="border border-neutral-200 rounded-lg mx-4 mt-4 overflow-hidden">
            <SectionHeader title="Admission Source & Transfer Information" />
            <FormRow label="Admission Source">
              <select
                value={draft.admissionSource ?? ''}
                onChange={e => set('admissionSource', e.target.value || null)}
                className="border border-neutral-300 rounded-md px-3 py-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500 w-full"
              >
                <option value="">— Select —</option>
                <option>Home</option>
                <option>Hospital</option>
                <option>Other SNF/LTC</option>
                <option>Rehab facility</option>
                <option>Assisted living</option>
                <option>Other</option>
              </select>
            </FormRow>
            <FormRow label="Recent hospitalization (≤30 days)">
              <YesNoSelect value={draft.recentHospitalization} onChange={v => set('recentHospitalization', v)} />
            </FormRow>
            <FormRow label="Transfer from another facility">
              <YesNoSelect value={draft.transferFromFacility} onChange={v => set('transferFromFacility', v)} />
            </FormRow>
          </div>

          {/* Section 3: Current Infection / Symptoms */}
          <div className="border border-neutral-200 rounded-lg mx-4 mt-4 overflow-hidden">
            <SectionHeader title="Current Infection Symptoms or Diagnosis" />
            <FormRow label="Current symptoms">
              <CheckboxGroup
                options={SYMPTOM_OPTIONS}
                selected={draft.currentSymptoms ?? []}
                onChange={v => set('currentSymptoms', v)}
              />
            </FormRow>
            <FormRow label="Current diagnosis / condition">
              <TextInput value={draft.currentDiagnosis ?? ''} onChange={v => set('currentDiagnosis', v || null)} placeholder="e.g., UTI, cellulitis, pneumonia" />
            </FormRow>
          </div>

          {/* Section 4: Isolation / Precautions */}
          <div className="border border-neutral-200 rounded-lg mx-4 mt-4 overflow-hidden">
            <SectionHeader title="Isolation / Precaution Status on Admission" />
            <FormRow label="Isolation status on admission">
              <select
                value={draft.isolationStatus ?? ''}
                onChange={e => set('isolationStatus', e.target.value || null)}
                className="border border-neutral-300 rounded-md px-3 py-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500 w-full"
              >
                <option value="">— Select —</option>
                <option>None</option>
                <option>Contact precautions</option>
                <option>Droplet precautions</option>
                <option>Airborne precautions</option>
                <option>Enhanced Contact precautions</option>
                <option>Standard + Contact</option>
                <option>Standard + Droplet</option>
              </select>
            </FormRow>
            <FormRow label="Precaution type / reason">
              <TextInput value={draft.precautionType ?? ''} onChange={v => set('precautionType', v || null)} placeholder="e.g., MRSA, C. diff, COVID-19" />
            </FormRow>
          </div>

          {/* Section 5: MDRO History */}
          <div className="border border-neutral-200 rounded-lg mx-4 mt-4 overflow-hidden">
            <SectionHeader title="MDRO / Resistant Organism History" />
            <FormRow label="Known MDRO history">
              <YesNoSelect value={draft.mdroHistory} onChange={v => set('mdroHistory', v)} />
            </FormRow>
            {draft.mdroHistory && (
              <FormRow label="MDRO organism(s)">
                <TextInput value={draft.mdroOrganism ?? ''} onChange={v => set('mdroOrganism', v || null)} placeholder="e.g., MRSA, VRE, CRE, C. diff" />
              </FormRow>
            )}
          </div>

          {/* Section 6: Recent Antibiotics */}
          <div className="border border-neutral-200 rounded-lg mx-4 mt-4 overflow-hidden">
            <SectionHeader title="Recent Antibiotic / Anti-Infective Exposure" />
            <FormRow label="Recent antibiotics (≤90 days)">
              <YesNoSelect value={draft.recentAntibiotics} onChange={v => set('recentAntibiotics', v)} />
            </FormRow>
            {draft.recentAntibiotics && (
              <FormRow label="Antibiotic details">
                <TextInput value={draft.antibioticDetails ?? ''} onChange={v => set('antibioticDetails', v || null)} placeholder="Medication, indication, duration" />
              </FormRow>
            )}
          </div>

          {/* Section 7: Devices */}
          <div className="border border-neutral-200 rounded-lg mx-4 mt-4 overflow-hidden">
            <SectionHeader title="Devices / Treatments Present on Admission" />
            <FormRow label="Medical devices present">
              <CheckboxGroup
                options={DEVICE_OPTIONS}
                selected={draft.devicesPresent ?? []}
                onChange={v => set('devicesPresent', v)}
              />
            </FormRow>
          </div>

          {/* Section 8: Vaccination */}
          <div className="border border-neutral-200 rounded-lg mx-4 mt-4 overflow-hidden">
            <SectionHeader title="Vaccination / Prevention Review" />
            <FormRow label="Vaccination history reviewed">
              <YesNoSelect value={draft.vaccinationReviewed} onChange={v => set('vaccinationReviewed', v)} />
            </FormRow>
            <FormRow label="Vaccination notes">
              <Textarea value={draft.vaccinationNotes ?? ''} onChange={v => set('vaccinationNotes', v || null)} placeholder="Flu, pneumococcal, COVID-19, RSV status…" />
            </FormRow>
          </div>

          {/* Section 9: Follow-up */}
          <div className="border border-neutral-200 rounded-lg mx-4 mt-4 overflow-hidden">
            <SectionHeader title="Follow-Up Actions & Recommendations" />
            <FormRow label="Follow-up actions">
              <Textarea value={draft.followUpActions ?? ''} onChange={v => set('followUpActions', v || null)} placeholder="Cultures ordered, isolation placed, notifications…" rows={3} />
            </FormRow>
            <FormRow label="IC recommendations">
              <Textarea value={draft.recommendations ?? ''} onChange={v => set('recommendations', v || null)} placeholder="Infection prevention recommendations…" rows={3} />
            </FormRow>
            <FormRow label="Additional notes">
              <Textarea value={draft.notes ?? ''} onChange={v => set('notes', v || null)} rows={2} />
            </FormRow>
          </div>

          <div className="h-6" />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-200 flex items-center justify-end gap-3 bg-neutral-50 shrink-0 print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-neutral-300 rounded-md hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 text-sm border border-neutral-300 text-neutral-600 rounded-md hover:bg-neutral-50 inline-flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
          <button
            onClick={() => handleSave('draft')}
            className="px-4 py-2 text-sm border border-indigo-300 text-indigo-700 rounded-md hover:bg-indigo-50"
          >
            Save as Draft
          </button>
          <button
            onClick={() => handleSave('completed')}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Mark Complete
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdmissionScreeningForm;
