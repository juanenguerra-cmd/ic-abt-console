export const PRINT_ALLOWED = {
  precautions: true,
} as const;

export type PrintFeature = keyof typeof PRINT_ALLOWED;

export function isPrintFeatureEnabled(feature?: PrintFeature): boolean {
  return feature ? PRINT_ALLOWED[feature] : false;
}
