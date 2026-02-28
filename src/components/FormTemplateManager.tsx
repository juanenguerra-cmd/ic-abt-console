import React from 'react';
import { useFormTemplates } from '../hooks/useFormTemplates';

interface FormTemplateManagerProps {
  category: 'resident';
  onClose: () => void;
}

export function FormTemplateManager({ category, onClose }: FormTemplateManagerProps) {
  const { residentForms } = useFormTemplates();
  const templates = category === 'resident' ? residentForms : [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Manage Forms</h2>
        <p className="text-sm text-neutral-500">Configured templates for {category} forms.</p>
      </div>
      <ul className="space-y-2">
        {templates.map((template) => (
          <li key={template.id} className="rounded-lg border border-neutral-200 p-3">
            <p className="text-sm font-medium text-neutral-900">{template.name}</p>
            <p className="text-xs text-neutral-500">{template.description}</p>
          </li>
        ))}
      </ul>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Close
        </button>
      </div>
    </div>
  );
}
