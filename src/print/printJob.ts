export const PRINT_JOB_KINDS = [
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
