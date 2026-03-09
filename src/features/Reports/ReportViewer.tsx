import React, { useMemo, useState } from 'react';
import { useFacilityData } from '../../app/providers';
import { REPORT_REGISTRY } from './registry';
import { Download, Printer, Filter as FilterIcon, FileText } from 'lucide-react';
import { exportPDF } from '../../utils/pdfExport';

interface Props {
  reportId: string;
  initialFilters?: any;
  showTitle?: boolean;
  showDescription?: boolean;
  headerColorClass?: string;
  textColorClass?: string;
}

export const ReportViewer: React.FC<Props> = ({ 
  reportId, 
  initialFilters = {}, 
  showTitle = true, 
  showDescription = true,
  headerColorClass = 'bg-neutral-50',
  textColorClass = 'text-neutral-900'
}) => {
  const { store } = useFacilityData();
  const report = REPORT_REGISTRY[reportId];
  const [filters, setFilters] = useState(initialFilters);
  const [showFilters, setShowFilters] = useState(false);

  const data = useMemo(() => {
    if (!report) return [];
    return report.datasetResolver(store, filters);
  }, [report, store, filters]);

  const handleExportCsv = () => {
    if (!report) return;
    const headers = report.columns.map(col => col.header);
    const rows = data.map(item => 
      report.columns.map(col => {
        if (col.exportValue) return col.exportValue(item);
        const val = col.accessor(item);
        return typeof val === 'string' || typeof val === 'number' ? String(val) : '';
      })
    );

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.id}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    if (!report) return;
    const headers = report.columns.map(col => col.header);
    const rows = data.map(item => 
      report.columns.map(col => {
        if (col.exportValue) return col.exportValue(item);
        const val = col.accessor(item);
        return typeof val === 'string' || typeof val === 'number' ? String(val) : '';
      })
    );

    exportPDF({
      title: report.title,
      orientation: report.pdfTemplateMapping?.orientation || 'landscape',
      template: report.pdfTemplateMapping?.template,
      columns: headers,
      rows,
      filters,
    });
  };

  if (!report) {
    return (
      <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg">
        Report "{reportId}" not found in registry.
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden print:shadow-none print:border-none">
      {/* Header */}
      <div className={`px-4 py-5 sm:px-6 border-b border-neutral-200 ${headerColorClass} print:bg-white print:border-b-2 print:border-neutral-200`}>
        <div className="flex items-center justify-between">
          <div>
            {showTitle && <h3 className={`text-lg leading-6 font-bold ${textColorClass}`}>{report.title}</h3>}
            {showDescription && report.description && (
              <p className="text-xs text-neutral-500 mt-1 print:hidden">{report.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 print:hidden">
            {report.filterSchema && report.filterSchema.length > 0 && (
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className="p-2 text-neutral-500 hover:bg-neutral-100 rounded-md transition-colors"
                title="Toggle Filters"
              >
                <FilterIcon className="w-4 h-4" />
              </button>
            )}
            {report.csvSupport && (
              <button 
                onClick={handleExportCsv}
                className="p-2 text-neutral-500 hover:bg-neutral-100 rounded-md transition-colors" 
                title="Export CSV"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
            <button 
              onClick={handleExportPdf}
              className="p-2 text-neutral-500 hover:bg-neutral-100 rounded-md transition-colors" 
              title="Export PDF"
            >
              <FileText className="w-4 h-4" />
            </button>
            {report.printSupport && (
              <button 
                onClick={() => window.print()}
                className="p-2 text-neutral-500 hover:bg-neutral-100 rounded-md transition-colors" 
                title="Print Report"
              >
                <Printer className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && report.filterSchema && (
          <div className="mt-4 p-4 bg-white border border-neutral-200 rounded-lg grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
            {report.filterSchema.map(field => (
              <div key={field.id} className="space-y-1">
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider">{field.label}</label>
                {field.type === 'date' && (
                  <input 
                    type="date" 
                    value={filters[field.id] || ''} 
                    onChange={e => setFilters({...filters, [field.id]: e.target.value})}
                    className="w-full border border-neutral-300 rounded-md px-2 py-1 text-sm"
                  />
                )}
                {field.type === 'select' && (
                  <select 
                    value={filters[field.id] || ''} 
                    onChange={e => setFilters({...filters, [field.id]: e.target.value})}
                    className="w-full border border-neutral-300 rounded-md px-2 py-1 text-sm"
                  >
                    <option value="">All</option>
                    {field.options?.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-50">
            <tr>
              {report.columns.map(col => (
                <th key={col.id} className={`px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider ${col.headerClassName || ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-neutral-200">
            {data.length === 0 ? (
              <tr>
                <td colSpan={report.columns.length} className="px-4 py-8 text-center text-neutral-400 italic">
                  No data found for this report.
                </td>
              </tr>
            ) : (
              data.map((item, idx) => (
                <tr key={idx} className="hover:bg-neutral-50 transition-colors print:hover:bg-transparent">
                  {report.columns.map(col => (
                    <td key={col.id} className={`px-4 py-2 text-neutral-900 ${col.className || ''}`}>
                      {col.accessor(item)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
