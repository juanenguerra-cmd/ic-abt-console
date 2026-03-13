import { FacilityStore, ExportProfile, Resident, ResidentRef, QuarantineResident } from "../domain/models";

// Helper to resolve dot notation paths
const resolvePath = (obj: any, path: string): any => {
  if (!obj) return undefined;
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

// PHI Fields that need redaction if includePHI is false
const PHI_FIELDS = ["displayName", "firstName", "lastName", "dob", "mrn", "residentRef.id", "name"];

/**
 * Resolves a ResidentRef to the full resident or quarantine record.
 * Use this instead of ad-hoc `residentRef.kind === 'mrn' ? store.residents[...] : store.quarantine[...]` lookups.
 */
export const resolveResident = (
  store: FacilityStore,
  ref: ResidentRef
): Resident | QuarantineResident | undefined => {
  if (ref.kind === 'mrn') return store.residents[ref.id];
  return store.quarantine[ref.id];
};

/**
 * Returns the canonical MRN for an mrn-type ResidentRef, or the tempId for a
 * quarantine resident. Use wherever a single identifier string is needed.
 */
export const getResidentMrn = (store: FacilityStore, ref: ResidentRef): string | undefined => {
  if (ref.kind === 'mrn') return ref.id;
  return store.quarantine[ref.id]?.tempId;
};

/**
 * Enriches a Resident record with a unified `location` field that falls back
 * to the legacy `currentUnit`/`currentRoom` fields for backward compatibility.
 */
const withUnifiedLocation = (r: Resident): Resident & { location: { unit?: string; room?: string } } => ({
  ...r,
  location: {
    unit: r.location?.unit ?? r.currentUnit,
    room: r.location?.room ?? r.currentRoom,
  },
});

/**
 * Applies withUnifiedLocation only when the resolved record is a full Resident
 * (i.e. resolved via MRN, not a quarantine placeholder).
 */
const withLocation = (r: Resident | QuarantineResident | undefined) =>
  r && 'mrn' in r ? withUnifiedLocation(r as Resident) : r;

export const generateCSV = (store: FacilityStore, profile: ExportProfile): string => {
  const data = getDataForProfile(store, profile);
  const headers = profile.columns.map(c => c.header).join(",");
  const rows = data.map(item => {
    return profile.columns.map(col => {
      let value = resolvePath(item, col.fieldPath);
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
      if (col.transform) {
        if (col.transform === "date" && value) value = new Date(value).toLocaleDateString();
        else if (col.transform === "boolean") value = value ? "Yes" : "No";
      }
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

export const getDataForProfile = (store: FacilityStore, profile: ExportProfile): any[] => {
  let data: any[] = [];
  switch (profile.dataset) {
    case "residents":
      data = (Object.values(store.residents) as Resident[]).filter(r => !r.isHistorical && !r.backOfficeOnly).map(withUnifiedLocation);
      break;
    case "abts":
      data = Object.values(store.abts).map(abt => {
        const resident = resolveResident(store, abt.residentRef);
        return { ...abt, resident: withLocation(resident) };
      });
      break;
    case "vaxEvents": // @deprecated alias — use "vax"
    case "vax":
      data = Object.values(store.vaxEvents).map(vax => {
        const resident = resolveResident(store, vax.residentRef);
        return {
          ...vax,
          // Expose canonical date with backward-compatible fallback
          canonicalDate: vax.dateGiven ?? vax.administeredDate,
          resident: withLocation(resident),
        };
      });
      break;
    case "infections":
      data = Object.values(store.infections).map(inf => {
        const resident = resolveResident(store, inf.residentRef);
        return { ...inf, resident: withLocation(resident) };
      });
      break;
    case "outbreaks":
      data = Object.values(store.outbreaks);
      break;
    case "outbreakCases":
      data = Object.values(store.outbreakCases).map(c => {
        const resident = resolveResident(store, c.residentRef);
        return { ...c, resident: withLocation(resident) };
      });
      break;
    case "custom": {
      const hasAbtCols = profile.columns.some(c => c.fieldPath.startsWith('abt.'));
      const hasIpCols = profile.columns.some(c => c.fieldPath.startsWith('ip.'));
      const hasVaxCols = profile.columns.some(c => c.fieldPath.startsWith('vax.'));
      if (hasAbtCols) {
        data = Object.values(store.abts).map(abt => {
          const resident = resolveResident(store, abt.residentRef);
          return { resident: withLocation(resident), abt };
        });
      } else if (hasIpCols) {
        data = Object.values(store.infections).map(inf => {
          const resident = resolveResident(store, inf.residentRef);
          return { resident: withLocation(resident), ip: inf };
        });
      } else if (hasVaxCols) {
        data = Object.values(store.vaxEvents).map(vax => {
          const resident = resolveResident(store, vax.residentRef);
          return {
            resident: withLocation(resident),
            vax: {
              ...vax,
              // Expose canonical date with backward-compatible fallback
              canonicalDate: vax.dateGiven ?? vax.administeredDate,
            },
          };
        });
      } else {
        data = (Object.values(store.residents) as Resident[]).filter(r => !r.isHistorical && !r.backOfficeOnly).map(r => ({ resident: withUnifiedLocation(r) }));
      }
      break;
    }
    default:
      console.warn(`Unknown dataset: ${profile.dataset}`);
      return [];
  }
  return data;
};
