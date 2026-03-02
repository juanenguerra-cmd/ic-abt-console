import { SymptomClass } from '../domain/models';

export interface SymptomHashtagDefinition {
  hashtag: string;
  symptomClass: SymptomClass;
}

export const SYMPTOM_HASHTAG_LIBRARY: SymptomHashtagDefinition[] = [
  { hashtag: '#cough', symptomClass: 'resp' },
  { hashtag: '#runnynose', symptomClass: 'resp' },
  { hashtag: '#fever', symptomClass: 'resp' },
  { hashtag: '#sorethroat', symptomClass: 'resp' },
  { hashtag: '#sob', symptomClass: 'resp' },
  { hashtag: '#congestion', symptomClass: 'resp' },
  { hashtag: '#wheezing', symptomClass: 'resp' },
  { hashtag: '#chills', symptomClass: 'resp' },
  { hashtag: '#fatigue', symptomClass: 'resp' },
  { hashtag: '#diarrhea', symptomClass: 'gi' },
  { hashtag: '#vomiting', symptomClass: 'gi' },
  { hashtag: '#nausea', symptomClass: 'gi' },
  { hashtag: '#abdominalpain', symptomClass: 'gi' },
  { hashtag: '#stomachcramping', symptomClass: 'gi' },
  { hashtag: '#lossofappetite', symptomClass: 'gi' },
];

const hashtagClassMap = new Map<string, SymptomClass>(
  SYMPTOM_HASHTAG_LIBRARY.map(({ hashtag, symptomClass }) => [hashtag.toLowerCase(), symptomClass]),
);

export function normalizeSymptomHashtag(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return '';
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

export function getSymptomClassForHashtag(value: string): SymptomClass | undefined {
  return hashtagClassMap.get(normalizeSymptomHashtag(value));
}
