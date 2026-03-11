import React, { useMemo, useState } from 'react';
import { useFacilityData } from '../../app/providers';
import { IPEvent, Resident, QuarantineResident } from '../../domain/models';
import { ExportPdfButton } from '../../components/ExportPdfButton';
import { DrilldownHeader } from '../../components/DrilldownHeader';
import { todayLocalDateInputValue } from '../../lib/dateUtils';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SURVEILLANCE_CATEGORY_MAP: Record<string, string> = {
  'UTI': 'UTI',
  'CAUTI': 'Device-Associated',
  'Pneumonia': 'Respiratory',
  'Influenza': 'Respiratory',
  'COVID-19': 'Respiratory',
  'RSV': 'Respiratory',
  'Pertussis': 'Respiratory',
  'Tuberculosis': 'Respiratory',
  'Measles': 'Respiratory',
  'GI': 'GI',
  'C. diff': 'GI',
  'Norovirus': 'GI',
  'Skin/Soft Tissue': 'Skin/Soft Tissue',
  'Scabies': 'Skin/Soft Tissue',
  'Lice': 'Skin/Soft Tissue',
  'Pressure Ulcer': 'Skin/Soft Tissue',
  'Surgical Site Infection': 'Skin/Soft Tissue',
  'MRSA': 'MDRO / Resistant Organism',
  'VRE': 'MDRO / Resistant Organism',
  'CLABSI': 'Device-Associated',
  'VAP': 'Device-Associated',
  'Bloodstream': 'Other',
  'Sepsis': 'Other',
  'Meningitis': 'Other',
  'Varicella (Chickenpox)': 'Other',
  'Routine surveillance': 'Other',
  'Other': 'Other',
};

function normalizeCategory(raw: string | undefined): string {
  if (!raw) return 'Unknown';
  return SURVEILLANCE_CATEGORY_MAP[raw] ?? 'Other';
}

