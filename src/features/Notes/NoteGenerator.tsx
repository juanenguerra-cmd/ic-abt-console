import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useFacilityData } from '../../app/providers';
import { Resident, ABTCourse, IPEvent } from '../../domain/models';
import { FileText, Copy, CheckSquare, Download } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { formatDateLikeForDisplay, todayLocalDateInputValue } from '../../lib/dateUtils';
import { exportPdfDocument } from '../../pdf/exportPdf';

// --- Note Configuration System ---

interface NoteOption {
  id: string;
  label: string;
  defaultChecked: boolean;
}

interface NoteConfig {
  id: string;
  label: string;
  options: NoteOption[];
  generate: (resident: Resident, store: any, selectedOptions: Set<string>) => string;
}

const getAge = (dob?: string): string => {
  if (!dob) return '[Age]';
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return String(age);
};

const getDaysDiff = (start: string, end: string = new Date().toISOString()): number => {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return Math.max(1, Math.ceil((e - s) / (1000 * 60 * 60 * 24)));
};

const NOTE_CONFIGS: Record<string, NoteConfig> = {
  ABT_STEWARDSHIP: {
    id: 'ABT_STEWARDSHIP',
    label: 'ABT Stewardship',
    options: [
      { id: 'identifiers', label: 'Include resident identifiers', defaultChecked: true },
      { id: 'location', label: 'Include room / unit', defaultChecked: true },
      { id: 'allergies', label: 'Include allergies', defaultChecked: true },
      { id: 'activeAbt', label: 'Include active antibiotic & day count', defaultChecked: true },
      { id: 'indication', label: 'Include indication / syndrome', defaultChecked: true },
      { id: 'culture', label: 'Include culture / organism info', defaultChecked: true },
      { id: 'adverseEffects', label: 'Include adverse effects monitoring', defaultChecked: false },
      { id: 'providerComm', label: 'Include provider communication', defaultChecked: false },
      { id: 'response', label: 'Include response / tolerance', defaultChecked: false },
      { id: 'followUp', label: 'Include follow-up plan', defaultChecked: false },
    ],
    generate: (resident, store, opts) => {
      const parts: string[] = [];
      const today = new Date().toLocaleDateString();
      
      parts.push(`On ${today}, antibiotic stewardship review completed`);

      if (opts.has('identifiers')) {
        parts.push(`for ${resident.displayName}, ${getAge(resident.dob)} ${resident.sex || '[Sex]'} | MRN: ${resident.mrn}`);
      } else {
        parts.push(`for resident`);
      }

      if (opts.has('location')) {
        parts.push(`residing in ${resident.currentUnit || '[Unit]'}/${resident.currentRoom || '[Room]'}`);
      }

      parts.push('.');

      const activeAbt = (Object.values(store.abts) as ABTCourse[]).find(a => a.residentRef.id === resident.mrn && a.status === 'active');

      if (opts.has('activeAbt')) {
        if (activeAbt) {
          const medDetail = `${activeAbt.medication}${activeAbt.route ? ` ${activeAbt.route}` : ''}${activeAbt.frequency ? ` ${activeAbt.frequency}` : ''}`;
          const dayCount = activeAbt.startDate ? getDaysDiff(activeAbt.startDate) : '[#]';
          parts.push(`\nCurrent antibiotic therapy includes ${medDetail} initiated on ${activeAbt.startDate ? formatDateLikeForDisplay(activeAbt.startDate) : '[Start Date]'}. Current day of therapy is ${dayCount}.`);
          if (activeAbt.endDate) {
            parts.push(` Expected stop date is ${formatDateLikeForDisplay(activeAbt.endDate)}.`);
          }
        } else {
          parts.push(`\n[No active antibiotic record found for this resident.]`);
        }
      }

      if (opts.has('indication') && activeAbt) {
        parts.push(`\nIndication: ${activeAbt.indication || '[Indication]'} / ${activeAbt.syndromeCategory || '[Syndrome]'}. Infection source: ${activeAbt.infectionSource || '[Source]'}.`);
      }

      if (opts.has('culture') && activeAbt) {
        parts.push(`\nCulture status: ${activeAbt.cultureCollected ? 'Collected' : 'Not collected'}.`);
        if (activeAbt.organismIdentified) {
          parts.push(` Organism/Sensitivities: ${activeAbt.organismIdentified}.`);
        }
      }

      if (opts.has('allergies')) {
        const allergies = resident.allergies && resident.allergies.length > 0 ? resident.allergies.join(', ') : 'No Known Allergies';
        parts.push(`\nAllergies reviewed: ${allergies}.`);
      }

      if (opts.has('adverseEffects')) {
        parts.push(`\nMonitoring for adverse effects (e.g., C. difficile risk, rash, GI upset, renal injury): [None noted / Describe findings].`);
      }

      if (opts.has('response')) {
        parts.push(`\nClinical response assessed as [improving/stable/worsening].`);
      }

      if (opts.has('providerComm')) {
        parts.push(`\nCommunication completed with [Provider Name]. Plan is to [continue/modify/stop] antibiotics.`);
      }

      if (opts.has('followUp')) {
        parts.push(`\nFollow-up plan: [Reassess in 48-72h / Follow up on pending cultures by Date].`);
      }

      return parts.join('');
    }
  },
  INFECTION_REVIEW: {
    id: 'INFECTION_REVIEW',
    label: 'Infection Review',
    options: [
      { id: 'identifiers', label: 'Include resident identifiers', defaultChecked: true },
      { id: 'location', label: 'Include room / unit', defaultChecked: true },
      { id: 'infectionDetails', label: 'Include infection category & organism', defaultChecked: true },
      { id: 'symptoms', label: 'Include current symptoms', defaultChecked: true },
      { id: 'vitals', label: 'Include vitals', defaultChecked: false },
      { id: 'diagnostics', label: 'Include diagnostics', defaultChecked: true },
      { id: 'isolation', label: 'Include current isolation status', defaultChecked: true },
      { id: 'notifications', label: 'Include notifications (Provider/Family)', defaultChecked: false },
      { id: 'followUp', label: 'Include follow-up plan', defaultChecked: false },
    ],
    generate: (resident, store, opts) => {
      const parts: string[] = [];
      const today = new Date().toLocaleDateString();
      
      parts.push(`On ${today}, infection surveillance completed`);

      if (opts.has('identifiers')) {
        parts.push(`for ${resident.displayName}, ${getAge(resident.dob)} ${resident.sex || '[Sex]'}`);
      } else {
        parts.push(`for resident`);
      }

      if (opts.has('location')) {
        parts.push(` residing in ${resident.currentUnit || '[Unit]'}/${resident.currentRoom || '[Room]'}`);
      }

      parts.push('.');

      const activeIp = (Object.values(store.infections) as IPEvent[]).find(i => i.residentRef.id === resident.mrn && i.status === 'active');

      if (opts.has('infectionDetails')) {
        if (activeIp) {
          parts.push(`\nTracking active event: ${activeIp.infectionCategory || '[Category]'}.`);
          if (activeIp.organism) {
            parts.push(` Organism/Reason: ${activeIp.organism}.`);
          }
        } else {
          parts.push(`\n[No active infection prevention event found for this resident.]`);
        }
      }

      if (opts.has('symptoms')) {
        parts.push(`\nResident presentation included [symptoms] with onset [date/time]. Assessment using [McGeer/Loeb/clinical criteria]: findings [meet/do not meet] criteria.`);
      }

      if (opts.has('vitals')) {
        parts.push(`\nCurrent vitals: [T, BP, HR, RR, O2 sat]. Baseline status compared: [none/yes—describe].`);
      }

      if (opts.has('diagnostics')) {
        parts.push(`\nDiagnostics: [labs/imaging/cultures] with results [summary]; pending: [list].`);
      }

      if (opts.has('isolation')) {
        if (activeIp && activeIp.isolationType) {
          parts.push(`\nPrecautions: Resident is currently on ${activeIp.isolationType} precautions. Signage, PPE, and staff compliance [adequate/addressed].`);
        } else {
          parts.push(`\nPrecautions: Resident is on [standard/contact/droplet/airborne] precautions due to [reason]. Signage, PPE, and staff compliance [adequate/addressed].`);
        }
      }

      if (opts.has('notifications')) {
        parts.push(`\nNotifications made to [provider], [DON/ADON], and [family/POA if indicated].`);
      }

      if (opts.has('followUp')) {
        parts.push(`\nFollow-up on [date] to reassess symptoms, results, and isolation/treatment need.`);
      }

      return parts.join('');
    }
  },
  ADMISSION_SCREENING: {
    id: 'ADMISSION_SCREENING',
    label: 'Admission Screening',
    options: [
      { id: 'identifiers', label: 'Include resident identifiers', defaultChecked: true },
      { id: 'admissionDetails', label: 'Include admission date & diagnosis', defaultChecked: true },
      { id: 'allergies', label: 'Include allergies', defaultChecked: true },
      { id: 'isolation', label: 'Include isolation on admission', defaultChecked: true },
      { id: 'devices', label: 'Include device review', defaultChecked: true },
      { id: 'vaccines', label: 'Include vaccine offer status', defaultChecked: true },
      { id: 'education', label: 'Include education provided', defaultChecked: false },
      { id: 'safety', label: 'Include safety measures', defaultChecked: false },
    ],
    generate: (resident, store, opts) => {
      const parts: string[] = [];
      
      parts.push(`Admission infection prevention screening completed`);

      if (opts.has('identifiers')) {
        parts.push(` for ${resident.displayName}, a ${getAge(resident.dob)}-year-old ${resident.sex || '[Sex]'}`);
      } else {
        parts.push(` for resident`);
      }

      if (opts.has('admissionDetails')) {
        const admDate = resident.admissionDate ? formatDateLikeForDisplay(resident.admissionDate) : '[Admission Date]';
        parts.push(` admitted on ${admDate}. Primary diagnosis: ${resident.primaryDiagnosis || '[Primary Dx]'}.`);
      } else {
        parts.push(`.`);
      }

      if (opts.has('allergies')) {
        const allergies = resident.allergies && resident.allergies.length > 0 ? resident.allergies.join(', ') : 'No Known Allergies';
        parts.push(`\nAllergy history: ${allergies}.`);
      }

      if (opts.has('isolation')) {
        const admissionIp = (Object.values(store.infections) as IPEvent[]).find(i => i.residentRef.id === resident.mrn);
        const iso = admissionIp?.isolationType || 'none';
        parts.push(`\nIsolation on admission: ${iso}. MDRO history: [MRSA/VRE/ESBL/CRE/C. auris—known/unknown].`);
      }

      if (opts.has('devices')) {
        parts.push(`\nDevices: [Foley/suprapubic/trach/central line/PICC/dialysis access/feeding tube/wound vac/ostomy/oxygen/none]. Skin/wound: [intact / wounds—location/type/stage].`);
      }

      if (opts.has('vaccines')) {
        parts.push(`\nVaccines reviewed: Influenza [accepted/declined/unknown], Pneumococcal [same], RSV [same], COVID-19 [same]. Plan to administer on [date] or re-offer on [date].`);
      }

      if (opts.has('education')) {
        parts.push(`\nEducation provided via [teach-back/verbal/written]: [understood/needs reinforcement]. Cognition: [alert/oriented x__ / confused / dementia].`);
      }

      if (opts.has('safety')) {
        parts.push(`\nSafety measures: [fall precautions/call bell/bed alarm/hand hygiene coaching/respiratory etiquette].`);
      }

      parts.push(`\nPlan: continue admission monitoring, follow pending records/results, update precautions per clinical course.`);

      return parts.join('');
    }
  },
  VACCINATION_OFFER: {
    id: 'VACCINATION_OFFER',
    label: 'Vaccination Offer',
    options: [
      { id: 'identifiers', label: 'Include resident identifiers', defaultChecked: true },
      { id: 'location', label: 'Include room / unit', defaultChecked: true },
      { id: 'vaccineStatus', label: 'Include vaccine status (Accept/Decline)', defaultChecked: true },
      { id: 'education', label: 'Include education provided', defaultChecked: true },
      { id: 'consent', label: 'Include consent status', defaultChecked: true },
      { id: 'adminPlan', label: 'Include administration plan', defaultChecked: true },
      { id: 'monitoring', label: 'Include monitoring plan', defaultChecked: false },
    ],
    generate: (resident, store, opts) => {
      const parts: string[] = [];
      const today = new Date().toLocaleDateString();
      
      parts.push(`On ${today},`);

      if (opts.has('identifiers')) {
        parts.push(` ${resident.displayName}, a ${getAge(resident.dob)}-year-old ${resident.sex || '[Sex]'}`);
      } else {
        parts.push(` resident`);
      }

      if (opts.has('location')) {
        parts.push(` residing in ${resident.currentUnit || '[Unit]'}/${resident.currentRoom || '[Room]'}`);
      }

      parts.push(`, was offered vaccines per facility schedule and eligibility review.`);

      if (opts.has('vaccineStatus')) {
        parts.push(`\nVaccines offered: Influenza [accepted/declined/contraindicated], Pneumococcal [accepted/declined/contraindicated], RSV [accepted/declined/contraindicated], COVID-19 [accepted/declined/contraindicated].`);
      }

      if (opts.has('education')) {
        parts.push(`\nEducation provided on purpose and benefits (reduced risk of severe illness, hospitalization) and risks/side effects (injection-site soreness, fatigue/fever, allergic reaction warning signs).`);
      }

      if (opts.has('consent')) {
        parts.push(`\nResident/POA demonstrated understanding by [teach-back statement] and decision was [consent given/refused/requested more time]. Consent documented in [EMR/consent form].`);
      }

      if (opts.has('adminPlan')) {
        parts.push(`\nPlan is to administer [vaccines] on [date/time] or re-offer on [date].`);
      }

      if (opts.has('monitoring')) {
        parts.push(`\nWill monitor for adverse reactions per protocol and update immunization record accordingly.`);
      }

      return parts.join('');
    }
  }
};

