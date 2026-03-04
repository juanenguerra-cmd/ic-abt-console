export type PrintJobKind = "census-rounding";

export interface PrintJob<TPayload = unknown> {
  id: string;
  kind: PrintJobKind;
  createdAt: string;
  payload: TPayload;
}

const PRINT_JOB_PREFIX = "ltc_print_job_";

function createJobId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getPrintJobStorageKey(jobId: string) {
  return `${PRINT_JOB_PREFIX}${jobId}`;
}

export async function startPrint<TPayload>(
  kind: PrintJobKind,
  buildPayload: () => Promise<TPayload> | TPayload,
) {
  const jobId = createJobId();
  const tab = window.open("about:blank", "_blank");

  if (tab?.document) {
    tab.document.title = "Preparing print…";
    tab.document.body.innerHTML = "<p style=\"font-family:Arial,Helvetica,sans-serif;padding:24px\">Preparing print report…</p>";
  }

  try {
    const payload = await buildPayload();
    const job: PrintJob<TPayload> = {
      id: jobId,
      kind,
      createdAt: new Date().toISOString(),
      payload,
    };

    localStorage.setItem(getPrintJobStorageKey(jobId), JSON.stringify(job));
    const targetUrl = `/print/${kind}?jobId=${encodeURIComponent(jobId)}`;

    if (tab) {
      tab.location.href = targetUrl;
      tab.focus();
    } else {
      window.open(targetUrl, "_blank");
    }
  } catch (error) {
    if (tab?.document) {
      tab.document.body.innerHTML = `<p style=\"font-family:Arial,Helvetica,sans-serif;color:#b91c1c;padding:24px\">Unable to prepare print report.</p>`;
    }
    // eslint-disable-next-line no-console
    console.error("Failed to start print job", error);
  }
}