function getEventDate(ip: IPEvent): Date | null {
  const raw = ip.onsetDate || ip.specimenCollectedDate || ip.labResultDate || ip.createdAt;
  if (!raw) return null;
  try {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function residentUnit(ip: IPEvent, res: Resident | QuarantineResident | undefined): string {
  return (
    ip.locationSnapshot?.unit ??
    (res as Resident)?.currentUnit ??
    '—'
  );
}

/** Returns the 3 month numbers (1-based) for a given quarter */
function getQuarterMonths(quarter: number): [number, number, number] {
  const q = Math.max(1, Math.min(4, quarter));
  const start = (q - 1) * 3 + 1;
  return [start, start + 1, start + 2] as [number, number, number];
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

const TREND_THRESHOLD = 0.5; // absolute case-count change considered "meaningful"

function computeTrend(
  counts: [number, number, number]
): { direction: 'increasing' | 'decreasing' | 'stable' | 'insufficient-data'; note: string } {
  const withData = counts.filter(c => c > 0);
  if (withData.length < 2) {
    return { direction: 'insufficient-data', note: 'Insufficient data across months to determine trend.' };
  }
  const first = counts[0];
  const last = counts[2] > 0 || counts[1] > 0 ? (counts[2] || counts[1]) : counts[0];
  const diff = last - first;
  if (diff > TREND_THRESHOLD) return { direction: 'increasing', note: `Case counts increased from ${first} to ${last} over the quarter.` };
  if (diff < -TREND_THRESHOLD) return { direction: 'decreasing', note: `Case counts decreased from ${first} to ${last} over the quarter.` };
  return { direction: 'stable', note: `Case counts were stable (${first} → ${last}) over the quarter.` };
}

const TREND_COLORS: Record<string, string> = {
  increasing: 'text-red-700 bg-red-50 border-red-200',
  decreasing: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  stable: 'text-blue-700 bg-blue-50 border-blue-200',
  'insufficient-data': 'text-neutral-600 bg-neutral-50 border-neutral-200',
};

// ─── Component ───────────────────────────────────────────────────────────────

const QuarterlyRateReport: React.FC = () => {
  const { store } = useFacilityData();

  const now = new Date();
  const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));
  const [selectedQuarter, setSelectedQuarter] = useState(String(currentQuarter));
  const [selectedUnit, setSelectedUnit] = useState('all');

  const year = parseInt(selectedYear, 10);
  const quarter = parseInt(selectedQuarter, 10);
  const quarterMonths = getQuarterMonths(quarter);
  const periodLabel = `Q${quarter} ${year}`;

  const units = useMemo(() => {
    const s = new Set<string>();
    Object.values(store.residents).forEach(r => {
      if (r.currentUnit?.trim()) s.add(r.currentUnit.trim());
    });
    return Array.from(s).sort();
  }, [store.residents]);

  /** Resident-days from localStorage (same source as MonthlyAnalytics) */
  const residentDaysMap = useMemo((): Record<string, number> => {
    try {
      const saved = localStorage.getItem('ltc_facility_metrics');
      if (!saved) return {};
      return JSON.parse(saved) as Record<string, number>;
    } catch {
      return {};
    }
  }, []);

  /** Per-month aggregation */
  const monthlyData = useMemo(() => {
    return quarterMonths.map(m => {
      const monthStart = new Date(year, m - 1, 1);
      const monthEnd = new Date(year, m, 0, 23, 59, 59);
      const monthKey = `${year}-${String(m).padStart(2, '0')}`;

      const cases: string[] = []; // infection ids
      const categoryCounts: Record<string, number> = {};

      Object.values(store.infections).forEach(ip => {
        try {
          const d = getEventDate(ip);
          if (!d || d < monthStart || d > monthEnd) return;

          const res =
            ip.residentRef.kind === 'mrn'
              ? store.residents[ip.residentRef.id]
              : store.quarantine[ip.residentRef.id];

          const unit = residentUnit(ip, res);
          if (selectedUnit !== 'all' && unit !== selectedUnit) return;

          cases.push(ip.id);
          const cat = normalizeCategory(ip.infectionCategory);
          categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
        } catch {
          // skip malformed
        }
      });

      const residentDays = residentDaysMap[monthKey] ?? null;
      const ratePer1000 =
        residentDays && residentDays > 0
          ? parseFloat(((cases.length / residentDays) * 1000).toFixed(2))
          : null;

      return {
        monthKey,
        monthLabel: monthLabel(year, m),
        caseCount: cases.length,
        residentDays,
        ratePer1000,
        categoryCounts,
      };
    });
  }, [store.infections, store.residents, store.quarantine, year, quarterMonths, selectedUnit, residentDaysMap]);

  const totalCases = monthlyData.reduce((s, m) => s + m.caseCount, 0);
  const totalResidentDays = monthlyData.every(m => m.residentDays !== null)
    ? monthlyData.reduce((s, m) => s + (m.residentDays ?? 0), 0)
    : null;
  const quarterRate =
    totalResidentDays && totalResidentDays > 0
      ? parseFloat(((totalCases / totalResidentDays) * 1000).toFixed(2))
      : null;

  const trend = useMemo(
    () => computeTrend(monthlyData.map(m => m.caseCount) as [number, number, number]),
    [monthlyData]
  );

  /** Unique categories across the quarter */
  const allCategories = useMemo(() => {
    const s = new Set<string>();
    monthlyData.forEach(m => Object.keys(m.categoryCounts).forEach(c => s.add(c)));
    return Array.from(s).sort();
  }, [monthlyData]);

  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => String(y - i));
  }, []);

  const buildPdfSpec = () => ({
    title: `Quarterly Infection Rate Report — ${periodLabel}`,
    orientation: 'landscape' as const,
    template: 'LANDSCAPE_TEMPLATE_V1' as const,
    subtitleLines: [
      `Quarter: ${periodLabel}`,
      selectedUnit !== 'all' ? `Unit: ${selectedUnit}` : 'Unit: All',
      `Total Cases: ${totalCases}`,
      totalResidentDays !== null ? `Total Resident-Days: ${totalResidentDays}` : 'Resident-Days: Not available',
      quarterRate !== null ? `Quarter Rate/1,000 RD: ${quarterRate}` : 'Rate: N/A (no denominator)',
      `Generated: ${todayLocalDateInputValue()}`,
    ],
    sections: [
      {
        type: 'table' as const,
        title: 'Monthly Summary',
        columns: ['Month', 'Infection Cases', 'Resident-Days', 'Rate / 1,000 RD'],
        rows: monthlyData.map(m => [
          m.monthLabel,
          String(m.caseCount),
          m.residentDays !== null ? String(m.residentDays) : 'N/A',
          m.ratePer1000 !== null ? String(m.ratePer1000) : 'N/A',
        ]),
      },
      ...(allCategories.length > 0
        ? [{
            type: 'table' as const,
            title: 'Category Breakdown by Month',
            columns: ['Category', ...monthlyData.map(m => m.monthLabel), 'Quarter Total'],
            rows: allCategories.map(cat => [
              cat,
              ...monthlyData.map(m => String(m.categoryCounts[cat] ?? 0)),
              String(monthlyData.reduce((s, m) => s + (m.categoryCounts[cat] ?? 0), 0)),
            ]),
          }]
        : []),
      {
        type: 'text' as const,
        lines: [`Trend: ${trend.note}`],
      },
    ],
  });

  const trendBadgeClass = TREND_COLORS[trend.direction] ?? TREND_COLORS['insufficient-data'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3">
        <DrilldownHeader
          title="Quarterly Infection Rate Report"
          subtitle="Month-by-month infection trends and rates for a selected quarter"
          right={
            <ExportPdfButton
              filename={`quarterly-rate-report-${selectedYear}-Q${selectedQuarter}`}
              buildSpec={buildPdfSpec}
            />
          }
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-indigo-700 uppercase">Year</label>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
              className="border border-indigo-300 rounded-md px-2 py-1 text-sm text-indigo-800 bg-white focus:ring-indigo-500 focus:border-indigo-500"
            >
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-indigo-700 uppercase">Quarter</label>
            <select
              value={selectedQuarter}
              onChange={e => setSelectedQuarter(e.target.value)}
              className="border border-indigo-300 rounded-md px-2 py-1 text-sm text-indigo-800 bg-white focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="1">Q1 (Jan–Mar)</option>
              <option value="2">Q2 (Apr–Jun)</option>
              <option value="3">Q3 (Jul–Sep)</option>
              <option value="4">Q4 (Oct–Dec)</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-indigo-700 uppercase">Unit</label>
            <select
              value={selectedUnit}
              onChange={e => setSelectedUnit(e.target.value)}
              className="border border-indigo-300 rounded-md px-2 py-1 text-sm text-indigo-800 bg-white focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Units</option>
              {units.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <span className="text-indigo-700 text-sm font-semibold ml-auto">{periodLabel}</span>
        </div>
      </div>

      {/* Quarter Totals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white shadow rounded-lg p-5 flex flex-col items-center">
          <div className="text-4xl font-bold text-indigo-700">{totalCases}</div>
          <div className="text-xs text-neutral-500 mt-1 uppercase tracking-wide">Total Cases</div>
        </div>
        <div className="bg-white shadow rounded-lg p-5 flex flex-col items-center">
          <div className="text-4xl font-bold text-neutral-700">
            {totalResidentDays !== null ? totalResidentDays.toLocaleString() : <span className="text-neutral-400 text-2xl">N/A</span>}
          </div>
          <div className="text-xs text-neutral-500 mt-1 uppercase tracking-wide">Total Resident-Days</div>
        </div>
        <div className="bg-white shadow rounded-lg p-5 flex flex-col items-center">
          <div className="text-4xl font-bold text-indigo-700">
            {quarterRate !== null ? quarterRate : <span className="text-neutral-400 text-2xl">N/A</span>}
          </div>
          <div className="text-xs text-neutral-500 mt-1 uppercase tracking-wide">Rate / 1,000 Resident-Days</div>
        </div>
      </div>

      {/* Trend */}
      <div className={`border rounded-lg px-4 py-3 ${trendBadgeClass}`}>
        <span className="font-semibold text-sm capitalize">{trend.direction.replace('-', ' ')}: </span>
        <span className="text-sm">{trend.note}</span>
        {totalResidentDays === null && (
          <span className="text-xs ml-2 opacity-70">(Rates unavailable — enter resident-days in Monthly Analytics settings)</span>
        )}
      </div>

      {/* Monthly Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-4 bg-indigo-50 border-b border-indigo-200">
          <h3 className="text-base font-bold text-indigo-900">Monthly Breakdown — {periodLabel}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200 text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Month</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-neutral-500 uppercase">Cases</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-neutral-500 uppercase">Resident-Days</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-neutral-500 uppercase">Rate / 1,000 RD</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {monthlyData.map(m => (
                <tr key={m.monthKey}>
                  <td className="px-4 py-3 font-medium text-neutral-900">{m.monthLabel}</td>
                  <td className="px-4 py-3 text-right text-neutral-700">{m.caseCount}</td>
                  <td className="px-4 py-3 text-right text-neutral-500">
                    {m.residentDays !== null ? m.residentDays.toLocaleString() : <span className="italic text-neutral-300">N/A</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {m.ratePer1000 !== null
                      ? <span className="font-semibold text-indigo-700">{m.ratePer1000}</span>
                      : <span className="italic text-neutral-300">N/A</span>}
                  </td>
                </tr>
              ))}
              <tr className="bg-neutral-50 font-bold">
                <td className="px-4 py-3 text-neutral-700">Quarter Total</td>
                <td className="px-4 py-3 text-right text-neutral-900">{totalCases}</td>
                <td className="px-4 py-3 text-right text-neutral-700">
                  {totalResidentDays !== null ? totalResidentDays.toLocaleString() : '—'}
                </td>
                <td className="px-4 py-3 text-right text-indigo-700">
                  {quarterRate !== null ? quarterRate : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Category Comparison */}
      {allCategories.length > 0 && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-4 py-4 bg-purple-50 border-b border-purple-200">
            <h3 className="text-base font-bold text-purple-900">Category Breakdown by Month</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200 text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Category</th>
                  {monthlyData.map(m => (
                    <th key={m.monthKey} className="px-4 py-2 text-right text-xs font-medium text-neutral-500 uppercase whitespace-nowrap">{m.monthLabel}</th>
                  ))}
                  <th className="px-4 py-2 text-right text-xs font-medium text-neutral-500 uppercase">Q Total</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200">
                {allCategories.map(cat => {
                  const qTotal = monthlyData.reduce((s, m) => s + (m.categoryCounts[cat] ?? 0), 0);
                  return (
                    <tr key={cat}>
                      <td className="px-4 py-2 text-neutral-700">{cat}</td>
                      {monthlyData.map(m => (
                        <td key={m.monthKey} className="px-4 py-2 text-right text-neutral-700">
                          {m.categoryCounts[cat] ?? 0}
                        </td>
                      ))}
                      <td className="px-4 py-2 text-right font-semibold text-neutral-900">{qTotal}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {allCategories.length === 0 && (
        <div className="bg-white shadow rounded-lg px-4 py-8 text-center text-neutral-400 italic">
          No infection cases found for {periodLabel}{selectedUnit !== 'all' ? ` in ${selectedUnit}` : ''}.
        </div>
      )}
    </div>
  );
};

export default QuarterlyRateReport;
