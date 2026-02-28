import React, { useState, useMemo } from 'react';
import { useDatabase, useFacilityData } from '../../app/providers';
import { Resident, ABTCourse, IPEvent } from '../../domain/models';
import { FileText, Copy } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

const NOTE_TEMPLATES = {
  ABT_STEWARDSHIP: `On [Today], antibiotic stewardship review completed for [displayName], [Age] [Sex] | MRN: [mrn] | Location: [currentUnit]/[currentRoom]. Current antibiotic therapy includes [medication, dose, route, frequency] initiated on [startDate] for [indication/syndromeCategory] with [infectionSource/site]. Indication reviewed against available clinical data including symptoms ([symptoms]), vital signs, and pertinent results ([UA/UCx, CXR, CBC, wound culture]) with culture status noted as [cultureStatus] and organism/susceptibilities: [organism; sensitivities]. Current day of therapy is [#] with planned duration [# days] and expected stop date [endDate]; renal/hepatic considerations reviewed ([SCr/CrCl], allergies, interactions) and dose is [appropriate/adjusted to new dose] due to [reason]. Clinical response assessed as [improving/stable/worsening]. Stewardship actions: [de-escalate/discontinue/IV-to-PO/narrow spectrum/obtain cultures/reassess in 48-72h]. Communication completed with [provider], [pharmacy/ID/NP], and nursing; plan is to [continue/modify/stop] antibiotics, monitor for adverse effects ([C. difficile risk, rash, GI upset, QT prolongation, renal injury]), and follow up on [pending labs/cultures] by [date/time].`,
  INFECTION_REVIEW: `On [Today], infection surveillance completed for [displayName], [Age] [Sex] | Location: [currentUnit]/[currentRoom], related to [suspected/confirmed infection type]. Resident presentation included [symptoms] with onset [date/time] and current vitals [T, BP, HR, RR, O2 sat]; baseline status compared: [none/yes—describe]. Assessment using [McGeer/Loeb/clinical criteria]: findings [meet/do not meet] criteria because [rationale]. Diagnostics: [labs/imaging/cultures] with results [summary]; pending: [list]. Treatment plan: [antibiotics/antivirals/supportive care] and non-pharmacologic measures [hydration, wound care, pulmonary hygiene]. Precautions: resident is on [standard/contact/droplet/airborne] precautions due to [reason/organism]; signage, PPE, and staff compliance [adequate/addressed]. Notifications to [provider], [DON/ADON], [family/POA if indicated]; documented in [line list/EMR log]. Follow-up on [date] to reassess symptoms, results, and isolation/treatment need.`,
  ADMISSION_SCREENING: `Admission infection prevention screening completed for [displayName], a [Age]-year-old [Sex] admitted on [admissionDate]. Primary diagnosis: [primaryDx]; secondary diagnoses: [secondaryDx list]. Cognition: [alert/oriented x__ / confused / dementia—stage]; ability to follow IP instructions: [independent/needs cues/limited]; education via [teach-back/verbal/written]: [understood/needs reinforcement]. Isolation on admission: [none / contact/droplet/airborne for reason]; MDRO history: [MRSA/VRE/ESBL/CRE/C. auris—known/unknown]; screens ordered: [type/date]. Antibiotics on admission: [none / drug, dose, route, indication, start, planned duration]; allergy history: [allergies]. Devices: [Foley/suprapubic/trach/central line/PICC/dialysis access/feeding tube/wound vac/ostomy/oxygen]; device care plan initiated. Skin/wound: [intact / wounds—location/type/stage]. Vaccines offered: Influenza [accepted/declined/contraindicated/unknown], Pneumococcal [same], RSV [same], COVID-19 [same]; risks/benefits reviewed; decision documented; plan to administer on [date] or re-offer on [date]. Pain medication review: [regimen]; education on [sedation/constipation/falls/respiratory depression/interactions]; response: [resident response]. Safety measures: [fall precautions/call bell/bed alarm/non-skid footwear/safe transfer/aspiration precautions/hand hygiene coaching/respiratory etiquette]; PPE available, isolation cart [if needed]. Plan: continue admission monitoring, follow pending records/results, reinforce education, update precautions/treatment per clinical course.`,
  VACCINATION_OFFER: `On [Today], [displayName], a [Age]-year-old [Sex] residing in [currentUnit]/[currentRoom], was offered the following vaccines per facility schedule and eligibility review: Influenza [accepted/declined/contraindicated], Pneumococcal [accepted/declined/contraindicated], RSV [accepted/declined/contraindicated], and COVID-19 [accepted/declined/contraindicated]. Education provided on purpose and benefits (reduced risk of severe illness, hospitalization, and complications) and risks/side effects (injection-site soreness, fatigue/fever, allergic reaction warning signs, and when to seek medical attention). Resident/POA demonstrated understanding by [teach-back statement] and decision was [consent given/refused/requested more time]; consent documented in [EMR/consent form]. Plan is to administer [vaccines] on [date/time] or re-offer on [date], monitor for adverse reactions per protocol, and update immunization record accordingly.`,
};

