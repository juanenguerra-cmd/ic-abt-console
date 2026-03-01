import React, { useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle, XCircle, HelpCircle } from "lucide-react";
import { NhsnResult, CriterionStatus } from "../utils/nhsnCriteria";

interface Props {
  result: NhsnResult | null;
  title?: string;
}

const statusIcon = (status: CriterionStatus) => {
  if (status === 'met') return <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />;
  if (status === 'not_met') return <XCircle className="w-4 h-4 text-red-600 shrink-0" />;
  return <HelpCircle className="w-4 h-4 text-slate-400 shrink-0" />;
};

const statusLabel = (status: CriterionStatus) => {
  if (status === 'met') return 'text-green-600';
  if (status === 'not_met') return 'text-red-600';
  return 'text-slate-400';
};

const verdictBadge = (verdict: NhsnResult['verdict']) => {
  if (verdict === 'meets') {
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">Meets NHSN Definition</span>;
  }
  if (verdict === 'does_not_meet') {
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">Does Not Meet Definition</span>;
  }
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">Insufficient Data</span>;
};

export const NhsnCriteriaPanel: React.FC<Props> = ({ result, title = "NHSN Surveillance Criteria" }) => {
  const [open, setOpen] = useState(true);

  if (!result) return null;

  return (
    <div className="border border-indigo-200 rounded-lg overflow-hidden text-sm">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="w-full flex items-center justify-between px-4 py-2 bg-indigo-50 hover:bg-indigo-100 transition-colors text-left"
      >
        <span className="font-semibold text-indigo-800">{title}</span>
        <div className="flex items-center gap-2">
          {verdictBadge(result.verdict)}
          {open ? <ChevronUp className="w-4 h-4 text-indigo-600" /> : <ChevronDown className="w-4 h-4 text-indigo-600" />}
        </div>
      </button>
      {open && (
        <ul className="divide-y divide-neutral-100 bg-white px-4 py-2 space-y-1">
          {result.criteria.map((criterion, i) => (
            <li key={i} className="flex items-start gap-2 py-1.5">
              {statusIcon(criterion.status)}
              <div className="flex-1 min-w-0">
                <span className={`font-medium ${statusLabel(criterion.status)}`}>{criterion.label}</span>
                {criterion.note && (
                  <p className="text-xs text-neutral-500 mt-0.5">{criterion.note}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
