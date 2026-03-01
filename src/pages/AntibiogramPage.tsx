import React, { useMemo, useState } from "react";
import { useFacilityData } from "../app/providers";
import { ABTCourse } from "../domain/models";
import { Download, BarChart2 } from "lucide-react";

// ---------- Types ----------

interface OrgRow {
  organism: string;
  isolates: number;
  topAntibiotic: string;
  sensitiveCount: number;
  resistantCount: number;
  pctSensitive: string;
  monthCounts: Record<string, number>;
}

// ---------- Helpers ----------

const PALETTE = [
  "fill-indigo-400",
  "fill-emerald-400",
  "fill-amber-400",
  "fill-rose-400",
  "fill-violet-400",
  "fill-sky-400",
  "fill-orange-400",
];

const STROKE_PALETTE = [
  "stroke-indigo-400",
  "stroke-emerald-400",
  "stroke-amber-400",
  "stroke-rose-400",
  "stroke-violet-400",
  "stroke-sky-400",
  "stroke-orange-400",
];

function parseMonthKey(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "unknown";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  } catch {
    return "unknown";
  }
}

function parseSensitivity(raw: string): { sensitive: number; resistant: number } {
  let sensitive = 0;
  let resistant = 0;
  if (!raw) return { sensitive, resistant };
  const tokens = raw.split(/[,;|]/);
  for (const token of tokens) {
    const lower = token.toLowerCase().trim();
    if (/^sensitive:|^s:/.test(lower) || lower.endsWith("(s)")) sensitive++;
    else if (/^resistant:|^r:/.test(lower) || lower.endsWith("(r)")) resistant++;
    else if (lower.includes("sensitive")) sensitive++;
    else if (lower.includes("resistant")) resistant++;
  }
  return { sensitive, resistant };
}

