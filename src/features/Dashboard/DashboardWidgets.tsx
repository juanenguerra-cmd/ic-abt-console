
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, AlertCircle, FileText, Inbox, Building2, ClipboardCheck, Bell, Activity, ChevronRight, SlidersHorizontal, TrendingUp, Shield, X, ArrowUpRight, Database, Syringe, AlertTriangle } from 'lucide-react';
import { FloorMap, RoomStatus } from '../Heatmap/FloorMap';
import { Resident, FloorLayout, ABTCourse, IPEvent } from '../../domain/models';
import { SymptomIndicator } from '../../utils/symptomIndicators';
import { DetectionRules } from '../../services/detectionRules';

// --- Props Interfaces ---

export interface WidgetProps {
  navigate: ReturnType<typeof useNavigate>;
  store: any;
  activeFacilityId: string;
  facility: any;
  // Add other shared data as needed
  [key: string]: any;
}

// --- Season Banner Widget ---

export const SeasonBannerWidget: React.FC<WidgetProps> = ({ navigate, isFluSeason, fluCoverage, covidCoverage, fluVaxMrns, covidVaxMrns, totalActiveResidents, fluSeasonStart, fluSeasonEnd }) => {
  if (!isFluSeason || (fluCoverage === null && covidCoverage === null)) return null;

  return (
    <div className={`rounded-lg border px-4 py-3 flex flex-wrap items-center gap-4 text-sm ${(fluCoverage !== null && fluCoverage < 80) ? 'bg-amber-50 border-amber-300' : 'bg-emerald-50 border-emerald-300'}`}>
      <span className="font-semibold text-neutral-800">🍂 Flu Season Active ({fluSeasonStart.getFullYear()}–{fluSeasonEnd.getFullYear()})</span>
      {fluCoverage !== null && (
        <span className={`font-medium ${fluCoverage >= 80 ? 'text-emerald-700' : 'text-amber-700'}`}>
          Flu Vaccine: {fluCoverage}% ({fluVaxMrns.size}/{totalActiveResidents} residents)
        </span>
      )}
      {covidCoverage !== null && (
        <span className={`font-medium ${covidCoverage >= 80 ? 'text-emerald-700' : 'text-amber-700'}`}>
          COVID-19: {covidCoverage}% ({covidVaxMrns.size}/{totalActiveResidents} residents)
        </span>
      )}
      <button onClick={() => navigate('/resident-board', { state: { vaxFilter: true } })} className="ml-auto text-xs underline text-neutral-600 hover:text-neutral-900">View Vaccination Board →</button>
    </div>
  );
};

// --- Facility Overview Widget ---

