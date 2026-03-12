import React, { useState, useMemo } from 'react';
import {
  Pill, AlertTriangle, CheckCircle2, Clock, Activity, MessageSquare,
  FlaskConical, ChevronDown, ChevronRight,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts';
import { ABTCourse, AbtIntervention } from '../../domain/models';
import { useDatabase, useFacilityData } from '../../app/providers';
import PrescriberFeedbackModal from './PrescriberFeedbackModal';
import { ExportPdfButton } from '../../components/ExportPdfButton';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const parseLocalDate = (raw: string): Date =>
  /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(raw + 'T00:00:00') : new Date(raw);

/** Days between two YYYY-MM-DD strings, inclusive of start. Returns null if either is missing. */
function daysBetween(start?: string, end?: string): number | null {
  if (!start) return null;
  const s = parseLocalDate(start);
  const e = end ? parseLocalDate(end) : new Date();
  return Math.max(0, Math.round((e.getTime() - s.getTime()) / 86_400_000));
}

// ─── Broad-Spectrum Antibiotic Classes ───────────────────────────────────────
const BROAD_SPECTRUM_CLASSES = [
  'Carbapenem', 'Anti-pseudomonal', 'Extended-spectrum cephalosporin',
  'Fluoroquinolone', 'Glycopeptide', 'Oxazolidinone', 'Lipopeptide',
];
const BROAD_SPECTRUM_NAMES = [
  'vancomycin', 'linezolid', 'daptomycin', 'meropenem', 'imipenem', 'ertapenem',
  'piperacillin', 'cefepime', 'ciprofloxacin', 'levofloxacin', 'moxifloxacin',
  'tigecycline', 'colistin',
];

function isBroadSpectrum(abt: ABTCourse): boolean {
  if (abt.isBroadSpectrum !== undefined) return abt.isBroadSpectrum;
  const medLow = (abt.medication || '').toLowerCase();
  const classLow = (abt.medicationClass || '').toLowerCase();
  return (
    BROAD_SPECTRUM_NAMES.some((n) => medLow.includes(n)) ||
    BROAD_SPECTRUM_CLASSES.some((c) => classLow.includes(c.toLowerCase()))
  );
}

// ─── PAF Queue Flag Logic ─────────────────────────────────────────────────────

interface PafFlag {
  abt: ABTCourse;
  residentName: string;
  reasons: string[];
  urgency: 'high' | 'medium' | 'low';
}

function buildPafQueue(
  abts: ABTCourse[],
  residentNames: Record<string, string>,
): PafFlag[] {
  const flags: PafFlag[] = [];
  const now = new Date();

  for (const abt of abts) {
    if (abt.status !== 'active') continue;
    const reasons: string[] = [];
    let urgency: PafFlag['urgency'] = 'low';

    const daysOnTherapy = daysBetween(abt.startDate) ?? 0;

    // Flag 1: No 72h timeout documented after 3+ days on therapy
    if (daysOnTherapy >= 3 && !abt.timeoutReviewDate) {
      reasons.push(`72-hour timeout not documented (Day ${daysOnTherapy} of therapy)`);
      urgency = 'high';
    }

    // Flag 2: Broad-spectrum started without documented culture
    if (isBroadSpectrum(abt) && !abt.cultureCollected) {
      reasons.push('Broad-spectrum agent started without documented culture collection');
      urgency = 'high';
    }

    // Flag 3: Long UTI course (>7 days for UTI)
    const syndromeIsUti = (abt.syndromeCategory || '').toLowerCase().includes('uri') ||
      (abt.indication || '').toLowerCase().includes('uti');
    if (syndromeIsUti && daysOnTherapy > 7) {
      reasons.push(`UTI course exceeds 7 days (currently Day ${daysOnTherapy})`);
      urgency = urgency === 'high' ? 'high' : 'medium';
    }

    // Flag 4: No indication documented
    if (!abt.indication?.trim() && !abt.syndromeCategory) {
      reasons.push('No indication or syndrome category documented');
      urgency = urgency === 'high' ? 'high' : 'medium';
    }

    // Flag 5: Course >14 days (most LTCF infections don't need >14d)
    if (daysOnTherapy > 14) {
      reasons.push(`Extended course >14 days (Day ${daysOnTherapy}) — review continuation`);
      urgency = urgency === 'high' ? 'high' : 'medium';
    }

    // Flag 6: Fluoroquinolone without documented rationale
    const isFluoro = ['ciprofloxacin', 'levofloxacin', 'moxifloxacin'].some((f) =>
      (abt.medication || '').toLowerCase().includes(f)
    );
    if (isFluoro && !abt.indication?.trim()) {
      reasons.push('Fluoroquinolone without documented clinical rationale (CMS last-resort requirement)');
      urgency = 'high';
    }

    if (reasons.length > 0) {
      const resId = abt.residentRef.id;
      flags.push({
        abt,
        residentName: residentNames[resId] || resId,
        reasons,
        urgency,
      });
    }
  }

  // Sort: high → medium → low
  const urgencyOrder = { high: 0, medium: 1, low: 2 };
  return flags.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);
}

