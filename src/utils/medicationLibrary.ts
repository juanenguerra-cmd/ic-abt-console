
export interface MedicationEntry {
  id: string;
  name: string; // Canonical name (e.g., "Amoxicillin")
  class: string;
  aliases: string[]; // Brand names, common misspellings
  isAntibiotic: boolean;
}

export const MEDICATION_LIBRARY: MedicationEntry[] = [
  // Penicillins
  { id: "med_amox", name: "Amoxicillin", class: "Penicillins", aliases: ["Amoxil", "Moxatag"], isAntibiotic: true },
  { id: "med_amp", name: "Ampicillin", class: "Penicillins", aliases: ["Principen"], isAntibiotic: true },
  { id: "med_pen_v", name: "Penicillin V", class: "Penicillins", aliases: ["Pen VK", "Veetids"], isAntibiotic: true },
  { id: "med_pen_g", name: "Penicillin G", class: "Penicillins", aliases: ["Pfizerpen"], isAntibiotic: true },
  { id: "med_amox_clav", name: "Amoxicillin-Clavulanate", class: "Penicillins", aliases: ["Augmentin", "Augmentin ES", "Augmentin XR"], isAntibiotic: true },
  { id: "med_pip_tazo", name: "Piperacillin-Tazobactam", class: "Penicillins", aliases: ["Zosyn"], isAntibiotic: true },
  { id: "med_naf", name: "Nafcillin", class: "Penicillins", aliases: [], isAntibiotic: true },
  { id: "med_oxa", name: "Oxacillin", class: "Penicillins", aliases: ["Bactocill"], isAntibiotic: true },
  { id: "med_diclox", name: "Dicloxacillin", class: "Penicillins", aliases: [], isAntibiotic: true },

  // Cephalosporins
  { id: "med_ceph", name: "Cephalexin", class: "Cephalosporins", aliases: ["Keflex"], isAntibiotic: true },
  { id: "med_cefaz", name: "Cefazolin", class: "Cephalosporins", aliases: ["Ancef"], isAntibiotic: true },
  { id: "med_ceftri", name: "Ceftriaxone", class: "Cephalosporins", aliases: ["Rocephin"], isAntibiotic: true },
  { id: "med_cefep", name: "Cefepime", class: "Cephalosporins", aliases: ["Maxipime"], isAntibiotic: true },
  { id: "med_cefdin", name: "Cefdinir", class: "Cephalosporins", aliases: ["Omnicef"], isAntibiotic: true },
  { id: "med_cefurox", name: "Cefuroxime", class: "Cephalosporins", aliases: ["Ceftin", "Zinacef"], isAntibiotic: true },
  { id: "med_cefpod", name: "Cefpodoxime", class: "Cephalosporins", aliases: ["Vantin"], isAntibiotic: true },
  { id: "med_ceftaz", name: "Ceftazidime", class: "Cephalosporins", aliases: ["Fortaz", "Tazicef"], isAntibiotic: true },

  // Fluoroquinolones
  { id: "med_cipro", name: "Ciprofloxacin", class: "Fluoroquinolones", aliases: ["Cipro"], isAntibiotic: true },
  { id: "med_levo", name: "Levofloxacin", class: "Fluoroquinolones", aliases: ["Levaquin"], isAntibiotic: true },
  { id: "med_moxi", name: "Moxifloxacin", class: "Fluoroquinolones", aliases: ["Avelox"], isAntibiotic: true },

  // Macrolides
  { id: "med_azith", name: "Azithromycin", class: "Macrolides", aliases: ["Zithromax", "Z-Pak"], isAntibiotic: true },
  { id: "med_clarith", name: "Clarithromycin", class: "Macrolides", aliases: ["Biaxin"], isAntibiotic: true },
  { id: "med_eryth", name: "Erythromycin", class: "Macrolides", aliases: ["Ery-Tab", "E.E.S."], isAntibiotic: true },
  { id: "med_fidax", name: "Fidaxomicin", class: "Macrolides", aliases: ["Dificid"], isAntibiotic: true },

  // Tetracyclines
  { id: "med_doxy", name: "Doxycycline", class: "Tetracyclines", aliases: ["Vibramycin", "Doryx"], isAntibiotic: true },
  { id: "med_mino", name: "Minocycline", class: "Tetracyclines", aliases: ["Minocin"], isAntibiotic: true },

  // Sulfonamides
  { id: "med_tmp_smx", name: "Trimethoprim-Sulfamethoxazole", class: "Sulfonamides", aliases: ["Bactrim", "Septra", "TMP-SMX", "Cotrimoxazole"], isAntibiotic: true },

  // Glycopeptides
  { id: "med_vanco", name: "Vancomycin", class: "Glycopeptides", aliases: ["Vancocin"], isAntibiotic: true },

  // Nitroimidazoles
  { id: "med_metro", name: "Metronidazole", class: "Nitroimidazoles", aliases: ["Flagyl"], isAntibiotic: true },

  // Nitrofurans
  { id: "med_nitro", name: "Nitrofurantoin", class: "Nitrofurans", aliases: ["Macrobid", "Macrodantin"], isAntibiotic: true },

  // Lincosamides
  { id: "med_clinda", name: "Clindamycin", class: "Lincosamides", aliases: ["Cleocin"], isAntibiotic: true },

  // Carbapenems
  { id: "med_mero", name: "Meropenem", class: "Carbapenems", aliases: ["Merrem"], isAntibiotic: true },
  { id: "med_ertap", name: "Ertapenem", class: "Carbapenems", aliases: ["Invanz"], isAntibiotic: true },
  { id: "med_imi_cil", name: "Imipenem-Cilastatin", class: "Carbapenems", aliases: ["Primaxin"], isAntibiotic: true },

  // Oxazolidinones
  { id: "med_linez", name: "Linezolid", class: "Oxazolidinones", aliases: ["Zyvox"], isAntibiotic: true },
];

