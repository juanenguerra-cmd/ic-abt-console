import { useState, useEffect, useRef, useCallback } from "react";

export type TemplateType = "ili" | "gi";

interface UseLineListOverridesOptions {
  outbreakId: string;
  facilityId: string;
  template: TemplateType;
}

interface UseLineListOverridesResult {
  overrides: Record<string, string>;
  saveOverride: (rowIndex: number, colKey: string, value: string) => void;
  retryFailedSaves: () => void;
  resetOverrides: () => Promise<void>;
  isLoading: boolean;
  loadError: string | null;
  saveStatus: "idle" | "saving" | "saved" | "error";
}

const DEBOUNCE_MS = 600;

export function useLineListOverrides({
  outbreakId,
  facilityId,
  template,
}: UseLineListOverridesOptions): UseLineListOverridesResult {
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Pending writes: key → value, waiting to be flushed
  const pendingRef = useRef<Record<string, string>>({});
  // Failed writes from the last flush attempt: key → value
  const failedRef = useRef<Record<string, string>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load overrides on mount / when outbreakId or template changes
  useEffect(() => {
    if (!outbreakId) return;
    setIsLoading(true);
    setLoadError(null);
    fetch(`/api/linelist-overrides?outbreakId=${encodeURIComponent(outbreakId)}&template=${encodeURIComponent(template)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ overrides: Record<string, string> }>;
      })
      .then((data) => {
        setOverrides(data.overrides ?? {});
      })
      .catch((err) => {
        console.error("Failed to load linelist overrides:", err);
        setLoadError("Failed to load saved edits. Please refresh to try again.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [outbreakId, template]);

  const flushWrites = useCallback(
    (writes: Record<string, string>) => {
      if (Object.keys(writes).length === 0) return;

      setSaveStatus("saving");
      failedRef.current = {};

      const requests = Object.entries(writes).map(([key, value]) => {
        const [rowIndexStr, colKey] = key.split("::");
        return fetch("/api/linelist-overrides", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            outbreakId,
            facilityId,
            template,
            rowIndex: parseInt(rowIndexStr, 10),
            colKey,
            value,
          }),
        }).then((res) => ({ key, ok: res.ok, value }));
      });

      Promise.all(requests)
        .then((results) => {
          const failed: Record<string, string> = {};
          for (const r of results) {
            if (!r.ok) failed[r.key] = r.value;
          }
          if (Object.keys(failed).length === 0) {
            setSaveStatus("saved");
            if (savedStatusTimerRef.current) clearTimeout(savedStatusTimerRef.current);
            savedStatusTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2500);
          } else {
            failedRef.current = failed;
            setSaveStatus("error");
          }
        })
        .catch(() => {
          failedRef.current = writes;
          setSaveStatus("error");
        });
    },
    [outbreakId, facilityId, template]
  );

  const flushPending = useCallback(() => {
    const pending = { ...pendingRef.current };
    pendingRef.current = {};
    flushWrites(pending);
  }, [flushWrites]);

  const saveOverride = useCallback(
    (rowIndex: number, colKey: string, value: string) => {
      const key = `${rowIndex}::${colKey}`;

      // Optimistic update
      setOverrides((prev) => ({ ...prev, [key]: value }));

      // Accumulate into pending batch
      pendingRef.current[key] = value;

      // Debounce flush
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flushPending, DEBOUNCE_MS);
    },
    [flushPending]
  );

  const retryFailedSaves = useCallback(() => {
    const failed = { ...failedRef.current };
    failedRef.current = {};
    flushWrites(failed);
  }, [flushWrites]);

  const resetOverrides = useCallback(async () => {
    // Cancel any pending debounced saves
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = {};
    failedRef.current = {};

    await fetch("/api/linelist-overrides", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outbreakId, template }),
    });

    setOverrides({});
    setSaveStatus("idle");
  }, [outbreakId, template]);

  return { overrides, saveOverride, retryFailedSaves, resetOverrides, isLoading, loadError, saveStatus };
}