type NoteType = keyof typeof NOTE_TEMPLATES;

const getAge = (dob?: string): string => {
  if (!dob) return '[Age]';
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return String(age);
};

export const NoteGenerator: React.FC = () => {
  const { store } = useFacilityData();
  const [searchParams] = useSearchParams();

  const [selectedMrn, setSelectedMrn] = useState<string>('');
  const [noteType, setNoteType] = useState<NoteType>('ABT_STEWARDSHIP');
  const [noteContent, setNoteContent] = useState('');
  const [copied, setCopied] = useState(false);

  React.useEffect(() => {
    const mrn = searchParams.get('mrn');
    const incomingType = searchParams.get('noteType');
    if (mrn && store.residents[mrn]) setSelectedMrn(mrn);
    if (incomingType && incomingType in NOTE_TEMPLATES) setNoteType(incomingType as NoteType);
  }, [searchParams, store.residents]);

  const residents = (Object.values(store.residents) as Resident[]).filter(r => !r.isHistorical && !r.backOfficeOnly);

  const generateNote = () => {
    if (!selectedMrn) {
      alert('Please select a resident.');
      return;
    }

    const resident = store.residents[selectedMrn];
    if (!resident) return;

    let generatedNote = NOTE_TEMPLATES[noteType];

    const today = new Date().toLocaleDateString();
    const age = getAge(resident.dob);
    const sex = resident.sex || '[Sex]';

    generatedNote = generatedNote.replace(/\[Today\]/g, today);
    generatedNote = generatedNote.replace(/\[displayName\]/g, resident.displayName);
    generatedNote = generatedNote.replace(/\[Age\]/g, age);
    generatedNote = generatedNote.replace(/\[Sex\]/g, sex);
    generatedNote = generatedNote.replace(/\[mrn\]/g, resident.mrn);
    generatedNote = generatedNote.replace(/\[currentUnit\]/g, resident.currentUnit || '[Unit]');
    generatedNote = generatedNote.replace(/\[currentRoom\]/g, resident.currentRoom || '[Room]');
    generatedNote = generatedNote.replace(/\[admissionDate\]/g, resident.admissionDate ? new Date(resident.admissionDate).toLocaleDateString() : '[Admission Date]');
    generatedNote = generatedNote.replace(/\[primaryDx\]/g, resident.primaryDiagnosis || '[Primary Dx]');
    generatedNote = generatedNote.replace(/\[allergies\]/g, resident.allergies?.join(', ') || '[Allergies]');

    if (noteType === 'ABT_STEWARDSHIP') {
      const activeAbt = (Object.values(store.abts) as ABTCourse[]).find(a => a.residentRef.id === selectedMrn && a.status === 'active');
      if (activeAbt) {
        const medDetail = `${activeAbt.medication}${activeAbt.route ? ` ${activeAbt.route}` : ''}${activeAbt.frequency ? ` ${activeAbt.frequency}` : ''}`;
        generatedNote = generatedNote.replace(/\[medication, dose, route, frequency\]/g, medDetail);
        generatedNote = generatedNote.replace(/\[startDate\]/g, activeAbt.startDate || '[Start Date]');
        generatedNote = generatedNote.replace(/\[indication\/syndromeCategory\]/g, `${activeAbt.indication || ''}/${activeAbt.syndromeCategory || ''}`);
        generatedNote = generatedNote.replace(/\[infectionSource\/site\]/g, activeAbt.infectionSource || '[Infection Source]');
        generatedNote = generatedNote.replace(/\[organism; sensitivities\]/g, activeAbt.organismIdentified || '[Organism/Sensitivities]');
        generatedNote = generatedNote.replace(/\[endDate\]/g, activeAbt.endDate || '[End Date]');
        generatedNote = generatedNote.replace(/\[cultureStatus\]/g, activeAbt.cultureCollected ? 'collected' : 'not collected');
      }
    }

    if (noteType === 'INFECTION_REVIEW') {
      const activeIp = (Object.values(store.infections) as IPEvent[]).find(i => i.residentRef.id === selectedMrn && i.status === 'active');
      if (activeIp) {
        generatedNote = generatedNote.replace(/\[suspected\/confirmed infection type\]/g, activeIp.infectionCategory || '[Infection Type]');
        generatedNote = generatedNote.replace(/\[standard\/contact\/droplet\/airborne\]/g, activeIp.isolationType || 'standard');
        generatedNote = generatedNote.replace(/\[reason\/organism\]/g, activeIp.organism || activeIp.infectionCategory || '[Reason/Organism]');
      }
    }

    if (noteType === 'ADMISSION_SCREENING') {
      const admissionIp = (Object.values(store.infections) as IPEvent[]).find(i => i.residentRef.id === selectedMrn);
      if (admissionIp) {
        generatedNote = generatedNote.replace(/\[none \/ contact\/droplet\/airborne for reason\]/g, admissionIp.isolationType || 'none');
      }
    }

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
                <option value="VACCINATION_OFFER">Vaccination Offer</option>
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
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-neutral-300 text-sm font-medium"
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
