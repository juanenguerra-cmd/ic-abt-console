import { PrintJob, PrintJobKind } from './printJob';
import { cleanupExpiredPrintJobs, savePrintJob } from './printJobStore';
import { isPrintFeatureEnabled, PrintFeature } from './printFlags';

function createJobId(): string {
  return crypto.randomUUID();
}

interface StartPrintOptions {
  feature?: PrintFeature;
}

export async function startPrint<TPayload>(
  kind: PrintJobKind,
  titleOrBuildPayload: string | (() => Promise<TPayload> | TPayload),
  maybeBuildPayload?: () => Promise<TPayload> | TPayload,
  options?: StartPrintOptions,
): Promise<void> {
  const buildPayload =
    typeof titleOrBuildPayload === 'function'
      ? titleOrBuildPayload
      : maybeBuildPayload;

  if (!buildPayload) {
    throw new Error('startPrint requires a payload builder function.');
  }

  if (!isPrintFeatureEnabled(options?.feature)) {
    window.alert('Printing is being rebuilt. Please try again later.');
    return;
  }

  const targetPath = kind === 'dom' ? '/print/precautions' : `/print/${encodeURIComponent(kind)}`;
  const w = window.open('about:blank', '_blank', 'noopener,noreferrer');
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

    w.location.href = `${targetPath}?jobId=${encodeURIComponent(jobId)}`;
    w.focus();
  } catch (error) {
    w.close();
    window.alert(`Unable to prepare print report: ${String(error)}`);
  }
}
