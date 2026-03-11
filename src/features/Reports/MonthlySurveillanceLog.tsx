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

const SURVEILLANCE_CATEGORIES = [
  'UTI',
  'Respiratory',
  'GI',
  'Skin/Soft Tissue',
  'MDRO / Resistant Organism',
  'Device-Associated',
  'Other',
  'Unknown',
];

function normalizeCategory(raw: string | undefined): string {
  if (!raw) return 'Unknown';
  return SURVEILLANCE_CATEGORY_MAP[raw] ?? 'Other';
}

/** Pick the best event date from an IP record. Returns null if none is usable. */
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

function residentLabel(res: Resident | QuarantineResident | undefined): string {
  if (!res) return '—';
  const displayName = (res as Resident).displayName ?? (res as QuarantineResident).displayName ?? '—';
  const isHistorical =
    (res as Resident).isHistorical ||
    (res as Resident).backOfficeOnly ||
    (res as Resident).status === 'Discharged';
  return isHistorical ? `${displayName} (Historical)` : displayName;
}

function getMrn(res: Resident | QuarantineResident | undefined): string {
  return (res as Resident)?.mrn ?? '—';
}

function getUnit(ip: IPEvent, res: Resident | QuarantineResident | undefined): string {
  return (
    ip.locationSnapshot?.unit ??
    (res as Resident)?.currentUnit ??
    '—'
  );
}

