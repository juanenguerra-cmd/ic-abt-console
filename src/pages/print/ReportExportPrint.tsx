import React, { useMemo, useState, useEffect } from "react";
import { loadDBAsync } from "../../storage/engine";
import { PrintLayout } from "./PrintLayout";
import { getDataForProfile } from "../../reports/engine";
import { UnifiedDB } from "../../domain/models";

// Helper to resolve dot notation paths
const resolvePath = (obj: any, path: string): any => {
  if (!obj) return undefined;
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

const ReportExportPrint: React.FC = () => {
  const [db, setDb] = useState<UnifiedDB | null>(null);

  useEffect(() => {
    loadDBAsync().then(setDb);
  }, []);

  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const profileId = params.get("profileId");
  const facilityId = db?.data.facilities.activeFacilityId ?? "";
  const facility = db?.data.facilities.byId[facilityId];
  const store = db?.data.facilityData[facilityId];

  const profile = useMemo(() => {
    return store?.exportProfiles?.[profileId || ""];
  }, [store?.exportProfiles, profileId]);

  const data = useMemo(() => {
    if (!profile || !store) return [];
    return getDataForProfile(store, profile);
  }, [store, profile]);

  if (!db) return <div className="p-8 text-center text-neutral-500">Loading…</div>;
  if (!profile) return <div className="p-8 text-red-600">Report profile not found</div>;

  return (
    <PrintLayout
      title={`Report: ${profile.name}`}
      facilityName={facility?.name ?? ""}
      facilityAddress={facility?.address}
      dohId={facility?.dohId}
    >
      <div className="space-y-6">
        <div className="bg-neutral-50 border border-neutral-200 p-4 rounded-md text-sm">
          <p><strong>Dataset:</strong> {profile.dataset}</p>
          <p><strong>Total Records:</strong> {data.length}</p>
          {!profile.includePHI && (
            <p className="text-amber-700 font-medium mt-1">⚠️ PHI Redacted</p>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-100 border-b-2 border-neutral-300">
                {profile.columns.map((col, idx) => (
                  <th key={idx} className="p-2 text-left font-semibold border-r border-neutral-200 last:border-r-0">
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((item, rowIdx) => (
                <tr key={rowIdx} className="border-b border-neutral-200 break-inside-avoid">
                  {profile.columns.map((col, colIdx) => {
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

                    return (
                      <td key={colIdx} className="p-2 align-top border-r border-neutral-200 last:border-r-0">
                        {value !== undefined && value !== null ? String(value) : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={profile.columns.length} className="p-8 text-center text-neutral-500 italic">
                    No data found for this report configuration.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PrintLayout>
  );
};

export default ReportExportPrint;
