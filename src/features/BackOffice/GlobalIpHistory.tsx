import React, { useState } from 'react';
import { useFacilityData, useDatabase } from '../../app/providers';
import { IPEvent, Resident } from '../../domain/models';
import { Edit, Trash2, Search } from 'lucide-react';

interface Props {
  onEditIpEvent: (event: IPEvent) => void;
}

export const GlobalIpHistory: React.FC<Props> = ({ onEditIpEvent }) => {
  const { store, activeFacilityId } = useFacilityData();
  const { updateDB } = useDatabase();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUnit, setFilterUnit] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const allInfections = Object.values(store.infections || {});
  
  // Filter only historical IP events (or all IP events? The prompt says "ALL historical IP events across all residents")
  // Let's assume historical means status is 'resolved', 'ongoing-at-discharge', 'transferred', or source is 'manual-historical', or resident is historical.
  // Actually, the prompt says "ALL historical IP events across all residents".
  // Let's just show all IP events where resident is historical, OR the event has 'manual-historical' in notes, OR status is not 'active'.
  const historicalInfections = allInfections.filter(ip => {
    const resident = store.residents[ip.residentRef.id];
    const isHistoricalResident = resident?.isHistorical || resident?.backOfficeOnly;
    const isManualHistorical = ip.notes?.includes('Source: manual-historical');
    const isHistoricalStatus = ip.status === 'historical' || ip.status === 'resolved' || (ip.status as any) === 'ongoing-at-discharge' || (ip.status as any) === 'transferred';
    
    return isHistoricalResident || isManualHistorical || isHistoricalStatus;
  });

  const filteredInfections = historicalInfections.filter(ip => {
    const resident = store.residents[ip.residentRef.id];
    const matchesSearch = resident?.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          resident?.mrn.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesUnit = filterUnit ? ip.locationSnapshot?.unit === filterUnit : true;
    const matchesType = filterType ? ip.isolationType === filterType : true;
    const matchesStatus = filterStatus ? ip.status === filterStatus : true;
    
    const eventDate = new Date(ip.createdAt).getTime();
    const matchesStartDate = startDate ? eventDate >= new Date(startDate).getTime() : true;
    const matchesEndDate = endDate ? eventDate <= new Date(endDate).getTime() + 86400000 : true; // Include end date

    return matchesSearch && matchesUnit && matchesType && matchesStatus && matchesStartDate && matchesEndDate;
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const uniqueUnits = Array.from(new Set(historicalInfections.map(ip => ip.locationSnapshot?.unit).filter(Boolean))) as string[];
  const uniqueTypes = Array.from(new Set(historicalInfections.map(ip => ip.isolationType).filter(Boolean))) as string[];
  const uniqueStatuses = Array.from(new Set(historicalInfections.map(ip => ip.status).filter(Boolean))) as string[];

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this IP event?')) {
      updateDB(draft => {
        const facilityId = draft.data.facilities.activeFacilityId;
        delete draft.data.facilityData[facilityId].infections[id];
      });
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden flex flex-col">
      <div className="p-4 border-b border-neutral-200 bg-neutral-50 grid grid-cols-1 md:grid-cols-6 gap-4">
        <div className="relative col-span-1 md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search by resident name or MRN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-neutral-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        
        <select
          value={filterUnit}
          onChange={(e) => setFilterUnit(e.target.value)}
          className="w-full border-neutral-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="">All Units</option>
          {uniqueUnits.map(u => <option key={u} value={u}>{u}</option>)}
        </select>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="w-full border-neutral-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="">All Precaution Types</option>
          {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="w-full border-neutral-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="">All Statuses</option>
          {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <div className="flex items-center gap-2 col-span-1 md:col-span-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full border-neutral-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
            title="Start Date"
          />
          <span className="text-neutral-500">-</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full border-neutral-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
            title="End Date"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Resident</th>
              <th className="px-4 py-3 font-medium">Onset Date</th>
              <th className="px-4 py-3 font-medium">Precaution Type</th>
              <th className="px-4 py-3 font-medium">Organism</th>
              <th className="px-4 py-3 font-medium">Unit/Room</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Resolution Date</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {filteredInfections.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-neutral-500">
                  No historical IP events found matching filters.
                </td>
              </tr>
            ) : (
              filteredInfections.map(event => {
                const resident = store.residents[event.residentRef.id];
                return (
                  <tr key={event.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-medium text-neutral-900">
                      {resident?.displayName || 'Unknown'} <br/>
                      <span className="text-xs text-neutral-500 font-normal">{event.residentRef.id}</span>
                    </td>
                    <td className="px-4 py-3">{new Date(event.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{event.isolationType || '-'}</td>
                    <td className="px-4 py-3">{event.organism || '-'}</td>
                    <td className="px-4 py-3">
                      {event.locationSnapshot?.unit || '-'} {event.locationSnapshot?.room ? `/ ${event.locationSnapshot.room}` : ''}
                    </td>
                    <td className="px-4 py-3">{event.status}</td>
                    <td className="px-4 py-3">{event.resolvedAt ? new Date(event.resolvedAt).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-3 text-right space-x-3">
                      <button onClick={() => onEditIpEvent(event)} className="text-indigo-600 hover:text-indigo-900"><Edit className="w-4 h-4" /></button>
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
