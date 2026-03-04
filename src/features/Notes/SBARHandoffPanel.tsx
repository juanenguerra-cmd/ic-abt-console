import React, { useEffect, useRef } from 'react';
import { ClipboardList, X, Loader2, Zap, AlertTriangle, Printer, Copy } from 'lucide-react';
import { useSBARHandoff } from '../../hooks/useSBARHandoff';
import { useDatabase } from '../../app/providers';
import { PrintButton } from '../../components/PrintButton';
import type { ShiftLogEntry } from '../../domain/models';
import { v4 as uuidv4 } from 'uuid';

interface SBARHandoffPanelProps {
  entries: ShiftLogEntry[];
  facilityName: string;
  shiftLabel: string;
  facilityId: string;
  onClose: () => void;
}

const SBAR_SECTIONS = [
  { key: 'situation' as const, label: 'Situation', border: 'border-red-500' },
  { key: 'background' as const, label: 'Background', border: 'border-blue-500' },
  { key: 'assessment' as const, label: 'Assessment', border: 'border-amber-500' },
  { key: 'recommendation' as const, label: 'Recommendation', border: 'border-emerald-500' },
];

export const SBARHandoffPanel: React.FC<SBARHandoffPanelProps> = ({
  entries,
  facilityName,
  shiftLabel,
  facilityId,
  onClose,
}) => {
  const { generate, sbar, isGenerating, error, reset } = useSBARHandoff();
  const { updateDB } = useDatabase();
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleCopy = () => {
    if (!sbar) return;
    const text = SBAR_SECTIONS
      .map(s => `${s.label.toUpperCase()}\n${sbar[s.key]}`)
      .join('\n\n');
    navigator.clipboard.writeText(text).catch(() => undefined);
  };

  const handleSaveToLog = () => {
    if (!sbar) return;
    const body = SBAR_SECTIONS
      .map(s => `**${s.label}:** ${sbar[s.key]}`)
      .join('\n\n');
    const detectedShift: ShiftLogEntry['shift'] =
      shiftLabel.toLowerCase().includes('night') ? 'Night' : 'Day';
    const entry: ShiftLogEntry = {
      id: uuidv4(),
      facilityId,
      createdAtISO: new Date().toISOString(),
      shift: detectedShift,
      tags: [],
      priority: 'FYI',
      body: `SBAR Handoff — ${shiftLabel}\n\n${body}\n\n${sbar.rulesSummary}`,
      type: 'sbar_handoff',
    };
    updateDB(draft => {
      const fd = draft.data.facilityData[facilityId];
      if (!fd.shiftLog) fd.shiftLog = {};
      fd.shiftLog[entry.id] = entry;
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg bg-white h-full flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-neutral-900">SBAR Handoff</h2>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Idle screen */}
          {!sbar && !isGenerating && !error && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
              <ClipboardList className="w-12 h-12 text-indigo-400" />
              <h3 className="text-lg font-bold text-neutral-900">Generate SBAR Handoff</h3>
              <p className="text-sm text-neutral-500">
                Summarize {entries.length} shift {entries.length === 1 ? 'entry' : 'entries'} into clinical format.
              </p>
              <span className="flex items-center gap-1 text-xs text-neutral-500 bg-neutral-100 border border-neutral-200 px-3 py-1 rounded-full">
                <Zap className="w-3 h-3" /> Rule-Based Engine — No internet required
              </span>
              <button
                onClick={() => generate(entries, facilityName, shiftLabel)}
                className="px-5 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Generate Now
              </button>
            </div>
          )}

          {/* Loading screen */}
          {isGenerating && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              <p className="text-sm text-neutral-600">Building SBAR from shift log…</p>
            </div>
          )}

          {/* Error screen */}
          {error && !isGenerating && (
            <div className="flex flex-col items-center gap-3 p-4 bg-red-50 border border-red-300 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <p className="text-sm text-red-800">{error}</p>
              <button
                onClick={() => { reset(); generate(entries, facilityName, shiftLabel); }}
                className="px-4 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Result screen */}
          {sbar && !isGenerating && (
            <div ref={printRef} className="space-y-4">
              {/* Source notice */}
              <div className="flex items-center gap-2 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs text-neutral-600 no-print">
                <Zap className="w-3.5 h-3.5 shrink-0" />
                <span>⚡ Rule-Based Analysis · {sbar.entryCount} entries reviewed · No AI service used</span>
              </div>

              {/* SBAR cards */}
              {SBAR_SECTIONS.map(section => (
                <div key={section.key} className={`bg-white border border-neutral-200 rounded-lg p-4 border-l-4 ${section.border}`}>
                  <h4 className="text-xs font-bold uppercase text-neutral-500 mb-1">{section.label}</h4>
                  <p className="text-sm text-neutral-800 whitespace-pre-wrap">{sbar[section.key]}</p>
                </div>
              ))}

              <p className="text-xs text-neutral-400 text-center">{sbar.rulesSummary}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {sbar && !isGenerating && (
          <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50 shrink-0 flex flex-wrap gap-2 no-print">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 border border-neutral-300 rounded-md hover:bg-neutral-100"
            >
              <Copy className="w-3.5 h-3.5" /> Copy
            </button>
            <PrintButton contentRef={printRef} title="SBAR Handoff" />
            <button
              onClick={handleSaveToLog}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
            >
              Save to Shift Log
            </button>
            <button
              onClick={() => { reset(); generate(entries, facilityName, shiftLabel); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 border border-neutral-300 rounded-md hover:bg-neutral-100"
            >
              Regenerate
            </button>
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 border border-neutral-300 rounded-md hover:bg-neutral-100"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
