import React, { useState, useMemo } from 'react';
import { FlaskConical, Plus, Download, Info, BarChart2, Calendar } from 'lucide-react';
import { CultureResult } from '../../domain/models';
import AddCultureModal from './AddCultureModal';
import { ExportPdfButton } from '../../components/ExportPdfButton';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  facilityId: string;
  cultures: CultureResult[];
  onAddCulture: (result: CultureResult) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Group CultureResults into an antibiogram matrix:
 *  organism → antibiotic → { S: n, I: n, R: n, total: n }
 */
function buildAntibiogramMatrix(cultures: CultureResult[]) {
  const matrix: Record<string, Record<string, { S: number; I: number; R: number; total: number }>> = {};

  for (const culture of cultures) {
    if (!matrix[culture.organism]) matrix[culture.organism] = {};
    for (const sens of culture.sensitivities) {
      if (!matrix[culture.organism][sens.antibiotic]) {
        matrix[culture.organism][sens.antibiotic] = { S: 0, I: 0, R: 0, total: 0 };
      }
      matrix[culture.organism][sens.antibiotic][sens.result]++;
      matrix[culture.organism][sens.antibiotic].total++;
    }
  }

  return matrix;
}

/** Returns the sorted list of all antibiotics tested across all organisms. */
function getAllAntibiotics(matrix: ReturnType<typeof buildAntibiogramMatrix>): string[] {
  const set = new Set<string>();
  for (const organism of Object.values(matrix)) {
    for (const abt of Object.keys(organism)) set.add(abt);
  }
  return Array.from(set).sort();
}

// ─── Cell Component ───────────────────────────────────────────────────────────