type NoteType = keyof typeof NOTE_CONFIGS;

export const NoteGenerator: React.FC = () => {
  const { store } = useFacilityData();
  const [searchParams] = useSearchParams();

  const [selectedMrn, setSelectedMrn] = useState<string>('');
  const [noteType, setNoteType] = useState<NoteType>('ABT_STEWARDSHIP');
  const [noteContent, setNoteContent] = useState('');
  const [copied, setCopied] = useState(false);
  
  // Track selected options for the current note type
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize options when note type changes
  useEffect(() => {
    const config = NOTE_CONFIGS[noteType];
    if (config) {
      const defaults = new Set(config.options.filter(o => o.defaultChecked).map(o => o.id));
      setSelectedOptions(defaults);
    }
  }, [noteType]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [noteContent]);

  const highlightedNote = useMemo(() => {
    if (!noteContent) return '';
    const escaped = noteContent
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return escaped.replace(
      /\[[^\]]+\]/g,
      '<mark style="background-color:rgba(251,191,36,0.4);border-radius:2px;color:transparent">$&</mark>',
    );
  }, [noteContent]);

  React.useEffect(() => {
    const mrn = searchParams.get('mrn');
    const incomingType = searchParams.get('noteType');
    if (mrn && store.residents[mrn]) setSelectedMrn(mrn);
    if (incomingType && incomingType in NOTE_CONFIGS) setNoteType(incomingType as NoteType);
  }, [searchParams, store.residents]);

  const residents = useMemo(
    () =>
      (Object.values(store.residents) as Resident[])
        .filter(r => !r.isHistorical && !r.backOfficeOnly)
        .sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })),
    [store.residents],
  );

  const toggleOption = (id: string) => {
    const next = new Set(selectedOptions);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedOptions(next);
  };

  const generateNote = () => {
    if (!selectedMrn) {
      alert('Please select a resident.');
      return;
    }

    const resident = store.residents[selectedMrn];
    if (!resident) return;

    const config = NOTE_CONFIGS[noteType];
    if (!config) return;

    const generatedNote = config.generate(resident, store, selectedOptions);
    setNoteContent(generatedNote);
  };

  const handleCopy = async () => {
    if (!noteContent.trim()) return;
    try {
      await navigator.clipboard.writeText(noteContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert('Unable to copy to clipboard. Please copy the note manually.');
    }
  };

  const handleExportPdf = () => {
    if (!noteContent.trim()) return;
    const resident = selectedMrn ? store.residents[selectedMrn] : null;
    const title = currentConfig?.label || 'Progress Note';
    const residentName = resident?.displayName || 'Resident';
    const today = formatDateLikeForDisplay(todayLocalDateInputValue());
    // Split the note into lines for the PDF text section
    const noteLines = noteContent.split('\n');
    exportPdfDocument({
      title,
      orientation: 'portrait',
      template: 'PORTRAIT_TEMPLATE_V1',
      subtitleLines: [`Resident: ${residentName}`, `Date: ${today}`],
      sections: [
        {
          type: 'text',
          lines: noteLines,
        },
      ],
      filename: `${title.replace(/\s+/g, '_')}_${residentName.replace(/\s+/g, '_')}_${today.replace(/\//g, '-')}.pdf`,
      showSignatureLines: true,
    });
  };

  const currentConfig = NOTE_CONFIGS[noteType];

  return (
    <div className="p-6 bg-neutral-100 h-full overflow-y-auto">
      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 flex flex-col min-h-full">
        <div className="px-6 py-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-50">
          <h2 className="text-xl font-bold text-neutral-900">Automated Progress Note Generator</h2>
        </div>

        <div className="p-6 space-y-6 flex-1 flex flex-col">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                {Object.values(NOTE_CONFIGS).map(config => (
                  <option key={config.id} value={config.id}>{config.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Checkbox Options */}
          {currentConfig && (
            <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200">
              <h3 className="text-sm font-semibold text-neutral-800 mb-3 flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-indigo-600" />
                Include in Note
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {currentConfig.options.map(opt => (
                  <label key={opt.id} className="flex items-start gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedOptions.has(opt.id)}
                      onChange={() => toggleOption(opt.id)}
                      className="mt-0.5 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-neutral-700 group-hover:text-neutral-900 select-none">
                      {opt.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={generateNote}
              disabled={!selectedMrn}
              className="flex items-center justify-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-neutral-300 text-sm font-medium transition-colors"
            >
              <FileText className="w-4 h-4" />
              Generate Note
            </button>
          </div>

          <div className="flex flex-col flex-1">
            <label className="block text-sm font-medium text-neutral-700 mb-1">Note Content</label>
            <div className="relative rounded-md border border-neutral-300 focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500 flex-1 flex flex-col min-h-[300px]">
              <div
                aria-hidden="true"
                className="absolute inset-0 p-3 text-sm font-mono whitespace-pre-wrap break-words pointer-events-none select-none overflow-hidden"
                style={{ color: 'transparent' }}
                dangerouslySetInnerHTML={{ __html: highlightedNote + ' ' }}
              />
              <textarea
                ref={textareaRef}
                value={noteContent}
                onChange={e => setNoteContent(e.target.value)}
                className="relative w-full flex-1 border-0 focus:ring-0 focus:outline-none rounded-md p-3 text-sm font-mono bg-transparent resize-none overflow-y-auto"
                placeholder="Generated note will appear here..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={handleExportPdf}
              disabled={!noteContent.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-700 text-white rounded-md hover:bg-neutral-800 disabled:bg-neutral-300 text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Export PDF
            </button>
            <button
              onClick={handleCopy}
              disabled={!noteContent.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-neutral-300 text-sm font-medium transition-colors"
            >
              <Copy className="w-4 h-4" />
              {copied ? 'Copied!' : 'Copy to Clipboard'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
