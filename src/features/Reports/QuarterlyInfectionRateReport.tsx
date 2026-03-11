import React, { useEffect, useMemo, useState } from 'react';
import { useFacilityData, useDatabase } from '../../app/providers';
import { IPEvent } from '../../domain/models';
import { ExportPdfButton } from '../../components/ExportPdfButton';
import { DrilldownHeader } from '../../components/DrilldownHeader';
import {
  Quarter,
  StoredMonthlyMetric,
  TrendDirection,
  buildQuarterlyInfectionRateReport,
  type QuarterlyInfectionRateReport as QuarterlyReport,
} from '../../lib/trackerAggregator';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseMetrics(raw: string | null): Record<string, StoredMonthlyMetric> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, StoredMonthlyMetric>;
  } catch {
    return {};
  }
}

function fmtRate(rate: number | null): string {
  if (rate === null) return '—';
  return rate.toFixed(1);
}

function fmtDays(days: number | null): string {
  if (days === null) return '—';
  return days.toLocaleString();
}

const TREND_COLOR: Record<TrendDirection, string> = {
  increasing: 'text-red-700 bg-red-50 border-red-200',
  decreasing: 'text-green-700 bg-green-50 border-green-200',
  stable: 'text-blue-700 bg-blue-50 border-blue-200',
  'insufficient-data': 'text-neutral-600 bg-neutral-50 border-neutral-200',
};

/** Maps trend direction to a summary badge color (used in the header stats block). */
const TREND_TEXT_COLOR: Record<TrendDirection, string> = {
  increasing: 'text-red-700',
  decreasing: 'text-green-700',
  stable: 'text-blue-700',
  'insufficient-data': 'text-neutral-500',
};

const TREND_ICON: Record<TrendDirection, string> = {
  increasing: '↑',
  decreasing: '↓',
  stable: '→',
  'insufficient-data': '—',
};

const QUARTER_OPTIONS: { value: Quarter; label: string }[] = [
  { value: 1, label: 'Q1 (Jan–Mar)' },
  { value: 2, label: 'Q2 (Apr–Jun)' },
  { value: 3, label: 'Q3 (Jul–Sep)' },
  { value: 4, label: 'Q4 (Oct–Dec)' },
];

