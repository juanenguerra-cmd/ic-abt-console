export const PRINT_ALLOWED = {
  precautions: true,
  census: false,
  residentProfile: false,
  consents: false,
  reports: false,
  audits: false,
} as const;

export type PrintFeature = keyof typeof PRINT_ALLOWED;

export function isPrintFeatureEnabled(feature?: PrintFeature): boolean {
  return feature ? PRINT_ALLOWED[feature] : false;
}