// ─── Component ────────────────────────────────────────────────────────────────

const AbtMetrics: React.FC = () => {
  const { store, activeFacilityId } = useFacilityData();
  const { updateDB } = useDatabase();
  const [feedbackTarget, setFeedbackTarget] = useState<PafFlag | null>(null);
  const [expandedPaf, setExpandedPaf] = useState<string | null>(null);

  const abts = useMemo(() => Object.values(store.abts || {}) as ABTCourse[], [store.abts]);
  const residents = store.residents || {};
  const quarantine = (store.quarantine as any) || {};

  // Build resident name lookup
  const residentNames = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const r of Object.values(residents)) {
      map[(r as any).mrn] = (r as any).displayName || (r as any).mrn;
    }
    for (const q of Object.values(quarantine)) {
      map[(q as any).tempId] = (q as any).displayName || (q as any).tempId;
    }
    return map;
  }, [residents, quarantine]);

  // ── Core Metrics ──────────────────────────────────────────────────────────

  const metrics = useMemo(() => {
    const activeResidents = Object.values(residents).filter(
      (r: any) => r.status === 'Active' || (!r.isHistorical && !r.backOfficeOnly)
    ).length;
    const residentDays = Math.max(activeResidents * 30, 1); // approximate monthly resident-days

    const activeAbts = abts.filter((a) => a.status === 'active');
    const completedAbts = abts.filter((a) => a.status === 'completed' || a.status === 'discontinued');

    // DOT = sum of days of active therapy
    const totalDaysOfTherapy = abts.reduce((sum, abt) => {
      const d = daysBetween(abt.startDate, abt.endDate);
      return sum + (d ?? 0);
    }, 0);
    const dotPer1000 = residentDays > 0 ? Math.round((totalDaysOfTherapy / residentDays) * 1000) : 0;

    // LOT = average length of completed courses by syndrome
    const lotBySyndrome: Record<string, number[]> = {};
    for (const abt of completedAbts) {
      const syndrome = abt.syndromeCategory || 'Unspecified';
      const d = daysBetween(abt.startDate, abt.endDate);
      if (d !== null) {
        if (!lotBySyndrome[syndrome]) lotBySyndrome[syndrome] = [];
        lotBySyndrome[syndrome].push(d);
      }
    }
    const lotChart = Object.entries(lotBySyndrome)
      .map(([syndrome, days]) => ({
        syndrome,
        avgDays: Math.round(days.reduce((s, d) => s + d, 0) / days.length),
        n: days.length,
      }))
      .sort((a, b) => b.avgDays - a.avgDays);

    // Timeout compliance
    const abtsOver72h = abts.filter((a) => (daysBetween(a.startDate) ?? 0) >= 3);
    const reviewed = abtsOver72h.filter((a) => !!a.timeoutReviewDate).length;
    const timeoutCompliance =
      abtsOver72h.length > 0 ? Math.round((reviewed / abtsOver72h.length) * 100) : 100;

    // Broad-spectrum %
    const broadCount = activeAbts.filter(isBroadSpectrum).length;
    const broadPct = activeAbts.length > 0 ? Math.round((broadCount / activeAbts.length) * 100) : 0;

    // Culture-guided therapy rate
    const withCulture = abts.filter((a) => a.cultureCollected).length;
    const cultureRate = abts.length > 0 ? Math.round((withCulture / abts.length) * 100) : 0;

    // Monthly DOT trend (last 6 months)
    const dotTrend: { month: string; dot: number; sortKey: string }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      let monthDot = 0;
      for (const abt of abts) {
        if (!abt.startDate) continue;
        const start = parseLocalDate(abt.startDate);
        const end = abt.endDate ? parseLocalDate(abt.endDate) : new Date();
        const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
        const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        // Overlap days in this month
        const overlapStart = start > mStart ? start : mStart;
        const overlapEnd = end < mEnd ? end : mEnd;
        if (overlapEnd >= overlapStart) {
          monthDot += Math.round((overlapEnd.getTime() - overlapStart.getTime()) / 86_400_000) + 1;
        }
      }
      dotTrend.push({
        month: d.toLocaleString('default', { month: 'short' }),
        dot: monthDot,
        sortKey,
      });
    }

    return {
      totalAbts: abts.length,
      activeAbts: activeAbts.length,
      dotPer1000,
      timeoutCompliance,
      broadPct,
      cultureRate,
      lotChart,
      dotTrend,
    };
  }, [abts, residents]);

  // ── PAF Queue ─────────────────────────────────────────────────────────────
  const pafQueue = useMemo(() => buildPafQueue(abts, residentNames), [abts, residentNames]);

  // ── Save Intervention ─────────────────────────────────────────────────────
  const handleSaveIntervention = async (
    abtId: string,
    intervention: Omit<AbtIntervention, 'date'>
  ) => {
    await updateDB((draft) => {
      const abt = draft.data.facilityData[activeFacilityId]?.abts?.[abtId];
      if (!abt) return;
      const newIntervention: AbtIntervention = {
        ...intervention,
        date: new Date().toISOString(),
      };
      abt.interventions = [...(abt.interventions || []), newIntervention];
      if (intervention.type === 'Timeout Review') {
        abt.timeoutReviewDate = new Date().toISOString().split('T')[0];
      }
      abt.updatedAt = new Date().toISOString();
    }, { action: 'update', entityType: 'ABTCourse', entityId: abtId });
    setFeedbackTarget(null);
  };

  const urgencyStyle = {
    high: 'border-red-300 bg-red-50',
    medium: 'border-amber-300 bg-amber-50',
    low: 'border-neutral-200 bg-white',
  };
  const urgencyBadge = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-amber-100 text-amber-800',
    low: 'bg-neutral-100 text-neutral-600',
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-600" />
          ASP Metrics Dashboard
        </h2>
        <p className="text-sm text-neutral-500 mt-1">
          CMS/NHSN-aligned antibiotic stewardship program metrics. Tracks Days of Therapy (DOT),
          Length of Therapy (LOT), culture-guided therapy rates, and prospective audit & feedback (PAF) opportunities.
        </p>
      </div>

      {/* Key Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-50 rounded-lg"><Pill className="w-5 h-5 text-emerald-600" /></div>
            <p className="text-sm font-medium text-neutral-600">Active ABT Courses</p>
          </div>
          <p className="text-3xl font-bold text-neutral-900">{metrics.activeAbts}</p>
          <p className="text-xs text-neutral-500 mt-1">{metrics.totalAbts} total on record</p>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 rounded-lg"><Activity className="w-5 h-5 text-blue-600" /></div>
            <p className="text-sm font-medium text-neutral-600">DOT / 1,000 Res-Days</p>
          </div>
          <p className="text-3xl font-bold text-neutral-900">{metrics.dotPer1000}</p>
          <p className="text-xs text-neutral-500 mt-1">Days of Therapy (NHSN measure)</p>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-50 rounded-lg"><Clock className="w-5 h-5 text-amber-600" /></div>
            <p className="text-sm font-medium text-neutral-600">72h Timeout Rate</p>
          </div>
          <p className={`text-3xl font-bold ${metrics.timeoutCompliance >= 80 ? 'text-emerald-700' : 'text-amber-700'}`}>
            {metrics.timeoutCompliance}%
          </p>
          <p className="text-xs text-neutral-500 mt-1">Courses with documented review</p>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-50 rounded-lg"><FlaskConical className="w-5 h-5 text-purple-600" /></div>
            <p className="text-sm font-medium text-neutral-600">Culture-Guided Therapy</p>
          </div>
          <p className={`text-3xl font-bold ${metrics.cultureRate >= 50 ? 'text-emerald-700' : 'text-orange-700'}`}>
            {metrics.cultureRate}%
          </p>
          <p className="text-xs text-neutral-500 mt-1">Courses with culture collected</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* DOT Trend */}
        <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-500" />
                Days of Therapy — Monthly Trend
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">Total patient-days of antibiotic exposure per month</p>
            </div>
            <ExportPdfButton
              className="text-xs"
              filename="dot-trend"
              buildSpec={() => ({
                title: 'DOT Monthly Trend',
                orientation: 'landscape' as const,
                template: 'LANDSCAPE_TEMPLATE_V1' as const,
                subtitleLines: [`DOT/1,000 Res-Days: ${metrics.dotPer1000}`],
                sections: [{
                  type: 'table' as const,
                  columns: ['Month', 'Days of Therapy'],
                  rows: metrics.dotTrend.map((d) => [d.month, d.dot]),
                }],
              })}
            />
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.dotTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Line type="monotone" dataKey="dot" name="Days of Therapy" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4, strokeWidth: 0, fill: '#3b82f6' }} activeDot={{ r: 6, strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* LOT by Syndrome */}
        <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
                <Pill className="w-4 h-4 text-emerald-500" />
                Avg. Length of Therapy by Syndrome
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Average course duration for completed/discontinued courses
              </p>
            </div>
          </div>
          {metrics.lotChart.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-neutral-400 text-sm">
              No completed courses with syndrome data yet.
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.lotChart} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} label={{ value: 'Avg Days', position: 'insideBottom', offset: -2, fontSize: 10 }} />
                  <YAxis type="category" dataKey="syndrome" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#374151' }} width={90} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number, _: string, entry: any) => [`${value} days (n=${entry.payload.n})`, 'Avg LOT']}
                  />
                  <Bar dataKey="avgDays" name="Avg Days" fill="#10b981" radius={[0, 4, 4, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Broad Spectrum Banner */}
      {metrics.broadPct > 50 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-xl p-4 text-sm text-amber-900">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">High Broad-Spectrum Usage Alert</p>
            <p className="text-xs mt-0.5">
              {metrics.broadPct}% of active antibiotic courses are broad-spectrum agents.
              CMS F-Tag 881 and CDC stewardship guidelines emphasize targeted therapy.
              Review the PAF queue below for de-escalation opportunities.
            </p>
          </div>
        </div>
      )}

      {/* PAF Queue */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Prospective Audit & Feedback (PAF) Queue
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              Auto-detected stewardship opportunities on active antibiotic courses.
            </p>
          </div>
          {pafQueue.length > 0 && (
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              pafQueue.some((f) => f.urgency === 'high') ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
            }`}>
              {pafQueue.length} flag{pafQueue.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {pafQueue.length === 0 ? (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="font-semibold">No Active PAF Flags</p>
              <p className="text-xs mt-0.5">All active antibiotic courses meet current stewardship criteria.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {pafQueue.map((flag) => {
              const isExpanded = expandedPaf === flag.abt.id;
              const interventions = flag.abt.interventions || [];
              return (
                <div
                  key={flag.abt.id}
                  className={`rounded-xl border overflow-hidden transition-all ${urgencyStyle[flag.urgency]}`}
                >
                  {/* Collapsed Header */}
                  <button
                    type="button"
                    onClick={() => setExpandedPaf(isExpanded ? null : flag.abt.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/5 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-neutral-900">{flag.residentName}</span>
                        <span className="text-sm text-neutral-600">— {flag.abt.medication}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${urgencyBadge[flag.urgency]}`}>
                          {flag.urgency} priority
                        </span>
                        <span className="text-xs text-neutral-500">
                          {flag.abt.startDate ? `Started ${flag.abt.startDate}` : 'No start date'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {flag.reasons.map((r, i) => (
                          <span key={i} className="text-xs text-neutral-700 bg-white/70 border border-neutral-200 px-2 py-0.5 rounded-full">
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {interventions.length > 0 && (
                        <span className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                          {interventions.length} logged
                        </span>
                      )}
                      {isExpanded
                        ? <ChevronDown className="w-4 h-4 text-neutral-500" />
                        : <ChevronRight className="w-4 h-4 text-neutral-500" />
                      }
                    </div>
                  </button>

                  {/* Expanded Body */}
                  {isExpanded && (
                    <div className="border-t border-neutral-200 bg-white px-4 py-4 space-y-4">
                      {/* ABT Details */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-neutral-700">
                        {flag.abt.indication && (
                          <div><span className="text-neutral-500">Indication:</span> <span className="font-medium">{flag.abt.indication}</span></div>
                        )}
                        {flag.abt.syndromeCategory && (
                          <div><span className="text-neutral-500">Syndrome:</span> <span className="font-medium">{flag.abt.syndromeCategory}</span></div>
                        )}
                        {flag.abt.prescriber && (
                          <div><span className="text-neutral-500">Prescriber:</span> <span className="font-medium">{flag.abt.prescriber}</span></div>
                        )}
                        {flag.abt.medicationClass && (
                          <div><span className="text-neutral-500">Class:</span> <span className="font-medium">{flag.abt.medicationClass}</span></div>
                        )}
                      </div>

                      {/* Prior Interventions */}
                      {interventions.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-neutral-700 mb-2">Prior Interventions</p>
                          <div className="space-y-1.5">
                            {interventions.map((iv, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
                                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-semibold text-indigo-800">{iv.type}</span>
                                  <span className="text-neutral-500 ml-1">· {iv.loggedBy} · {new Date(iv.date).toLocaleDateString()}</span>
                                  <p className="text-neutral-700 mt-0.5">{iv.note}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action Button */}
                      <button
                        type="button"
                        onClick={() => setFeedbackTarget(flag)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Log Stewardship Intervention
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Prescriber Feedback Modal */}
      {feedbackTarget && (
        <PrescriberFeedbackModal
          abt={feedbackTarget.abt}
          residentName={feedbackTarget.residentName}
          onSave={(intervention) => handleSaveIntervention(feedbackTarget.abt.id, intervention)}
          onClose={() => setFeedbackTarget(null)}
        />
      )}
    </div>
  );
};

export default AbtMetrics;
