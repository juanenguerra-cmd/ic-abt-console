import { PrintJob, PrintJobKind } from './printJob';
import { cleanupExpiredPrintJobs, savePrintJob } from './printJobStore';

function createJobId(): string {
  return crypto.randomUUID();
}

export async function startPrint<TPayload>(
  kind: PrintJobKind,
  titleOrBuildPayload: string | (() => Promise<TPayload> | TPayload),
  maybeBuildPayload?: () => Promise<TPayload> | TPayload,
): Promise<void> {
  const buildPayload =
    typeof titleOrBuildPayload === 'function'
      ? titleOrBuildPayload
      : maybeBuildPayload;

  if (!buildPayload) {
    throw new Error('startPrint requires a payload builder function.');
  }

  const w = window.open('/print/loading', '_blank', 'noopener,noreferrer');
  if (!w) {
    window.alert('Popup blocked. Please allow popups for this site to print.');
    return;
  }

  try {
    const payload = await buildPayload();
    const jobId = createJobId();

    const job: PrintJob<TPayload> = {
      id: jobId,
      kind,
      createdAt: Date.now(),
      title: typeof titleOrBuildPayload === 'string' ? titleOrBuildPayload : undefined,
      payload,
    };

    cleanupExpiredPrintJobs();
    savePrintJob(job);

    w.location.href = `/print/${encodeURIComponent(kind)}?jobId=${encodeURIComponent(jobId)}`;
    w.focus();
  } catch (error) {
    w.location.href = `/print/error?msg=${encodeURIComponent(String(error))}`;
  }
}
