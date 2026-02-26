import React, { useState, useEffect } from 'react';
import { useFacilityData } from '../../app/providers';

const ReportsConsole: React.FC = () => {
  const [activeTab, setActiveTab] = useState('monthly');

  return (
    <div className="max-w-6xl mx-auto">
      <div className="border-b border-neutral-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button 
            data-testid="survey-tab-button"
            onClick={() => setActiveTab('survey')}
            className={`${activeTab === 'survey' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm active:scale-95`}>
            Survey Packets
          </button>
          <button 
            data-testid="soc-tab-button"
            onClick={() => setActiveTab('soc')}
            className={`${activeTab === 'soc' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm active:scale-95`}>
            Daily/Weekly SOC
          </button>
          <button 
            data-testid="monthly-analytics-tab-button"
            onClick={() => setActiveTab('monthly')}
            className={`${activeTab === 'monthly' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm active:scale-95`}>
            Monthly Analytics
          </button>
        </nav>
      </div>

      <div className="mt-8">
        {activeTab === 'survey' && <div>Survey Packets Content</div>}
        {activeTab === 'soc' && <div>Daily/Weekly SOC Content</div>}
        {activeTab === 'monthly' && <MonthlyAnalytics />}
      </div>
    </div>
  );
};

const MonthlyAnalytics: React.FC = () => {
  const { store } = useFacilityData();
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [analytics, setAnalytics] = useState<any[]>([]);

  useEffect(() => {
    const savedMetrics = localStorage.getItem('ltc_facility_metrics');
    if (savedMetrics) {
      setMetrics(JSON.parse(savedMetrics));
    }
  }, []);

  useEffect(() => {
    const calculateAnalytics = () => {
      const results: any[] = [];
      Object.entries(metrics).forEach(([month, residentDays]) => {
        const [year, monthNum] = month.split('-');
        const infections = Object.values(store.infections).filter(ip => {
          const eventDate = new Date(ip.createdAt);
          return eventDate.getFullYear() === parseInt(year) && eventDate.getMonth() + 1 === parseInt(monthNum);
        });

        const abtDays = Object.values(store.abts).reduce((total, abt) => {
          if (abt.startDate && abt.endDate) {
            const start = new Date(abt.startDate);
            const end = new Date(abt.endDate);
            if (start.getFullYear() === parseInt(year) && start.getMonth() + 1 === parseInt(monthNum)) {
              const diffTime = Math.abs(end.getTime() - start.getTime());
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
              return total + diffDays;
            }
          }
          return total;
        }, 0);

        const infectionRate = residentDays > 0 ? (infections.length / residentDays) * 1000 : 0;
        const aur = residentDays > 0 ? (abtDays / residentDays) * 1000 : 0;

        results.push({
          month,
          residentDays,
          totalInfections: infections.length,
          infectionRate: infectionRate.toFixed(2),
          totalAbtDays: abtDays,
          aur: aur.toFixed(2),
        });
      });
      setAnalytics(results);
    };

    if (store) {
      calculateAnalytics();
    }
  }, [metrics, store]);

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg leading-6 font-medium text-neutral-900">Monthly Analytics</h3>
      </div>
      <div className="border-t border-neutral-200">
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Month</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Resident Days</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Total Infections</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Infection Rate / 1000</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Total ABT Days</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">AUR / 1000</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-neutral-200">
            {analytics.map(row => (
              <tr key={row.month}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-900">{row.month}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">{row.residentDays}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">{row.totalInfections}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">{row.infectionRate}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">{row.totalAbtDays}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">{row.aur}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ReportsConsole;
