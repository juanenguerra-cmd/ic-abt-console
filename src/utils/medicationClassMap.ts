/**
 * Medication-to-class mapping for antibiotic stewardship.
 * Maps lowercase medication name substrings to their drug class.
 * Used to auto-detect the drug class when a medication name is entered.
 */

export const MEDICATION_CLASS_OPTIONS = [
  "Penicillins",
  "Cephalosporins",
  "Carbapenems",
  "Macrolides",
  "Tetracyclines",
  "Fluoroquinolones",
  "Sulfonamides",
  "Glycopeptides",
  "Aminoglycosides",
  "Other",
] as const;

export type MedicationClass = (typeof MEDICATION_CLASS_OPTIONS)[number];

/**
 * Ordered list of [substring, class] pairs.
 * The first match wins, so more specific entries should come first.
 */
const MEDICATION_CLASS_RULES: [string, MedicationClass][] = [
  // Penicillins
  ["amoxicillin", "Penicillins"],
  ["ampicillin", "Penicillins"],
  ["penicillin", "Penicillins"],
  ["nafcillin", "Penicillins"],
  ["oxacillin", "Penicillins"],
  ["dicloxacillin", "Penicillins"],
  ["flucloxacillin", "Penicillins"],
  ["cloxacillin", "Penicillins"],
  ["piperacillin", "Penicillins"],
  ["ticarcillin", "Penicillins"],
  ["augmentin", "Penicillins"],
  ["unasyn", "Penicillins"],
  ["zosyn", "Penicillins"],
  ["timentin", "Penicillins"],

  // Cephalosporins
  ["cephalexin", "Cephalosporins"],
  ["cefazolin", "Cephalosporins"],
  ["ceftriaxone", "Cephalosporins"],
  ["cefdinir", "Cephalosporins"],
  ["cefixime", "Cephalosporins"],
  ["cefuroxime", "Cephalosporins"],
  ["cefpodoxime", "Cephalosporins"],
  ["cefepime", "Cephalosporins"],
  ["ceftazidime", "Cephalosporins"],
  ["cefotaxime", "Cephalosporins"],
  ["cefoxitin", "Cephalosporins"],
  ["cefotetan", "Cephalosporins"],
  ["cefadroxil", "Cephalosporins"],
  ["cephalothin", "Cephalosporins"],
  ["cefaclor", "Cephalosporins"],
  ["cefprozil", "Cephalosporins"],
  ["ceftolozane", "Cephalosporins"],
  ["cefiderocol", "Cephalosporins"],
  ["rocephin", "Cephalosporins"],
  ["keflex", "Cephalosporins"],
  ["ancef", "Cephalosporins"],
  ["omnicef", "Cephalosporins"],
  ["maxipime", "Cephalosporins"],
  ["cef", "Cephalosporins"],

  // Carbapenems
  ["meropenem", "Carbapenems"],
  ["imipenem", "Carbapenems"],
  ["ertapenem", "Carbapenems"],
  ["doripenem", "Carbapenems"],
  ["cilastatin", "Carbapenems"],
  ["merrem", "Carbapenems"],
  ["invanz", "Carbapenems"],
  ["primaxin", "Carbapenems"],

  // Macrolides
  ["azithromycin", "Macrolides"],
  ["clarithromycin", "Macrolides"],
  ["erythromycin", "Macrolides"],
  ["fidaxomicin", "Macrolides"],
  ["roxithromycin", "Macrolides"],
  ["zithromax", "Macrolides"],
  ["z-pak", "Macrolides"],
  ["biaxin", "Macrolides"],
  ["dificid", "Macrolides"],

  // Tetracyclines
  ["doxycycline", "Tetracyclines"],
  ["minocycline", "Tetracyclines"],
  ["tetracycline", "Tetracyclines"],
  ["tigecycline", "Tetracyclines"],
  ["omadacycline", "Tetracyclines"],
  ["eravacycline", "Tetracyclines"],
  ["vibramycin", "Tetracyclines"],
  ["tygacil", "Tetracyclines"],
  ["nuzyra", "Tetracyclines"],

  // Fluoroquinolones
  ["ciprofloxacin", "Fluoroquinolones"],
  ["levofloxacin", "Fluoroquinolones"],
  ["moxifloxacin", "Fluoroquinolones"],
  ["ofloxacin", "Fluoroquinolones"],
  ["norfloxacin", "Fluoroquinolones"],
  ["gemifloxacin", "Fluoroquinolones"],
  ["delafloxacin", "Fluoroquinolones"],
  ["cipro", "Fluoroquinolones"],
  ["levaquin", "Fluoroquinolones"],
  ["avelox", "Fluoroquinolones"],
  ["floxacin", "Fluoroquinolones"],

  // Sulfonamides / TMP-SMX
  ["sulfamethoxazole", "Sulfonamides"],
  ["trimethoprim", "Sulfonamides"],
  ["cotrimoxazole", "Sulfonamides"],
  ["sulfadiazine", "Sulfonamides"],
  ["sulfisoxazole", "Sulfonamides"],
  ["bactrim", "Sulfonamides"],
  ["septra", "Sulfonamides"],
  ["tmp-smx", "Sulfonamides"],
  ["tmp/smx", "Sulfonamides"],
  ["smx/tmp", "Sulfonamides"],

  // Glycopeptides
  ["vancomycin", "Glycopeptides"],
  ["teicoplanin", "Glycopeptides"],
  ["oritavancin", "Glycopeptides"],
  ["dalbavancin", "Glycopeptides"],
  ["televancin", "Glycopeptides"],
  ["telavancin", "Glycopeptides"],
  ["vanco", "Glycopeptides"],
  ["vancocin", "Glycopeptides"],

  // Aminoglycosides
  ["gentamicin", "Aminoglycosides"],
  ["tobramycin", "Aminoglycosides"],
  ["amikacin", "Aminoglycosides"],
  ["streptomycin", "Aminoglycosides"],
  ["neomycin", "Aminoglycosides"],
  ["kanamycin", "Aminoglycosides"],
  ["plazomicin", "Aminoglycosides"],
];

/**
 * Infers the drug class from a medication name using substring matching.
 * Returns the matched class string, or an empty string if no match is found.
 */
export function detectMedicationClass(medicationName: string): MedicationClass | "" {
  const lower = medicationName.trim().toLowerCase();
  if (!lower) return "";
  for (const [keyword, cls] of MEDICATION_CLASS_RULES) {
    if (lower.includes(keyword)) {
      return cls;
    }
  }
  return "";
}
