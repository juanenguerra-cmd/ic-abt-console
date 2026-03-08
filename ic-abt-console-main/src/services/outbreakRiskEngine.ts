import type { OutbreakRiskResult } from '../types/ai';
import type { ShiftLogEntry } from '../domain/models';

const RESP_KEYWORDS = [
  'cough', 'fever', 'shortness of breath', 'sob', 'respiratory',
  'covid', 'influenza', 'flu', 'rsv', 'pneumonia', 'uri', 'urti',
  'runny nose', 'congestion', 'sore throat', 'wheezing', 'bronchitis',
  'chest pain', 'chills', 'myalgia', 'body ache', 'loss of taste',
  'loss of smell', 'hypoxia', 'oxygen', 'o2 sat',
];

const GI_KEYWORDS = [
  'diarrhea', 'vomiting', 'nausea', 'gastro', 'gi', 'c. diff',
  'cdiff', 'c diff', 'norovirus', 'loose stool', 'abdominal',
  'stomach', 'cramping', 'blood in stool', 'bowel', 'emesis',
];

const CLUSTER_KEYWORDS = [
  'multiple residents', 'several residents', 'new onset',
  'spreading', 'cluster', 'outbreak', 'unit-wide', 'wing-wide',
  'contact precaution', 'droplet precaution', 'airborne precaution',
  'isolation initiated', 'cohorting', 'three residents',
  'four residents', 'five residents',
];

const PATHOGEN_MAP: Record<string, string> = {
  'influenza': 'Influenza',
  'flu': 'Influenza',
  'covid': 'COVID-19',
  'coronavirus': 'COVID-19',
  'rsv': 'RSV',
  'c. diff': 'C. difficile',
  'cdiff': 'C. difficile',
  'c diff': 'C. difficile',
  'norovirus': 'Norovirus',
  'mrsa': 'MRSA',
  'vre': 'VRE',
  'scabies': 'Scabies',
  'pneumonia': 'Pneumonia (unspecified)',
};

function extractUnitMentions(content: string): string[] {
  const found: string[] = [];
  const patterns = [
    /\b(east|west|north|south)\s+wing\b/gi,
    /\bunit\s+[a-z0-9]+\b/gi,
    /\bfloor\s+[0-9]+\b/gi,
    /\b[0-9]+\s+(north|south|east|west)\b/gi,
    /\bmemory\s+care\b/gi,
    /\brehab\b/gi,
    /\blong[- ]term\b/gi,
    /\bskilled\s+nursing\b/gi,
  ];
  patterns.forEach(p => {
    const matches = content.match(p);
    if (matches) found.push(...matches.map(m => m.trim().toLowerCase()));
  });
  return [...new Set(found)];
}

