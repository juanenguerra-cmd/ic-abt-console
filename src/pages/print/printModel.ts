export interface PrintModelSection {
  key: string;
  label: string;
  count: number;
}

export interface PrintModel<TPayload = unknown> {
  facilityName: string;
  reportTitle: string;
  generatedAt: string;
  filtersSummary: string;
  sections: PrintModelSection[];
  payload: TPayload;
}

interface BuildPrintModelInput<TPayload> {
  facilityName: string;
  reportTitle: string;
  filtersSummary?: string;
  sections: PrintModelSection[];
  payload: TPayload;
}

export const buildPrintModel = <TPayload>(input: BuildPrintModelInput<TPayload>): PrintModel<TPayload> => {
  return {
    facilityName: input.facilityName,
    reportTitle: input.reportTitle,
    generatedAt: new Date().toISOString(),
    filtersSummary: input.filtersSummary?.trim() || "All records",
    sections: input.sections,
    payload: input.payload,
  };
};

export const validatePrintableContent = (model: PrintModel): string[] => {
  const warnings: string[] = [];

  if (!model.facilityName.trim()) warnings.push("Missing facility name.");
  if (!model.reportTitle.trim()) warnings.push("Missing report title.");
  if (!model.generatedAt.trim()) warnings.push("Missing generated timestamp.");
  if (!model.filtersSummary.trim()) warnings.push("Missing filters summary.");

  // Empty datasets are valid for many reports when filters exclude records.
  // Individual print views should render an explicit "No records match your filters" section.

  return warnings;
};
