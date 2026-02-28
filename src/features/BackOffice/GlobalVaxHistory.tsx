import React, { useMemo, useState } from 'react';
import { useFacilityData, useDatabase } from '../../app/providers';
import { VaxEvent } from '../../domain/models';
import { Edit, Trash2, Search } from 'lucide-react';

interface Props {
  onEditVaxEvent: (event: VaxEvent) => void;
}

export const GlobalVaxHistory: React.FC<Props> = ({ onEditVaxEvent }) => {
  const { store } = useFacilityData();
  const { updateDB } = useDatabase();
  const [searchTerm, setSearchTerm] = useState('');
  const [vaccineType, setVaccineType] = useState('');
  const [status, setStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const all = useMemo(() => Object.values(store.vaxEvents || {}) as VaxEvent[], [store.vaxEvents]);
  const vaccines = useMemo(() => Array.from(new Set(all.map(v => v.vaccine).filter(Boolean))).sort(), [all]);
  const statuses = useMemo(() => Array.from(new Set(all.map(v => v.status).filter(Boolean))).sort(), [all]);

  const filtered = all.filter(v => {
    const resident = store.residents[v.residentRef.id];
    const matchesSearch = !searchTerm || resident?.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || resident?.mrn?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesVaccine = !vaccineType || v.vaccine === vaccineType;
    const matchesStatus = !status || v.status === status;
    const eventDate = new Date(v.administeredDate || v.dateGiven || v.createdAt).getTime();
    const matchesStart = !startDate || eventDate >= new Date(startDate + 'T00:00:00').getTime();
    const matchesEnd = !endDate || eventDate <= new Date(endDate + 'T23:59:59').getTime();
    return matchesSearch && matchesVaccine && matchesStatus && matchesStart && matchesEnd;
  }).sort((a, b) => new Date(b.administeredDate || b.dateGiven || b.createdAt).getTime() - new Date(a.administeredDate || a.dateGiven || a.createdAt).getTime());

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to delete this VAX event?')) return;
    updateDB(draft => {
      const facilityId = draft.data.facilities.activeFacilityId;
      delete draft.data.facilityData[facilityId].vaxEvents[id];
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden flex flex-col">
      <div className="p-4 border-b border-neutral-200 bg-neutral-50 grid grid-cols-1 md:grid-cols-6 gap-4">
        <div className="relative col-span-1 md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} type="text" placeholder="Search by resident name or MRN..." className="w-full pl-9 pr-4 py-2 border border-neutral-300 rounded-md text-sm" />
        </div>
        <select value={vaccineType} onChange={e => setVaccineType(e.target.value)} className="w-full border-neutral-300 rounded-md text-sm">
          <option value="">All Vaccine Types</option>
          {vaccines.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className="w-full border-neutral-300 rounded-md text-sm">
          <option value="">All Statuses</option>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full border-neutral-300 rounded-md text-sm" />
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full border-neutral-300 rounded-md text-sm" />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Resident</th>
              <th className="px-4 py-3 font-medium">Administered Date</th>
              <th className="px-4 py-3 font-medium">Vaccine</th>
              <th className="px-4 py-3 font-medium">Dose</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-neutral-500">No historical VAX events found matching filters.</td></tr>
            ) : (
              filtered.map(event => {
                const resident = store.residents[event.residentRef.id];
                return (
                  <tr key={event.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-medium text-neutral-900">{resident?.displayName || 'Unknown'}<br /><span className="text-xs text-neutral-500 font-normal">{event.residentRef.id}</span></td>
                    <td className="px-4 py-3">{new Date(event.administeredDate || event.dateGiven || event.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{event.vaccine || '-'}</td>
                    <td className="px-4 py-3">{event.dose || '-'}</td>
                    <td className="px-4 py-3">{event.status}</td>
                    <td className="px-4 py-3">{event.source || '-'}</td>
                    <td className="px-4 py-3 text-right space-x-3">
                      <button onClick={() => onEditVaxEvent(event)} className="text-indigo-600 hover:text-indigo-900"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(event.id)} className="text-red-600 hover:text-red-900"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