export function analyzeOutbreakRisk(
  entries: ShiftLogEntry[]
): OutbreakRiskResult {
  const WINDOW_MS = 72 * 60 * 60 * 1000;
  const cutoff = Date.now() - WINDOW_MS;
  const recent = entries.filter(
    e => new Date(e.createdAtISO).getTime() >= cutoff
  );

  if (recent.length < 3) {
    return {
      riskDetected: false,
      riskLevel: 'low',
      summary: `Only ${recent.length} shift log entr${recent.length === 1 ? 'y' : 'ies'} in the last 72 hours. Minimum 3 required for pattern analysis.`,
      triggeredRules: [],
      analyzedEntryCount: recent.length,
      analyzedWindowHours: 72,
    };
  }

  const scored = recent.map(e => {
    const lower = e.body.toLowerCase();
    return {
      entry: e,
      respHits: RESP_KEYWORDS.filter(k => lower.includes(k)),
      giHits: GI_KEYWORDS.filter(k => lower.includes(k)),
      clusterHits: CLUSTER_KEYWORDS.filter(k => lower.includes(k)),
      units: extractUnitMentions(lower),
      pathogenHints: Object.keys(PATHOGEN_MAP).filter(k => lower.includes(k)),
    };
  });

  const respEntries = scored.filter(s => s.respHits.length > 0);
  const giEntries = scored.filter(s => s.giHits.length > 0);
  const clusterEntries = scored.filter(s => s.clusterHits.length > 0);

  const unitFreq: Record<string, number> = {};
  scored.forEach(s => s.units.forEach(u => {
    unitFreq[u] = (unitFreq[u] ?? 0) + 1;
  }));
  const topUnit = Object.entries(unitFreq)
    .sort((a, b) => b[1] - a[1])[0]?.[0];

  const allPathogenHints = scored.flatMap(s => s.pathogenHints);
  const pathogenFreq: Record<string, number> = {};
  allPathogenHints.forEach(p => {
    pathogenFreq[p] = (pathogenFreq[p] ?? 0) + 1;
  });
  const topPathogenKey = Object.entries(pathogenFreq)
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  const suspectedPathogen = topPathogenKey
    ? PATHOGEN_MAP[topPathogenKey]
    : respEntries.length > giEntries.length
    ? 'Unspecified Respiratory Pathogen'
    : giEntries.length > 0
    ? 'Unspecified GI Pathogen'
    : undefined;

  const triggeredRules: string[] = [];
  const dominant = Math.max(respEntries.length, giEntries.length);
  const dominantLabel = respEntries.length >= giEntries.length
    ? 'Respiratory (ILI)' : 'GI';

  if (respEntries.length >= 3)
    triggeredRules.push(`≥3 respiratory symptom entries in 72h (${respEntries.length} entries)`);
  if (giEntries.length >= 3)
    triggeredRules.push(`≥3 GI symptom entries in 72h (${giEntries.length} entries)`);
  if (clusterEntries.length >= 2)
    triggeredRules.push(`Cluster/outbreak language in ${clusterEntries.length} entries`);
  if (topUnit && unitFreq[topUnit] >= 2)
    triggeredRules.push(`${unitFreq[topUnit]} entries reference "${topUnit}"`);
  if (dominant >= 5)
    triggeredRules.push(`High volume: ${dominant} ${dominantLabel} entries`);

  let riskLevel: 'low' | 'moderate' | 'high' = 'low';
  let riskDetected = false;

  if (dominant >= 5 || clusterEntries.length >= 3) {
    riskLevel = 'high';
    riskDetected = true;
  } else if (dominant >= 3 || clusterEntries.length >= 2) {
    riskLevel = 'moderate';
    riskDetected = true;
  }

  if (!riskDetected) {
    return {
      riskDetected: false,
      riskLevel: 'low',
      summary: `${recent.length} entries reviewed. ${dominant > 0 ? `${dominant} mention ${dominantLabel} symptoms — below threshold for alert. ` : 'No significant symptom patterns detected.'}`,
      triggeredRules,
      analyzedEntryCount: recent.length,
      analyzedWindowHours: 72,
    };
  }

  const summary =
    `${dominant} shift log entries in the last 72 hours document ${dominantLabel} symptoms.` +
    `${clusterEntries.length > 0 ? ` ${clusterEntries.length} entries contain cluster/outbreak language. ` : ''}` +
    `${topUnit ? ` Highest concentration of entries references "${topUnit}". ` : ''}` +
    `${suspectedPathogen ? ` Suspected: ${suspectedPathogen}. ` : ''}`;

  const recommendedAction =
    riskLevel === 'high'
      ? 'Initiate outbreak investigation protocol immediately. Notify DON and Medical Director. Implement contact/droplet precautions and cohort symptomatic residents. Complete line list within 24 hours.'
      : 'Increase symptom surveillance frequency. Review isolation status for all flagged residents. Notify Medical Director if additional cases emerge. Update line list.';

  return {
    riskDetected: true,
    riskLevel,
    summary,
    affectedUnit: topUnit,
    suspectedPathogen,
    recommendedAction,
    triggeredRules,
    analyzedEntryCount: recent.length,
    analyzedWindowHours: 72,
  };
}
