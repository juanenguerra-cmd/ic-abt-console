import React, { useEffect, useMemo, useRef, useState } from "react";
import { getPrintJobStorageKey, PrintJob, PrintJobKind } from "./startPrint";

interface PrintShellProps<TPayload = unknown> {
  kind: PrintJobKind;
  render: (job: PrintJob<TPayload>) => React.ReactNode;
}

export function PrintShell<TPayload = unknown>({ kind, render }: PrintShellProps<TPayload>) {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const jobId = params.get("jobId");
  const [job, setJob] = useState<PrintJob<TPayload> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasPrintedRef = useRef(false);

  useEffect(() => {
    if (!jobId) {
      setError("Missing print job id.");
      return;
    }

    let attempts = 0;
    const maxAttempts = 30;

    const hydrate = () => {
      const raw = localStorage.getItem(getPrintJobStorageKey(jobId));
      if (!raw) {
        attempts += 1;
        if (attempts >= maxAttempts) {
          setError("Print job not found.");
          return;
        }
        window.setTimeout(hydrate, 100);
        return;
      }

      try {
        const parsed = JSON.parse(raw) as PrintJob<TPayload>;
        if (parsed.kind !== kind) {
          setError("Print job kind does not match this page.");
          return;
        }
        setJob(parsed);
      } catch {
        setError("Invalid print job payload.");
      }
    };

    hydrate();
  }, [jobId, kind]);

  useEffect(() => {
    if (!job || hasPrintedRef.current) return;
    hasPrintedRef.current = true;

    const timer = window.setTimeout(() => {
      window.print();
    }, 80);

    return () => window.clearTimeout(timer);
  }, [job]);

  if (error) {
    return <div className="p-8 text-red-700">{error}</div>;
  }

  if (!job) {
    return <div className="p-8 text-neutral-500">Preparing print job…</div>;
  }

  return <>{render(job)}</>;
}
