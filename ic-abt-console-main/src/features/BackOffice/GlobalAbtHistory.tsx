import React, { useState } from 'react';
import { useFacilityData, useDatabase } from '../../app/providers';
import { ABTCourse, Resident } from '../../domain/models';
import { Edit, Trash2, Search } from 'lucide-react';

interface Props {
  onEditAbtEvent: (event: ABTCourse) => void;
}

export const GlobalAbtHistory: React.FC<Props> = ({ onEditAbtEvent }) => {
  const { store, activeFacilityId } = useFacilityData();
  const { updateDB } = useDatabase();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUnit, setFilterUnit] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const allAbts = Object.values(store.abts || {});
  
  const historicalAbts = allAbts.filter(abt => {
    const resident = store.residents[abt.residentRef.id];
    const isHistoricalResident = resident?.isHistorical || resident?.backOfficeOnly;
    const isManualHistorical = abt.notes?.includes('Source: manual-historical');
    const isHistoricalStatus = abt.status === 'completed' || (abt.status as any) === 'ongoing-at-discharge' || abt.status === 'discontinued';
    
    return isHistoricalResident || isManualHistorical || isHistoricalStatus;
  });

  const filteredAbts = historicalAbts.filter(abt => {
    const resident = store.residents[abt.residentRef.id];
    const matchesSearch = resident?.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          resident?.mrn.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesUnit = filterUnit ? abt.locationSnapshot?.unit === filterUnit : true;
    const matchesClass = filterClass ? abt.medicationClass === filterClass : true;
    const matchesCategory = filterCategory ? abt.syndromeCategory === filterCategory : true;
    const matchesStatus = filterStatus ? abt.status === filterStatus : true;
    
    const eventDate = abt.startDate ? new Date(abt.startDate).getTime() : new Date(abt.createdAt).getTime();
    const matchesStartDate = startDate ? eventDate >= new Date(startDate).getTime() : true;
    const matchesEndDate = endDate ? eventDate <= new Date(endDate).getTime() + 86400000 : true; // Include end date

    return matchesSearch && matchesUnit && matchesClass && matchesCategory && matchesStatus && matchesStartDate && matchesEndDate;
  }).sort((a, b) => {
    const dateA = a.startDate ? new Date(a.startDate).getTime() : new Date(a.createdAt).getTime();
    const dateB = b.startDate ? new Date(b.startDate).getTime() : new Date(b.createdAt).getTime();
    return dateB - dateA;
  });

  const uniqueUnits = Array.from(new Set(historicalAbts.map(abt => abt.locationSnapshot?.unit).filter(Boolean))) as string[];
  const uniqueClasses = Array.from(new Set(historicalAbts.map(abt => abt.medicationClass).filter(Boolean))) as string[];
  const uniqueCategories = Array.from(new Set(historicalAbts.map(abt => abt.syndromeCategory).filter(Boolean))) as string[];
  const uniqueStatuses = Array.from(new Set(historicalAbts.map(abt => abt.status).filter(Boolean))) as string[];

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this ABX event?')) {
      updateDB(draft => {
        const facilityId = draft.data.facilities.activeFacilityId;
        delete draft.data.facilityData[facilityId].abts[id];
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
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
          className="w-full border-neutral-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="">All Med Classes</option>
          {uniqueClasses.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="w-full border-neutral-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="">All Categories</option>
          {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
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
              <th className="px-4 py-3 font-medium">Start Date</th>
              <th className="px-4 py-3 font-medium">Medication</th>
              <th className="px-4 py-3 font-medium">Class</th>
              <th className="px-4 py-3 font-medium">Indication</th>
              <th className="px-4 py-3 font-medium">Unit/Room</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">End Date</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {filteredAbts.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-neutral-500">
                  No historical ABX events found matching filters.
                </td>
              </tr>
            ) : (
              filteredAbts.map(event => {
                const resident = store.residents[event.residentRef.id];
                return (
                  <tr key={event.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-medium text-neutral-900">
                      {resident?.displayName || 'Unknown'} <br/>
                      <span className="text-xs text-neutral-500 font-normal">{event.residentRef.id}</span>
                    </td>
                    <td className="px-4 py-3">{event.startDate ? new Date(event.startDate).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-3">{event.medication || '-'}</td>
                    <td className="px-4 py-3">{event.medicationClass || '-'}</td>
                    <td className="px-4 py-3">{event.indication || '-'}</td>
                    <td className="px-4 py-3">
                      {event.locationSnapshot?.unit || '-'} {event.locationSnapshot?.room ? `/ ${event.locationSnapshot.room}` : ''}
                    </td>
                    <td className="px-4 py-3">{event.status}</td>
                    <td className="px-4 py-3">{event.endDate ? new Date(event.endDate).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-3 text-right space-x-3">
                      <button onClick={() => onEditAbtEvent(event)} className="text-indigo-600 hover:text-indigo-900"><Edit className="w-4 h-4" /></button>
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
