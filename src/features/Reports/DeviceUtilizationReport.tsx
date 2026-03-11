import React, { useMemo, useState } from 'react';
import { useDatabase, useFacilityData } from '../../app/providers';
import { Resident } from '../../domain/models';
import { ExportPdfButton } from '../../components/ExportPdfButton';
import { DrilldownHeader } from '../../components/DrilldownHeader';
import { todayLocalDateInputValue } from '../../lib/dateUtils';
import { buildDeviceUtilizationReport } from '../../utils/clinicalDevices';
import { exportPDF } from '../../utils/pdfExport';
import { Download } from 'lucide-react';

const DeviceUtilizationReport: React.FC = () => {
  const { store, activeFacilityId } = useFacilityData();
  const { db } = useDatabase();

  const facility = db.data.facilities.byId[activeFacilityId];
  const units: string[] = facility?.units?.map((u: { name: string }) => u.name) ?? [];

  const [selectedUnit, setSelectedUnit] = useState<string>('all');

  const residents = useMemo(
    () => Object.values(store.residents) as Resident[],
    [store.residents],
  );

  const report = useMemo(
    () => buildDeviceUtilizationReport(residents, selectedUnit === 'all' ? null : selectedUnit),
    [residents, selectedUnit],
  );

  const tableColumns = ['Resident', 'MRN', 'Room', 'Unit', 'Devices'];

  const tableRows = report.rows.map((r) => [
    r.name,
    r.mrn || '—',
    r.room || '—',
    r.unit || '—',
    r.devices.join(', '),
  ]);

  const buildPdfSpec = () => ({
    title: 'Device Utilization Report',
    orientation: 'landscape' as const,
    template: 'LANDSCAPE_TEMPLATE_V1' as const,
    subtitleLines: [
      `Report Date: ${todayLocalDateInputValue()}`,
      selectedUnit !== 'all' ? `Unit: ${selectedUnit}` : 'Unit: All',
      `Active Census: ${report.censusCount}`,
      `Residents with Devices: ${report.rows.length}`,
    ],
    sections: [
      {
        type: 'table' as const,
        title: 'Device Summary',
        columns: ['Device', 'Count'],
        rows: report.totals.map((t) => [t.device, String(t.count)]),
      },
      {
        type: 'table' as const,
        title: 'Resident Device Detail',
        columns: tableColumns,
        rows: tableRows,
      },
    ],
  });

  const handleExportCsv = () => {
    const headers = tableColumns;
    const csvContent = [headers, ...tableRows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `device-utilization_${todayLocalDateInputValue()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-3">
        <DrilldownHeader
          title="Device Utilization Report"
          subtitle="Active device counts and resident-level detail for current census"
          right={
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCsv}
                className="flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              <ExportPdfButton
                filename={`device-utilization-${todayLocalDateInputValue()}`}
                buildSpec={buildPdfSpec}
              />
            </div>
          }
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-teal-700 uppercase">Unit</label>
            <select
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="border border-teal-300 rounded-md px-2 py-1 text-sm text-teal-800 bg-white focus:ring-teal-500 focus:border-teal-500"
            >
              <option value="all">All Units</option>
              {units.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <span className="text-xs text-teal-700">
            Active Census: <strong>{report.censusCount}</strong>
          </span>
          <span className="text-xs text-teal-700">
            Residents with Devices: <strong>{report.rows.length}</strong>
          </span>
        </div>
      </div>

      {/* Device Summary Cards */}
      {report.totals.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide mb-3">
            Device Summary
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {report.totals.map(({ device, count }) => (
              <div
                key={device}
                className="bg-white border border-neutral-200 rounded-lg px-4 py-3 flex items-center justify-between shadow-sm"
              >
                <span className="text-sm font-medium text-neutral-700">{device}</span>
                <span className="text-2xl font-bold text-teal-700">{count}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-6 text-center">
          <p className="text-sm text-neutral-500">
            No active devices documented for the selected unit.
          </p>
        </div>
      )}

      {/* Resident Detail Table */}
      {report.rows.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide mb-3">
            Resident Device Detail
          </h3>
          <div className="overflow-x-auto rounded-lg border border-neutral-200">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  {tableColumns.map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-100">
                {report.rows.map((row) => (
                  <tr key={row.residentId} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 text-sm font-medium text-neutral-900">{row.name}</td>
                    <td className="px-4 py-3 text-sm text-neutral-500 font-mono">{row.mrn || '—'}</td>
                    <td className="px-4 py-3 text-sm text-neutral-500">{row.room || '—'}</td>
                    <td className="px-4 py-3 text-sm text-neutral-500">{row.unit || '—'}</td>
                    <td className="px-4 py-3 text-sm text-neutral-700">
                      <div className="flex flex-wrap gap-1">
                        {row.devices.map((device, idx) => (
                          <span
                            key={`${device}-${idx}`}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700 border border-teal-100"
                          >
                            {device}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeviceUtilizationReport;
