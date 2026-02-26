import React, { useState } from 'react';
import { useFacilityData } from '../../app/providers';
import { Staff } from '../../domain/models';
import { Plus, MoreVertical } from 'lucide-react';

const StaffPage: React.FC = () => {
  const { store } = useFacilityData();
  const staffList = Object.values(store.staff) as Staff[];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <header className="flex items-center justify-between pb-4 border-b border-neutral-200">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Staff Management</h1>
          <p className="text-sm text-neutral-500">Manage staff records, vaccinations, and FIT testing.</p>
        </div>
        <button 
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium active:scale-95"
        >
          <Plus className="w-4 h-4" />
          New Staff
        </button>
      </header>

      <div className="mt-6">
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200/50 overflow-hidden">
          <table className="w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-neutral-500 uppercase tracking-wider">Name</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-neutral-500 uppercase tracking-wider">Role</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-neutral-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {staffList.map((staff) => (
                <tr key={staff.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-900">{staff.displayName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">{staff.role}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span 
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${staff.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {staff.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button className="text-indigo-600 hover:text-indigo-900">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StaffPage;
