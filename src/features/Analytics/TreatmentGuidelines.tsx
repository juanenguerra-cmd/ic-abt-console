import React, { useState } from 'react';
import {
  BookOpen, ExternalLink, ChevronDown, ChevronRight, CheckCircle2, Circle,
  AlertTriangle, Activity, Stethoscope, ShieldAlert, FlaskConical, Info,
  ClipboardList, ArrowRight,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type SyndromeKey = 'uti' | 'pneumonia' | 'ssti' | 'cdiff' | 'moments';

interface CriterionGroup {
  label: string;
  required?: boolean;
  items: string[];
}

interface TreatmentOption {
  label: string;
  agents: string[];
  duration: string;
  note?: string;
}

interface ExternalResource {
  label: string;
  url: string;
  org: string;
}

interface SyndromeGuide {
  key: SyndromeKey;
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  source: string;
  summary: string;
  criteriaTitle: string;
  criteriaNote?: string;
  criteriaGroups: CriterionGroup[];
  decisionTree: { question: string; yes: string; no: string }[];
  treatments: TreatmentOption[];
  stewardshipPearls: string[];
  resources: ExternalResource[];
}

// ─── Guideline Data ────────────────────────────────────────────────────────────

const SYNDROME_GUIDES: SyndromeGuide[] = [
  // ── UTI ───────────────────────────────────────────────────────────────────
  {
    key: 'uti',
    label: 'UTI',
    icon: <FlaskConical className="w-4 h-4" />,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    source: 'Loeb Criteria (LTCF, 2001) · McGeer Criteria (Revised 2012)',
    summary:
      'Urinary tract infections are the most over-diagnosed infection in LTCFs. Asymptomatic bacteriuria should NOT be treated. Use the Loeb Minimum Criteria to justify antibiotic initiation.',
    criteriaTitle: 'Loeb Minimum Criteria — UTI (LTCF)',
    criteriaNote:
      'For catheterized residents, ONE criterion is sufficient. For non-catheterized residents, dysuria alone OR ≥1 criterion from Group B plus acute onset.',
    criteriaGroups: [
      {
        label: 'Catheterized Residents — Any ONE of:',
        required: true,
        items: [
          'Fever (>37.9 °C / 100.0 °F or ≥1.5 °C rise from baseline)',
          'New costovertebral angle tenderness',
          'Rigors (shaking chills) with or without identified cause',
          'New onset delirium',
        ],
      },
      {
        label: 'Non-Catheterized — Dysuria alone OR acute dysuria + ≥1 below:',
        items: [
          'Fever (>37.9 °C / 100.0 °F or ≥1.5 °C rise from baseline)',
          'New or worsening urgency',
          'New or worsening frequency',
          'Suprapubic pain',
          'Gross hematuria',
          'New costovertebral angle tenderness',
          'Urinary incontinence (new or worsening)',
        ],
      },
    ],
    decisionTree: [
      {
        question: 'Does the resident have a urinary catheter?',
        yes: 'Apply catheterized criteria — ONE sign/symptom required.',
        no: 'Apply non-catheterized criteria — dysuria alone or dysuria + ≥1 systemic sign required.',
      },
      {
        question: 'Does the resident meet the Loeb minimum criteria above?',
        yes: 'Criteria met — obtain urine culture before starting antibiotics if feasible.',
        no: 'Criteria NOT met — do NOT treat. Consider watchful waiting and monitor for evolving signs.',
      },
      {
        question: 'Has a culture been collected and resulted?',
        yes: 'De-escalate to narrow-spectrum targeted therapy based on susceptibilities.',
        no: 'Use empiric regimen; perform 72-hour timeout and review when culture results available.',
      },
    ],
    treatments: [
      {
        label: 'Uncomplicated UTI — First Line',
        agents: ['Nitrofurantoin 100 mg BID (macrocrystal)', 'TMP-SMX DS 1 tab BID (if susceptible)'],
        duration: '5–7 days (female); 7 days (male)',
        note: 'Avoid nitrofurantoin if eGFR < 30. Check local resistance — TMP-SMX resistance >20% warrants alternative.',
      },
      {
        label: 'Uncomplicated UTI — Alternatives',
        agents: ['Fosfomycin 3 g single dose', 'Pivmecillinam 400 mg BID (if available)'],
        duration: '1–7 days per agent',
      },
      {
        label: 'Complicated UTI / Pyelonephritis',
        agents: ['Ciprofloxacin 500 mg BID (if susceptible)', 'Amoxicillin-clavulanate 875/125 mg BID', 'Ceftriaxone 1 g IV daily (severe)'],
        duration: '7–14 days (oral); 5–7 days IV then step-down',
        note: 'Fluoroquinolones are last-resort per CMS/CDC — document stewardship rationale.',
      },
      {
        label: 'Catheter-Associated UTI (CAUTI)',
        agents: ['Remove or replace catheter before starting antibiotics if possible', 'Same empiric regimens as complicated UTI'],
        duration: '7 days if symptoms resolve promptly; 14 days if delayed response',
      },
    ],
    stewardshipPearls: [
      'Asymptomatic bacteriuria does NOT require treatment in most residents (exception: pre-urologic procedure).',
      'Pyuria (positive leukocyte esterase) alone is NOT an indication for antibiotics.',
      'Cloudy or malodorous urine alone is NOT diagnostic of UTI.',
      'Document meeting Loeb criteria in the clinical note before ordering antibiotics.',
      'Perform a 72-hour antibiotic timeout once culture results are available to de-escalate.',
    ],
    resources: [
      { label: 'Loeb Minimum Criteria for UTI (Original 2001)', url: 'https://pubmed.ncbi.nlm.nih.gov/11490120/', org: 'PubMed' },
      { label: 'McGeer Criteria Revised 2012', url: 'https://pubmed.ncbi.nlm.nih.gov/22998813/', org: 'PubMed' },
      { label: 'NYSDOH LTCF Antibiotic Stewardship Toolkit', url: 'https://www.health.ny.gov/professionals/nursing_home_administrator/antibiotic_stewardship/', org: 'NYSDOH' },
      { label: 'CDC Core Elements of Antibiotic Stewardship for NHs', url: 'https://www.cdc.gov/antibiotic-use/core-elements/long-term-care.html', org: 'CDC' },
      { label: 'CMS Antibiotic Stewardship F-Tag 881', url: 'https://www.cms.gov/Medicare/Provider-Enrollment-and-Certification/GuidanceforLawsAndRegulations/Downloads/Advance-Appendix-PP-Including-Phase-2-.pdf', org: 'CMS' },
      { label: 'NHSN CAUTI Surveillance Definition', url: 'https://www.cdc.gov/nhsn/pdfs/pscmanual/7psccauticurrent.pdf', org: 'NHSN/CDC' },
    ],
  },

  // ── Pneumonia ─────────────────────────────────────────────────────────────
  {
    key: 'pneumonia',
    label: 'Pneumonia',
    icon: <Activity className="w-4 h-4" />,
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    source: 'Loeb Criteria (LTCF, 2001) · McGeer Criteria (Revised 2012) · IDSA/ATS 2019',
    summary:
      'Lower respiratory tract infections are a leading cause of hospitalization and death in LTCFs. Distinguish between nursing home-acquired pneumonia (NHAP), aspiration pneumonia, and HCAP.',
    criteriaTitle: 'Minimum Criteria — Lower Respiratory Tract Infection (LTCF)',
    criteriaNote:
      'Requires at least ONE sign/symptom from Group A PLUS at least ONE from Group B. Radiographic confirmation strengthens the diagnosis but is not always required for treatment initiation.',
    criteriaGroups: [
      {
        label: 'Group A — Respiratory Signs/Symptoms (at least ONE):',
        required: true,
        items: [
          'New or increased cough',
          'New or increased sputum production',
          'New or increased shortness of breath (dyspnea)',
          'New or increased respiratory rate (>25 breaths/min)',
          'Pleuritic chest pain',
          'New onset or worsening confusion/altered mental status',
        ],
      },
      {
        label: 'Group B — Systemic Signs (at least ONE):',
        required: true,
        items: [
          'Fever >37.9 °C (100.0 °F) or ≥1.5 °C rise from baseline',
          'O₂ saturation decrease ≥3% from baseline or SpO₂ <94%',
          'New onset rigors',
          'New onset delirium',
        ],
      },
    ],
    decisionTree: [
      {
        question: 'Does the resident meet the LTCF minimum criteria for LRTI above?',
        yes: 'Criteria met — assess severity and consider chest X-ray.',
        no: 'Criteria NOT met — do not treat with antibiotics. Consider symptomatic management and close monitoring.',
      },
      {
        question: 'Is the resident hemodynamically stable and able to take oral medications?',
        yes: 'Outpatient / oral therapy appropriate. Use CURB-65 to guide severity stratification.',
        no: 'Consider hospital transfer for IV antibiotics. Ensure advance directive review.',
      },
      {
        question: 'Is there a suspicion for aspiration (witnessed or history of dysphagia)?',
        yes: 'Add anaerobic coverage or use amoxicillin-clavulanate. SLP swallowing eval if not done.',
        no: 'Treat as community or healthcare-associated pneumonia based on prior hospitalization history.',
      },
    ],
    treatments: [
      {
        label: 'Mild NHAP — Outpatient, No Recent Antibiotics',
        agents: ['Amoxicillin 500 mg TID', 'Doxycycline 100 mg BID'],
        duration: '5–7 days',
      },
      {
        label: 'Moderate NHAP / Atypical Coverage Needed',
        agents: ['Amoxicillin-clavulanate 875/125 mg BID', 'Azithromycin 500 mg Day 1, then 250 mg Days 2–5'],
        duration: '5–7 days',
        note: 'Use respiratory fluoroquinolone only if penicillin-allergic and macrolide-resistant rates are high.',
      },
      {
        label: 'Aspiration Pneumonia',
        agents: ['Amoxicillin-clavulanate 875/125 mg BID (oral)', 'Clindamycin 300–450 mg TID (penicillin allergy)', 'Piperacillin-tazobactam 3.375 g Q6h IV (severe)'],
        duration: '5–7 days; reassess at 72 hours',
      },
      {
        label: 'Fluoroquinolone Reserve (Last Resort — Document Rationale)',
        agents: ['Levofloxacin 750 mg daily', 'Moxifloxacin 400 mg daily'],
        duration: '5 days',
        note: 'Fluoroquinolones increase C. diff risk and resistance. Use only after failure of first-line agents or documented allergy.',
      },
    ],
    stewardshipPearls: [
      'Aspirating residents commonly colonize the oropharynx with GNRs — this does NOT equal pneumonia.',
      'Azithromycin is a QTc-prolonging agent — review EKG and medication list before prescribing.',
      'Short-course therapy (5 days) is non-inferior to longer courses in mild-moderate CAP.',
      'Do NOT use fluoroquinolones as first-line therapy per CMS F-Tag 881 and CDC guidance.',
      'Document CURB-65 score or clinical severity rationale for all pneumonia antibiotic orders.',
    ],
    resources: [
      { label: 'IDSA/ATS Community-Acquired Pneumonia Guidelines', url: 'https://www.idsociety.org/practice-guideline/community-acquired-pneumonia-cap-in-adults/', org: 'IDSA' },
      { label: 'McGeer Criteria Revised 2012 (Pneumonia)', url: 'https://pubmed.ncbi.nlm.nih.gov/22998813/', org: 'PubMed' },
      { label: 'NYSDOH LTCF Pneumonia Toolkit', url: 'https://www.health.ny.gov/professionals/nursing_home_administrator/antibiotic_stewardship/', org: 'NYSDOH' },
      { label: 'CDC — Pneumonia in LTC Facilities', url: 'https://www.cdc.gov/antibiotic-use/core-elements/long-term-care.html', org: 'CDC' },
      { label: 'CMS F-Tag 881 — Antibiotic Stewardship', url: 'https://www.cms.gov/Medicare/Provider-Enrollment-and-Certification/GuidanceforLawsAndRegulations/Downloads/Advance-Appendix-PP-Including-Phase-2-.pdf', org: 'CMS' },
    ],
  },

  // ── SSTI ──────────────────────────────────────────────────────────────────
  {
    key: 'ssti',
    label: 'Skin / Soft Tissue',
    icon: <Stethoscope className="w-4 h-4" />,
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    source: 'Loeb Criteria (LTCF) · IDSA SSTI Guidelines 2014 · McGeer Revised 2012',
    summary:
      'Cellulitis, wound infections, and pressure injuries are frequently over-treated in LTCFs. Distinguish true infection from chronic colonization or non-infectious inflammation before starting antibiotics.',
    criteriaTitle: 'Minimum Criteria — Skin & Soft Tissue Infection (LTCF)',
    criteriaNote:
      'Non-pressure wound infections require at least TWO criteria from Group A (local signs). Pressure ulcer infections require at least FOUR criteria.',
    criteriaGroups: [
      {
        label: 'Non-Pressure Wound — ≥2 Local Signs:',
        required: true,
        items: [
          'New or increasing redness (erythema) at wound edges',
          'New or increasing warmth',
          'New or increasing tenderness or pain at wound site',
          'New or increasing swelling',
          'Purulent drainage or new wound discharge',
        ],
      },
      {
        label: 'Pressure Ulcer — ≥4 Signs (in addition to non-healing or increasing size):',
        items: [
          'Redness, warmth, or swelling at wound edge or surrounding tissue',
          'Odor',
          'Purulent exudate',
          'Fever >37.9 °C or ≥1.5 °C rise from baseline',
          'New or worsening pain at wound site',
          'New onset delirium',
        ],
      },
    ],
    decisionTree: [
      {
        question: 'Does the resident meet minimum criteria for SSTI above?',
        yes: 'Criteria met — assess severity (mild, moderate, severe).',
        no: 'Criteria NOT met — do not treat. Consider wound care optimization and re-evaluation in 24–48 hours.',
      },
      {
        question: 'Are there signs of systemic infection (fever, hypotension, tachycardia, AMS)?',
        yes: 'Systemic involvement — IV antibiotics and consideration of hospital transfer for severe cases.',
        no: 'Mild-moderate cellulitis — oral antibiotics appropriate for most residents.',
      },
      {
        question: 'Is there evidence of purulence (abscess, furuncle, carbuncle)?',
        yes: 'Incision and drainage is the primary treatment. MRSA coverage needed if severe or immunocompromised.',
        no: 'Non-purulent cellulitis — streptococcal coverage first-line.',
      },
    ],
    treatments: [
      {
        label: 'Non-Purulent Cellulitis — First Line',
        agents: ['Cephalexin 500 mg QID', 'Dicloxacillin 500 mg QID', 'Amoxicillin-clavulanate 875/125 mg BID'],
        duration: '5–7 days; reassess at 48–72 hours',
        note: 'Beta-lactams are preferred over TMP-SMX for non-purulent cellulitis (predominantly streptococcal).',
      },
      {
        label: 'MRSA-Suspected or Purulent Cellulitis',
        agents: ['TMP-SMX DS 1–2 tabs BID', 'Doxycycline 100 mg BID', 'Clindamycin 300–450 mg TID (if susceptible)'],
        duration: '5–7 days',
      },
      {
        label: 'Pressure Ulcer — Infected',
        agents: ['Amoxicillin-clavulanate 875/125 mg BID (mixed flora)', 'Metronidazole 500 mg TID (if anaerobes suspected)', 'TMP-SMX DS + Metronidazole (MRSA + anaerobic coverage)'],
        duration: '7–14 days depending on clinical response',
        note: 'Bone probe test / x-ray if concern for osteomyelitis (Stage III–IV PU). MRI preferred for osteomyelitis diagnosis.',
      },
      {
        label: 'Severe / IV Therapy Required',
        agents: ['Vancomycin 15–20 mg/kg Q8-12h IV (MRSA/severe)', 'Piperacillin-tazobactam 3.375 g Q6h IV (GNR/polymicrobial)'],
        duration: '7–14 days with step-down to oral when feasible',
      },
    ],
    stewardshipPearls: [
      'Stage I and II pressure ulcers rarely require systemic antibiotics — optimize wound care first.',
      'Wound surface swabs reflect colonization, NOT infection — request deep tissue biopsy or curettage for culture.',
      'Bilateral leg erythema that is symmetric is more likely stasis dermatitis (non-infectious) than bilateral cellulitis.',
      'Mark the border of erythema with a skin marker at initiation to track response over 24–48 hours.',
      'Systemic antibiotic therapy for osteomyelitis requires a minimum 6-week course — confirm diagnosis with imaging before committing.',
    ],
    resources: [
      { label: 'IDSA SSTI Practice Guidelines 2014', url: 'https://www.idsociety.org/practice-guideline/skin-and-soft-tissue-infections/', org: 'IDSA' },
      { label: 'McGeer Criteria — SSTI Definition', url: 'https://pubmed.ncbi.nlm.nih.gov/22998813/', org: 'PubMed' },
      { label: 'NYSDOH LTCF Infection Prevention Toolkit', url: 'https://www.health.ny.gov/professionals/nursing_home_administrator/antibiotic_stewardship/', org: 'NYSDOH' },
      { label: 'CDC — Antibiotic Use in Skin & Soft Tissue', url: 'https://www.cdc.gov/antibiotic-use/index.html', org: 'CDC' },
    ],
  },

  // ── C. diff ───────────────────────────────────────────────────────────────
  {
    key: 'cdiff',
    label: 'C. difficile',
    icon: <ShieldAlert className="w-4 h-4" />,
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    source: 'IDSA/SHEA C. diff Guidelines 2021 · NHSN LabID Surveillance',
    summary:
      'C. difficile Infection (CDI) is a major healthcare-associated infection in LTCFs. Antibiotic exposure is the primary risk factor. Test only symptomatic residents — do NOT test to confirm resolution.',
    criteriaTitle: 'CDI Diagnostic Criteria',
    criteriaNote:
      'Test ONLY when: ≥3 unformed stools in 24 hours AND no laxatives in prior 48 hours. Do not test formed stool. Do not test for test of cure.',
    criteriaGroups: [
      {
        label: 'Clinical Criteria — BOTH required:',
        required: true,
        items: [
          'Diarrhea: ≥3 unformed stools within a 24-hour period',
          'No laxatives administered in the previous 48 hours',
        ],
      },
      {
        label: 'Laboratory Confirmation (any one):',
        items: [
          'Positive GDH + Toxin EIA (two-step algorithm)',
          'Positive NAAT (PCR) — confirm clinical picture (avoid testing colonized patients)',
          'Stool toxin cytotoxicity assay (gold standard, rarely used clinically)',
        ],
      },
    ],
    decisionTree: [
      {
        question: 'Does the resident have ≥3 unformed stools in 24 hours without laxatives?',
        yes: 'Clinical criteria met — send stool for C. diff testing using facility protocol (GDH+Toxin or PCR).',
        no: 'Do NOT test. Manage diarrhea symptomatically. Review laxative/medication history.',
      },
      {
        question: 'Has CDI been laboratory-confirmed?',
        yes: 'Initiate treatment based on severity. Place resident on Contact Precautions immediately.',
        no: 'Do not treat empirically unless critically ill and high clinical suspicion. Await results.',
      },
      {
        question: 'Is this a first episode or recurrence? Assess severity.',
        yes: 'Initial episode: Vancomycin oral or Fidaxomicin. Avoid Metronidazole as first-line.',
        no: 'Recurrence: Fidaxomicin preferred; consider Bezlotoxumab adjunct for high-risk patients.',
      },
    ],
    treatments: [
      {
        label: 'Non-Severe CDI (WBC <15k, Cr <1.5× baseline)',
        agents: ['Vancomycin 125 mg PO QID × 10 days (preferred)', 'Fidaxomicin 200 mg PO BID × 10 days (alternative, lower recurrence)'],
        duration: '10 days',
        note: 'Metronidazole is NO LONGER recommended as first-line therapy (IDSA 2021 update).',
      },
      {
        label: 'Severe CDI (WBC ≥15k OR Cr ≥1.5× baseline)',
        agents: ['Vancomycin 125 mg PO QID × 10 days'],
        duration: '10 days',
      },
      {
        label: 'Fulminant CDI (Hypotension, Ileus, Megacolon)',
        agents: ['Vancomycin 500 mg PO/PR QID + Metronidazole 500 mg IV Q8h'],
        duration: 'Until clinical improvement; surgical consult if no improvement in 2–5 days',
        note: 'Transfer to hospital for fulminant CDI.',
      },
      {
        label: 'First Recurrence',
        agents: ['Fidaxomicin 200 mg BID × 10 days (preferred)', 'Vancomycin pulsed-taper regimen (if initial Vanco used)'],
        duration: '10–40 days (taper)',
      },
      {
        label: 'Second or Further Recurrence',
        agents: ['Fidaxomicin 200 mg BID × 10 days', 'Bezlotoxumab 10 mg/kg IV × 1 (adjunct, high-risk)', 'Fecal Microbiota Transplantation (FMT) — specialist referral'],
        duration: 'Per specialist guidance',
      },
    ],
    stewardshipPearls: [
      'Do NOT test for C. diff "test of cure" after treatment — PCR can remain positive for weeks.',
      'Do NOT treat asymptomatic C. diff colonization.',
      'Discontinue or narrow the offending antibiotic if medically safe — this improves CDI outcomes.',
      'All CDI cases should trigger Contact Precautions (gown + gloves). Alcohol hand gel does NOT kill C. diff spores — use soap and water.',
      'Report CDI under NHSN LabID surveillance for LTCF facilities as required by CMS.',
      'Proton pump inhibitors (PPIs) independently increase CDI risk — review and discontinue if not indicated.',
    ],
    resources: [
      { label: 'IDSA/SHEA CDI Clinical Practice Guidelines 2021', url: 'https://www.idsociety.org/practice-guideline/clostridium-difficile/', org: 'IDSA' },
      { label: 'NHSN CDI LabID Surveillance Definition', url: 'https://www.cdc.gov/nhsn/pdfs/pscmanual/12pscmdro_cdadcurrent.pdf', org: 'NHSN/CDC' },
      { label: 'CMS CDI Reporting Requirements for NHs', url: 'https://www.cms.gov/Medicare/Provider-Enrollment-and-Certification/GuidanceforLawsAndRegulations/Downloads/Advance-Appendix-PP-Including-Phase-2-.pdf', org: 'CMS' },
      { label: 'NYSDOH C. diff Prevention in LTCFs', url: 'https://www.health.ny.gov/diseases/communicable/cdiff/', org: 'NYSDOH' },
      { label: 'CDC — C. difficile in Healthcare Settings', url: 'https://www.cdc.gov/cdiff/index.html', org: 'CDC' },
    ],
  },
];

// ─── 4 Moments of Antibiotic Stewardship ─────────────────────────────────────

const FOUR_MOMENTS = [
  {
    number: 1,
    title: 'Does my patient have an infection that requires antibiotics?',
    description:
      'Determine whether the clinical picture represents true infection vs. colonization, viral illness, or non-infectious inflammation. Apply Loeb/McGeer minimum criteria.',
    action: 'If NO or UNCERTAIN — defer antibiotics; obtain cultures; reassess in 24–48 hours.',
    color: 'bg-blue-50 border-blue-300 text-blue-800',
    numberColor: 'bg-blue-600',
  },
  {
    number: 2,
    title: 'Have I ordered appropriate cultures and am I using the right drug, dose, and duration?',
    description:
      'Obtain relevant cultures BEFORE starting antibiotics when feasible. Verify allergy history, renal function (dose adjust as needed), and drug interactions.',
    action: 'Use narrowest spectrum agent that covers likely pathogens. Match duration to evidence-based guidelines.',
    color: 'bg-emerald-50 border-emerald-300 text-emerald-800',
    numberColor: 'bg-emerald-600',
  },
  {
    number: 3,
    title: 'Does my patient have a daily assessment for de-escalation or IV-to-PO conversion?',
    description:
      'At 48–72 hours ("antibiotic timeout"), reassess clinical response, culture results, and whether therapy can be narrowed, switched to oral, or discontinued.',
    action: 'Document the 72-hour timeout review in the clinical record. De-escalate whenever safe.',
    color: 'bg-amber-50 border-amber-300 text-amber-800',
    numberColor: 'bg-amber-600',
  },
  {
    number: 4,
    title: 'What is the planned stop date and has the resident been reassessed?',
    description:
      'Every antibiotic order should have a defined duration or a scheduled reassessment date. Avoid open-ended prescribing.',
    action: 'Set a stop date at initiation. Reassess at that date — do not auto-renew without clinical justification.',
    color: 'bg-purple-50 border-purple-300 text-purple-800',
    numberColor: 'bg-purple-600',
  },
];

// ─── C. diff Risk Calculator Data ─────────────────────────────────────────────

interface RiskFactor {
  id: string;
  label: string;
  points: number;
  detail: string;
}

const CDIFF_RISK_FACTORS: RiskFactor[] = [
  { id: 'age75', label: 'Age ≥ 75 years', points: 2, detail: 'Older residents have reduced immunity and altered gut microbiome.' },
  { id: 'recentAbx', label: 'Antibiotic exposure in last 90 days', points: 3, detail: 'Greatest single modifiable risk factor — fluoroquinolones, clindamycin, and broad-spectrum PCNs are highest risk.' },
  { id: 'ppi', label: 'Current proton pump inhibitor (PPI) use', points: 1, detail: 'PPIs alter gastric acid barrier, increasing susceptibility to spore ingestion.' },
  { id: 'hospital', label: 'Hospitalization in last 90 days', points: 2, detail: 'Healthcare exposure increases contact with C. diff spores.' },
  { id: 'prevCdiff', label: 'Prior CDI episode', points: 3, detail: 'Strongest predictor of recurrent CDI.' },
  { id: 'immunosupp', label: 'Immunosuppression (steroids, chemo, transplant)', points: 2, detail: 'Impaired immune response to C. diff toxins.' },
  { id: 'multipleAbx', label: 'Currently receiving ≥2 antibiotics simultaneously', points: 2, detail: 'Additive disruption of gut microbiota.' },
  { id: 'tube', label: 'Enteral feeding (NG tube or PEG)', points: 1, detail: 'Altered gastric transit and microbiome composition.' },
  { id: 'icu', label: 'ICU stay within last 30 days', points: 2, detail: 'High-risk environment for nosocomial C. diff transmission.' },
];

// ─── Sub-components ────────────────────────────────────────────────────────────

const CriterionChecklist: React.FC<{ groups: CriterionGroup[] }> = ({ groups }) => {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const toggle = (key: string) =>
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="space-y-4">
      {groups.map((group, gi) => (
        <div key={gi}>
          <p className="text-sm font-semibold text-neutral-700 mb-2">{group.label}</p>
          <div className="space-y-1.5">
            {group.items.map((item, ii) => {
              const key = `${gi}-${ii}`;
              const isChecked = !!checked[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggle(key)}
                  className={`w-full flex items-start gap-3 text-left px-3 py-2 rounded-lg border transition-colors text-sm ${
                    isChecked
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : 'bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  {isChecked ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                  )}
                  <span>{item}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

const DecisionTree: React.FC<{ steps: { question: string; yes: string; no: string }[] }> = ({ steps }) => (
  <div className="space-y-3">
    {steps.map((step, i) => (
      <div key={i} className="border border-neutral-200 rounded-xl overflow-hidden bg-white shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3 bg-neutral-50 border-b border-neutral-200">
          <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
            {i + 1}
          </span>
          <p className="font-semibold text-neutral-800 text-sm">{step.question}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-neutral-200">
          <div className="flex items-start gap-2 p-3">
            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded shrink-0 mt-0.5">YES</span>
            <p className="text-xs text-neutral-700 leading-relaxed">{step.yes}</p>
          </div>
          <div className="flex items-start gap-2 p-3">
            <span className="text-xs font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded shrink-0 mt-0.5">NO</span>
            <p className="text-xs text-neutral-700 leading-relaxed">{step.no}</p>
          </div>
        </div>
      </div>
    ))}
  </div>
);

const TreatmentCard: React.FC<{ option: TreatmentOption }> = ({ option }) => (
  <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm space-y-2">
    <p className="text-sm font-semibold text-neutral-900">{option.label}</p>
    <div className="flex flex-wrap gap-1.5">
      {option.agents.map((agent, i) => (
        <span key={i} className="text-xs bg-indigo-50 text-indigo-800 border border-indigo-200 px-2 py-1 rounded-full font-medium">
          {agent}
        </span>
      ))}
    </div>
    <div className="flex items-center gap-2 text-xs text-neutral-600">
      <span className="font-medium">Duration:</span>
      <span>{option.duration}</span>
    </div>
    {option.note && (
      <div className="flex items-start gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>{option.note}</span>
      </div>
    )}
  </div>
);

const CollapsibleSection: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({
  title,
  children,
  defaultOpen = false,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-neutral-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-neutral-50 hover:bg-neutral-100 transition-colors text-left"
      >
        <span className="text-sm font-semibold text-neutral-900">{title}</span>
        {open ? <ChevronDown className="w-4 h-4 text-neutral-500" /> : <ChevronRight className="w-4 h-4 text-neutral-500" />}
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
};

const CdiffRiskCalculator: React.FC = () => {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const score = CDIFF_RISK_FACTORS.reduce((sum, f) => sum + (selected[f.id] ? f.points : 0), 0);
  const maxScore = CDIFF_RISK_FACTORS.reduce((s, f) => s + f.points, 0);

  const risk =
    score === 0
      ? { label: 'Very Low Risk', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' }
      : score <= 2
      ? { label: 'Low Risk', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' }
      : score <= 4
      ? { label: 'Moderate Risk', color: 'text-amber-700 bg-amber-50 border-amber-200' }
      : score <= 7
      ? { label: 'High Risk', color: 'text-orange-700 bg-orange-50 border-orange-200' }
      : { label: 'Very High Risk', color: 'text-red-700 bg-red-50 border-red-200' };

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600">
        Select all risk factors that apply to this resident to estimate their C. difficile infection risk profile.
        This is a clinical aid — it does not replace clinical judgment.
      </p>

      <div className="space-y-2">
        {CDIFF_RISK_FACTORS.map((factor) => (
          <button
            key={factor.id}
            type="button"
            onClick={() => setSelected((prev) => ({ ...prev, [factor.id]: !prev[factor.id] }))}
            className={`w-full flex items-start gap-3 text-left px-3 py-3 rounded-xl border transition-colors ${
              selected[factor.id]
                ? 'bg-red-50 border-red-300'
                : 'bg-white border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            {selected[factor.id] ? (
              <CheckCircle2 className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            ) : (
              <Circle className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className={`text-sm font-medium ${selected[factor.id] ? 'text-red-900' : 'text-neutral-800'}`}>
                  {factor.label}
                </p>
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                  selected[factor.id] ? 'bg-red-200 text-red-800' : 'bg-neutral-100 text-neutral-600'
                }`}>
                  +{factor.points}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">{factor.detail}</p>
            </div>
          </button>
        ))}
      </div>

      <div className={`rounded-xl border p-4 ${risk.color}`}>
        <div className="flex items-center justify-between mb-2">
          <p className="font-bold text-lg">Risk Score: {score} / {maxScore}</p>
          <p className="font-bold text-base">{risk.label}</p>
        </div>
        <div className="w-full bg-white/50 rounded-full h-2.5">
          <div
            className="h-2.5 rounded-full bg-current opacity-70 transition-all duration-300"
            style={{ width: `${Math.round((score / maxScore) * 100)}%` }}
          />
        </div>
        {score >= 3 && (
          <div className="mt-3 text-xs space-y-1">
            <p className="font-semibold">Recommended Actions:</p>
            <ul className="space-y-1">
              {score >= 3 && <li className="flex gap-1"><ArrowRight className="w-3 h-3 shrink-0 mt-0.5" /><span>Review all current antibiotics — discontinue or narrow spectrum if safe.</span></li>}
              {score >= 5 && <li className="flex gap-1"><ArrowRight className="w-3 h-3 shrink-0 mt-0.5" /><span>Consider probiotics (Lactobacillus rhamnosus GG or Saccharomyces) for CDI prevention if not contraindicated.</span></li>}
              {score >= 5 && <li className="flex gap-1"><ArrowRight className="w-3 h-3 shrink-0 mt-0.5" /><span>Reassess PPI necessity — step down to H2-blocker or discontinue if no indication.</span></li>}
              {score >= 7 && <li className="flex gap-1"><ArrowRight className="w-3 h-3 shrink-0 mt-0.5" /><span>Consider Bezlotoxumab prophylaxis discussion with physician for very high-risk residents receiving antibiotics.</span></li>}
            </ul>
          </div>
        )}
      </div>

      {score > 0 && (
        <button
          type="button"
          onClick={() => setSelected({})}
          className="text-xs text-neutral-500 hover:text-neutral-700 underline"
        >
          Reset Calculator
        </button>
      )}
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

const TreatmentGuidelines: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SyndromeKey | 'moments'>('uti');

  const currentGuide = SYNDROME_GUIDES.find((g) => g.key === activeTab);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-600" />
          Treatment Guidelines & Clinical Decision Support
        </h2>
        <p className="text-sm text-neutral-500 mt-1">
          Evidence-based guidelines for LTCF antibiotic stewardship. Includes Loeb/McGeer criteria,
          syndrome-specific decision trees, and C. diff risk stratification. All external links open
          official sources (NYSDOH, CDC, CMS, IDSA, NHSN).
        </p>
      </div>

      {/* Syndrome Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-neutral-200 pb-2">
        {SYNDROME_GUIDES.map((guide) => (
          <button
            key={guide.key}
            type="button"
            onClick={() => setActiveTab(guide.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === guide.key
                ? `${guide.bgColor} ${guide.color} border ${guide.borderColor}`
                : 'text-neutral-600 hover:bg-neutral-100 border border-transparent'
            }`}
          >
            {guide.icon}
            {guide.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setActiveTab('moments')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'moments'
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
              : 'text-neutral-600 hover:bg-neutral-100 border border-transparent'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          4 Moments
        </button>
      </div>

      {/* 4 Moments View */}
      {activeTab === 'moments' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-bold text-neutral-900">4 Moments of Antibiotic Stewardship</h3>
            <p className="text-sm text-neutral-500 mt-1">
              A framework developed to guide prescribers through evidence-based antibiotic decision-making.
              Based on the CDC-endorsed model adopted by SHEA and the Choosing Wisely campaign.
            </p>
          </div>
          <div className="space-y-4">
            {FOUR_MOMENTS.map((moment) => (
              <div key={moment.number} className={`rounded-xl border p-5 ${moment.color}`}>
                <div className="flex items-start gap-4">
                  <span className={`w-9 h-9 rounded-full ${moment.numberColor} text-white text-sm font-bold flex items-center justify-center shrink-0`}>
                    {moment.number}
                  </span>
                  <div className="space-y-2">
                    <p className="font-bold text-base">{moment.title}</p>
                    <p className="text-sm opacity-90 leading-relaxed">{moment.description}</p>
                    <div className="flex items-start gap-2 text-sm font-semibold mt-2">
                      <ArrowRight className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{moment.action}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-sm text-indigo-800">
            <p className="font-semibold mb-1 flex items-center gap-2"><Info className="w-4 h-4" /> Reference Sources</p>
            <ul className="space-y-1">
              <li className="flex items-center gap-2">
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                <a href="https://www.cdc.gov/antibiotic-use/core-elements/long-term-care.html" target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-900">
                  CDC Core Elements of Antibiotic Stewardship for Long-Term Care
                </a>
                <span className="text-xs opacity-70">· CDC</span>
              </li>
              <li className="flex items-center gap-2">
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                <a href="https://www.health.ny.gov/professionals/nursing_home_administrator/antibiotic_stewardship/" target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-900">
                  NYSDOH Antibiotic Stewardship for LTCFs
                </a>
                <span className="text-xs opacity-70">· NYSDOH</span>
              </li>
              <li className="flex items-center gap-2">
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                <a href="https://www.cms.gov/Medicare/Provider-Enrollment-and-Certification/GuidanceforLawsAndRegulations/Downloads/Advance-Appendix-PP-Including-Phase-2-.pdf" target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-900">
                  CMS F-Tag 881 — Antibiotic Stewardship Program Requirements
                </a>
                <span className="text-xs opacity-70">· CMS</span>
              </li>
            </ul>
          </div>

          {/* C. diff Risk Calculator embedded here too */}
          <div className="border border-red-200 rounded-xl overflow-hidden">
            <div className="bg-red-50 px-5 py-3 border-b border-red-200">
              <h4 className="font-semibold text-red-800 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                C. difficile Risk Calculator
              </h4>
              <p className="text-xs text-red-700 mt-0.5">
                Use during Moment 2 — when prescribing antibiotics to high-risk residents.
              </p>
            </div>
            <div className="p-5">
              <CdiffRiskCalculator />
            </div>
          </div>
        </div>
      )}

      {/* Syndrome Guide View */}
      {currentGuide && (
        <div className="space-y-5">

          {/* Synopsis Banner */}
          <div className={`rounded-xl border p-4 ${currentGuide.bgColor} ${currentGuide.borderColor}`}>
            <p className={`text-xs font-semibold uppercase tracking-wider ${currentGuide.color} mb-1`}>
              Source: {currentGuide.source}
            </p>
            <p className={`text-sm leading-relaxed ${currentGuide.color}`}>{currentGuide.summary}</p>
          </div>

          {/* Criteria Checklist */}
          <CollapsibleSection
            title={`✓ ${currentGuide.criteriaTitle}`}
            defaultOpen={true}
          >
            {currentGuide.criteriaNote && (
              <div className="mb-4 flex items-start gap-2 text-sm text-indigo-800 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{currentGuide.criteriaNote}</span>
              </div>
            )}
            <CriterionChecklist groups={currentGuide.criteriaGroups} />
            <p className="mt-3 text-xs text-neutral-500 italic">
              Click each criterion to mark as present. Checkboxes reset on navigation — for documentation, record findings in the clinical note.
            </p>
          </CollapsibleSection>

          {/* Decision Tree */}
          <CollapsibleSection title="→ Clinical Decision Tree" defaultOpen={true}>
            <DecisionTree steps={currentGuide.decisionTree} />
          </CollapsibleSection>

          {/* Empiric Treatment */}
          <CollapsibleSection title="💊 Empiric Treatment Options" defaultOpen={true}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {currentGuide.treatments.map((t, i) => (
                <TreatmentCard key={i} option={t} />
              ))}
            </div>
          </CollapsibleSection>

          {/* Stewardship Pearls */}
          <CollapsibleSection title="⭐ Stewardship Pearls" defaultOpen={false}>
            <ul className="space-y-2.5">
              {currentGuide.stewardshipPearls.map((pearl, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-neutral-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{pearl}</span>
                </li>
              ))}
            </ul>
          </CollapsibleSection>

          {/* External Resources */}
          <CollapsibleSection title="🔗 External Guidelines & Resources" defaultOpen={false}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {currentGuide.resources.map((res, i) => (
                <a
                  key={i}
                  href={res.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 p-3 rounded-xl border border-neutral-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 transition-colors group"
                >
                  <ExternalLink className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5 group-hover:text-indigo-700" />
                  <div>
                    <p className="text-sm font-medium text-neutral-800 group-hover:text-indigo-800 leading-snug">
                      {res.label}
                    </p>
                    <p className="text-xs text-neutral-500 mt-0.5">{res.org}</p>
                  </div>
                </a>
              ))}
            </div>
          </CollapsibleSection>

          {/* C. diff Risk Calculator on CDI tab */}
          {currentGuide.key === 'cdiff' && (
            <CollapsibleSection title="🧮 C. difficile Risk Score Calculator" defaultOpen={true}>
              <CdiffRiskCalculator />
            </CollapsibleSection>
          )}

        </div>
      )}
    </div>
  );
};

export default TreatmentGuidelines;