function getMonthRange(startDate: Date, endDate: Date): string[] {
  const months: string[] = [];
  const cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  while (cur <= end) {
    months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

function exportCsv(rows: OrgRow[], months: string[]): void {
  const headers = ["Organism", "# Isolates", "Top Antibiotic Used", "Sensitive Count", "Resistant Count", "% Sensitive", ...months];
  const csvRows = rows.map(r => [
    `"${r.organism}"`,
    r.isolates,
    `"${r.topAntibiotic}"`,
    r.sensitiveCount,
    r.resistantCount,
    r.pctSensitive,
    ...months.map(m => r.monthCounts[m] ?? 0),
  ].join(","));
  const csv = [headers.join(","), ...csvRows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `antibiogram_${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------- Page component ----------

type SortField = "organism" | "isolates" | "pctSensitive";
type SortDir = "asc" | "desc";
type DateRange = "30" | "90" | "180" | "custom";

export const AntibiogramPage: React.FC = () => {
  const { store } = useFacilityData();

  const [dateRange, setDateRange] = useState<DateRange>("90");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().split("T")[0]);
  const [sortField, setSortField] = useState<SortField>("isolates");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    if (dateRange === "custom" && customStart && customEnd) {
      return { startDate: new Date(customStart), endDate: new Date(customEnd) };
    }
    const days = parseInt(dateRange, 10);
    const start = new Date(end);
    start.setDate(start.getDate() - days);
    return { startDate: start, endDate: end };
  }, [dateRange, customStart, customEnd]);

  const months = useMemo(() => getMonthRange(startDate, endDate), [startDate, endDate]);

  const rows = useMemo((): OrgRow[] => {
    const abts = (Object.values(store.abts) as ABTCourse[]).filter(a => {
      if (!a.organismIdentified?.trim()) return false;
      if (a.status !== "active" && a.status !== "completed") return false;
      const dateStr = a.startDate ?? a.createdAt;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d >= startDate && d <= endDate;
    });

    const orgMap = new Map<string, { abts: ABTCourse[]; monthCounts: Record<string, number> }>();
    for (const abt of abts) {
      const org = (abt.organismIdentified ?? "").trim();
      if (!orgMap.has(org)) orgMap.set(org, { abts: [], monthCounts: {} });
      const entry = orgMap.get(org)!;
      entry.abts.push(abt);
      const mk = parseMonthKey(abt.startDate ?? abt.createdAt ?? "");
      entry.monthCounts[mk] = (entry.monthCounts[mk] ?? 0) + 1;
    }

    const result: OrgRow[] = [];
    for (const [organism, { abts: orgAbts, monthCounts }] of orgMap.entries()) {
      const abtCounts = new Map<string, number>();
      let totalSensitive = 0;
      let totalResistant = 0;
      for (const abt of orgAbts) {
        abtCounts.set(abt.medication, (abtCounts.get(abt.medication) ?? 0) + 1);
        const { sensitive, resistant } = parseSensitivity(abt.sensitivitySummary ?? "");
        totalSensitive += sensitive;
        totalResistant += resistant;
      }
      const topEntry = [...abtCounts.entries()].sort((a, b) => b[1] - a[1])[0];
      const total = totalSensitive + totalResistant;
      result.push({
        organism,
        isolates: orgAbts.length,
        topAntibiotic: topEntry?.[0] ?? "—",
        sensitiveCount: totalSensitive,
        resistantCount: totalResistant,
        pctSensitive: total > 0 ? `${Math.round((totalSensitive / total) * 100)}%` : "N/A",
        monthCounts,
      });
    }

    return result.sort((a, b) => {
      let cmp = 0;
      if (sortField === "organism") cmp = a.organism.localeCompare(b.organism);
      else if (sortField === "isolates") cmp = a.isolates - b.isolates;
      else {
        const av = parseFloat(a.pctSensitive) || 0;
        const bv = parseFloat(b.pctSensitive) || 0;
        cmp = av - bv;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [store.abts, startDate, endDate, sortField, sortDir]);

  // Chart: top 6 organisms + "Others"
  const chartData = useMemo(() => {
    const top6 = rows.slice(0, 6);
    const others = rows.slice(6);
    const othersMonthCounts: Record<string, number> = {};
    for (const r of others) {
      for (const [mk, cnt] of Object.entries(r.monthCounts)) {
        othersMonthCounts[mk] = (othersMonthCounts[mk] ?? 0) + cnt;
      }
    }
    const all = [...top6];
    if (others.length > 0) {
      all.push({ organism: "Others", isolates: others.reduce((s, r) => s + r.isolates, 0), topAntibiotic: "—", sensitiveCount: 0, resistantCount: 0, pctSensitive: "N/A", monthCounts: othersMonthCounts });
    }
    return all;
  }, [rows]);

  const maxMonthCount = useMemo(() => {
    let max = 0;
    for (const row of chartData) {
      for (const cnt of Object.values(row.monthCounts)) {
        if (cnt > max) max = cnt;
      }
    }
    return Math.max(max, 1);
  }, [chartData]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const sortIndicator = (field: SortField) =>
    sortField === field ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  // SVG chart dimensions
  const chartW = 600;
  const chartH = 200;
  const chartPadL = 32;
  const chartPadB = 40;
  const chartPadT = 10;
  const chartPadR = 10;
  const innerW = chartW - chartPadL - chartPadR;
  const innerH = chartH - chartPadB - chartPadT;

  const barGroupW = months.length > 0 ? innerW / months.length : innerW;
  const barW = chartData.length > 0 ? Math.max(4, barGroupW / (chartData.length + 1)) : 8;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <BarChart2 className="w-6 h-6 text-indigo-600" />
          <h1 className="text-2xl font-bold text-neutral-900">Antibiogram Summary</h1>
        </div>
        <button
          onClick={() => exportCsv(rows, months)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 text-sm font-medium active:scale-95"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Date range filter */}
      <div className="bg-white rounded-lg border border-neutral-200 p-4 flex flex-wrap items-center gap-4">
        <span className="text-sm font-medium text-neutral-700">Date Range:</span>
        {(["30", "90", "180", "custom"] as DateRange[]).map(r => (
          <label key={r} className="flex items-center gap-1.5 text-sm text-neutral-700 cursor-pointer">
            <input type="radio" name="dateRange" value={r} checked={dateRange === r} onChange={() => setDateRange(r)} className="text-indigo-600 focus:ring-indigo-500" />
            {r === "custom" ? "Custom" : `Last ${r} days`}
          </label>
        ))}
        {dateRange === "custom" && (
          <>
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="border border-neutral-300 rounded-md p-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500" />
            <span className="text-sm text-neutral-500">—</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="border border-neutral-300 rounded-md p-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500" />
          </>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-lg border border-neutral-200 p-12 text-center text-neutral-500">
          <BarChart2 className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
          <p className="font-medium">No antibiotic courses with identified organisms found in this date range.</p>
          <p className="text-sm mt-1">Add culture/organism data to ABT courses to see antibiogram data here.</p>
        </div>
      ) : (
        <>
          {/* Organism Trend Chart */}
          <div className="bg-white rounded-lg border border-neutral-200 p-4 overflow-x-auto">
            <h2 className="text-sm font-semibold text-neutral-700 mb-3">Organism Trend (Isolates by Month)</h2>
            <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full max-w-2xl" aria-label="Organism trend bar chart">
              {/* Y-axis grid */}
              {[0, 0.25, 0.5, 0.75, 1].map(frac => {
                const y = chartPadT + innerH * (1 - frac);
                const val = Math.round(maxMonthCount * frac);
                return (
                  <g key={frac}>
                    <line x1={chartPadL} y1={y} x2={chartW - chartPadR} y2={y} stroke="#e5e7eb" strokeWidth="1" />
                    <text x={chartPadL - 4} y={y + 4} textAnchor="end" fontSize="10" fill="#9ca3af">{val}</text>
                  </g>
                );
              })}
              {/* Bars */}
              {months.map((month, mi) => {
                const groupX = chartPadL + mi * barGroupW;
                return (
                  <g key={month}>
                    {chartData.map((row, ri) => {
                      const cnt = row.monthCounts[month] ?? 0;
                      const barH = (cnt / maxMonthCount) * innerH;
                      const x = groupX + (ri + 0.5) * barW;
                      const y = chartPadT + innerH - barH;
                      const fill = PALETTE[ri % PALETTE.length];
                      return (
                        <rect
                          key={row.organism}
                          x={x}
                          y={y}
                          width={barW - 2}
                          height={barH}
                          className={fill}
                          rx="2"
                        >
                          <title>{row.organism}: {cnt} isolates in {month}</title>
                        </rect>
                      );
                    })}
                    <text
                      x={groupX + barGroupW / 2}
                      y={chartH - chartPadB + 14}
                      textAnchor="middle"
                      fontSize="9"
                      fill="#6b7280"
                    >
                      {month.split("-")[1]}/{month.split("-")[0].slice(2)}
                    </text>
                  </g>
                );
              })}
              {/* Legend */}
              {chartData.map((row, ri) => (
                <g key={row.organism} transform={`translate(${chartPadL + ri * 85}, ${chartH - 8})`}>
                  <rect width="8" height="8" className={PALETTE[ri % PALETTE.length]} rx="1" y="-8" />
                  <text x="11" y="-1" fontSize="9" fill="#4b5563">{row.organism.length > 10 ? row.organism.slice(0, 10) + "…" : row.organism}</text>
                </g>
              ))}
            </svg>
          </div>

          {/* Pivot table */}
          <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
            <table className="min-w-full divide-y divide-neutral-200 text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  <th
                    className="px-4 py-3 text-left font-medium text-neutral-500 cursor-pointer hover:text-neutral-700 select-none"
                    onClick={() => handleSort("organism")}
                  >
                    Organism{sortIndicator("organism")}
                  </th>
                  <th
                    className="px-4 py-3 text-right font-medium text-neutral-500 cursor-pointer hover:text-neutral-700 select-none"
                    onClick={() => handleSort("isolates")}
                  >
                    # Isolates{sortIndicator("isolates")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-500">Top Antibiotic Used</th>
                  <th className="px-4 py-3 text-right font-medium text-neutral-500">Sensitive</th>
                  <th className="px-4 py-3 text-right font-medium text-neutral-500">Resistant</th>
                  <th
                    className="px-4 py-3 text-right font-medium text-neutral-500 cursor-pointer hover:text-neutral-700 select-none"
                    onClick={() => handleSort("pctSensitive")}
                  >
                    % Sensitive{sortIndicator("pctSensitive")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {rows.map(row => {
                  const pct = parseFloat(row.pctSensitive);
                  const pctColor = isNaN(pct) ? "" : pct >= 80 ? "text-green-700" : pct >= 50 ? "text-amber-700" : "text-red-700";
                  return (
                    <tr key={row.organism} className="hover:bg-neutral-50">
                      <td className="px-4 py-2.5 font-medium text-neutral-800">{row.organism}</td>
                      <td className="px-4 py-2.5 text-right text-neutral-700">{row.isolates}</td>
                      <td className="px-4 py-2.5 text-neutral-600">{row.topAntibiotic}</td>
                      <td className="px-4 py-2.5 text-right text-green-700">{row.sensitiveCount || <span className="text-neutral-400">—</span>}</td>
                      <td className="px-4 py-2.5 text-right text-red-700">{row.resistantCount || <span className="text-neutral-400">—</span>}</td>
                      <td className={`px-4 py-2.5 text-right font-semibold ${pctColor}`}>{row.pctSensitive}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
