import React from 'react';
import { loadPrintJob, deletePrintJob } from './printJobStore';
import { PrintJob, PrintJobKind } from './printJob';
import './print.css';

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

export const PrintShell: React.FC<{
  kind: PrintJobKind;
  children: (job: PrintJob) => React.ReactNode;
}> = ({ kind, children }) => {
  const [job, setJob] = React.useState<PrintJob | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const jobId = params.get('jobId') || '';
    if (!jobId) {
      setError('Missing print job. Please close this tab and print again.');
      return;
    }

    const found = loadPrintJob(jobId);
    if (!found) {
      setError('Print payload expired or missing. Please print again.');
      return;
    }

    if (found.kind !== kind) {
      setError(`Print type mismatch. Expected ${kind}, got ${found.kind}.`);
      return;
    }

    setJob(found);
    return () => {
      deletePrintJob(jobId);
    };
  }, [kind]);

  React.useEffect(() => {
    if (!job) return;

    let cancelled = false;
    void (async () => {
      document.documentElement.classList.add('print-freeze');
      await nextFrame();
      await nextFrame();
      await nextFrame();

      if (document.fonts?.ready) {
        await document.fonts.ready.catch(() => undefined);
      }

      await nextFrame();
      if (!cancelled) {
        window.print();
      }
    })();

    return () => {
      cancelled = true;
      document.documentElement.classList.remove('print-freeze');
    };
  }, [job]);

  if (error) return <div className="p-8 text-red-700">{error}</div>;
  if (!job) return <div className="p-8 text-neutral-500">Preparing print job…</div>;

  return <div className="print-root">{children(job)}</div>;
};
