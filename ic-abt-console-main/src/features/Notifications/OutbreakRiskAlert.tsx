import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronDown, ChevronUp, X, MapPin, Zap } from 'lucide-react';
import type { OutbreakRiskResult } from '../../types/ai';

interface OutbreakRiskAlertProps {
  result: OutbreakRiskResult;
  analysisId: string;
  onDismiss: () => void;
}

const DISMISSED_KEY = 'dismissed_outbreak_alerts';

function isDismissed(analysisId: string): boolean {
  try {
    const stored = localStorage.getItem(DISMISSED_KEY);
    const arr: string[] = stored ? JSON.parse(stored) : [];
    return arr.includes(analysisId);
  } catch {
    return false;
  }
}

function persistDismiss(analysisId: string): void {
  try {
    const stored = localStorage.getItem(DISMISSED_KEY);
    const arr: string[] = stored ? JSON.parse(stored) : [];
    if (!arr.includes(analysisId)) {
      arr.push(analysisId);
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(arr));
    }
  } catch {
    // ignore storage errors
  }
}

export const OutbreakRiskAlert: React.FC<OutbreakRiskAlertProps> = ({
  result,
  analysisId,
  onDismiss,
}) => {
  const navigate = useNavigate();
  const [showRules, setShowRules] = useState(false);

  if (!result.riskDetected || isDismissed(analysisId)) return null;

  const isHigh = result.riskLevel === 'high';
  const colorClasses = isHigh
    ? 'bg-red-50 border-red-300 text-red-900'
    : 'bg-amber-50 border-amber-300 text-amber-900';
  const pillClasses = isHigh
    ? 'bg-red-100 text-red-800 border border-red-300'
    : 'bg-amber-100 text-amber-800 border border-amber-300';

  const handleDismiss = () => {
    persistDismiss(analysisId);
    onDismiss();
  };

  return (
    <div className={`rounded-lg border p-4 mb-3 ${colorClasses}`} role="alert">
      {/* Source badge */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${pillClasses}`}>
            {isHigh ? '🔴 HIGH RISK' : '🟠 MODERATE RISK'}
          </span>
          <AlertTriangle className="w-4 h-4" />
          <span className="text-sm font-semibold">
            Potential {isHigh ? 'HIGH RISK' : 'MODERATE RISK'} Pattern Detected
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[10px] text-neutral-500 bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded-full">
            <Zap className="w-3 h-3" /> Rule-Based Analysis
          </span>
          <button onClick={handleDismiss} className="text-neutral-400 hover:text-neutral-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary */}
      <p className="text-sm mb-2">{result.summary}</p>

      {/* Unit */}
      {result.affectedUnit && (
        <p className="text-sm mb-1 flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5" />
          <span>Unit: <strong>{result.affectedUnit}</strong></span>
        </p>
      )}

      {/* Pathogen */}
      {result.suspectedPathogen && (
        <p className="text-sm mb-1">
          🦠 Suspected: <strong>{result.suspectedPathogen}</strong>
        </p>
      )}

      {/* Action */}
      {result.recommendedAction && (
        <p className="text-sm mb-2">
          📋 Action: {result.recommendedAction}
        </p>
      )}

      {/* Triggered rules toggle */}
      <div className="mt-2">
        <button
          onClick={() => setShowRules(v => !v)}
          className="flex items-center gap-1 text-xs font-medium underline"
        >
          {showRules ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {showRules ? 'Hide triggered rules' : 'Show triggered rules'}
        </button>
        {showRules && (
          <div className="mt-2">
            <ul className="list-disc list-inside space-y-0.5 text-xs">
              {result.triggeredRules.map((rule, i) => (
                <li key={i}>{rule}</li>
              ))}
            </ul>
            <p className="text-xs mt-1 text-neutral-500">
              Analyzed {result.analyzedEntryCount} entries from last 72 hours.
            </p>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="mt-3">
        <button
          onClick={() => navigate('/outbreaks', { state: { prefill: result } })}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold text-white transition-colors ${isHigh ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}
        >
          Create Outbreak Record
        </button>
      </div>
    </div>
  );
};
