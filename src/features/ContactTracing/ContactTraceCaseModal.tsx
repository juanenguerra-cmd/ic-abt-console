import React, { useState } from 'react';
import { X, Plus, Trash2, CheckCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useFacilityData, useDatabase } from '../../app/providers';
import { ContactTraceCase, ContactTraceExposure } from '../../domain/models';
import { PersonTypeahead, PersonRef } from './PersonTypeahead';

interface Props {
  caseId: string;
  onClose: () => void;
}

const RISK_COLORS: Record<string, string> = {
  low: 'bg-green-100 text-green-800 border-green-200',
  medium: 'bg-amber-100 text-amber-800 border-amber-200',
  high: 'bg-red-100 text-red-800 border-red-200',
};

export const ContactTraceCaseModal: React.FC<Props> = ({ caseId, onClose }) => {
  const { store, activeFacilityId } = useFacilityData();
  const { updateDB } = useDatabase();

  const traceCase = (store.contactTraceCases ?? {})[caseId] as ContactTraceCase | undefined;
  const exposures = Object.values(store.contactTraceExposures ?? {}).filter(
    (e) => e.caseId === caseId
  ) as ContactTraceExposure[];

  // Add-exposure form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [typeaheadQuery, setTypeaheadQuery] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<PersonRef | null>(null);
  const [exposureStart, setExposureStart] = useState(new Date().toISOString().slice(0, 10));
  const [exposureEnd, setExposureEnd] = useState('');
  const [location, setLocation] = useState('');
  const [risk, setRisk] = useState<ContactTraceExposure['risk']>('medium');
  const [actMonitoring, setActMonitoring] = useState(false);
  const [actTesting, setActTesting] = useState(false);
  const [actIsolation, setActIsolation] = useState(false);
  const [actNotes, setActNotes] = useState('');

  if (!traceCase) return null;

  const indexResident = store.residents[traceCase.indexResidentMrn];

  /** Set of already-added person identifiers so typeahead can show "Already added". */
  const addedIds = new Set(
    exposures.map((e) =>
      e.personRef.kind === 'resident' ? e.personRef.mrn : e.personRef.staffId
    )
  );

  const getPersonLabel = (personRef: ContactTraceExposure['personRef']) => {
    if (personRef.kind === 'resident') {
      return store.residents[personRef.mrn]?.displayName ?? `MRN: ${personRef.mrn}`;
    }
    return store.staff[personRef.staffId]?.displayName ?? `Staff: ${personRef.staffId}`;
  };

  const handleAddExposure = () => {
    if (!selectedPerson) { alert('Please select a person before saving the exposure.'); return; }
    if (!exposureStart) { alert('Please provide an exposure start date.'); return; }
    const now = new Date().toISOString();
    const exposure: ContactTraceExposure = {
      id: uuidv4(),
      caseId,
      personRef: selectedPerson,
      exposureStartISO: new Date(exposureStart).toISOString(),
      exposureEndISO: exposureEnd ? new Date(exposureEnd).toISOString() : undefined,
      location: location.trim() || undefined,
      risk,
      actions: {
        monitoring: actMonitoring || undefined,
        testing: actTesting || undefined,
        isolation: actIsolation || undefined,
        notes: actNotes.trim() || undefined,
      },
      createdAt: now,
      updatedAt: now,
    };

    updateDB((draft) => {
      const fd = draft.data.facilityData[activeFacilityId];
      if (!fd.contactTraceExposures) fd.contactTraceExposures = {};
      fd.contactTraceExposures[exposure.id] = exposure;
      // update case updatedAt
      if (fd.contactTraceCases?.[caseId]) {
        fd.contactTraceCases[caseId].updatedAt = now;
      }
    }, { action: 'create', entityType: 'ContactTraceExposure', entityId: exposure.id });

    // Reset form
    setSelectedPerson(null);
    setTypeaheadQuery('');
    setExposureStart(new Date().toISOString().slice(0, 10));
    setExposureEnd('');
    setLocation('');
    setRisk('medium');
    setActMonitoring(false);
    setActTesting(false);
    setActIsolation(false);
    setActNotes('');
    setShowAddForm(false);
  };

  const handleDeleteExposure = (exposureId: string) => {
    const exp = (store.contactTraceExposures ?? {})[exposureId];
    const name = exp ? getPersonLabel(exp.personRef) : 'this person';
    if (!confirm(`Remove exposure record for ${name}?`)) return;
    updateDB((draft) => {
      const fd = draft.data.facilityData[activeFacilityId];
      if (fd.contactTraceExposures) delete fd.contactTraceExposures[exposureId];
    }, { action: 'delete', entityType: 'ContactTraceExposure', entityId: exposureId });
  };

  const handleCloseCase = () => {
    if (!confirm('Mark this contact trace case as closed?')) return;
    const now = new Date().toISOString();
    updateDB((draft) => {
      const fd = draft.data.facilityData[activeFacilityId];
      if (fd.contactTraceCases?.[caseId]) {
        fd.contactTraceCases[caseId].status = 'closed';
        fd.contactTraceCases[caseId].updatedAt = now;
      }
    }, { action: 'update', entityType: 'ContactTraceCase', entityId: caseId });
  };

  const indexLabel =
    traceCase.indexRef.kind === 'ipEvent'
      ? `IP Event #${traceCase.indexRef.id.slice(0, 8)}`
      : `Symptom window ${new Date(traceCase.indexRef.startISO).toLocaleDateString()}`;

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 bg-teal-50 shrink-0 flex justify-between items-start">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">Contact Trace Case</h2>
            <p className="text-sm text-neutral-600">
              {indexResident?.displayName ?? traceCase.indexResidentMrn}
              <span className="mx-2 text-neutral-400">·</span>
              {indexLabel}
              {traceCase.syndromeOrOrganism && (
                <span className="mx-2 text-neutral-400">·</span>
              )}
              {traceCase.syndromeOrOrganism}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-bold uppercase px-2 py-1 rounded-full border ${
                traceCase.status === 'open'
                  ? 'bg-green-100 text-green-800 border-green-200'
                  : 'bg-neutral-100 text-neutral-500 border-neutral-300'
              }`}
            >
              {traceCase.status}
            </span>
            {traceCase.status === 'open' && (
              <button
                onClick={handleCloseCase}
                className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50 text-neutral-700"
              >
                <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                Close Case
              </button>
            )}
            <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700 ml-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Exposures list */}
          <section>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold text-neutral-900">
                Exposures ({exposures.length})
              </h3>
              {traceCase.status === 'open' && (
                <button
                  onClick={() => setShowAddForm((v) => !v)}
                  className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-md"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Exposure
                </button>
              )}
            </div>

            {exposures.length === 0 && !showAddForm && (
              <p className="text-sm text-neutral-500 italic">No exposures recorded yet.</p>
            )}

            <div className="space-y-2">
              {exposures
                .sort((a, b) => a.exposureStartISO.localeCompare(b.exposureStartISO))
                .map((exp) => (
                  <div
                    key={exp.id}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-neutral-50 border-neutral-200"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-neutral-900">
                        {getPersonLabel(exp.personRef)}
                        <span
                          className={`ml-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${RISK_COLORS[exp.risk]}`}
                        >
                          {exp.risk} risk
                        </span>
                      </p>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {new Date(exp.exposureStartISO).toLocaleDateString()}
                        {exp.exposureEndISO && ` – ${new Date(exp.exposureEndISO).toLocaleDateString()}`}
                        {exp.location && ` · ${exp.location}`}
                      </p>
                      {(exp.actions.monitoring || exp.actions.testing || exp.actions.isolation) && (
                        <p className="text-xs text-teal-700 mt-0.5">
                          Actions:{' '}
                          {[
                            exp.actions.monitoring && 'Monitoring',
                            exp.actions.testing && 'Testing',
                            exp.actions.isolation && 'Isolation',
                          ]
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                      )}
                      {exp.outcome && (
                        <p className="text-xs text-neutral-600 mt-0.5">Outcome: {exp.outcome}</p>
                      )}
                    </div>
                    {traceCase.status === 'open' && (
                      <button
                        onClick={() => handleDeleteExposure(exp.id)}
                        className="shrink-0 p-1 text-neutral-400 hover:text-red-600 rounded hover:bg-red-50"
                        title="Remove exposure"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
            </div>

            {/* Add Exposure Form */}
            {showAddForm && (
              <div className="mt-4 p-4 border border-teal-200 rounded-lg bg-teal-50 space-y-4">
                <h4 className="text-sm font-semibold text-teal-800">Add Exposure</h4>

                {/* Typeahead */}
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Person <span className="text-red-500">*</span>
                  </label>
                  {selectedPerson ? (
                    <div className="flex items-center gap-2 p-2 bg-white border border-teal-300 rounded-md text-sm">
                      <span className="flex-1 font-medium">
                        {selectedPerson.kind === 'resident'
                          ? (store.residents[selectedPerson.mrn]?.displayName ?? selectedPerson.mrn)
                          : (store.staff[selectedPerson.staffId]?.displayName ?? selectedPerson.staffId)}
                      </span>
                      <button
                        onClick={() => setSelectedPerson(null)}
                        className="text-neutral-400 hover:text-neutral-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <PersonTypeahead
                      query={typeaheadQuery}
                      onQueryChange={setTypeaheadQuery}
                      onSelect={(ref) => setSelectedPerson(ref)}
                      disabledIds={addedIds}
                      placeholder="Search resident or staff…"
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">
                      Exposure Start <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={exposureStart}
                      onChange={(e) => setExposureStart(e.target.value)}
                      className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">
                      Exposure End
                    </label>
                    <input
                      type="date"
                      value={exposureEnd}
                      onChange={(e) => setExposureEnd(e.target.value)}
                      className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">
                      Location
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Unit / Room / Area"
                      className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">
                      Risk Level
                    </label>
                    <select
                      value={risk}
                      onChange={(e) => setRisk(e.target.value as ContactTraceExposure['risk'])}
                      className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-2">Actions</label>
                  <div className="flex gap-4">
                    {([
                      ['monitoring', 'Monitoring', actMonitoring, setActMonitoring],
                      ['testing', 'Testing', actTesting, setActTesting],
                      ['isolation', 'Isolation', actIsolation, setActIsolation],
                    ] as [string, string, boolean, React.Dispatch<React.SetStateAction<boolean>>][]).map(
                      ([, label, val, setter]) => (
                        <label key={label} className="flex items-center gap-1.5 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={val}
                            onChange={(e) => setter(e.target.checked)}
                            className="rounded border-neutral-300 text-teal-600"
                          />
                          {label}
                        </label>
                      )
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Action Notes
                  </label>
                  <textarea
                    value={actNotes}
                    onChange={(e) => setActNotes(e.target.value)}
                    rows={2}
                    className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm resize-none"
                    placeholder="Optional notes…"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => { setShowAddForm(false); setSelectedPerson(null); setTypeaheadQuery(''); }}
                    className="px-3 py-1.5 text-sm border border-neutral-300 rounded-md hover:bg-neutral-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddExposure}
                    className="px-4 py-1.5 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-md font-medium"
                  >
                    Save Exposure
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Case notes */}
          {traceCase.notes && (
            <section>
              <h3 className="text-sm font-bold text-neutral-900 mb-2">Notes</h3>
              <p className="text-sm text-neutral-700 whitespace-pre-wrap">{traceCase.notes}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
