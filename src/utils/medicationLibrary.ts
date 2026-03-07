
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

export function resolveMedication(term: string): MedicationMatch | null {
  const normalized = term.trim().toLowerCase();
  if (!normalized) return null;

  // 1. Exact canonical match
  const exact = MEDICATION_LIBRARY.find(m => m.name.toLowerCase() === normalized);
  if (exact) return { medication: exact, confidence: 'exact', originalTerm: term };

  // 2. Alias match
  const alias = MEDICATION_LIBRARY.find(m => m.aliases.some(a => a.toLowerCase() === normalized));
  if (alias) return { medication: alias, confidence: 'alias', originalTerm: term };

  // 3. Substring/Fuzzy match (simple implementation)
  // Check if the term is contained in the name or aliases, or vice versa
  const fuzzy = MEDICATION_LIBRARY.find(m => {
    const nameMatch = m.name.toLowerCase().includes(normalized) || normalized.includes(m.name.toLowerCase());
    const aliasMatch = m.aliases.some(a => a.toLowerCase().includes(normalized) || normalized.includes(a.toLowerCase()));
    return nameMatch || aliasMatch;
  });

  if (fuzzy) return { medication: fuzzy, confidence: 'fuzzy', originalTerm: term };

  return null;
}
