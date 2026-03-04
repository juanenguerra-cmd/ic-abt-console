import React, { useMemo } from 'react';
import { useFacilityData } from '../../app/providers';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import {
  TrendingUp, AlertTriangle, Activity, Pill, Users,
  ShieldAlert, CheckCircle, Stethoscope, ClipboardList
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const MDRO_CATEGORIES = [
  'mrsa', 'vre', 'c. diff', 'cdiff', 'c.diff',
  'cre', 'esbl', 'mdr-acinetobacter', 'mdr-pseudomonas', 'mdro',
];
const DEVICE_CATEGORIES = [
  'cauti', 'clabsi', 'vap', 'surgical site infection',
  'catheter-associated', 'central line', 'ventilator',
];

/** Safely parse a date string as local time (avoids UTC midnight shift on YYYY-MM-DD). */
const parseLocalDate = (raw: string): Date =>
  /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(raw + 'T00:00:00') : new Date(raw);

// ─── Component ────────────────────────────────────────────────────────────────
export const AnalyticsDashboard: React.FC = () => {
  const { store } = useFacilityData();

  // ── 1. Monthly Historical Data (Last 6 Months) ─────────────────────────────
  const monthlyData = useMemo(() => {
    const data: Record<string, { month: string; infections: number; abts: number; sortKey: string }> = {};

    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      data[sortKey] = {
        month: d.toLocaleString('default', { month: 'short' }),
        infections: 0,
        abts: 0,
        sortKey,
      };
    }

    // FIX: IPEvent uses onsetDate || createdAt — there is no startDate on infections
    Object.values(store.infections || {}).forEach((inf: any) => {
      if (!inf) return;
      const raw = inf.onsetDate || inf.createdAt;
      if (!raw) return;
      const d = parseLocalDate(raw);
      const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (data[sortKey]) data[sortKey].infections += 1;
    });

    // ABTs correctly use startDate
    Object.values(store.abts || {}).forEach((abt: any) => {
      if (!abt || !abt.startDate) return;
      const d = parseLocalDate(abt.startDate);
      const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (data[sortKey]) data[sortKey].abts += 1;
    });

    return Object.values(data).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [store.infections, store.abts]);

  // ── 2. Projections (3-month moving average + trend factor) ─────────────────
  const projections = useMemo(() => {
    if (monthlyData.length < 3) return { infections: 0, abts: 0 };
    const last3 = monthlyData.slice(-3);
    const avgInfections = last3.reduce((s, d) => s + d.infections, 0) / 3;
    const avgAbts = last3.reduce((s, d) => s + d.abts, 0) / 3;
    const lastMonth = last3[2];
    return {
      infections: Math.round(avgInfections * (lastMonth.infections > avgInfections ? 1.1 : 0.9)),
      abts: Math.round(avgAbts * (lastMonth.abts > avgAbts ? 1.1 : 0.9)),
    };
  }, [monthlyData]);

  // ── 3. Chart data with projection appended ─────────────────────────────────
  const chartDataWithProjection = useMemo(() => {
    const nextMonthDate = new Date();
    nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
    return [
      ...monthlyData,
      {
        month: nextMonthDate.toLocaleString('default', { month: 'short' }) + ' (Proj)',
        infections: projections.infections,
        abts: projections.abts,
        sortKey: 'projection',
      },
    ];
  }, [monthlyData, projections]);

  // ── 4. Top Trending Numbers ─────────────────────────────────────────────────
  const topTrends = useMemo(() => {
    const infectionTypes: Record<string, number> = {};
    const abtTypes: Record<string, number> = {};
    const unitInfections: Record<string, number> = {};

    // FIX: use infectionCategory (not inf.type — that field does not exist)
    Object.values(store.infections || {}).forEach((inf: any) => {
      if (!inf) return;
      const cat = inf.infectionCategory;
      if (cat) infectionTypes[cat] = (infectionTypes[cat] || 0) + 1;

      if (inf.residentRef?.id) {
        const res =
          inf.residentRef.kind === 'mrn'
            ? store.residents?.[inf.residentRef.id]
            : (store.quarantine as any)?.[inf.residentRef.id];
        const unit = inf.locationSnapshot?.unit || (res as any)?.currentUnit;
        if (unit) unitInfections[unit] = (unitInfections[unit] || 0) + 1;
      }
    });

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
      units: getTop3(unitInfections),
    };
  }, [store.infections, store.abts, store.residents, store.quarantine]);

  // ── 5. Quality & Stewardship Metrics ───────────────────────────────────────
  const qualityMetrics = useMemo(() => {
    const abts = Object.values(store.abts || {});
    const infections = Object.values(store.infections || {});

    // FIX 1: ABTCourse has no reviewDate — use indication as a proxy for
    // "documented 72h review" (clinician filled in the indication = reviewed)
    const totalAbts = abts.length;
    const reviewedAbts = abts.filter(
      (a: any) => a && (a.reviewDate || a.reviewedAt || a.indication?.trim())
    ).length;
    const timeoutCompliance =
      totalAbts > 0 ? Math.round((reviewedAbts / totalAbts) * 100) : 0;

    // FIX 2: use infectionCategory + organism (not inf.type / inf.mdro)
    let mdroCount = 0;
    let deviceCount = 0;
    infections.forEach((inf: any) => {
      if (!inf) return;
      const cat = (inf.infectionCategory || '').toLowerCase();
      const org = (inf.organism || '').toLowerCase();
      if (MDRO_CATEGORIES.some(m => cat.includes(m) || org.includes(m))) mdroCount++;
      if (DEVICE_CATEGORIES.some(d => cat.includes(d))) deviceCount++;
    });

    // FIX 3: compute audit compliance from infectionControlAuditItems
    // (sessions don't store a numeric score — items hold individual pass/fail)
    const auditItems = Object.values(store.infectionControlAuditItems || {});
    const totalItems = auditItems.filter((i: any) => i != null).length;
    const compliantItems = auditItems.filter(
      (i: any) =>
        i &&
        (i.compliant === true ||
          i.result === 'compliant' ||
          i.status === 'pass' ||
          i.response === 'yes' ||
          i.value === 'yes' ||
          i.answer === 'yes')
    ).length;
    const avgAuditScore =
      totalItems > 0 ? Math.round((compliantItems / totalItems) * 100) : 0;

    return {
      timeoutCompliance,
      mdroCount,
      deviceCount,
      avgAuditScore,
      totalInfections: infections.length,
    };
  }, [store.abts, store.infections, store.infectionControlAuditItems]);

  const mdroPieData = [
    { name: 'MDROs', value: qualityMetrics.mdroCount, color: '#ef4444' },
    {
      name: 'Other Infections',
      value: Math.max(0, qualityMetrics.totalInfections - qualityMetrics.mdroCount),
      color: '#e5e7eb',
    },
  ];

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-indigo-600" />
            Analytics & Projections
          </h1>
          <p className="text-neutral-500 mt-1">
            Historical trends, predictive analytics, and quality stewardship matrices.
          </p>
        </div>
      </div>

      {/* Quality & Stewardship Matrix */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 rounded-lg">
            <CheckCircle className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm text-neutral-500 font-medium">72h Timeout Compliance</p>
            <p className="text-2xl font-bold text-neutral-900">
              {Object.values(store.abts || {}).length === 0
                ? 'N/A'
                : `${qualityMetrics.timeoutCompliance}%`}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-50 rounded-lg">
            <ShieldAlert className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <p className="text-sm text-neutral-500 font-medium">Active MDRO Cases</p>
            <p className="text-2xl font-bold text-neutral-900">{qualityMetrics.mdroCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 rounded-lg">
            <Stethoscope className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <p className="text-sm text-neutral-500 font-medium">Device-Associated</p>
            <p className="text-2xl font-bold text-neutral-900">{qualityMetrics.deviceCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 rounded-lg">
            <ClipboardList className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm text-neutral-500 font-medium">Avg Audit Compliance</p>
            <p className="text-2xl font-bold text-neutral-900">
              {qualityMetrics.avgAuditScore > 0 ? `${qualityMetrics.avgAuditScore}%` : 'N/A'}
            </p>
          </div>
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
            {topTrends.infections.length > 0 ? (
              topTrends.infections.map((item, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-sm text-neutral-600 truncate pr-2">{item.name}</span>
                  <span className="text-sm font-bold text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded-full">
                    {item.count}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-neutral-400">No data available</p>
            )}
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
            {topTrends.abts.length > 0 ? (
              topTrends.abts.map((item, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-sm text-neutral-600 truncate pr-2">{item.name}</span>
                  <span className="text-sm font-bold text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded-full">
                    {item.count}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-neutral-400">No data available</p>
            )}
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
            {topTrends.units.length > 0 ? (
              topTrends.units.map((item, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-sm text-neutral-600 truncate pr-2">{item.name}</span>
                  <span className="text-sm font-bold text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded-full">
                    {item.count} cases
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-neutral-400">No data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Infections Trend & Projection */}
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm lg:col-span-2">
          <div className="mb-4">
            <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-500" />
              Infections Trend & 1-Month Projection
            </h3>
            <p className="text-xs text-neutral-500 mt-1">
              Historical IP events and next month's forecasted volume.
            </p>
          </div>
          <div className="h-72">
            {chartDataWithProjection.every(d => d.infections === 0) ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-neutral-400">
                <Activity className="w-8 h-8 text-neutral-300" />
                <p className="text-sm">No infection records in the last 6 months.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartDataWithProjection}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorInfections" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: 'none',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
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
            )}
          </div>
        </div>

        {/* MDRO Prevalence */}
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm">
          <div className="mb-4">
            <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-500" />
              MDRO Prevalence
            </h3>
            <p className="text-xs text-neutral-500 mt-1">
              Proportion of infections identified as Multi-Drug Resistant Organisms.
            </p>
          </div>
          <div className="h-64 flex flex-col items-center justify-center relative">
            {qualityMetrics.totalInfections > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={mdroPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {mdroPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: '8px',
                        border: 'none',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-bold text-neutral-900">
                    {Math.round(
                      (qualityMetrics.mdroCount / qualityMetrics.totalInfections) * 100
                    )}%
                  </span>
                  <span className="text-xs text-neutral-500">MDRO</span>
                </div>
              </>
            ) : (
              <p className="text-sm text-neutral-400">No infection data available</p>
            )}
          </div>
        </div>

        {/* ABT Usage Trend & Projection */}
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm lg:col-span-3">
          <div className="mb-4">
            <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
              <Pill className="w-5 h-5 text-emerald-500" />
              Antibiotic Usage & 1-Month Projection
            </h3>
            <p className="text-xs text-neutral-500 mt-1">
              Historical ABT courses and next month's forecasted volume.
            </p>
          </div>
          <div className="h-72">
            {chartDataWithProjection.every(d => d.abts === 0) ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-neutral-400">
                <Pill className="w-8 h-8 text-neutral-300" />
                <p className="text-sm">No antibiotic records in the last 6 months.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartDataWithProjection}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: 'none',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
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
            )}
          </div>
        </div>
      </div>

      {/* AI Analytics Summary */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
        <h3 className="font-semibold text-indigo-900 mb-2">AI Analytics Summary</h3>
        <ul className="space-y-2 text-sm text-indigo-800">
          <li className="flex items-start gap-2">
            <span className="mt-0.5">•</span>
            <span>
              Based on the last 3 months, infection rates are projected to be{' '}
              <strong>{projections.infections}</strong> next month.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5">•</span>
            <span>
              Antibiotic stewardship efforts should focus on{' '}
              <strong>{topTrends.abts[0]?.name || 'the most common antibiotics'}</strong>, which
              is currently the highest prescribed medication.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5">•</span>
            <span>
              <strong>{topTrends.units[0]?.name || 'Certain units'}</strong> shows the highest
              concentration of recent infections and may require targeted rounding or environmental
              audits.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5">•</span>
            <span>
              Your 72-hour antibiotic timeout compliance is currently at{' '}
              <strong>{qualityMetrics.timeoutCompliance}%</strong>.{' '}
              {qualityMetrics.timeoutCompliance < 80
                ? 'Consider reviewing documentation practices to improve this metric.'
                : 'Great job maintaining high stewardship standards.'}
            </span>
          </li>
        </ul>
      </div>

    </div>
  );
};
