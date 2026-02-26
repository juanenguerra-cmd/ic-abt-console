import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const MonthlyMetricsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [month, setMonth] = useState('');
  const [residentDays, setResidentDays] = useState('');

  useEffect(() => {
    const savedMetrics = localStorage.getItem('ltc_facility_metrics');
    if (savedMetrics) {
      setMetrics(JSON.parse(savedMetrics));
    }
  }, []);

  const handleSave = () => {
    if (month && residentDays) {
      const newMetrics = { ...metrics, [month]: parseInt(residentDays, 10) };
      localStorage.setItem('ltc_facility_metrics', JSON.stringify(newMetrics));
      setMetrics(newMetrics);
      setMonth('');
      setResidentDays('');
    }
  };

  const handleDelete = (key: string) => {
    const newMetrics = { ...metrics };
    delete newMetrics[key];
    localStorage.setItem('ltc_facility_metrics', JSON.stringify(newMetrics));
    setMetrics(newMetrics);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="text-lg font-medium">Monthly Metrics</h3>
          <button data-testid="close-monthly-metrics-modal-button" onClick={onClose} className="text-neutral-500 hover:text-neutral-800 active:scale-95">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <h4 className="font-medium mb-2">Add/Update Metric</h4>
            <div className="flex items-center gap-2">
              <input 
                type="month" 
                value={month} 
                onChange={e => setMonth(e.target.value)} 
                className="w-full border border-neutral-300 rounded-md p-2 text-sm"
              />
              <input 
                type="number" 
                placeholder="Total Resident Days" 
                value={residentDays} 
                onChange={e => setResidentDays(e.target.value)} 
                className="w-full border border-neutral-300 rounded-md p-2 text-sm"
              />
              <button data-testid="save-monthly-metric-button" onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium flex items-center gap-2 active:scale-95">
                <Save className="w-4 h-4" />
                Save
              </button>
            </div>
          </div>
          <div>
            <h4 className="font-medium mb-2">Saved Metrics</h4>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {Object.entries(metrics).map(([key, value]) => (
                <div key={key} className="flex justify-between items-center bg-neutral-50 p-2 rounded-md">
                  <div>
                    <span className="font-semibold">{key}</span>: {value} resident days
                  </div>
                  <button data-testid={`delete-metric-button-${key}`} onClick={() => handleDelete(key)} className="text-red-500 hover:text-red-700 text-xs active:scale-95">Delete</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
