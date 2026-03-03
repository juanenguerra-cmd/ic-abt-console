import React, { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { useFormTemplates } from '../hooks/useFormTemplates';
import { useDatabase, useFacilityData } from '../app/providers';
import { ExportProfile } from '../domain/models';
import { v4 as uuidv4 } from 'uuid';

interface FormTemplateManagerProps {
  category: 'resident';
  onClose: () => void;
}

interface ExportProfileBuilderModalProps {
  initialProfile?: ExportProfile;
  onClose: () => void;
  onSave: (next: ExportProfile) => void;
}

function ExportProfileBuilderModal({ initialProfile, onClose, onSave }: ExportProfileBuilderModalProps) {
  const [name, setName] = useState(initialProfile?.name || '');
  const [type, setType] = useState<ExportProfile['type']>(initialProfile?.type || 'pdf');
  const [dataset, setDataset] = useState(initialProfile?.dataset || 'vaxEvents');
  const [includePHI, setIncludePHI] = useState(initialProfile?.includePHI ?? true);
  const [columnsText, setColumnsText] = useState(
    initialProfile?.columns
      .map((column) => `${column.header}|${column.fieldPath}`)
      .join('\n') || 'Resident Name|resident.displayName\nDOB|resident.dob\nVaccine|vax.vaccine'
  );

  const parsedColumns = useMemo(
    () =>
      columnsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [header, fieldPath] = line.split('|').map((part) => part.trim());
          if (!header || !fieldPath) return null;
          return { header, fieldPath };
        })
        .filter((col): col is { header: string; fieldPath: string } => Boolean(col)),
    [columnsText]
  );

  const handleSave = () => {
    if (!name.trim() || parsedColumns.length === 0) return;
    const now = new Date().toISOString();
    onSave({
      id: initialProfile?.id || uuidv4(),
      facilityId: initialProfile?.facilityId || '',
      name: name.trim(),
      type,
      dataset: dataset.trim(),
      columns: parsedColumns,
      includePHI,
      createdAt: initialProfile?.createdAt || now,
      updatedAt: now,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <h3 className="text-base font-semibold text-neutral-900">{initialProfile ? 'Edit Form Profile' : 'Create Form Profile'}</h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-neutral-500 hover:bg-neutral-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 p-4">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Profile name" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          <div className="grid grid-cols-3 gap-2">
            <select value={type} onChange={(e) => setType(e.target.value as ExportProfile['type'])} className="rounded-md border border-neutral-300 px-2 py-2 text-sm">
              <option value="pdf">PDF</option>
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
            <input value={dataset} onChange={(e) => setDataset(e.target.value)} placeholder="Dataset" className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
            <label className="inline-flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm">
              <input type="checkbox" checked={includePHI} onChange={(e) => setIncludePHI(e.target.checked)} /> Include PHI
            </label>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase text-neutral-600">Columns (Header|field.path)</p>
            <textarea
              value={columnsText}
              onChange={(e) => setColumnsText(e.target.value)}
              rows={7}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-xs"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3">
          <button type="button" onClick={onClose} className="rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50">Cancel</button>
          <button type="button" onClick={handleSave} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">Save</button>
        </div>
      </div>
    </div>
  );
}

export function FormTemplateManager({ category, onClose }: FormTemplateManagerProps) {
  const { residentForms } = useFormTemplates();
  const { store, activeFacilityId } = useFacilityData();
  const { updateDB } = useDatabase();
  const templates = category === 'resident' ? residentForms : [];

  const exportProfiles = useMemo(
    () =>
      Object.values(store.exportProfiles)
        .filter((profile) => profile.type === 'pdf')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [store.exportProfiles]
  );

  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ExportProfile | null>(null);
  const [deletingProfileId, setDeletingProfileId] = useState<string | null>(null);

  const deletingProfile = deletingProfileId ? store.exportProfiles[deletingProfileId] : null;

  const handleSaveProfile = (next: ExportProfile) => {
    updateDB((draft) => {
      const facility = draft.data.facilityData[activeFacilityId];
      const existing = facility.exportProfiles[next.id];
      facility.exportProfiles[next.id] = {
        ...next,
        facilityId: activeFacilityId,
        createdAt: existing?.createdAt || next.createdAt,
        updatedAt: new Date().toISOString(),
      };
    });
    setIsBuilderOpen(false);
    setEditingProfile(null);
  };

  const handleDeleteProfile = () => {
    if (!deletingProfileId) return;
    updateDB((draft) => {
      const facility = draft.data.facilityData[activeFacilityId];
      delete facility.exportProfiles[deletingProfileId];
    });
    setDeletingProfileId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Manage Forms</h2>
          <p className="text-sm text-neutral-500">Configured templates for {category} forms.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingProfile(null);
            setIsBuilderOpen(true);
          }}
          className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50"
        >
          <Plus className="h-4 w-4" /> New Export Profile
        </button>
      </div>

      <ul className="space-y-2">
        {templates.map((template) => (
          <li key={template.id} className="rounded-lg border border-neutral-200 p-3">
            <p className="text-sm font-medium text-neutral-900">{template.name}</p>
            <p className="text-xs text-neutral-500">{template.description}</p>
          </li>
        ))}
      </ul>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-neutral-800">Export Profiles</h3>
        {exportProfiles.length === 0 && <p className="text-xs text-neutral-500">No export profiles created yet.</p>}
        {exportProfiles.map((profile) => (
          <div key={profile.id} className="flex items-center justify-between rounded-lg border border-neutral-200 p-3">
            <div>
              <p className="text-sm font-medium text-neutral-900">{profile.name}</p>
              <p className="text-xs text-neutral-500">{profile.dataset} · {profile.columns.length} columns</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingProfile(profile);
                  setIsBuilderOpen(true);
                }}
                className="rounded-md border border-neutral-300 p-2 text-neutral-700 hover:bg-neutral-50"
                aria-label={`Edit ${profile.name}`}
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setDeletingProfileId(profile.id)}
                className="rounded-md border border-red-200 p-2 text-red-600 hover:bg-red-50"
                aria-label={`Delete ${profile.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {deletingProfile && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-800">
            Delete form '{deletingProfile.name}'? This cannot be undone.
          </p>
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setDeletingProfileId(null)} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm">Cancel</button>
            <button type="button" onClick={handleDeleteProfile} className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white">Delete</button>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Close
        </button>
      </div>

      {isBuilderOpen && (
        <ExportProfileBuilderModal
          initialProfile={editingProfile || undefined}
          onClose={() => {
            setIsBuilderOpen(false);
            setEditingProfile(null);
          }}
          onSave={handleSaveProfile}
        />
      )}
    </div>
  );
}