function getRoom(ip: IPEvent, res: Resident | QuarantineResident | undefined): string {
  return (
    ip.locationSnapshot?.room ??
    (res as Resident)?.currentRoom ??
    '—'
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

const MonthlySurveillanceLog: React.FC = () => {
  const { store } = useFacilityData();

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState(
    String(now.getMonth() + 1).padStart(2, '0')
  );
  const [selectedUnit, setSelectedUnit] = useState('all');

  const year = parseInt(selectedYear, 10);
  const month = parseInt(selectedMonth, 10);

  const periodLabel = useMemo(() => {
    const d = new Date(year, month - 1, 1);
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }, [year, month]);

  const monthStart = useMemo(() => new Date(year, month - 1, 1), [year, month]);
  const monthEnd = useMemo(() => new Date(year, month, 0, 23, 59, 59), [year, month]);

  /** All active units derived from residents */
  const units = useMemo(() => {
    const s = new Set<string>();
    Object.values(store.residents).forEach(r => {
      if (r.currentUnit?.trim()) s.add(r.currentUnit.trim());
    });
    return Array.from(s).sort();
  }, [store.residents]);

  /** Filtered, normalized rows for the selected month/unit */
  const rows = useMemo(() => {
    const result: Array<{
      caseId: string;
      residentName: string;
      mrn: string;
      room: string;
      unit: string;
      eventDate: string;
      infectionCategory: string;
      rawInfectionType: string;
      organism: string;
      isolationType: string;
      status: string;
    }> = [];

    Object.values(store.infections).forEach(ip => {
      try {
        const eventDate = getEventDate(ip);
        if (!eventDate) return;
        if (eventDate < monthStart || eventDate > monthEnd) return;

        const res =
          ip.residentRef.kind === 'mrn'
            ? store.residents[ip.residentRef.id]
            : store.quarantine[ip.residentRef.id];

        const unit = getUnit(ip, res);
        if (selectedUnit !== 'all' && unit !== selectedUnit) return;

        result.push({
          caseId: ip.id,
          residentName: residentLabel(res),
          mrn: getMrn(res),
          room: getRoom(ip, res),
          unit,
          eventDate: eventDate.toLocaleDateString(),
          infectionCategory: normalizeCategory(ip.infectionCategory),
          rawInfectionType: ip.infectionCategory ?? '—',
          organism: ip.organism ?? '—',
          isolationType: ip.isolationType ?? '—',
          status: ip.status,
        });
      } catch {
        // skip malformed records
      }
    });

    return result.sort((a, b) => {
      const da = new Date(a.eventDate).getTime();
      const dateB = new Date(b.eventDate).getTime();
      if (da !== dateB) return da - dateB;
      return a.residentName.localeCompare(b.residentName);
    });
  }, [store.infections, store.residents, store.quarantine, monthStart, monthEnd, selectedUnit]);

  /** Totals by surveillance category */
  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    SURVEILLANCE_CATEGORIES.forEach(c => { map[c] = 0; });
    rows.forEach(r => { map[r.infectionCategory] = (map[r.infectionCategory] ?? 0) + 1; });
    return SURVEILLANCE_CATEGORIES.map(cat => ({ category: cat, count: map[cat] ?? 0 })).filter(
      r => r.count > 0
    );
  }, [rows]);

  /** Totals by unit */
  const byUnit = useMemo(() => {
    const map: Record<string, number> = {};
    rows.forEach(r => { map[r.unit] = (map[r.unit] ?? 0) + 1; });
    return Object.entries(map)
      .map(([unit, count]) => ({ unit, count }))
      .sort((a, b) => b.count - a.count);
  }, [rows]);

  const totalCases = rows.length;

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => String(currentYear - i));
  }, []);

  const monthOptions = [
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ];

  const buildPdfSpec = () => ({
    title: 'Monthly Infection Surveillance Log',
    orientation: 'portrait' as const,
    template: 'PORTRAIT_TEMPLATE_V1' as const,
    subtitleLines: [
      `Period: ${periodLabel}`,
      selectedUnit !== 'all' ? `Unit: ${selectedUnit}` : 'Unit: All',
      `Total Cases: ${totalCases}`,
      `Generated: ${todayLocalDateInputValue()}`,
    ],
    sections: [
      {
        type: 'table' as const,
        title: 'Infections by Category',
        columns: ['Category', 'Count'],
        rows: byCategory.map(r => [r.category, String(r.count)]),
      },
      {
        type: 'table' as const,
        title: 'Infections by Unit',
        columns: ['Unit', 'Count'],
        rows: byUnit.map(r => [r.unit, String(r.count)]),
      },
      {
        type: 'table' as const,
        title: 'Individual Cases',
        columns: ['Resident', 'MRN', 'Unit', 'Room', 'Event Date', 'Category', 'Raw Type', 'Organism', 'Isolation'],
        rows: rows.map(r => [
          r.residentName,
          r.mrn,
          r.unit,
          r.room,
          r.eventDate,
          r.infectionCategory,
          r.rawInfectionType,
          r.organism,
          r.isolationType,
        ]),
      },
    ],
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
        <DrilldownHeader
          title="Monthly Infection Surveillance Log"
          subtitle="Case-level infection data for a selected month with category and unit breakdown"
          right={
            <ExportPdfButton
              filename={`monthly-surveillance-${selectedYear}-${selectedMonth}`}
              buildSpec={buildPdfSpec}
            />
          }
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-red-700 uppercase">Year</label>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
              className="border border-red-300 rounded-md px-2 py-1 text-sm text-red-800 bg-white focus:ring-red-500 focus:border-red-500"
            >
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-red-700 uppercase">Month</label>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="border border-red-300 rounded-md px-2 py-1 text-sm text-red-800 bg-white focus:ring-red-500 focus:border-red-500"
            >
              {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-red-700 uppercase">Unit</label>
            <select
              value={selectedUnit}
              onChange={e => setSelectedUnit(e.target.value)}
              className="border border-red-300 rounded-md px-2 py-1 text-sm text-red-800 bg-white focus:ring-red-500 focus:border-red-500"
            >
              <option value="all">All Units</option>
              {units.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <span className="text-red-700 text-sm font-semibold ml-auto">
            {periodLabel}{selectedUnit !== 'all' ? ` — ${selectedUnit}` : ''}
          </span>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white shadow rounded-lg p-5 flex flex-col items-center">
          <div className="text-4xl font-bold text-red-700">{totalCases}</div>
          <div className="text-xs text-neutral-500 mt-1 uppercase tracking-wide">Total Cases</div>
        </div>
        <div className="bg-white shadow rounded-lg p-5 flex flex-col items-center">
          <div className="text-4xl font-bold text-neutral-700">{byCategory.length}</div>
          <div className="text-xs text-neutral-500 mt-1 uppercase tracking-wide">Categories Represented</div>
        </div>
        <div className="bg-white shadow rounded-lg p-5 flex flex-col items-center">
          <div className="text-4xl font-bold text-neutral-700">{byUnit.length}</div>
          <div className="text-xs text-neutral-500 mt-1 uppercase tracking-wide">Units Affected</div>
        </div>
      </div>

      {/* Category & Unit Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-4 py-4 bg-red-50 border-b border-red-200">
            <h3 className="text-base font-bold text-red-900">By Infection Category</h3>
          </div>
          <table className="min-w-full divide-y divide-neutral-200 text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Category</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-neutral-500 uppercase">Count</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {byCategory.length === 0 ? (
                <tr><td colSpan={2} className="px-4 py-6 text-center text-neutral-400 italic">No cases in this period</td></tr>
              ) : (
                <>
                  {byCategory.map(r => (
                    <tr key={r.category}>
                      <td className="px-4 py-2 text-neutral-700">{r.category}</td>
                      <td className="px-4 py-2 text-right font-semibold text-neutral-900">{r.count}</td>
                    </tr>
                  ))}
                  <tr className="bg-neutral-50">
                    <td className="px-4 py-2 font-bold text-neutral-700">Total</td>
                    <td className="px-4 py-2 text-right font-bold text-neutral-900">{totalCases}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-4 py-4 bg-amber-50 border-b border-amber-200">
            <h3 className="text-base font-bold text-amber-900">By Unit</h3>
          </div>
          <table className="min-w-full divide-y divide-neutral-200 text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Unit</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-neutral-500 uppercase">Count</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {byUnit.length === 0 ? (
                <tr><td colSpan={2} className="px-4 py-6 text-center text-neutral-400 italic">No cases in this period</td></tr>
              ) : (
                byUnit.map(r => (
                  <tr key={r.unit}>
                    <td className="px-4 py-2 text-neutral-700">{r.unit}</td>
                    <td className="px-4 py-2 text-right font-semibold text-neutral-900">{r.count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Individual Cases Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-4 bg-red-50 border-b border-red-200">
          <h3 className="text-base font-bold text-red-900">Individual Cases — {periodLabel}</h3>
          <p className="text-xs text-red-700 mt-1">{rows.length} case{rows.length !== 1 ? 's' : ''} found</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200 text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase whitespace-nowrap">Resident</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase whitespace-nowrap">MRN</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase whitespace-nowrap">Unit</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase whitespace-nowrap">Room</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase whitespace-nowrap">Event Date</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase whitespace-nowrap">Category</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase whitespace-nowrap">Raw Type</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase whitespace-nowrap">Organism</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase whitespace-nowrap">Isolation</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-neutral-400 italic">
                    No infection cases found for {periodLabel}{selectedUnit !== 'all' ? ` in ${selectedUnit}` : ''}.
                  </td>
                </tr>
              ) : (
                rows.map(r => (
                  <tr key={r.caseId} className="hover:bg-neutral-50">
                    <td className="px-3 py-2 font-medium text-neutral-900 whitespace-nowrap">{r.residentName}</td>
                    <td className="px-3 py-2 text-neutral-600 whitespace-nowrap">{r.mrn}</td>
                    <td className="px-3 py-2 text-neutral-600 whitespace-nowrap">{r.unit}</td>
                    <td className="px-3 py-2 text-neutral-600 whitespace-nowrap">{r.room}</td>
                    <td className="px-3 py-2 text-neutral-600 whitespace-nowrap">{r.eventDate}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        {r.infectionCategory}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-neutral-600 whitespace-nowrap">{r.rawInfectionType}</td>
                    <td className="px-3 py-2 text-neutral-600 whitespace-nowrap">{r.organism}</td>
                    <td className="px-3 py-2 text-neutral-600 whitespace-nowrap">{r.isolationType}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MonthlySurveillanceLog;
