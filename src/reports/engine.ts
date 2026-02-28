import { FacilityStore, ExportProfile, Resident } from "../domain/models";

// Helper to resolve dot notation paths
const resolvePath = (obj: any, path: string): any => {
  if (!obj) return undefined;
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

// PHI Fields that need redaction if includePHI is false
const PHI_FIELDS = ["displayName", "firstName", "lastName", "dob", "mrn", "residentRef.id", "name"];

export const generateCSV = (store: FacilityStore, profile: ExportProfile): string => {
  let data: any[] = [];

  // 1. Select Dataset and Hydrate
  switch (profile.dataset) {
    case "residents":
      data = (Object.values(store.residents) as Resident[]).filter(r => !r.isHistorical && !r.backOfficeOnly);
      break;
    case "abts":
      data = Object.values(store.abts).map(abt => {
        const resident = abt.residentRef.kind === 'mrn' 
          ? store.residents[abt.residentRef.id] 
          : store.quarantine[abt.residentRef.id];
        return { ...abt, resident };
      });
      break;
    case "infections":
      data = Object.values(store.infections).map(inf => {
        const resident = inf.residentRef.kind === 'mrn' 
          ? store.residents[inf.residentRef.id] 
          : store.quarantine[inf.residentRef.id];
        return { ...inf, resident };
      });
      break;
    case "outbreaks":
      data = Object.values(store.outbreaks);
      break;
    case "outbreakCases":
      data = Object.values(store.outbreakCases).map(c => {
        const resident = c.residentRef.kind === 'mrn' 
          ? store.residents[c.residentRef.id] 
          : store.quarantine[c.residentRef.id];
        return { ...c, resident };
      });
      break;
    default:
      console.warn(`Unknown dataset: ${profile.dataset}`);
      return "";
  }

  // 2. Generate Header Row
  const headers = profile.columns.map(c => c.header).join(",");
  
  // 3. Generate Data Rows
  const rows = data.map(item => {
    return profile.columns.map(col => {
      let value = resolvePath(item, col.fieldPath);

      // Redaction Logic
      if (!profile.includePHI) {
        const pathLower = col.fieldPath.toLowerCase();
        if (pathLower.includes("mrn") || pathLower.includes("residentref.id")) {
          const strVal = String(value || "");
          value = strVal.length > 4 ? `***-${strVal.slice(-4)}` : "***-XXXX";
        } else if (pathLower.includes("name") || pathLower.includes("displayname") || pathLower.includes("firstname") || pathLower.includes("lastname")) {
          value = "ANONYMIZED";
        } else if (pathLower.includes("dob")) {
          value = "REDACTED";
        }
      }

      // Transforms
      if (col.transform) {
        if (col.transform === "date" && value) {
          value = new Date(value).toLocaleDateString();
        } else if (col.transform === "boolean") {
          value = value ? "Yes" : "No";
        }
      }

      // CSV Escaping
      if (value === undefined || value === null) return "";
      const strVal = String(value);
      if (strVal.includes(",") || strVal.includes('"') || strVal.includes("\n")) {
        return `"${strVal.replace(/"/g, '""')}"`;
      }
      return strVal;
    }).join(",");
  });

  return [headers, ...rows].join("\n");
};
