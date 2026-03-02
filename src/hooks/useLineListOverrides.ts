import { useCallback } from "react";
import { useDatabase, useFacilityData } from "../app/providers";

export type TemplateType = "ili" | "gi";

interface UseLineListOverridesOptions {
  outbreakId: string;
  facilityId: string;
  template: TemplateType;
}

interface UseLineListOverridesResult {
  overrides: Record<string, string>;
  saveOverride: (rowKey: string, colKey: string, value: string) => void;
}

export function useLineListOverrides({
  outbreakId,
  facilityId,
  template,
}: UseLineListOverridesOptions): UseLineListOverridesResult {
  const { store } = useFacilityData();
  const { updateDB } = useDatabase();

  const overrideKey = `${outbreakId}::${template}`;
  const overrides = store.lineListOverrides?.[overrideKey] || {};

  const saveOverride = useCallback(
    (rowKey: string, colKey: string, value: string) => {
      updateDB((draft) => {
        const facilityData = draft.data.facilityData[facilityId];
        if (!facilityData.lineListOverrides) {
          facilityData.lineListOverrides = {};
        }
        if (!facilityData.lineListOverrides[overrideKey]) {
          facilityData.lineListOverrides[overrideKey] = {};
        }
        const cellKey = `${rowKey}::${colKey}`;
        if (value.trim() === "") {
          delete facilityData.lineListOverrides[overrideKey][cellKey];
        } else {
          facilityData.lineListOverrides[overrideKey][cellKey] = value;
        }
      });
    },
    [updateDB, facilityId, overrideKey]
  );

  return { overrides, saveOverride };
}
