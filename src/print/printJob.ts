export const PRINT_JOB_KINDS = [
  'audit-report',
  'antibiogram',
  'linelist',
  'outbreak',
  'report-export',
  'resident-census',
  'floor-map',
  'note',
  'dom',
] as const;

export type PrintJobKind = (typeof PRINT_JOB_KINDS)[number];

export interface PrintJob {
  id: string;
  kind: PrintJobKind;
  createdAt: number;
  title: string;
  payload: unknown;
}
