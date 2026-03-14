import React, { useState } from "react";
import { X, Plus, Trash2, ArrowRight, ArrowLeft, Save } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { CustomAuditTemplate } from "../domain/models";

interface AuditTemplateBuilderModalProps {
  onClose: () => void;
  onSave: (template: CustomAuditTemplate) => void;
}

export const AuditTemplateBuilderModal: React.FC<AuditTemplateBuilderModalProps> = ({ onClose, onSave }) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [questions, setQuestions] = useState<{ id: string; text: string }[]>([
    { id: uuidv4(), text: "" },
  ]);

  const handleAddQuestion = () => {
    setQuestions([...questions, { id: uuidv4(), text: "" }]);
  };

  const handleRemoveQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  const handleQuestionChange = (id: string, text: string) => {
    setQuestions(questions.map((q) => (q.id === id ? { ...q, text } : q)));
  };

  const handleSave = () => {
    const validQuestions = questions.filter((q) => q.text.trim() !== "");
    if (!name.trim() || validQuestions.length === 0) return;

    onSave({
      id: uuidv4(),
      name: name.trim(),
      questions: validQuestions,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-neutral-200">
          <h2 className="text-lg font-semibold text-neutral-900">
            Audit Template Builder
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-neutral-900 mb-2">Step 1: Template Details</h3>
                <p className="text-sm text-neutral-500 mb-4">Give your custom audit template a clear, descriptive name.</p>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Template Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Weekly Hand Hygiene Spot Check"
                  className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  autoFocus
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-neutral-900 mb-2">Step 2: Add Questions</h3>
                <p className="text-sm text-neutral-500 mb-4">Define the questions or items to be checked during this audit.</p>
                
                <div className="space-y-3">
                  {questions.map((q, index) => (
                    <div key={q.id} className="flex items-start gap-2">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={q.text}
                          onChange={(e) => handleQuestionChange(q.id, e.target.value)}
                          placeholder={`Question ${index + 1}`}
                          className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                      <button
                        onClick={() => handleRemoveQuestion(q.id)}
                        disabled={questions.length === 1}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleAddQuestion}
                  className="mt-4 flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add Question
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-neutral-900 mb-2">Step 3: Review & Save</h3>
                <p className="text-sm text-neutral-500 mb-4">Review your template before saving.</p>
                
                <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200">
                  <h4 className="font-semibold text-neutral-900 mb-4">{name || "Unnamed Template"}</h4>
                  <ul className="space-y-2 list-disc pl-5 text-sm text-neutral-700">
                    {questions.filter(q => q.text.trim() !== "").map((q, i) => (
                      <li key={q.id}>{q.text}</li>
                    ))}
                    {questions.filter(q => q.text.trim() !== "").length === 0 && (
                      <li className="text-neutral-400 italic list-none -ml-5">No questions added.</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between rounded-b-xl">
          <div className="flex gap-1">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full ${step === i ? "bg-indigo-600" : "bg-neutral-300"}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50 flex items-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            )}
            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={step === 1 && !name.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={!name.trim() || questions.filter(q => q.text.trim() !== "").length === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <Save className="w-4 h-4" />
                Save Template
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
