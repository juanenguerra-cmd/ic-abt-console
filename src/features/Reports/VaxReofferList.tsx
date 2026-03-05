import React, { useMemo, useState } from 'react';
import { Syringe } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useDatabase, useFacilityData } from '../../app/providers';
import { useToast } from '../../hooks/useToast';
import { computeVaxGaps } from '../../utils/vaxReofferUtils';

const VACCINES = ['Influenza', 'Covid-19', 'Pneumococcal'] as const;
type VaccineFilter = 'All' | (typeof VACCINES)[number];

export const VaxReofferList: React.FC = () => {
  const { store, activeFacilityId } = useFacilityData();
  const { updateDB } = useDatabase();
  const { toast } = useToast();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterVaccine, setFilterVaccine] = useState<VaccineFilter>('All');
  const [confirmedOffer, setConfirmedOffer] = useState<string | null>(null);

  const gaps = useMemo(() => computeVaxGaps(store.residents, store.vaxEvents), [store.residents, store.vaxEvents]);
  const filtered = useMemo(
    () => (filterVaccine === 'All' ? gaps : gaps.filter((g) => g.missingVaccines.includes(filterVaccine))),
    [filterVaccine, gaps]
  );

  const summary = useMemo(
    () =>
      VACCINES.reduce(
        (acc, vaccine) => ({ ...acc, [vaccine]: gaps.filter((gap) => gap.missingVaccines.includes(vaccine)).length }),
        { Influenza: 0, 'Covid-19': 0, Pneumococcal: 0 }
      ),
    [gaps]
  );

  const consentProfile = useMemo(
    () =>
      Object.values(store.exportProfiles).find((profile) => {
        const lowered = profile.name.toLowerCase();
        return lowered.includes('vaccine') && lowered.includes('consent');
      }),
    [store.exportProfiles]
  );

  const offerVaccine = (residentMrn: string, residentName: string, vaccineName: (typeof VACCINES)[number]) => {
    const now = new Date().toISOString();
    const eventId = uuidv4();
    updateDB((draft) => {
      const facility = draft.data.facilityData[activeFacilityId];
      facility.vaxEvents[eventId] = {
        id: eventId,
        residentRef: { kind: 'mrn', id: residentMrn },
        vaccine: vaccineName,
        status: 'due',
        offerDate: now,
        createdAt: now,
        updatedAt: now,
      };
    });

    const notifId = uuidv4();
    updateDB((draft) => {
      const facility = draft.data.facilityData[activeFacilityId];
      facility.notifications[notifId] = {
        id: notifId,
        facilityId: activeFacilityId,
        createdAtISO: now,
        status: 'unread',
        category: 'VAX_REOFFER',
        residentId: residentMrn,
        message: `${residentName} was offered ${vaccineName} today. Consent pending administration.`,
        ruleId: 'vax_reoffer_manual',
      };
    });

    if (!consentProfile) {
      toast({
        title: 'No vaccine consent form template found.',
        description: 'Create one in Reports > Forms first.',
        variant: 'destructive',
      });
    }

    setConfirmedOffer(residentMrn);
  };

  const toggleResident = (mrn: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(mrn)) next.delete(mrn);
      else next.add(mrn);
      return next;
    });
  };

  const offerSelected = () => {
    filtered.filter((gap) => selected.has(gap.residentMrn)).forEach((gap) => {
      gap.missingVaccines.forEach((vaccine) => offerVaccine(gap.residentMrn, gap.residentName, vaccine));
    });
    setSelected(new Set());
  };

  return (
    <div className="space-y-4">
      <div className="no-print rounded-lg border border-neutral-200 bg-white p-4 flex justify-between items-start">
        <div>
          <h3 className="text-base font-bold text-neutral-900">Vaccine Re-offer List</h3>
          <p className="mt-1 text-sm text-neutral-600">
            Influenza: {summary.Influenza} · Covid-19: {summary['Covid-19']} · Pneumococcal: {summary.Pneumococcal}
          </p>
          {!consentProfile && (
            <p className="mt-2 text-xs text-amber-700">No vaccine consent template detected in Reports &gt; Forms.</p>
          )}
        </div>
      </div>

      <div className="no-print flex flex-wrap gap-2 justify-between items-center">
        <div className="flex gap-2">
        {(['All', ...VACCINES] as VaccineFilter[]).map((option) => (
          <button
            key={option}
            onClick={() => setFilterVaccine(option)}
            className={`rounded-full px-3 py-1 text-sm ${
              filterVaccine === option ? 'bg-indigo-600 text-white' : 'bg-neutral-100 text-neutral-700'
            }`}
          >
            {option}
          </button>
        ))}
        </div>
      </div>

      <div className="space-y-6">
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow">
        <div className="px-4 py-5 sm:px-6 bg-indigo-50 border-b border-indigo-200">
          <h3 className="text-lg leading-6 font-bold text-indigo-900">Re-offer Candidates</h3>
          <p className="text-xs text-indigo-700 mt-1">Residents missing one or more recommended vaccines</p>
        </div>
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="no-print px-3 py-2" />
              <th className="px-3 py-2 text-left text-xs font-medium uppercase text-neutral-500">Resident Name</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase text-neutral-500">Unit/Room</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase text-neutral-500">Missing Vaccines</th>
              <th className="no-print px-3 py-2 text-left text-xs font-medium uppercase text-neutral-500">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 bg-white">
            {filtered.map((gap) => (
              <tr key={gap.residentMrn}>
                <td className="no-print px-3 py-2">
                  <input type="checkbox" checked={selected.has(gap.residentMrn)} onChange={() => toggleResident(gap.residentMrn)} />
                </td>
                <td className="px-3 py-2 font-medium text-neutral-900">{gap.residentName}</td>
                <td className="px-3 py-2 text-neutral-600">{gap.unit || '—'} / {gap.room || '—'}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {gap.missingVaccines.map((vaccine) => (
                      <span key={vaccine} className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                        {vaccine}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="no-print px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {gap.missingVaccines.map((vaccine) => (
                      <button
                        key={vaccine}
                        onClick={() => offerVaccine(gap.residentMrn, gap.residentName, vaccine)}
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                      >
                        <Syringe className="h-3 w-3" /> Offer {vaccine}
                      </button>
                    ))}
                  </div>
                  {confirmedOffer === gap.residentMrn && <p className="mt-1 text-xs text-emerald-700">Offer recorded.</p>}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-neutral-400">
                  No vaccine re-offers needed.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      </div>

      {selected.size > 0 && (
        <div className="no-print flex justify-end">
          <button
            onClick={offerSelected}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Syringe className="h-4 w-4" /> Offer Selected ({selected.size})
          </button>
        </div>
      )}
    </div>
  );
};
