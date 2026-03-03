import React, { useMemo } from 'react';
import { useFacilityData } from '../../app/providers';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area
} from 'recharts';
import { TrendingUp, AlertTriangle, Activity, Pill, Users } from 'lucide-react';

export const AnalyticsDashboard: React.FC = () => {
  const { store } = useFacilityData();

  // 1. Process Historical Data (Last 6 Months)
  const monthlyData = useMemo(() => {
    const data: Record<string, { month: string; infections: number; abts: number; sortKey: string }> = {};
    
    // Initialize last 6 months
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = d.toLocaleString('default', { month: 'short' });
      const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      data[sortKey] = { month: monthStr, infections: 0, abts: 0, sortKey };
    }

    // Process Infections
    Object.values(store.infections || {}).forEach((inf: any) => {
      if (!inf || !inf.startDate) return;
      const d = new Date(inf.startDate);
      const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (data[sortKey]) {
        data[sortKey].infections += 1;
      }
    });

    // Process ABTs
    Object.values(store.abts || {}).forEach((abt: any) => {
      if (!abt || !abt.startDate) return;
      const d = new Date(abt.startDate);
      const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (data[sortKey]) {
        data[sortKey].abts += 1;
      }
    });

    return Object.values(data).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [store.infections, store.abts]);

  // 2. Projections (Simple moving average of last 3 months for the next month)
  const projections = useMemo(() => {
    if (monthlyData.length < 3) return { infections: 0, abts: 0 };
    const last3 = monthlyData.slice(-3);
    const avgInfections = Math.round(last3.reduce((sum, d) => sum + d.infections, 0) / 3);
    const avgAbts = Math.round(last3.reduce((sum, d) => sum + d.abts, 0) / 3);
    
    // Add a slight trend factor based on the last month vs the average
    const lastMonth = last3[2];
    const trendInfections = lastMonth.infections > avgInfections ? 1.1 : 0.9;
    const trendAbts = lastMonth.abts > avgAbts ? 1.1 : 0.9;

    return {
      infections: Math.round(avgInfections * trendInfections),
      abts: Math.round(avgAbts * trendAbts)
    };
  }, [monthlyData]);

  // Add projection to chart data
  const chartDataWithProjection = useMemo(() => {
    const data = [...monthlyData];
    const nextMonthDate = new Date();
    nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
    data.push({
      month: nextMonthDate.toLocaleString('default', { month: 'short' }) + ' (Proj)',
      infections: projections.infections,
      abts: projections.abts,
      sortKey: 'projection'
    });
    return data;
  }, [monthlyData, projections]);

  // 3. Highest Trending Numbers
  const topTrends = useMemo(() => {
    const infectionTypes: Record<string, number> = {};
    const abtTypes: Record<string, number> = {};
    const unitInfections: Record<string, number> = {};

    // Calculate top infections
    Object.values(store.infections || {}).forEach((inf: any) => {
      if (!inf || !inf.type) return;
      infectionTypes[inf.type] = (infectionTypes[inf.type] || 0) + 1;
      
      // Try to find resident unit
      if (inf.residentRef?.id) {
        const res = store.residents?.[inf.residentRef.id];
        if (res && res.currentUnit) {
          unitInfections[res.currentUnit] = (unitInfections[res.currentUnit] || 0) + 1;
        }
      }
    });

    // Calculate top ABTs
    Object.values(store.abts || {}).forEach((abt: any) => {
      if (!abt || !abt.medication) return;
      abtTypes[abt.medication] = (abtTypes[abt.medication] || 0) + 1;
    });

    const getTop3 = (record: Record<string, number>) => 
      Object.entries(record)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, count]) => ({ name, count }));

    return {
      infections: getTop3(infectionTypes),
      abts: getTop3(abtTypes),
      units: getTop3(unitInfections)
    };
  }, [store.infections, store.abts, store.residents]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-indigo-600" />
            Analytics & Projections
          </h1>
          <p className="text-neutral-500 mt-1">Historical trends, predictive analytics, and top risk factors.</p>
        </div>
      </div>

      {/* Top Trending Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-red-50 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="font-semibold text-neutral-900">Top Infection Types</h3>
          </div>
          <div className="space-y-3">
            {topTrends.infections.length > 0 ? topTrends.infections.map((item, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-sm text-neutral-600 truncate pr-2">{item.name}</span>
                <span className="text-sm font-bold text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded-full">{item.count}</span>
              </div>
            )) : <p className="text-sm text-neutral-400">No data available</p>}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Pill className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="font-semibold text-neutral-900">Top Antibiotics</h3>
          </div>
          <div className="space-y-3">
            {topTrends.abts.length > 0 ? topTrends.abts.map((item, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-sm text-neutral-600 truncate pr-2">{item.name}</span>
                <span className="text-sm font-bold text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded-full">{item.count}</span>
              </div>
            )) : <p className="text-sm text-neutral-400">No data available</p>}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-amber-50 rounded-lg">
              <Users className="w-5 h-5 text-amber-600" />
            </div>
            <h3 className="font-semibold text-neutral-900">Highest Risk Units</h3>
          </div>
          <div className="space-y-3">
            {topTrends.units.length > 0 ? topTrends.units.map((item, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-sm text-neutral-600 truncate pr-2">{item.name}</span>
                <span className="text-sm font-bold text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded-full">{item.count} cases</span>
              </div>
            )) : <p className="text-sm text-neutral-400">No data available</p>}
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Infections Trend & Projection */}
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm">
          <div className="mb-4">
            <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-500" />
              Infections Trend & 1-Month Projection
            </h3>
            <p className="text-xs text-neutral-500 mt-1">Historical IP events and next month's forecasted volume.</p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartDataWithProjection} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorInfections" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  cursor={{ stroke: '#9ca3af', strokeWidth: 1, strokeDasharray: '3 3' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="infections" 
                  name="Infections" 
                  stroke="#6366f1" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorInfections)" 
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ABT Usage Trend & Projection */}
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm">
          <div className="mb-4">
            <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
              <Pill className="w-5 h-5 text-emerald-500" />
              Antibiotic Usage & 1-Month Projection
            </h3>
            <p className="text-xs text-neutral-500 mt-1">Historical ABT courses and next month's forecasted volume.</p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartDataWithProjection} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: '#f3f4f6' }}
                />
                <Bar 
                  dataKey="abts" 
                  name="ABT Courses" 
                  fill="#10b981" 
                  radius={[4, 4, 0, 0]}
                  barSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {/* Summary Insights */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
        <h3 className="font-semibold text-indigo-900 mb-2">AI Analytics Summary</h3>
        <ul className="space-y-2 text-sm text-indigo-800">
          <li className="flex items-start gap-2">
            <span className="mt-0.5">•</span>
            <span>Based on the last 3 months, infection rates are projected to be <strong>{projections.infections}</strong> next month.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5">•</span>
            <span>Antibiotic stewardship efforts should focus on <strong>{topTrends.abts[0]?.name || 'the most common antibiotics'}</strong>, which is currently the highest prescribed medication.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5">•</span>
            <span><strong>{topTrends.units[0]?.name || 'Certain units'}</strong> shows the highest concentration of recent infections and may require targeted rounding or environmental audits.</span>
          </li>
        </ul>
      </div>
    </div>
  );
};