export const FacilityOverviewWidget: React.FC<WidgetProps> = ({ navigate, residentCount, capacityRate, activePrecautionsCount, outbreakCount, residentsNeedingScreeningCount, abtCount, setShowCensusModal, setShowPrecautionsModal, setShowOutbreakModal, setShowAbtModal }) => {
  return (
    <div>
      <h2 className="text-lg font-bold text-neutral-900 mb-4">Facility Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div onClick={() => setShowCensusModal(true)} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-500 group-hover:text-indigo-600 transition-colors">Census</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold text-neutral-900">{residentCount}</p>
                {capacityRate && (
                  <span className="text-xs font-medium text-neutral-500">
                    ({capacityRate}% capacity)
                  </span>
                )}
              </div>
            </div>
            <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>
        <div onClick={() => setShowPrecautionsModal(true)} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-500 group-hover:text-indigo-600 transition-colors">Active Precautions</p>
              <p className="text-2xl font-bold text-neutral-900">{activePrecautionsCount}</p>
            </div>
            <div className="p-2 bg-red-50 rounded-lg group-hover:bg-red-100 transition-colors">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
          </div>
        </div>
        <div onClick={() => setShowOutbreakModal(true)} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-500 group-hover:text-indigo-600 transition-colors">Active Outbreaks</p>
              <p className="text-2xl font-bold text-neutral-900">{outbreakCount}</p>
              <p className="text-xs text-neutral-400 mt-0.5">Click to drill down</p>
            </div>
            <div className="p-2 bg-orange-50 rounded-lg group-hover:bg-orange-100 transition-colors">
              <AlertCircle className="w-5 h-5 text-orange-600" />
            </div>
          </div>
        </div>
        <div onClick={() => navigate('/notifications', { state: { category: 'ADMISSION_SCREENING' } })} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-500 group-hover:text-indigo-600 transition-colors">Admission Screening</p>
              <p className="text-2xl font-bold text-neutral-900">{residentsNeedingScreeningCount}</p>
              <p className="text-xs text-neutral-400 mt-0.5">Needs screening</p>
            </div>
            <div className="p-2 bg-emerald-50 rounded-lg group-hover:bg-emerald-100 transition-colors">
              <FileText className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
        </div>
        <div onClick={() => setShowAbtModal(true)} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-500 group-hover:text-indigo-600 transition-colors">Active ABTs</p>
              <p className="text-2xl font-bold text-neutral-900">{abtCount}</p>
              <p className="text-xs text-neutral-400 mt-0.5">Click to drill down</p>
            </div>
            <div className="p-2 bg-amber-50 rounded-lg group-hover:bg-amber-100 transition-colors">
              <Inbox className="w-5 h-5 text-amber-600" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Compliance Widget ---

export const ComplianceWidget: React.FC<WidgetProps> = ({ navigate, auditsLast30, openCorrectiveActions, nonCompliantItems }) => {
  return (
    <div>
      <h2 className="text-lg font-bold text-neutral-900 mb-4">Compliance & Audits</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div onClick={() => navigate('/audit-center')} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-500 group-hover:text-indigo-600 transition-colors">Audits (Last 30d)</p>
              <p className="text-2xl font-bold text-neutral-900">{auditsLast30}</p>
            </div>
            <div className="p-2 bg-indigo-50 rounded-lg group-hover:bg-indigo-100 transition-colors">
              <ClipboardCheck className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
        </div>
        <div onClick={() => navigate('/audit-center')} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-500 group-hover:text-indigo-600 transition-colors">Open Corrective Actions</p>
              <p className="text-2xl font-bold text-neutral-900">{openCorrectiveActions}</p>
            </div>
            <div className="p-2 bg-yellow-50 rounded-lg group-hover:bg-yellow-100 transition-colors">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
            </div>
          </div>
        </div>
        <div onClick={() => navigate('/audit-center')} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-500 group-hover:text-indigo-600 transition-colors">Non-Compliant Items</p>
              <p className="text-2xl font-bold text-neutral-900">{nonCompliantItems}</p>
            </div>
            <div className="p-2 bg-red-50 rounded-lg group-hover:bg-red-100 transition-colors">
              <ClipboardCheck className="w-5 h-5 text-red-600" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Stewardship Widget ---

export const StewardshipWidget: React.FC<WidgetProps> = ({ navigate, totalDotDays, dotPer1000, residentVaxCoverage, residentVaxGiven, residentVaxTotal, vaxLabel, staffVaxCoverage, staffVaxGiven, staffVaxTotal }) => {
  return (
    <div>
      <h2 className="text-lg font-bold text-neutral-900 mb-4">Stewardship & Coverage</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div onClick={() => navigate('/resident-board', { state: { abtActive: true } })} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-500 group-hover:text-indigo-600 transition-colors">Days of Therapy (DOT)</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold text-neutral-900">{totalDotDays}</p>
                <span className="text-xs text-neutral-500">days total</span>
              </div>
              {dotPer1000 !== null && (
                <p className="text-xs text-neutral-500 mt-0.5">{dotPer1000} DOT / 1,000 resident-days</p>
              )}
            </div>
            <div className="p-2 bg-emerald-50 rounded-lg group-hover:bg-emerald-100 transition-colors">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
        </div>
        <div onClick={() => navigate('/resident-board', { state: { vaxFilter: true } })} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all group">
          <div className="flex items-center justify-between">
            <div className="flex-1 mr-4">
              <p className="text-sm font-medium text-neutral-500 group-hover:text-indigo-600 transition-colors">{vaxLabel}</p>
              {residentVaxCoverage !== null ? (
                <>
                  <p className="text-2xl font-bold text-neutral-900">{residentVaxCoverage}%</p>
                  <div className="mt-1 h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${residentVaxCoverage >= 80 ? 'bg-emerald-500' : residentVaxCoverage >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${residentVaxCoverage}%` }} />
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5">{residentVaxGiven} of {residentVaxTotal} vaccinated</p>
                </>
              ) : (
                <p className="text-sm text-neutral-400 mt-1">No data</p>
              )}
            </div>
            <div className="p-2 bg-blue-50 rounded-lg shrink-0 group-hover:bg-blue-100 transition-colors">
              <Shield className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>
        <div onClick={() => navigate('/staff')} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all group">
          <div className="flex items-center justify-between">
            <div className="flex-1 mr-4">
              <p className="text-sm font-medium text-neutral-500 group-hover:text-indigo-600 transition-colors">Staff Vax Coverage</p>
              {staffVaxCoverage !== null ? (
                <>
                  <p className="text-2xl font-bold text-neutral-900">{staffVaxCoverage}%</p>
                  <div className="mt-1 h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${staffVaxCoverage >= 80 ? 'bg-emerald-500' : staffVaxCoverage >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${staffVaxCoverage}%` }} />
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5">{staffVaxGiven} of {staffVaxTotal} doses given</p>
                </>
              ) : (
                <p className="text-sm text-neutral-400 mt-1">No data</p>
              )}
            </div>
            <div className="p-2 bg-indigo-50 rounded-lg shrink-0 group-hover:bg-indigo-100 transition-colors">
              <Shield className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Work Queue Widget ---

export const WorkQueueWidget: React.FC<WidgetProps> = ({ navigate, newNotificationsCount, activePrecautionsCount, outbreakCount, abtNeedsReviewCount }) => {
  return (
    <div>
      <h2 className="text-lg font-bold text-neutral-900 mb-4">Today's IC Work Queue</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => navigate('/notifications')}
          className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm border border-neutral-200 hover:shadow-md hover:border-indigo-200 transition-all text-left group"
        >
          <div className="p-2 bg-red-50 rounded-lg shrink-0 group-hover:bg-red-100 transition-colors">
            <Bell className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xl font-bold text-neutral-900">{newNotificationsCount}</p>
            <p className="text-xs font-medium text-neutral-600 group-hover:text-indigo-600 transition-colors">New alerts / positives</p>
            <p className="text-xs text-neutral-400">Open Notifications →</p>
          </div>
          <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-indigo-400 shrink-0 transition-colors" />
        </button>

        <button
          onClick={() => navigate('/resident-board', { state: { onPrecautions: true } })}
          className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm border border-neutral-200 hover:shadow-md hover:border-amber-200 transition-all text-left group"
        >
          <div className="p-2 bg-amber-50 rounded-lg shrink-0 group-hover:bg-amber-100 transition-colors">
            <AlertCircle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xl font-bold text-neutral-900">{activePrecautionsCount}</p>
            <p className="text-xs font-medium text-neutral-600 group-hover:text-amber-600 transition-colors">Active precautions</p>
            <p className="text-xs text-neutral-400">Open Resident Board →</p>
          </div>
          <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-amber-400 shrink-0 transition-colors" />
        </button>

        <button
          onClick={() => navigate('/outbreaks')}
          className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm border border-neutral-200 hover:shadow-md hover:border-orange-200 transition-all text-left group"
        >
          <div className="p-2 bg-orange-50 rounded-lg shrink-0 group-hover:bg-orange-100 transition-colors">
            <AlertCircle className="w-5 h-5 text-orange-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xl font-bold text-neutral-900">{outbreakCount}</p>
            <p className="text-xs font-medium text-neutral-600 group-hover:text-orange-600 transition-colors">Outbreak tasks due</p>
            <p className="text-xs text-neutral-400">Open Outbreak Manager →</p>
          </div>
          <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-orange-400 shrink-0 transition-colors" />
        </button>

        <button
          onClick={() => navigate('/resident-board', { state: { abtActive: true } })}
          className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm border border-neutral-200 hover:shadow-md hover:border-emerald-200 transition-all text-left group"
        >
          <div className="p-2 bg-emerald-50 rounded-lg shrink-0 group-hover:bg-emerald-100 transition-colors">
            <Activity className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xl font-bold text-neutral-900">{abtNeedsReviewCount}</p>
            <p className="text-xs font-medium text-neutral-600 group-hover:text-emerald-600 transition-colors">ABT reviews due</p>
            <p className="text-xs text-neutral-400">Open Resident Board →</p>
          </div>
          <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-emerald-400 shrink-0 transition-colors" />
        </button>
      </div>
    </div>
  );
};

// --- Command Center Widget ---

export const CommandCenterWidget: React.FC<WidgetProps> = ({ 
  navigate, 
  store, 
  vaxDueList, 
  stewardshipEscalations, 
  isolationReviews, 
  openCorrectiveActions,
  backupStatus 
}) => {
  const alerts = [
    {
      id: 'isolation',
      title: 'Missing Isolation',
      count: isolationReviews.length,
      description: 'Active infections without isolation assigned > 4h',
      icon: Shield,
      color: 'red',
      link: '/resident-board',
      state: { onPrecautions: true }
    },
    {
      id: 'abt',
      title: 'Prolonged ABT',
      count: stewardshipEscalations.length,
      description: 'Antibiotic courses exceeding 14 days',
      icon: Activity,
      color: 'orange',
      link: '/resident-board',
      state: { abtActive: true }
    },
    {
      id: 'corrective',
      title: 'Overdue Actions',
      count: openCorrectiveActions,
      description: 'Audit non-compliance items pending correction',
      icon: ClipboardCheck,
      color: 'amber',
      link: '/audit-center',
      state: {}
    },
    {
      id: 'backup',
      title: 'Stale Backup',
      count: backupStatus.isStale ? 1 : 0,
      description: backupStatus.label || 'No backup found in last 24h',
      icon: Database,
      color: 'rose',
      link: '/settings',
      state: {},
      hidden: !backupStatus.isStale
    },
    {
      id: 'vax',
      title: 'Vax Review',
      count: vaxDueList.length,
      description: 'Residents with due or overdue vaccinations',
      icon: Syringe,
      color: 'purple',
      link: '/resident-board',
      state: { vaxDue: true }
    }
  ].filter(a => !a.hidden && a.count > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
          <Bell className="w-5 h-5 text-indigo-600" />
          Clinical Command Center
        </h2>
        <span className="text-xs text-neutral-500 font-medium bg-neutral-100 px-2 py-1 rounded-full">
          {alerts.length} Active Alerts
        </span>
      </div>

      {alerts.length === 0 ? (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-8 text-center">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Shield className="w-6 h-6 text-emerald-600" />
          </div>
          <h3 className="text-emerald-900 font-bold">All Systems Clear</h3>
          <p className="text-emerald-700 text-sm mt-1">No high-priority clinical alerts at this time.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {alerts.map((alert) => (
            <button
              key={alert.id}
              onClick={() => navigate(alert.link, { state: alert.state })}
              className={`group relative bg-white border rounded-xl p-4 text-left transition-all hover:shadow-md hover:ring-2 ring-offset-2 ring-transparent ${
                alert.color === 'red' ? 'border-red-200 hover:ring-red-500' :
                alert.color === 'orange' ? 'border-orange-200 hover:ring-orange-500' :
                alert.color === 'amber' ? 'border-amber-200 hover:ring-amber-500' :
                alert.color === 'rose' ? 'border-rose-200 hover:ring-rose-500' :
                'border-purple-200 hover:ring-purple-500'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2 rounded-lg ${
                  alert.color === 'red' ? 'bg-red-50 text-red-600' :
                  alert.color === 'orange' ? 'bg-orange-50 text-orange-600' :
                  alert.color === 'amber' ? 'bg-amber-50 text-amber-600' :
                  alert.color === 'rose' ? 'bg-rose-50 text-rose-600' :
                  'bg-purple-50 text-purple-600'
                }`}>
                  <alert.icon className="w-5 h-5" />
                </div>
                <span className={`text-2xl font-black ${
                  alert.color === 'red' ? 'text-red-700' :
                  alert.color === 'orange' ? 'text-orange-700' :
                  alert.color === 'amber' ? 'text-amber-700' :
                  alert.color === 'rose' ? 'text-rose-700' :
                  'text-purple-700'
                }`}>
                  {alert.count}
                </span>
              </div>
              <h3 className="font-bold text-neutral-900 group-hover:text-indigo-600 transition-colors">{alert.title}</h3>
              <p className="text-xs text-neutral-500 mt-1 leading-relaxed">{alert.description}</p>
              <div className="mt-3 flex items-center text-[10px] font-bold uppercase tracking-wider text-neutral-400 group-hover:text-indigo-500 transition-colors">
                Take Action <ChevronRight className="w-3 h-3 ml-1" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// --- Needs Review Widget ---

export const NeedsReviewWidget: React.FC<WidgetProps> = ({ navigate, store, vaxDueList, stewardshipEscalations, isolationReviews, setShowAbtModal }) => {
  return (
    <div>
      <h2 className="text-lg font-bold text-neutral-900 mb-4">Clinical Needs Review</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Stewardship Escalations */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden flex flex-col">
          <div className="bg-orange-50 border-b border-orange-100 p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-orange-600" />
              <h3 className="font-semibold text-orange-900 text-sm">ABT Stewardship Escalations</h3>
            </div>
            <span className="bg-orange-200 text-orange-800 text-xs font-bold px-2 py-0.5 rounded-full">{stewardshipEscalations.length}</span>
          </div>
          <div className="p-0 flex-1 overflow-y-auto max-h-60">
            {stewardshipEscalations.length > 0 ? (
              <ul className="divide-y divide-neutral-100">
                {stewardshipEscalations.map(({ abt, alert }: any) => {
                  const res = store.residents?.[abt.residentRef?.id];
                  return (
                    <li key={abt.id} className="p-3 hover:bg-neutral-50 flex justify-between items-center">
                      <div className="flex-1 min-w-0 mr-2">
                        <p className="text-sm font-medium text-neutral-900 truncate">{res?.displayName || 'Unknown'}</p>
                        <p className="text-[11px] text-orange-700 leading-tight mt-0.5">{alert.message}</p>
                      </div>
                      <button onClick={() => navigate('/resident-board', { state: { focusMrn: abt.residentRef.id } })} className="text-indigo-600 hover:text-indigo-800 text-xs font-medium shrink-0">Profile</button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="p-6 text-center text-sm text-neutral-400 italic">No stewardship escalations.</div>
            )}
          </div>
        </div>

        {/* Isolation Reviews */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden flex flex-col">
          <div className="bg-red-50 border-b border-red-100 p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-red-600" />
              <h3 className="font-semibold text-red-900 text-sm">Isolation Reviews Required</h3>
            </div>
            <span className="bg-red-200 text-red-800 text-xs font-bold px-2 py-0.5 rounded-full">{isolationReviews.length}</span>
          </div>
          <div className="p-0 flex-1 overflow-y-auto max-h-60">
            {isolationReviews.length > 0 ? (
              <ul className="divide-y divide-neutral-100">
                {isolationReviews.map(({ ip, alert }: any) => {
                  const res = store.residents?.[ip.residentRef?.id];
                  return (
                    <li key={ip.id} className="p-3 hover:bg-neutral-50 flex justify-between items-center">
                      <div className="flex-1 min-w-0 mr-2">
                        <p className="text-sm font-medium text-neutral-900 truncate">{res?.displayName || 'Unknown'}</p>
                        <p className="text-[11px] text-red-700 leading-tight mt-0.5">{alert.message}</p>
                      </div>
                      <button onClick={() => navigate('/resident-board', { state: { focusMrn: ip.residentRef.id } })} className="text-indigo-600 hover:text-indigo-800 text-xs font-medium shrink-0">Profile</button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="p-6 text-center text-sm text-neutral-400 italic">All active infections have isolation assigned.</div>
            )}
          </div>
        </div>

        {/* VAX Due */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden flex flex-col">
          <div className="bg-amber-50 border-b border-amber-100 p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-600" />
              <h3 className="font-semibold text-amber-900 text-sm">Vaccinations Due</h3>
            </div>
            <span className="bg-amber-200 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full">{vaxDueList.length}</span>
          </div>
          <div className="p-0 flex-1 overflow-y-auto max-h-60">
            {vaxDueList.length > 0 ? (
              <ul className="divide-y divide-neutral-100">
                {vaxDueList.map((vax: any) => {
                  const res = store.residents?.[vax.residentRef?.id];
                  return (
                    <li key={vax.id} className="p-3 hover:bg-neutral-50 flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium text-neutral-900">{res?.displayName || 'Unknown'}</p>
                        <p className="text-xs text-neutral-500">{vax.vaccine} • Due: {vax.dueDate || 'Unknown'}</p>
                      </div>
                      <button onClick={() => navigate('/resident-board', { state: { vaxFilter: true } })} className="text-indigo-600 hover:text-indigo-800 text-xs font-medium">Review</button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="p-6 text-center text-sm text-neutral-400 italic">No vaccinations due.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


// --- Floor Map Widget ---

export const FloorMapWidget: React.FC<WidgetProps> = ({ navigate, activeFacilityId, units, selectedUnit, setSelectedUnit, tileSize, setTileSize, filteredLayout, roomStatuses, symptomIndicators, selectedRoomId, setSelectedRoomId, roomResidentsMap, perResidentIndicators }) => {
  if (!filteredLayout) {
    return <div>Display Default</div>
  }
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-neutral-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-neutral-900">Live Floor Map</h2>
          <button
            onClick={() => navigate('/floor-map')}
            className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
          >
            View Full Map <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
        <div className="flex items-center gap-4">
          {units.length > 0 && (
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-neutral-500" />
              <select
                value={selectedUnit}
                onChange={e => setSelectedUnit(e.target.value)}
                className="border border-neutral-300 rounded-md px-2 py-1 text-sm focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">All Units</option>
                {units.map((u: string) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          )}
          <div className="flex items-center gap-2" title="Tile size (1–10)">
            <SlidersHorizontal className="w-4 h-4 text-neutral-400" />
            <input
              type="range"
              min={1}
              max={10}
              value={tileSize}
              onChange={e => {
                const val = parseInt(e.target.value, 10);
                setTileSize(val);
                localStorage.setItem(`ltc_floor_tile_size_global:${activeFacilityId}`, String(val));
              }}
              className="w-24 accent-indigo-600"
              aria-label="Floor map tile size"
            />
            <span className="text-xs text-neutral-500 w-4 text-center">{tileSize}</span>
          </div>
        </div>
      </div>
      <FloorMap 
        key={tileSize}
        layout={filteredLayout} 
        facilityId={activeFacilityId}
        unitId={selectedUnit}
        roomStatuses={roomStatuses}
        symptomIndicators={symptomIndicators}
        onRoomClick={(roomId) => setSelectedRoomId(roomId)}
      />
      {selectedRoomId && (() => {
        const residents = roomResidentsMap[selectedRoomId] ?? [];
        const roomLabel = filteredLayout.rooms.find((r: any) => r.roomId === selectedRoomId)?.label ?? selectedRoomId;
        return (
          <div className="mt-3 bg-neutral-50 border border-neutral-200 rounded-lg p-4 space-y-2 relative">
            <button
              onClick={() => setSelectedRoomId(null)}
              className="absolute top-2 right-2 text-neutral-400 hover:text-neutral-700"
            >
              <X className="w-4 h-4" />
            </button>
            <p className="text-sm font-bold text-neutral-700">Room {roomLabel}</p>
            {residents.length === 0 ? (
              <p className="text-sm text-neutral-400">Unoccupied</p>
            ) : (
              residents.map((r: any) => {
                const residentIndicator = perResidentIndicators[r.mrn] ?? { respiratory: false, gi: false };
                return (
                <div key={r.mrn} className="flex items-center justify-between bg-white border border-neutral-200 rounded-md px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-neutral-800">{r.displayName}</p>
                    <p className="text-xs text-neutral-400">MRN: {r.mrn}</p>
                    <div className="flex gap-1 mt-0.5">
                      {residentIndicator.respiratory && (
                        <span className="text-[9px] font-bold bg-orange-500 text-white px-1 rounded">Resp 96h</span>
                      )}
                      {residentIndicator.gi && (
                        <span className="text-[9px] font-bold bg-purple-500 text-white px-1 rounded">GI 96h</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/resident-board', { state: { focusMrn: r.mrn } })}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    View Profile →
                  </button>
                </div>
                );
              })
            )}
          </div>
        );
      })()}
    </div>
  );
};
