import type { SBARHandoff } from '../types/ai';
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

const MAX_SECTION_LENGTH = 600;

export { RESP_KEYWORDS, GI_KEYWORDS, CLUSTER_KEYWORDS };

export function generateSBARHandoff(
  entries: ShiftLogEntry[],
  facilityName: string,
  shiftLabel: string
): SBARHandoff {
  const sorted = [...entries].sort(
    (a, b) => new Date(a.createdAtISO).getTime() - new Date(b.createdAtISO).getTime()
  );
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const lower = (e: ShiftLogEntry) => e.body.toLowerCase();

  const respEntries = entries.filter(e => RESP_KEYWORDS.some(k => lower(e).includes(k)));
  const giEntries = entries.filter(e => GI_KEYWORDS.some(k => lower(e).includes(k)));
  const isoEntries = entries.filter(e => lower(e).includes('isolation') || lower(e).includes('precaution'));
  const providerNotifs = entries.filter(e =>
    lower(e).includes('notif') || lower(e).includes('doctor') || lower(e).includes(' md ') || lower(e).includes('physician')
  );
  const testEntries = entries.filter(e =>
    lower(e).includes('test') || lower(e).includes('swab') || lower(e).includes('culture') || lower(e).includes('lab order')
  );
  const clusterEntries = entries.filter(e => CLUSTER_KEYWORDS.some(k => lower(e).includes(k)));

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const situationParts: string[] = [
    `${facilityName} — ${shiftLabel}.`,
    `${entries.length} shift log entr${entries.length === 1 ? 'y' : 'ies'} recorded.`,
  ];
  if (respEntries.length > 0)
    situationParts.push(`${respEntries.length} entr${respEntries.length === 1 ? 'y' : 'ies'} document respiratory symptoms.`);
  if (giEntries.length > 0)
    situationParts.push(`${giEntries.length} entr${giEntries.length === 1 ? 'y' : 'ies'} document GI symptoms.`);
  if (clusterEntries.length > 0)
    situationParts.push(`Cluster or outbreak language noted in ${clusterEntries.length} entries — potential emerging situation.`);
  if (respEntries.length === 0 && giEntries.length === 0 && clusterEntries.length === 0)
    situationParts.push('No significant infection concerns identified this shift.');

  const bgParts: string[] = [
    `Facility: ${facilityName}. Shift: ${shiftLabel}.`,
    `Log period: ${first ? fmtTime(first.createdAtISO) : 'N/A'} – ${last ? fmtTime(last.createdAtISO) : 'N/A'}.`,
    `Total entries: ${entries.length}. Respiratory: ${respEntries.length}. GI: ${giEntries.length}.`,
    `Isolation-related entries: ${isoEntries.length}.`,
    `Provider notification entries: ${providerNotifs.length}.`,
    `Test/lab order entries: ${testEntries.length}.`,
  ];

  const totalSymp = respEntries.length + giEntries.length;
  let assessment = '';
  if (clusterEntries.length >= 2 || totalSymp >= 5) {
    assessment = `Elevated infection risk. Pattern consistent with a potential ${respEntries.length >= giEntries.length ? 'respiratory' : 'GI'} cluster event. Immediate review and outbreak response consideration warranted.`;
  } else if (totalSymp >= 2) {
    assessment = `Moderate infection activity. ${totalSymp} symptomatic entries documented. Continued close monitoring recommended. No definitive cluster confirmed at this time.`;
  } else if (totalSymp === 1) {
    assessment = `Isolated infection concern noted. Single symptomatic entry documented. Monitor for additional cases over next 24–48 hours.`;
  } else {
    assessment = `Shift activity within expected parameters. No infection concerns identified. Routine surveillance continues.`;
  }

  const recParts: string[] = [];
  if (clusterEntries.length >= 2 || totalSymp >= 5)
    recParts.push('Initiate outbreak investigation protocol. Notify DON and Medical Director immediately.');
  if (isoEntries.length < totalSymp && totalSymp > 0)
    recParts.push('Verify isolation precautions are in place for all symptomatic residents.');
  if (providerNotifs.length === 0 && totalSymp > 0)
    recParts.push('Ensure Medical Director has been notified of symptomatic residents.');
  if (testEntries.length === 0 && totalSymp > 0)
    recParts.push('Consider diagnostic testing for symptomatic residents (COVID, Flu, RSV, C. diff as indicated).');
  recParts.push('Incoming shift to review all flagged entries and update resident status as needed.');
  if (recParts.length === 1)
    recParts.unshift('Continue routine infection surveillance.');

  const trim = (parts: string[]) => parts.join(' ').slice(0, MAX_SECTION_LENGTH);

  return {
    situation: trim(situationParts),
    background: trim(bgParts),
    assessment,
    recommendation: trim(recParts),
    generatedAt: new Date().toISOString(),
    shiftLabel,
    entryCount: entries.length,
    rulesSummary: `Rule-based analysis of ${entries.length} shift log entries. No external AI service used.`,
  };
}
