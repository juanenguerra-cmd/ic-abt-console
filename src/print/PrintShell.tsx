import React, { useEffect, useState } from 'react';
import { deletePrintJob, loadPrintJob } from './printJobStore';
import { PrintJob, PrintJobKind } from './printJob';

interface PrintShellProps<TPayload = unknown> {
  kind: PrintJobKind;
  children?: (job: PrintJob<TPayload>) => React.ReactNode;
  render?: (job: PrintJob<TPayload>) => React.ReactNode;
}

async function stabilize(frames = 2): Promise<void> {
  for (let i = 0; i < frames; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}

export function PrintShell<TPayload = unknown>({ kind, children, render }: PrintShellProps<TPayload>) {
  const [job, setJob] = useState<(PrintJob<TPayload> & { _jobId: string }) | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const jobId = params.get('jobId') || '';

    if (!jobId) {
      setErr('Unable to prepare print report: missing jobId.');
      return;
    }

    const loadedJob = loadPrintJob(jobId) as PrintJob<TPayload> | null;
    if (!loadedJob) {
      setErr('Unable to prepare print report: print payload not found or expired.');
      return;
    }

    if (loadedJob.kind !== kind) {
      setErr(`Unable to prepare print report: kind mismatch (expected ${kind}, got ${loadedJob.kind}).`);
      return;
    }

    setJob({ ...loadedJob, _jobId: jobId });
  }, [kind]);

  useEffect(() => {
    const runPrint = async () => {
      if (!job) return;

      document.documentElement.classList.add('print-freeze');
      await stabilize(3);

      if (document.fonts?.ready) {
        await document.fonts.ready.catch(() => undefined);
      }

      await stabilize(1);
      window.print();

      deletePrintJob(job._jobId);
      document.documentElement.classList.remove('print-freeze');
    };

    void runPrint();

    return () => document.documentElement.classList.remove('print-freeze');
  }, [job]);

  if (err) {
    return (
      <div style={{ padding: 24, fontFamily: 'Arial, sans-serif' }}>
        <h2 style={{ marginTop: 0 }}>Print Error</h2>
        <p>{err}</p>
        <p>Close this tab and click Print again from the main app.</p>
      </div>
    );
  }

  if (!job) {
    return <div style={{ padding: 24, fontFamily: 'Arial, sans-serif' }}>Preparing report…</div>;
  }

  const renderer = render ?? children;
  if (!renderer) {
    return <div style={{ padding: 24, fontFamily: 'Arial, sans-serif' }}>Print renderer missing.</div>;
  }

  return <div className="print-root">{renderer(job)}</div>;
}