function currentQuarter(): Quarter {
  return (Math.floor(new Date().getMonth() / 3) + 1) as Quarter;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const QuarterlyInfectionRateReport: React.FC = () => {
  const { activeFacilityId, store } = useFacilityData();
  const { db } = useDatabase();

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState<Quarter>(currentQuarter());
  const [selectedUnit, setSelectedUnit] = useState<string>('all');

  const [metricsMap, setMetricsMap] = useState<Record<string, StoredMonthlyMetric>>({});

  // Load resident-day denominator data from localStorage (same source as MonthlyAnalytics).
  useEffect(() => {
    const raw = localStorage.getItem('ltc_facility_metrics');
    setMetricsMap(parseMetrics(raw));
  }, []);

  // Derive available units from facility config (same approach as LineListReport).
  const facility = db.data.facilities.byId[activeFacilityId];
  const availableUnits: string[] = useMemo(
    () => facility?.units?.map((u) => u.name) ?? [],
    [facility],
  );

  const infections = useMemo(
    () => Object.values(store.infections) as IPEvent[],
    [store.infections],
  );

  const report: QuarterlyReport = useMemo(
    () =>
      buildQuarterlyInfectionRateReport(infections, metricsMap, {
        year: selectedYear,
        quarter: selectedQuarter,
        unitFilter: selectedUnit === 'all' ? null : selectedUnit,
      }),
    [infections, metricsMap, selectedYear, selectedQuarter, selectedUnit],
  );

  // ── Year options: current year ± YEARS_BEFORE/AFTER ─────────────────────
  const YEARS_BEFORE = 3;
  const YEARS_AFTER = 3;
  const yearOptions = useMemo(() => {
    const yr = now.getFullYear();
    return Array.from({ length: YEARS_BEFORE + 1 + YEARS_AFTER }, (_, i) => yr - YEARS_BEFORE + i);
  }, []);

  // ── PDF export spec ───────────────────────────────────────────────────────
  const buildPdfSpec = () => {
    const { months, byCategory, totals, periodLabel, selectedUnit: unit, trend } = report;

    const monthlyRows: (string | number)[][] = months.map(m => [
      m.monthLabel,
      m.caseCount,
      fmtDays(m.residentDays),
      fmtRate(m.ratePer1000),
    ]);

    const categoryColumns = [
      'Category',
      ...months.map(m => m.monthLabel),
      'Quarter Total',
    ];
    const categoryRows: (string | number)[][] = byCategory.map(cat => [
      cat.category,
      ...cat.monthly.map(mm => mm.count),
      cat.totalCases,
    ]);
    if (byCategory.length === 0) {
      categoryRows.push(['No infections recorded', ...months.map(() => 0), 0]);
    }

    return {
      title: `Quarterly Infection Rate Report — ${periodLabel}`,
      orientation: 'landscape' as const,
      template: 'LANDSCAPE_TEMPLATE_V1' as const,
      subtitleLines: [
        `Period: ${periodLabel}`,
        `Unit: ${unit ?? 'All Units'}`,
        `Total Infections: ${totals.totalCases}`,
        totals.totalResidentDays !== null
          ? `Total Resident-Days: ${totals.totalResidentDays.toLocaleString()}`
          : 'Resident-Days: Not available',
        totals.quarterRatePer1000 !== null
          ? `Quarter Rate per 1,000 Resident-Days: ${totals.quarterRatePer1000.toFixed(1)}`
          : 'Quarter Rate: N/A',
        `Trend: ${trend.direction.toUpperCase()} — ${trend.note}`,
      ],
      sections: [
        {
          type: 'table' as const,
          title: 'Monthly Infection Summary',
          columns: ['Month', 'Infection Cases', 'Resident-Days', 'Rate per 1,000 Resident-Days'],
          rows: monthlyRows,
        },
        {
          type: 'table' as const,
          title: 'Infection Category Breakdown',
          columns: categoryColumns,
          rows: categoryRows,
        },
      ],
    };
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  const { months, byCategory, totals, periodLabel, trend } = report;
  const missingDenominator = months.some(m => m.residentDays === null);

  return (
    <div className="space-y-6 print:space-y-4">
      {/* ── Filter bar ───────────────────────────────────────────────────── */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3">
        <DrilldownHeader
          title="Quarterly Infection Rate Report"
          subtitle="Infection burden and month-by-month trends for a selected quarter"
          right={
            <ExportPdfButton
              className="px-4 py-1.5 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 print:hidden"
              filename="quarterly-infection-rate-report"
              label="Export PDF"
              buildSpec={buildPdfSpec}
            />
          }
        />
        <div className="flex flex-wrap items-center gap-3 mt-3 print:hidden">
          {/* Year */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-indigo-800 uppercase tracking-wide">
              Year
            </label>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="border border-indigo-300 rounded-md px-2 py-1 text-sm text-indigo-800 bg-white focus:ring-indigo-500 focus:border-indigo-500"
            >
              {yearOptions.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Quarter */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-indigo-800 uppercase tracking-wide">
              Quarter
            </label>
            <select
              value={selectedQuarter}
              onChange={e => setSelectedQuarter(Number(e.target.value) as Quarter)}
              className="border border-indigo-300 rounded-md px-2 py-1 text-sm text-indigo-800 bg-white focus:ring-indigo-500 focus:border-indigo-500"
            >
              {QUARTER_OPTIONS.map(q => (
                <option key={q.value} value={q.value}>{q.label}</option>
              ))}
            </select>
          </div>

          {/* Unit (optional) */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-indigo-800 uppercase tracking-wide">
              Unit
            </label>
            <select
              value={selectedUnit}
              onChange={e => setSelectedUnit(e.target.value)}
              className="border border-indigo-300 rounded-md px-2 py-1 text-sm text-indigo-800 bg-white focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Units</option>
              {availableUnits.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Section A: Header summary ─────────────────────────────────────── */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 bg-indigo-50 border-b border-indigo-200">
          <h3 className="text-lg leading-6 font-bold text-indigo-900">
            {periodLabel}
          </h3>
          <p className="text-xs text-indigo-700 mt-1">
            Unit: {selectedUnit === 'all' ? 'All Units' : selectedUnit}
          </p>
        </div>
        <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-indigo-700">{totals.totalCases}</div>
            <div className="text-xs text-neutral-500 mt-1">Total Infections</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-neutral-700">
              {totals.totalResidentDays !== null ? totals.totalResidentDays.toLocaleString() : '—'}
            </div>
            <div className="text-xs text-neutral-500 mt-1">Total Resident-Days</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-teal-700">
              {fmtRate(totals.quarterRatePer1000)}
            </div>
            <div className="text-xs text-neutral-500 mt-1">Quarter Rate / 1,000 Res-Days</div>
          </div>
          <div className="text-center">
            <div className={`text-3xl font-bold ${TREND_TEXT_COLOR[trend.direction]}`}>
              {TREND_ICON[trend.direction]}
            </div>
            <div className="text-xs text-neutral-500 mt-1 capitalize">{trend.direction}</div>
          </div>
        </div>
      </div>

      {/* ── Section B: Monthly table ──────────────────────────────────────── */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 bg-blue-50 border-b border-blue-200">
          <h3 className="text-lg leading-6 font-bold text-blue-900">Monthly Summary</h3>
          <p className="text-xs text-blue-700 mt-1">Month-by-month breakdown for {periodLabel}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200 text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Month</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-neutral-500 uppercase">Infection Cases</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-neutral-500 uppercase">Resident-Days</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-neutral-500 uppercase">Rate / 1,000 Res-Days</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {months.map(m => (
                <tr key={m.monthKey}>
                  <td className="px-4 py-3 font-medium text-neutral-800">{m.monthLabel}</td>
                  <td className="px-4 py-3 text-right font-semibold text-neutral-900">{m.caseCount}</td>
                  <td className="px-4 py-3 text-right text-neutral-600">{fmtDays(m.residentDays)}</td>
                  <td className="px-4 py-3 text-right text-teal-700 font-medium">{fmtRate(m.ratePer1000)}</td>
                </tr>
              ))}
              {/* Quarter total row */}
              <tr className="bg-neutral-50 font-bold">
                <td className="px-4 py-3 text-neutral-700">Quarter Total</td>
                <td className="px-4 py-3 text-right text-neutral-900">{totals.totalCases}</td>
                <td className="px-4 py-3 text-right text-neutral-700">{fmtDays(totals.totalResidentDays)}</td>
                <td className="px-4 py-3 text-right text-teal-700">{fmtRate(totals.quarterRatePer1000)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Section C: Category comparison table ─────────────────────────── */}
      {/* print:landscape handled by overflow-x-auto + responsive columns */}
      <div className="bg-white shadow rounded-lg overflow-hidden print:overflow-visible">
        <div className="px-4 py-5 sm:px-6 bg-red-50 border-b border-red-200">
          <h3 className="text-lg leading-6 font-bold text-red-900">Infection Category Breakdown</h3>
          <p className="text-xs text-red-700 mt-1">Cases per category, by month and quarter total</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200 text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase whitespace-nowrap">Category</th>
                {months.map(m => (
                  <th key={m.monthKey} className="px-4 py-2 text-right text-xs font-medium text-neutral-500 uppercase whitespace-nowrap">
                    {m.monthLabel}
                  </th>
                ))}
                <th className="px-4 py-2 text-right text-xs font-medium text-neutral-500 uppercase whitespace-nowrap">Quarter Total</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {byCategory.length === 0 ? (
                <tr>
                  <td
                    colSpan={months.length + 2}
                    className="px-4 py-6 text-center text-neutral-400"
                  >
                    No infections recorded for this quarter
                  </td>
                </tr>
              ) : (
                byCategory.map(cat => (
                  <tr key={cat.category}>
                    <td className="px-4 py-3 font-medium text-neutral-800">{cat.category}</td>
                    {cat.monthly.map(mm => (
                      <td key={mm.monthKey} className="px-4 py-3 text-right text-neutral-700">
                        {mm.count > 0 ? mm.count : <span className="text-neutral-300">0</span>}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right font-bold text-neutral-900">{cat.totalCases}</td>
                  </tr>
                ))
              )}
              {/* Category grand total row */}
              {byCategory.length > 0 && (
                <tr className="bg-neutral-50 font-bold">
                  <td className="px-4 py-3 text-neutral-700">Total</td>
                  {months.map(m => (
                    <td key={m.monthKey} className="px-4 py-3 text-right text-neutral-900">
                      {m.caseCount}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right text-neutral-900">{totals.totalCases}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Section D: Trend note ─────────────────────────────────────────── */}
      <div
        className={`rounded-lg border px-4 py-3 flex items-start gap-3 ${TREND_COLOR[trend.direction]}`}
      >
        <span className="text-2xl leading-none mt-0.5">{TREND_ICON[trend.direction]}</span>
        <div>
          <div className="font-bold capitalize">{trend.direction.replace('-', ' ')}</div>
          <div className="text-sm mt-0.5">{trend.note}</div>
        </div>
      </div>

      {/* ── Missing denominator notice ───────────────────────────────────── */}
      {missingDenominator && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 print:hidden">
          <strong>Note:</strong> Resident-day data is missing for one or more months. Rates are
          shown as "—" for those months. Enter resident-days in{' '}
          <span className="font-medium">Settings → Monthly Metrics</span> to see rates.
        </div>
      )}
    </div>
  );
};
