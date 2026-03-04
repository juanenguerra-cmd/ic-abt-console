export const PRINT_JOB_KINDS = [
  'audit-report',
  'antibiogram',
  'census-rounding',
  'linelist',
  'outbreak',
  'report-export',
  'resident-census',
  'floor-map',
  'note',
  'dom',
] as const;

export type PrintJobKind = (typeof PRINT_JOB_KINDS)[number];

export interface PrintJob<TPayload = unknown> {
  id: string;
  kind: PrintJobKind;
  createdAt: number;
  title?: string;
  payload: TPayload;
}
