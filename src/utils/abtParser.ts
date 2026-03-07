
import { resolveMedication, MedicationMatch } from './medicationLibrary';

export interface ParsedABT {
  medicationId?: string;
  medicationName: string;
  enteredText: string;
  dose?: string;
  doseUnit?: string;
  route?: string;
  frequency?: string;
  confidence: 'high' | 'medium' | 'low';
  issues: string[];
}

const ROUTES = ['PO', 'IV', 'IM', 'SC', 'SQ', 'TOPICAL', 'INHALED', 'GT', 'PEG', 'NG', 'PR', 'SL'];
const FREQUENCIES = ['DAILY', 'QD', 'QDAY', 'BID', 'TID', 'QID', 'Q4H', 'Q6H', 'Q8H', 'Q12H', 'Q24H', 'WEEKLY', 'X1', 'ONCE', 'PRN', 'QHS', 'QAM', 'QPM'];
const UNITS = ['MG', 'G', 'GM', 'MCG', 'ML', 'UNITS', 'U', 'TAB', 'CAP', 'TABLET', 'CAPSULE'];

export function parseAbtString(text: string): ParsedABT {
  const cleanText = text.trim();
  const upperText = cleanText.toUpperCase();
  const tokens = cleanText.split(/\s+/);

  let medicationMatch: MedicationMatch | null = null;
  let dose = '';
  let doseUnit = '';
  let route = '';
  let frequency = '';
  let issues: string[] = [];

  // 1. Attempt to resolve medication from the full string first (best for multi-word meds)
  // We'll try to match the longest possible substring from the start
  for (let i = tokens.length; i > 0; i--) {
    const sub = tokens.slice(0, i).join(' ');
    const match = resolveMedication(sub);
    if (match) {
      medicationMatch = match;
      // Remove the matched medication from the tokens to parse the rest
      tokens.splice(0, i);
      break;
    }
  }

  // If no medication found at start, try to find it anywhere (less reliable)
  if (!medicationMatch) {
    // This is harder. Let's assume the first unknown token(s) might be the med.
    // For now, let's rely on the resolver finding something.
    // If not, we might flag it.
    issues.push('Medication not found in library');
  }

  // 2. Parse remaining tokens for Dose, Route, Frequency
  // We'll iterate through tokens and try to match patterns
  
  const remainingText = tokens.join(' ').toUpperCase();
  
  // Regex for Dose + Unit (e.g., 500mg, 500 mg, 1 g, 1g)
  // Look for number followed optionally by space and then a unit
  const doseRegex = /(\d+(?:\.\d+)?)\s*([A-Z]+)/g;
  let match;
  while ((match = doseRegex.exec(remainingText)) !== null) {
    const val = match[1];
    const unit = match[2];
    if (UNITS.includes(unit)) {
      if (!dose) {
        dose = val;
        doseUnit = unit;
      } else {
        // Multiple doses found? Maybe a range or complex order.
        // For now, ignore or append?
      }
    }
  }

  // Regex for Route
  for (const r of ROUTES) {
    // Check for exact word match to avoid partials like 'PO' in 'POLY'
    const regex = new RegExp(`\\b${r}\\b`);
    if (regex.test(remainingText)) {
      route = r;
      break; 
    }
  }

  // Regex for Frequency
  for (const f of FREQUENCIES) {
    const regex = new RegExp(`\\b${f}\\b`);
    if (regex.test(remainingText)) {
      frequency = f;
      break;
    }
  }

  // Refine Route/Frequency mapping
  if (route === 'SQ') route = 'SC';
  if (frequency === 'QD' || frequency === 'QDAY') frequency = 'Daily';

  // Determine confidence
  let confidence: 'high' | 'medium' | 'low' = 'high';

  if (!medicationMatch) {
    confidence = 'low';
  } else if (medicationMatch.confidence === 'fuzzy') {
    confidence = 'medium';
    issues.push('Medication match is fuzzy');
  }

  if (!dose) {
    confidence = 'medium';
    issues.push('Dose missing');
  }
  
  if (!route) {
    // Route might be optional or implied, but usually desired
    // confidence = 'medium'; 
    // issues.push('Route missing');
  }

  return {
    medicationId: medicationMatch?.medication.id,
    medicationName: medicationMatch?.medication.name || (tokens.length > 0 ? tokens[0] : cleanText.split(' ')[0]), // Fallback to first word if no match
    enteredText: cleanText,
    dose,
    doseUnit,
    route,
    frequency,
    confidence,
    issues
  };
}
