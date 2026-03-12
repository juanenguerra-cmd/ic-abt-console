import React, { useState } from 'react';
import { X, MessageSquare, CheckCircle, ChevronDown, AlertTriangle } from 'lucide-react';
import { ABTCourse, AbtIntervention } from '../../domain/models';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  abt: ABTCourse;
  residentName: string;
  onSave: (intervention: Omit<AbtIntervention, 'date'>) => void;
  onClose: () => void;
}

// ─── Feedback Templates ───────────────────────────────────────────────────────

interface FeedbackTemplate {
  type: AbtIntervention['type'];
  label: string;
  description: string;
  template: string;
  urgency: 'routine' | 'urgent' | 'critical';
}

const FEEDBACK_TEMPLATES: FeedbackTemplate[] = [
  {
    type: 'De-escalation',
    label: 'De-escalation Opportunity',
    description: 'Culture results support narrowing spectrum.',
    template:
      'Culture results are available and susceptibilities support de-escalation from broad-spectrum therapy. ' +
      'Recommend transitioning to a narrower-spectrum agent to reduce resistance pressure and adverse event risk.',
    urgency: 'routine',
  },
  {
    type: 'Timeout Review',
    label: '72-Hour Antibiotic Timeout',
    description: 'Mandatory review at 72 hours per stewardship policy.',
    template:
      'This antibiotic course has reached the 72-hour timeout review point. Please reassess: (1) Does the resident still have clinical signs of infection? ' +
      '(2) Are culture results available to guide therapy? (3) Can treatment be shortened, narrowed, or discontinued?',
    urgency: 'routine',
  },
  {
    type: 'Guideline Compliance',
    label: 'Guideline Compliance — First-Line Not Used',
    description: 'Current agent is not first-line per LTCF guidelines.',
    template:
      'The current antibiotic regimen does not align with facility stewardship guidelines for the documented indication. ' +
      'Per Loeb criteria and IDSA guidance, first-line therapy is recommended. Please review and consider transitioning to the guideline-preferred regimen.',
    urgency: 'routine',
  },
  {
    type: 'IV-to-PO',
    label: 'IV-to-PO Conversion',
    description: 'Resident may be eligible for oral step-down.',
    template:
      'Based on the resident\'s clinical trajectory (tolerating oral intake, improved vital signs, and adequate oral bioavailability of the current agent), ' +
      'an IV-to-oral switch is clinically appropriate. This reduces line-associated infection risk and facilitates earlier discharge planning.',
    urgency: 'routine',
  },
  {
    type: 'Discontinuation',
    label: 'Antibiotic Discontinuation',
    description: 'Evidence suggests antibiotics may not be indicated.',
    template:
      'Clinical reassessment indicates that the diagnostic criteria for infection may not have been met at initiation, or the resident has clinically resolved. ' +
      'Please consider discontinuing antibiotic therapy to minimize adverse effects including C. difficile risk.',
    urgency: 'urgent',
  },
  {
    type: 'Dose Optimization',
    label: 'Dose Optimization',
    description: 'Renal function or weight-based dosing adjustment needed.',
    template:
      'Current dosing may require adjustment based on renal function (eGFR), weight, or pharmacokinetic/pharmacodynamic targets. ' +
      'Please review current dose against renal dosing guidelines and consider adjustment or pharmacist consultation.',
    urgency: 'urgent',
  },
  {
    type: 'Other',
    label: 'Other Clinical Feedback',
    description: 'Custom stewardship feedback.',
    template: '',
    urgency: 'routine',
  },
];

const URGENCY_STYLES = {
  routine: 'bg-neutral-100 text-neutral-600',
  urgent: 'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
};

// ─── Component ────────────────────────────────────────────────────────────────