export interface MedicationMatch {
  medication: MedicationEntry;
  confidence: 'exact' | 'alias' | 'fuzzy';
  originalTerm: string;
}


// Levenshtein distance for fuzzy matching
function levenshtein(a: string, b: string): number {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export function resolveMedication(term: string): MedicationMatch | null {
  const normalized = term.trim().toLowerCase();
  if (!normalized || normalized.length < 3) return null; // Ignore very short terms

  // 1. Exact canonical match
  const exact = MEDICATION_LIBRARY.find(m => m.name.toLowerCase() === normalized);
  if (exact) return { medication: exact, confidence: 'exact', originalTerm: term };

  // 2. Exact Alias match (Brand names, etc.)
  const alias = MEDICATION_LIBRARY.find(m => m.aliases.some(a => a.toLowerCase() === normalized));
  if (alias) return { medication: alias, confidence: 'alias', originalTerm: term };

  // 3. StartsWith match (Canonical or Alias) - Prioritize matches that start with the term
  const startsWith = MEDICATION_LIBRARY.find(m => 
    m.name.toLowerCase().startsWith(normalized) || 
    m.aliases.some(a => a.toLowerCase().startsWith(normalized))
  );
  if (startsWith) return { medication: startsWith, confidence: 'fuzzy', originalTerm: term };

  // 4. Strict Fuzzy match (Levenshtein distance)
  // Allow 1 edit for length < 5, 2 edits for length >= 5
  const maxDistance = normalized.length < 5 ? 1 : 2;
  
  let bestMatch: MedicationEntry | null = null;
  let minDistance = Infinity;

  for (const med of MEDICATION_LIBRARY) {
    // Check canonical name
    const nameDist = levenshtein(normalized, med.name.toLowerCase());
    if (nameDist <= maxDistance && nameDist < minDistance) {
      minDistance = nameDist;
      bestMatch = med;
    }

    // Check aliases
    for (const alias of med.aliases) {
      const aliasDist = levenshtein(normalized, alias.toLowerCase());
      if (aliasDist <= maxDistance && aliasDist < minDistance) {
        minDistance = aliasDist;
        bestMatch = med;
      }
    }
  }

  if (bestMatch) return { medication: bestMatch, confidence: 'fuzzy', originalTerm: term };

  return null;
}
