/**
 * Monthly Infection Surveillance Log – standalone report component.
 *
 * Follows the QapiRollup pattern: self-contained state, summary blocks at top,
 * detail case table below, and an ExportPdfButton for print-ready PDF export.
 */

import React, { useMemo, useState } from 'react';
import { useFacilityData } from '../../app/providers';
import { Resident } from '../../domain/models';
import { ExportPdfButton } from '../../components/ExportPdfButton';
import {
  buildMonthlyInfectionSurveillanceLog,
  type SurveillanceRow,
  type SurveillanceCategory,
} from '../../lib/analytics/surveillanceAggregator';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const LAB_STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmed',
  suspected: 'Suspected',
  unknown: '—',
};

const LAB_STATUS_BADGE: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-800',
  suspected: 'bg-amber-100 text-amber-800',
  unknown: 'bg-neutral-100 text-neutral-600',
};

function safeStr(val: string | null | undefined): string {
  return val?.trim() || '—';
}

// ─── Component ───────────────────────────────────────────────────────────────

export const MonthlySurveillanceReport: React.FC = () => {
  const { store } = useFacilityData();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
  );
  const [selectedUnit, setSelectedUnit] = useState('');

  const [year, month] = selectedMonth.split('-').map(Number);

  // Derive available units from active residents
  const availableUnits = useMemo(() => {
    const s = new Set<string>();
    (Object.values(store.residents) as Resident[])
      .filter(r => !r.isHistorical && !r.backOfficeOnly)
      .forEach(r => {
        if (r.currentUnit?.trim()) s.add(r.currentUnit.trim());
      });
    return Array.from(s).sort();
  }, [store.residents]);

  const report = useMemo(
    () =>
      buildMonthlyInfectionSurveillanceLog(
        store,
        month,
        year,
        selectedUnit || null,
      ),
    [store, month, year, selectedUnit],
  );

  // ─── PDF Spec Builder ────────────────────────────────────────────────────
  const buildPdfSpec = () => {
    const subtitleLines = [
      `Reporting Period: ${report.periodLabel}`,
      report.selectedUnit ? `Unit: ${report.selectedUnit}` : 'Unit: All Units',
      `Total Cases: ${report.totals.totalCases}`,
      `Confirmed: ${report.totals.confirmed}  |  Suspected: ${report.totals.suspected}  |  Unknown: ${report.totals.unknownStatus}`,
    ];

    return {
      title: 'Monthly Infection Surveillance Log',
      orientation: 'portrait' as const,
      template: 'PORTRAIT_TEMPLATE_V1' as const,
      subtitleLines,
      sections: [
        {
          type: 'table' as const,
          title: 'Cases by Infection Category',
          columns: ['Category', 'Count'],
          rows:
            report.byCategory.length > 0
              ? report.byCategory.map(({ category, count }) => [
                  category,
                  count,
                ])
              : [['No cases', '0']],
        },
        {
          type: 'table' as const,
          title: 'Cases by Unit',
          columns: ['Unit', 'Count'],
          rows:
            report.byUnit.length > 0
              ? report.byUnit.map(({ unit, count }) => [unit, count])
              : [['No cases', '0']],
        },
        {
          type: 'table' as const,
          title: 'Individual Case Detail',
          columns: [
            'Date',
            'Resident',
            'MRN',
            'Unit / Room',
            'Category',
            'Type',
            'Organism',
            'Lab Status',
            'Precautions',
            'Outcome',
          ],
          rows:
            report.rows.length > 0
              ? report.rows.map((r: SurveillanceRow) => [
                  safeStr(r.eventDate),
                  safeStr(r.residentName),
                  safeStr(r.mrn),
                  r.room ? `${r.unit} / ${r.room}` : r.unit,
                  r.infectionCategory as string,
                  safeStr(r.rawInfectionType),
                  safeStr(r.organism),
                  LAB_STATUS_LABELS[r.labStatus] ?? '—',
                  safeStr(r.precautions),
                  r.outcome,
                ])
              : [['No cases recorded for this period', '', '', '', '', '', '', '', '', '']],
        },
      ],
    };
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 print:space-y-4">

      {/* ── Controls bar ─────────────────────────────────────────────────── */}
      <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-3 flex flex-wrap items-center gap-3 print:hidden">
        <span className="font-bold text-teal-900 text-sm whitespace-nowrap">
          Monthly Infection Surveillance Log
        </span>

        <input
          type="month"
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          className="border border-teal-300 rounded-md px-2 py-1 text-sm text-teal-800 bg-white focus:ring-teal-500 focus:border-teal-500"
          aria-label="Select month"
        />

        <select
          value={selectedUnit}
          onChange={e => setSelectedUnit(e.target.value)}
          className="border border-teal-300 rounded-md px-2 py-1 text-sm text-teal-800 bg-white focus:ring-teal-500 focus:border-teal-500"
          aria-label="Filter by unit"
        >
          <option value="">All Units</option>
          {availableUnits.map(u => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-2">
          <ExportPdfButton
            label="Export PDF"
            filename={`infection-surveillance-${report.monthKey}`}
            className="px-4 py-1.5 bg-teal-600 text-white rounded-md text-sm font-medium hover:bg-teal-700 flex items-center gap-2"
            buildSpec={buildPdfSpec}
          />
          <button
            onClick={() => window.print()}
            className="px-4 py-1.5 bg-white border border-teal-300 text-teal-700 rounded-md text-sm font-medium hover:bg-teal-50"
          >
            Print
          </button>
        </div>
      </div>

      {/* ── Report Header (visible in print) ─────────────────────────────── */}
      <div className="hidden print:block text-center mb-4">
        <h1 className="text-xl font-bold">Monthly Infection Surveillance Log</h1>
        <p className="text-sm text-neutral-600">
          {report.periodLabel}
          {report.selectedUnit ? ` — Unit: ${report.selectedUnit}` : ''}
        </p>
      </div>

      {/* ── Summary Totals ────────────────────────────────────────────────── */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 bg-teal-50 border-b border-teal-200">
          <h3 className="text-lg leading-6 font-bold text-teal-900">
            Summary — {report.periodLabel}
          </h3>
          {report.selectedUnit && (
            <p className="text-xs text-teal-700 mt-0.5">
              Unit filter: {report.selectedUnit}
            </p>
          )}
        </div>
        <div className="px-6 py-4 flex flex-wrap gap-8">
          <StatBlock
            value={report.totals.totalCases}
            label="Total Cases"
            colorClass="text-teal-700"
          />
          <StatBlock
            value={report.totals.confirmed}
            label="Confirmed"
            colorClass="text-green-700"
          />
          <StatBlock
            value={report.totals.suspected}
            label="Suspected"
            colorClass="text-amber-600"
          />
          <StatBlock
            value={report.totals.unknownStatus}
            label="Unknown Status"
            colorClass="text-neutral-500"
          />
          {report.residentDays !== null && (
            <StatBlock
              value={`${((report.totals.totalCases / report.residentDays) * 1000).toFixed(2)}/1000`}
              label="Infection Rate / 1,000 res-days"
              colorClass="text-indigo-700"
            />
          )}
        </div>
      </div>

      {/* ── Breakdown Grid ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* By Category */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-4 py-4 bg-red-50 border-b border-red-200">
            <h3 className="text-base font-bold text-red-900">
              Cases by Infection Category
            </h3>
          </div>
          <CategoryTable
            rows={report.byCategory}
            total={report.totals.totalCases}
          />
        </div>

        {/* By Unit */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-4 py-4 bg-amber-50 border-b border-amber-200">
            <h3 className="text-base font-bold text-amber-900">Cases by Unit</h3>
          </div>
          <UnitTable rows={report.byUnit} total={report.totals.totalCases} />
        </div>
      </div>

      {/* ── Individual Case Table ─────────────────────────────────────────── */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-4 sm:px-6 bg-neutral-50 border-b border-neutral-200">
          <h3 className="text-base font-bold text-neutral-900">
            Individual Case Detail
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            {report.totals.totalCases} case
            {report.totals.totalCases !== 1 ? 's' : ''} · sorted by event date
          </p>
        </div>
        <CaseTable rows={report.rows} />
      </div>
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StatBlockProps {
  value: number | string;
  label: string;
  colorClass: string;
}

const StatBlock: React.FC<StatBlockProps> = ({ value, label, colorClass }) => (
  <div className="text-center min-w-[80px]">
    <div className={`text-3xl font-bold ${colorClass}`}>{value}</div>
    <div className="text-xs text-neutral-500 mt-1">{label}</div>
  </div>
);

interface CategoryTableProps {
  rows: Array<{ category: SurveillanceCategory; count: number }>;
  total: number;
}

const CategoryTable: React.FC<CategoryTableProps> = ({ rows, total }) => (
  <table className="min-w-full divide-y divide-neutral-200 text-sm">
    <thead className="bg-neutral-50">
      <tr>
        <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">
          Category
        </th>
        <th className="px-4 py-2 text-right text-xs font-medium text-neutral-500 uppercase">
          Count
        </th>
      </tr>
    </thead>
    <tbody className="bg-white divide-y divide-neutral-200">
      {rows.length === 0 ? (
        <tr>
          <td
            colSpan={2}
            className="px-4 py-6 text-center text-neutral-400 italic"
          >
            No cases in this period
          </td>
        </tr>
      ) : (
        <>
          {rows.map(({ category, count }) => (
            <tr key={category}>
              <td className="px-4 py-2 text-neutral-700">{category}</td>
              <td className="px-4 py-2 text-right font-semibold text-neutral-900">
                {count}
              </td>
            </tr>
          ))}
          <tr className="bg-neutral-50">
            <td className="px-4 py-2 font-bold text-neutral-700">Total</td>
            <td className="px-4 py-2 text-right font-bold text-neutral-900">
              {total}
            </td>
          </tr>
        </>
      )}
    </tbody>
  </table>
);

interface UnitTableProps {
  rows: Array<{ unit: string; count: number }>;
  total: number;
}

const UnitTable: React.FC<UnitTableProps> = ({ rows, total }) => (
  <table className="min-w-full divide-y divide-neutral-200 text-sm">
    <thead className="bg-neutral-50">
      <tr>
        <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">
          Unit
        </th>
        <th className="px-4 py-2 text-right text-xs font-medium text-neutral-500 uppercase">
          Count
        </th>
      </tr>
    </thead>
    <tbody className="bg-white divide-y divide-neutral-200">
      {rows.length === 0 ? (
        <tr>
          <td
            colSpan={2}
            className="px-4 py-6 text-center text-neutral-400 italic"
          >
            No cases in this period
          </td>
        </tr>
      ) : (
        <>
          {rows.map(({ unit, count }) => (
            <tr key={unit}>
              <td className="px-4 py-2 text-neutral-700">{unit}</td>
              <td className="px-4 py-2 text-right font-semibold text-neutral-900">
                {count}
              </td>
            </tr>
          ))}
          <tr className="bg-neutral-50">
            <td className="px-4 py-2 font-bold text-neutral-700">Total</td>
            <td className="px-4 py-2 text-right font-bold text-neutral-900">
              {total}
            </td>
          </tr>
        </>
      )}
    </tbody>
  </table>
);

interface CaseTableProps {
  rows: SurveillanceRow[];
}

const CaseTable: React.FC<CaseTableProps> = ({ rows }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full divide-y divide-neutral-200 text-xs">
      <thead className="bg-neutral-50">
        <tr>
          {[
            'Date',
            'Resident',
            'MRN',
            'Unit',
            'Room',
            'Category',
            'Type',
            'Organism',
            'Lab Status',
            'Precautions',
            'Outcome',
          ].map(h => (
            <th
              key={h}
              className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider whitespace-nowrap"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-neutral-200">
        {rows.length === 0 ? (
          <tr>
            <td
              colSpan={11}
              className="px-4 py-8 text-center text-neutral-400 italic"
            >
              No cases recorded for this period.
            </td>
          </tr>
        ) : (
          rows.map((row, idx) => (
            <tr
              key={row.caseId || idx}
              className="hover:bg-neutral-50 transition-colors print:hover:bg-transparent"
            >
              <td className="px-3 py-1.5 text-neutral-700 whitespace-nowrap">
                {safeStr(row.eventDate)}
              </td>
              <td className="px-3 py-1.5 text-neutral-900 font-medium max-w-[140px] truncate">
                {safeStr(row.residentName)}
              </td>
              <td className="px-3 py-1.5 text-neutral-600">
                {safeStr(row.mrn)}
              </td>
              <td className="px-3 py-1.5 text-neutral-700">
                {safeStr(row.unit)}
              </td>
              <td className="px-3 py-1.5 text-neutral-600">
                {safeStr(row.room)}
              </td>
              <td className="px-3 py-1.5 text-neutral-700 whitespace-nowrap">
                {row.infectionCategory}
              </td>
              <td className="px-3 py-1.5 text-neutral-600 max-w-[120px] truncate">
                {safeStr(row.rawInfectionType)}
              </td>
              <td className="px-3 py-1.5 text-neutral-600 max-w-[120px] truncate">
                {safeStr(row.organism)}
              </td>
              <td className="px-3 py-1.5">
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                    LAB_STATUS_BADGE[row.labStatus] ??
                    'bg-neutral-100 text-neutral-600'
                  }`}
                >
                  {LAB_STATUS_LABELS[row.labStatus] ?? '—'}
                </span>
              </td>
              <td className="px-3 py-1.5 text-neutral-600">
                {safeStr(row.precautions)}
              </td>
              <td className="px-3 py-1.5 text-neutral-700">
                {row.outcome}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);
