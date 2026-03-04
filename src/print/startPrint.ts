import { PrintJobKind } from './printJob';
import { savePrintJob } from './printJobStore';

export async function startPrint(
  kind: PrintJobKind,
  title: string,
  buildPayload: () => Promise<unknown> | unknown
): Promise<void> {
  const w = window.open('/print/loading', '_blank', 'noopener,noreferrer');

  if (!w) {
    alert('Popup blocked. Please allow popups for this site to print.');
  }

  try {
    const payload = await buildPayload();
    const id = crypto.randomUUID();
    savePrintJob({ id, kind, title, createdAt: Date.now(), payload });
    const destination = `/print/${encodeURIComponent(kind)}?jobId=${encodeURIComponent(id)}`;

    if (w) {
      w.location.href = destination;
      w.focus();
    } else {
      window.location.href = destination;
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const destination = `/print/error?msg=${encodeURIComponent(msg)}`;
    if (w) {
      w.location.href = destination;
      w.focus();
    } else {
      window.location.href = destination;
    }
  }
}
