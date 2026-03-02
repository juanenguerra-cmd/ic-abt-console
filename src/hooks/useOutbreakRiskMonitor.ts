import { useState, useEffect, useRef } from 'react';
import { analyzeOutbreakRisk } from '../services/outbreakRiskEngine';
import type { OutbreakRiskResult, RiskAnalysisStatus } from '../types/ai';
import type { ShiftLogEntry } from '../domain/models';

interface UseOutbreakRiskMonitorOptions {
  shiftLogEntries: ShiftLogEntry[];
  enabled: boolean;
}

interface UseOutbreakRiskMonitorResult {
  riskResult: OutbreakRiskResult | null;
  status: RiskAnalysisStatus;
  lastAnalyzedAt: Date | null;
  rerunAnalysis: () => void;
  isAnalyzing: boolean;
}

export function useOutbreakRiskMonitor({
  shiftLogEntries,
  enabled,
}: UseOutbreakRiskMonitorOptions): UseOutbreakRiskMonitorResult {
  const [riskResult, setRiskResult] = useState<OutbreakRiskResult | null>(null);
  const [status, setStatus] = useState<RiskAnalysisStatus>('idle');
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<Date | null>(null);
  const pendingIdRef = useRef<ReturnType<typeof setTimeout> | number | null>(null);

  const runAnalysis = () => {
    const WINDOW_MS = 72 * 60 * 60 * 1000;
    const cutoff = Date.now() - WINDOW_MS;
    const recentCount = shiftLogEntries.filter(
      e => new Date(e.createdAtISO).getTime() >= cutoff
    ).length;

    if (recentCount < 3) {
      setStatus('insufficient_data');
      setRiskResult(null);
      setLastAnalyzedAt(new Date());
      return;
    }

    setStatus('analyzing');
    const result = analyzeOutbreakRisk(shiftLogEntries);
    setRiskResult(result);
    setStatus('complete');
    setLastAnalyzedAt(new Date());
  };

  const scheduleAnalysis = (fn: () => void) => {
    if ('requestIdleCallback' in window) {
      return window.requestIdleCallback(fn, { timeout: 3000 });
    }
    return setTimeout(fn, 2000);
  };

  useEffect(() => {
    if (!enabled) return;

    if (pendingIdRef.current !== null) {
      if ('requestIdleCallback' in window) {
        window.cancelIdleCallback(pendingIdRef.current as number);
      } else {
        clearTimeout(pendingIdRef.current as ReturnType<typeof setTimeout>);
      }
    }

    pendingIdRef.current = scheduleAnalysis(runAnalysis);

    return () => {
      if (pendingIdRef.current !== null) {
        if ('requestIdleCallback' in window) {
          window.cancelIdleCallback(pendingIdRef.current as number);
        } else {
          clearTimeout(pendingIdRef.current as ReturnType<typeof setTimeout>);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, shiftLogEntries.length]);

  const rerunAnalysis = () => {
    if (pendingIdRef.current !== null) {
      if ('requestIdleCallback' in window) {
        window.cancelIdleCallback(pendingIdRef.current as number);
      } else {
        clearTimeout(pendingIdRef.current as ReturnType<typeof setTimeout>);
      }
      pendingIdRef.current = null;
    }
    runAnalysis();
  };

  return {
    riskResult,
    status,
    lastAnalyzedAt,
    rerunAnalysis,
    isAnalyzing: status === 'analyzing',
  };
}