const SusceptibilityCell: React.FC<{ data?: { S: number; I: number; R: number; total: number } }> = ({ data }) => {
  if (!data || data.total === 0) {
    return <td className="px-3 py-2 text-center text-xs text-neutral-300">—</td>;
  }
  const pct = Math.round((data.S / data.total) * 100);
  const color =
    pct >= 90
      ? 'bg-emerald-100 text-emerald-800'
      : pct >= 70
      ? 'bg-amber-100 text-amber-800'
      : pct >= 50
      ? 'bg-orange-100 text-orange-800'
      : 'bg-red-100 text-red-800';

  return (
    <td className="px-2 py-1.5 text-center">
      <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${color}`} title={`S:${data.S} I:${data.I} R:${data.R}`}>
        {pct}%
      </span>
      <span className="block text-neutral-400 text-[10px] mt-0.5">n={data.total}</span>
    </td>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────

const AntibiogramBuilder: React.FC<Props> = ({ facilityId, cultures, onAddCulture }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());
  const [filterSource, setFilterSource] = useState<string>('All');

  // Derive available years from culture data
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(new Date().getFullYear());
    for (const c of cultures) {
      if (c.collectionDate) years.add(new Date(c.collectionDate + 'T00:00:00').getFullYear());
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [cultures]);

  // Derive available sources
  const availableSources = useMemo(() => {
    const sources = new Set<string>(['All']);
    for (const c of cultures) if (c.source) sources.add(c.source);
    return Array.from(sources);
  }, [cultures]);

  // Filter cultures by year and source
  const filteredCultures = useMemo(() => {
    return cultures.filter((c) => {
      const year = c.collectionDate ? new Date(c.collectionDate + 'T00:00:00').getFullYear() : null;
      const matchYear = year === filterYear;
      const matchSource = filterSource === 'All' || c.source === filterSource;
      return matchYear && matchSource;
    });
  }, [cultures, filterYear, filterSource]);

  const matrix = useMemo(() => buildAntibiogramMatrix(filteredCultures), [filteredCultures]);
  const organisms = Object.keys(matrix).sort();
  const antibiotics = getAllAntibiotics(matrix);

  // Build PDF export spec
  const buildPdfSpec = () => {
    const rows: (string | number)[][] = [];
    for (const org of organisms) {
      const countForOrg = filteredCultures.filter((c) => c.organism === org).length;
      for (const abt of antibiotics) {
        const d = matrix[org]?.[abt];
        if (d && d.total > 0) {
          rows.push([org, abt, `${Math.round((d.S / d.total) * 100)}%`, d.S, d.I, d.R, d.total]);
        }
      }
    }
    return {
      title: `Facility Antibiogram — ${filterYear}`,
      orientation: 'landscape' as const,
      template: 'LANDSCAPE_TEMPLATE_V1' as const,
      subtitleLines: [
        `Reporting Period: ${filterYear}`,
        filterSource !== 'All' ? `Source: ${filterSource}` : 'All Sources',
        `Total Cultures: ${filteredCultures.length}`,
        `Generated: ${new Date().toLocaleDateString()}`,
      ],
      sections: [
        {
          type: 'table' as const,
          columns: ['Organism', 'Antibiotic', '% Susceptible', 'S', 'I', 'R', 'n'],
          rows,
        },
      ],
    };
  };

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-blue-600" />
            Facility Antibiogram Builder
          </h2>
          <p className="text-sm text-neutral-500 mt-1">
            Annual susceptibility reports from culture data. Shows % susceptible per organism/antibiotic pair.
            Add lab results manually to build your facility antibiogram.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {filteredCultures.length > 0 && (
            <ExportPdfButton
              filename={`antibiogram-${filterYear}`}
              className="text-sm"
              buildSpec={buildPdfSpec}
            />
          )}
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Lab Result
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-neutral-50 border border-neutral-200 rounded-xl p-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-neutral-500" />
          <label className="text-sm font-medium text-neutral-700">Year:</label>
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(Number(e.target.value))}
            className="border border-neutral-300 rounded-lg p-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-neutral-500" />
          <label className="text-sm font-medium text-neutral-700">Source:</label>
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="border border-neutral-300 rounded-lg p-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {availableSources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <span className="text-sm text-neutral-500">
          {filteredCultures.length} culture{filteredCultures.length !== 1 ? 's' : ''} in dataset
        </span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-600">
        <span className="font-semibold">% Susceptible Legend:</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-200 inline-block" />≥90% — Excellent</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-200 inline-block" />70–89% — Adequate</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-200 inline-block" />50–69% — Marginal</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-200 inline-block" />&lt;50% — High Resistance</span>
      </div>

      {/* Antibiogram Table */}
      {organisms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-neutral-400 gap-3 border border-dashed border-neutral-300 rounded-xl">
          <FlaskConical className="w-10 h-10 text-neutral-300" />
          <p className="text-sm font-medium">No culture data for {filterYear}</p>
          <p className="text-xs">Click "Add Lab Result" to enter culture and sensitivity data.</p>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="mt-2 flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add First Result
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto border border-neutral-200 rounded-xl shadow-sm">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-700 sticky left-0 bg-neutral-50 min-w-[200px]">
                  Organism
                </th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-neutral-700 min-w-[60px]">
                  n (isolates)
                </th>
                {antibiotics.map((abt) => (
                  <th
                    key={abt}
                    className="text-center px-2 py-3 text-xs font-semibold text-neutral-600 min-w-[80px]"
                    title={abt}
                  >
                    <span className="block max-w-[72px] truncate">{abt}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {organisms.map((org) => {
                const isolateCount = filteredCultures.filter((c) => c.organism === org).length;
                return (
                  <tr key={org} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-neutral-900 sticky left-0 bg-white">
                      <p className="text-sm italic">{org}</p>
                      <p className="text-xs text-neutral-400">{isolateCount} isolate{isolateCount !== 1 ? 's' : ''}</p>
                    </td>
                    <td className="px-3 py-2 text-center text-sm font-bold text-neutral-700">
                      {isolateCount}
                    </td>
                    {antibiotics.map((abt) => (
                      <SusceptibilityCell key={abt} data={matrix[org]?.[abt]} />
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Info Note */}
      <div className="flex items-start gap-2 text-xs text-neutral-500 bg-neutral-50 border border-neutral-200 rounded-xl p-3">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-neutral-700">CLSI Antibiogram Guidelines</p>
          <p className="mt-0.5">
            Per CLSI M39 guidelines, at least 30 non-duplicate isolates per organism are recommended for reliable
            susceptibility reporting. Values based on fewer isolates should be interpreted with caution.
            This tool is intended to supplement — not replace — formal laboratory antibiogram reports.
          </p>
          <div className="flex flex-wrap gap-3 mt-2">
            <a
              href="https://clsi.org/standards/products/microbiology/documents/m39/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline hover:text-blue-800 flex items-center gap-1"
            >
              <Download className="w-3 h-3" /> CLSI M39 Antibiogram Analysis Standard
            </a>
            <a
              href="https://www.cdc.gov/antibiotic-use/core-elements/long-term-care.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline hover:text-blue-800 flex items-center gap-1"
            >
              <Download className="w-3 h-3" /> CDC — Antibiotic Use in LTCFs
            </a>
          </div>
        </div>
      </div>

      {showAddModal && (
        <AddCultureModal
          facilityId={facilityId}
          onSave={(result) => {
            onAddCulture(result);
            setShowAddModal(false);
          }}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
};

export default AntibiogramBuilder;