const PrescriberFeedbackModal: React.FC<Props> = ({ abt, residentName, onSave, onClose }) => {
  const [selectedTemplate, setSelectedTemplate] = useState<FeedbackTemplate | null>(null);
  const [noteText, setNoteText] = useState('');
  const [loggedBy, setLoggedBy] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  const handleSelectTemplate = (t: FeedbackTemplate) => {
    setSelectedTemplate(t);
    setNoteText(t.template);
  };

  const handleSave = () => {
    if (!selectedTemplate || !noteText.trim() || !loggedBy.trim()) return;
    onSave({
      type: selectedTemplate.type,
      note: noteText.trim(),
      loggedBy: loggedBy.trim(),
    });
    setIsSaved(true);
    setTimeout(onClose, 800);
  };

  const isReady = !!selectedTemplate && noteText.trim().length > 0 && loggedBy.trim().length > 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-50 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
              Log Stewardship Intervention
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              {residentName} · {abt.medication}
              {abt.startDate ? ` · Started ${abt.startDate}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-5">

          {/* Template Picker */}
          <div>
            <label className="block text-sm font-semibold text-neutral-800 mb-2">
              Intervention Type <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {FEEDBACK_TEMPLATES.map((t) => (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => handleSelectTemplate(t)}
                  className={`w-full flex items-start gap-3 text-left px-4 py-3 rounded-xl border transition-colors ${
                    selectedTemplate?.type === t.type
                      ? 'bg-indigo-50 border-indigo-400'
                      : 'bg-white border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  <div
                    className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${
                      selectedTemplate?.type === t.type ? 'bg-indigo-600' : 'bg-neutral-300'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-neutral-900">{t.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${URGENCY_STYLES[t.urgency]}`}>
                        {t.urgency}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-0.5">{t.description}</p>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-neutral-400 shrink-0 transition-transform ${
                      selectedTemplate?.type === t.type ? 'rotate-180 text-indigo-500' : ''
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Editable Feedback Note */}
          {selectedTemplate && (
            <div>
              <label className="block text-sm font-semibold text-neutral-800 mb-1">
                Feedback Note <span className="text-red-500">*</span>
                <span className="ml-2 text-xs font-normal text-neutral-500">
                  (pre-filled from template — edit as needed)
                </span>
              </label>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={5}
                className="w-full border border-neutral-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y"
                placeholder="Enter feedback note for the prescriber..."
              />
              {selectedTemplate.urgency === 'urgent' && (
                <div className="mt-1 flex items-center gap-1.5 text-xs text-amber-700">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>This is flagged as an urgent intervention — ensure timely communication with prescriber.</span>
                </div>
              )}
            </div>
          )}

          {/* Logged By */}
          <div>
            <label className="block text-sm font-semibold text-neutral-800 mb-1">
              Logged By (Stewardship Lead) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={loggedBy}
              onChange={(e) => setLoggedBy(e.target.value)}
              placeholder="e.g., Dr. Smith, IP Nurse Jones"
              className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* ABT Context Summary */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-xs text-neutral-700 space-y-1">
            <p className="font-semibold text-neutral-900 mb-2">ABT Course Context</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <span className="text-neutral-500">Medication:</span><span className="font-medium">{abt.medication}</span>
              {abt.medicationClass && <><span className="text-neutral-500">Class:</span><span>{abt.medicationClass}</span></>}
              {abt.syndromeCategory && <><span className="text-neutral-500">Syndrome:</span><span>{abt.syndromeCategory}</span></>}
              {abt.startDate && <><span className="text-neutral-500">Start Date:</span><span>{abt.startDate}</span></>}
              {abt.prescriber && <><span className="text-neutral-500">Prescriber:</span><span>{abt.prescriber}</span></>}
              <span className="text-neutral-500">Status:</span>
              <span className={`font-medium capitalize ${abt.status === 'active' ? 'text-emerald-700' : 'text-neutral-600'}`}>
                {abt.status}
              </span>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-200 flex justify-end gap-3 shrink-0 bg-neutral-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-neutral-300 rounded-lg text-sm text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            Cancel
          </button>
          {isSaved ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium">
              <CheckCircle className="w-4 h-4" />
              Saved
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={!isReady}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Log Intervention
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PrescriberFeedbackModal;
