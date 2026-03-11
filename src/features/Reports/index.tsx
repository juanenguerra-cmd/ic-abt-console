import React, { useState, useEffect, useMemo } from 'react';
import { useDatabase, useFacilityData } from '../../app/providers';
import { Resident, IPEvent, ABTCourse, VaxEvent, ResidentNote } from '../../domain/models';
import { IpEventModal } from '../ResidentBoard/IpEventModal';
import { AbtCourseModal } from '../ResidentBoard/AbtCourseModal';
import { VaxEventModal } from '../ResidentBoard/VaxEventModal';
import { Download, Link as LinkIcon, X, Edit, Trash2, Syringe } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { SymptomWatchReport } from './SymptomWatchReport';
import { VaxReofferList } from './VaxReofferList';
import { QuarterlyInfectionRateReport } from './QuarterlyInfectionRateReport';
import { HistoricalVaxEventModal } from '../BackOffice/HistoricalVaxEventModal';
import { exportPDF } from '../../utils/pdfExport';
import { ExportPdfButton } from '../../components/ExportPdfButton';
import { LineListExportButton } from '../../components/LineListExportButton';
import { DrilldownHeader } from '../../components/DrilldownHeader';
import { ReportViewer } from './ReportViewer';
import { getDeviceDay, normalizeClinicalDevices } from '../../utils/clinicalDevices';
import { getActiveABT, getAbtDays } from '../../utils/countCardDataHelpers';
import { todayLocalDateInputValue } from '../../lib/dateUtils';
import {
  computeVaccineCoverage,
  getActiveResidentMrns,
  getCanonicalDate,
  getFluSeasonWindow,
  isCovid19,
  isDeclinedEvent,
  isInfluenza,
  isPneumococcal,
  isQualifyingEvent,
  isRsv,
  normalizeVaxStatus,
} from '../../lib/vaccineCoverage';


const residentLabel = (res: any) => {
  if (!res?.displayName) return '—';
  return (res.backOfficeOnly || res.isHistorical || res.status === 'Discharged') ? `${res.displayName} (Historical)` : res.displayName;
};

/** Normalize vaccine status for display: "declined" (any variant) → "Refused". */
const normalizeVaxStatusDisplay = (status: string): string =>
  normalizeVaxStatus(status) === 'declined' ? 'Refused' : status;

/** Return the relevant date for a VaxEvent. Declined events are dated by their offer/declination date. */
const getVaxDate = (vax: VaxEvent): string =>
  normalizeVaxStatus(vax.status) === 'declined'
    ? (vax.offerDate ?? vax.createdAt)
    : (vax.administeredDate || vax.dateGiven || '—');

const ReportsConsole: React.FC = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(
    (location.state as any)?.activeTab || 'monthly'
  );

  useEffect(() => {
    if ((location.state as any)?.activeTab) {
      setActiveTab((location.state as any).activeTab);
      // Clear state so it doesn't persist on reload
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="border-b border-neutral-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button 
            data-testid="survey-tab-button"
            onClick={() => handleTabChange('survey')}
            className={`${activeTab === 'survey' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm active:scale-95`}>
            Survey Packets
          </button>
          <button 
            data-testid="soc-tab-button"
            onClick={() => handleTabChange('daily')}
            className={`${activeTab === 'daily' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm active:scale-95`}>
            Daily Report
          </button>
          <button 
            data-testid="weekly-tab-button"
            onClick={() => handleTabChange('weekly')}
            className={`${activeTab === 'weekly' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm active:scale-95`}>
            Weekly Report
          </button>
          <button 
            data-testid="monthly-analytics-tab-button"
            onClick={() => handleTabChange('monthly')}
            className={`${activeTab === 'monthly' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm active:scale-95`}>
            Monthly Analytics
          </button>
          <button 
            data-testid="qapi-tab-button"
            onClick={() => handleTabChange('qapi')}
            className={`${activeTab === 'qapi' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm active:scale-95`}>
            QAPI Rollup
          </button>
          <button 
            data-testid="ondemand-tab-button"
            onClick={() => handleTabChange('ondemand')}
            className={`${activeTab === 'ondemand' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm active:scale-95`}>
            On Demand
          </button>
          <button
            data-testid="symptomwatch-tab-button"
            onClick={() => handleTabChange('symptomwatch')}
            className={`${activeTab === 'symptomwatch' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm active:scale-95`}>
            Symptom Watch
          </button>
          <button
            data-testid="clinical-tab-button"
            onClick={() => handleTabChange('clinical')}
            className={`${activeTab === 'clinical' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm active:scale-95`}>
            Clinical Reports
          </button>
          <button
            data-testid="vax-coverage-tab-button"
            onClick={() => handleTabChange('vaxcoverage')}
            className={`${activeTab === 'vaxcoverage' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm active:scale-95`}>
            Vaccine Coverage
          </button>
          <button
            data-testid="vax-reoffer-tab-button"
            onClick={() => handleTabChange('vaxreoffer')}
            className={`${activeTab === 'vaxreoffer' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm active:scale-95 inline-flex items-center gap-2`}>
            <Syringe className="h-4 w-4" />
            Vax Re-offer
          </button>
          <button
            data-testid="quarterly-infection-tab-button"
            onClick={() => handleTabChange('quarterly')}
            className={`${activeTab === 'quarterly' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm active:scale-95`}>
            Quarterly Infection Rate
          </button>
        </nav>
      </div>

      <div className="mt-8">
        {activeTab === 'survey' && <SurveyPacketsReport />}
        {activeTab === 'daily' && <DailyReport />}
        {activeTab === 'weekly' && <WeeklyReport />}
        {activeTab === 'monthly' && <MonthlyAnalytics />}
        {activeTab === 'qapi' && <QapiRollup />}
        {activeTab === 'ondemand' && <OnDemandReport />}
        {activeTab === 'symptomwatch' && <SymptomWatchReport />}
        {activeTab === 'clinical' && <ClinicalReports />}
        {activeTab === 'vaxcoverage' && <VaccineCoverageReport />}
        {activeTab === 'vaxreoffer' && <VaxReofferList />}
        {activeTab === 'quarterly' && <QuarterlyInfectionRateReport />}
      </div>
    </div>
  );
};

const ClinicalReports: React.FC = () => {
  return (
    <div className="space-y-6">
      <ReportViewer 
        reportId="mdro-tracking" 
        headerColorClass="bg-purple-50" 
        textColorClass="text-purple-900" 
      />
      <ReportViewer 
        reportId="device-associated" 
        headerColorClass="bg-blue-50" 
        textColorClass="text-blue-900" 
      />
      <ReportViewer 
        reportId="infection-types" 
        headerColorClass="bg-emerald-50" 
        textColorClass="text-emerald-900" 
      />
      <ReportViewer 
        reportId="top-antibiotics" 
        headerColorClass="bg-amber-50" 
        textColorClass="text-amber-900" 
      />
    </div>
  );
};

const CombinedLineList: React.FC = () => {
  return (
    <ReportViewer 
      reportId="combined-line-list" 
      headerColorClass="bg-indigo-50" 
      textColorClass="text-indigo-900" 
    />
  );
};

const SurveyPacketsReport: React.FC = () => {
  const { store } = useFacilityData();

  const activePrecautionsCount = useMemo(() =>
    (Object.values(store.infections) as IPEvent[]).filter(ip => ip.status === 'active' && ip.isolationType).length,
    [store.infections]
  );

  const activeAbtsCount = useMemo(() =>
    getActiveABT(Object.values(store.abts) as ABTCourse[]).length,
    [store.abts]
  );

  return (
    <div className="space-y-6">
      {/* E6: Line List Export */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3">
        <DrilldownHeader
          title="Line Listing"
          subtitle="Survey-ready active precautions and ABT courses"
          right={
            <div className="flex items-center gap-3">
              <LineListExportButton />
              <ExportPdfButton
                label="Export PDF"
                filename="line-listing"
                buildSpec={() => ({
                  title: 'Line Listing',
                  orientation: 'landscape',
                  template: 'LANDSCAPE_TEMPLATE_V1',
                  subtitleLines: [
                    `Precautions: ${activePrecautionsCount}`,
                    `Active ABT: ${activeAbtsCount}`,
                  ],
                  sections: [
                    {
                      type: 'table',
                      columns: ['Type', 'Resident', 'MRN', 'Unit', 'Room', 'Syndrome/Category', 'Isolation Type', 'Organism', 'Onset/Start Date', 'Status', 'Notes'],
                      rows: [
                        ...(Object.values(store.infections) as IPEvent[]).filter(ip => ip.status === 'active' && ip.isolationType).map(ip => {
                          const res = ip.residentRef.kind === 'mrn' ? store.residents[ip.residentRef.id] : store.quarantine[ip.residentRef.id];
                          return [
                            'IP Event',
                            residentLabel(res),
                            (res as any)?.mrn || '',
                            ip.locationSnapshot?.unit || (res as any)?.currentUnit || '',
                            ip.locationSnapshot?.room || (res as any)?.currentRoom || '',
                            ip.infectionCategory || '',
                            ip.isolationType || '',
                            ip.organism || '',
                            ip.onsetDate || ip.createdAt?.split('T')[0] || '',
                            ip.status,
                            ip.notes || '',
                          ];
                        }),
                        ...getActiveABT(Object.values(store.abts) as ABTCourse[]).map(abt => {
                          const res = abt.residentRef.kind === 'mrn' ? store.residents[abt.residentRef.id] : store.quarantine[abt.residentRef.id];
                          return [
                            'ABT Course',
                            residentLabel(res),
                            (res as any)?.mrn || '',
                            abt.locationSnapshot?.unit || (res as any)?.currentUnit || '',
                            abt.locationSnapshot?.room || (res as any)?.currentRoom || '',
                            abt.syndromeCategory || abt.indication || '',
                            '',
                            abt.organismIdentified || '',
                            abt.startDate || '',
                            abt.status,
                            abt.notes || '',
                          ];
                        }),
                      ],
                    },
                  ],
                })}
              />
            </div>
          }
        />
      </div>

      <CombinedLineList />

      <div className="space-y-6">
        <ReportViewer 
          reportId="active-precautions" 
          headerColorClass="bg-red-50" 
          textColorClass="text-red-900" 
        />
        <ReportViewer 
          reportId="active-abts" 
          headerColorClass="bg-amber-50" 
          textColorClass="text-amber-900" 
        />
      </div>
    </div>
  );
};

const DailyReport: React.FC = () => {
  const { store } = useFacilityData();
  const [reportDate, setReportDate] = useState(todayLocalDateInputValue());
  const reportDateObj = useMemo(() => new Date(reportDate + 'T00:00:00'), [reportDate]);
  const threeDaysBeforeReport = useMemo(() => { const d = new Date(reportDateObj); d.setDate(d.getDate() - 3); return d; }, [reportDateObj]);

  const activePrecautionsCount = useMemo(() =>
    (Object.values(store.infections) as IPEvent[]).filter(ip => ip.status === 'active' && ip.isolationType && new Date(ip.createdAt) <= reportDateObj).length,
    [store.infections, reportDateObj]
  );

  const activeAbtsCount = useMemo(() =>
    getActiveABT(Object.values(store.abts) as ABTCourse[])
      .filter(a => (!a.startDate || new Date(a.startDate) <= reportDateObj)).length,
    [store.abts, reportDateObj]
  );

  const recentAdmissionsCount = useMemo(() =>
    (Object.values(store.residents) as Resident[])
      .filter(r => !r.isHistorical && !r.backOfficeOnly)
      .filter((r: Resident) => r.admissionDate && new Date(r.admissionDate) > threeDaysBeforeReport && new Date(r.admissionDate) <= reportDateObj).length,
    [store.residents, threeDaysBeforeReport, reportDateObj]
  );

  return (
    <div className="space-y-6">
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 space-y-3">
        <DrilldownHeader
          title="Daily Report"
          subtitle="Standard of care daily infection-control snapshot"
          right={
            <ExportPdfButton
              filename="daily-report"
              buildSpec={() => ({
                title: `Daily Report - ${reportDate}`,
                orientation: 'landscape',
                template: 'LANDSCAPE_TEMPLATE_V1',
                subtitleLines: [
                  `Date: ${reportDate}`,
                  `Precautions: ${activePrecautionsCount}`,
                  `Active ABT: ${activeAbtsCount}`,
                  `Recent Admissions: ${recentAdmissionsCount}`,
                ],
                sections: [
                  { 
                    type: 'table', 
                    title: 'Active Precautions', 
                    columns: ['Resident', 'MRN', 'Unit', 'Room', 'Category', 'Isolation', 'Organism'], 
                    rows: (Object.values(store.infections) as IPEvent[])
                      .filter(ip => ip.status === 'active' && ip.isolationType && new Date(ip.createdAt) <= reportDateObj)
                      .map(ip => {
                        const res = ip.residentRef.kind === 'mrn' ? store.residents[ip.residentRef.id] : store.quarantine[ip.residentRef.id];
                        return [residentLabel(res), (res as any)?.mrn || '-', ip.locationSnapshot?.unit || (res as any)?.currentUnit || '-', ip.locationSnapshot?.room || (res as any)?.currentRoom || '-', ip.infectionCategory || '-', ip.isolationType || '-', ip.organism || '-'];
                      })
                  },
                  { 
                    type: 'table', 
                    title: 'Active ABT Courses', 
                    columns: ['Resident', 'MRN', 'Medication', 'Indication', 'Start Date', 'Status'], 
                    rows: getActiveABT(Object.values(store.abts) as ABTCourse[])
                      .filter(a => (!a.startDate || new Date(a.startDate) <= reportDateObj))
                      .map(abt => {
                        const res = abt.residentRef.kind === 'mrn' ? store.residents[abt.residentRef.id] : store.quarantine[abt.residentRef.id];
                        const days = getAbtDays(abt.startDate, abt.endDate);
                        const med = days ? `${abt.medication} (Day ${days.current}${days.total ? '/' + days.total : ''})` : abt.medication;
                        return [residentLabel(res), (res as any)?.mrn || '-', med || '-', abt.indication || '-', abt.startDate || '-', abt.status];
                      }) 
                  },
                  { 
                    type: 'table', 
                    title: 'Recent Admissions (Last 72h)', 
                    columns: ['Resident', 'MRN', 'Admission Date', 'Screening Note'], 
                    rows: (Object.values(store.residents) as Resident[])
                      .filter(r => !r.isHistorical && !r.backOfficeOnly)
                      .filter((r: Resident) => r.admissionDate && new Date(r.admissionDate) > threeDaysBeforeReport && new Date(r.admissionDate) <= reportDateObj)
                      .map((r: Resident) => {
                        const hasScreening = (Object.values(store.notes) as ResidentNote[]).some(n =>
                          n.residentRef.kind === 'mrn' && n.residentRef.id === r.mrn && n.title?.includes('Admission Screening')
                        );
                        return [r.displayName, r.mrn, r.admissionDate || '-', hasScreening ? 'Completed' : 'Missing'];
                      })
                  },
                ],
              })}
            />
          }
        />
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={reportDate}
            onChange={e => setReportDate(e.target.value)}
            className="border border-indigo-300 rounded-md px-2 py-1 text-sm text-indigo-800 bg-white focus:ring-indigo-500 focus:border-indigo-500"
          />
          <span className="text-indigo-700 text-sm">{new Date(reportDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      <div className="space-y-6">
        <ReportViewer 
          reportId="active-precautions" 
          initialFilters={{ reportDate }} 
          headerColorClass="bg-red-50" 
          textColorClass="text-red-900" 
        />
        <ReportViewer 
          reportId="active-abts" 
          initialFilters={{ reportDate }} 
          headerColorClass="bg-amber-50" 
          textColorClass="text-amber-900" 
        />
        <ReportViewer 
          reportId="recent-admissions" 
          initialFilters={{ reportDate }} 
          headerColorClass="bg-emerald-50" 
          textColorClass="text-emerald-900" 
        />
      </div>
    </div>
  );
};

const WeeklyReport: React.FC = () => {
  const { store } = useFacilityData();
  const defaultEnd = todayLocalDateInputValue();
  const defaultStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  })();
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

  const startObj = useMemo(() => new Date(startDate + 'T00:00:00'), [startDate]);
  const endObj = useMemo(() => new Date(endDate + 'T23:59:59'), [endDate]);

  const newInfectionsCount = useMemo(() =>
    (Object.values(store.infections) as IPEvent[])
      .filter(ip => {
        const d = new Date(ip.onsetDate || ip.createdAt);
        return d >= startObj && d <= endObj;
      }).length,
    [store.infections, startObj, endObj]
  );

  const newAbtsCount = useMemo(() =>
    (Object.values(store.abts) as ABTCourse[])
      .filter(a => {
        const d = new Date(a.startDate || a.createdAt);
        return d >= startObj && d <= endObj;
      }).length,
    [store.abts, startObj, endObj]
  );

  const vaxActivityCount = useMemo(() =>
    (Object.values(store.vaxEvents) as VaxEvent[])
      .filter(v => {
        const d = new Date(v.administeredDate || v.dateGiven || v.createdAt);
        return d >= startObj && d <= endObj;
      }).length,
    [store.vaxEvents, startObj, endObj]
  );


  return (
    <div className="space-y-6">
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 space-y-3">
        <DrilldownHeader
          title="Weekly Activity Report"
          subtitle="Summary of new clinical events and interventions"
          right={
            <ExportPdfButton
              filename="weekly-report"
              buildSpec={() => ({
                title: `Weekly Activity Report: ${startDate} to ${endDate}`,
                orientation: 'landscape',
                template: 'LANDSCAPE_TEMPLATE_V1',
                subtitleLines: [
                  `Period: ${startDate} to ${endDate}`,
                  `New Infections: ${newInfectionsCount}`,
                  `New ABT Courses: ${newAbtsCount}`,
                  `Vaccination Activity: ${vaxActivityCount}`,
                ],
                sections: [
                  { 
                    type: 'table', 
                    title: 'New Infections', 
                    columns: ['Resident', 'MRN', 'Onset/Start', 'Category', 'Isolation', 'Status'], 
                    rows: (Object.values(store.infections) as IPEvent[])
                      .filter(ip => {
                        const d = new Date(ip.onsetDate || ip.createdAt);
                        return d >= startObj && d <= endObj;
                      })
                      .map(ip => {
                        const res = ip.residentRef.kind === 'mrn' ? store.residents[ip.residentRef.id] : store.quarantine[ip.residentRef.id];
                        return [residentLabel(res), (res as any)?.mrn || '-', ip.onsetDate || ip.createdAt.split('T')[0], ip.infectionCategory || '-', ip.isolationType || '-', ip.status];
                      })
                  },
                  { 
                    type: 'table', 
                    title: 'New ABT Courses', 
                    columns: ['Resident', 'MRN', 'Medication', 'Indication', 'Start Date', 'Status'], 
                    rows: (Object.values(store.abts) as ABTCourse[])
                      .filter(a => {
                        const d = new Date(a.startDate || a.createdAt);
                        return d >= startObj && d <= endObj;
                      })
                      .map(abt => {
                        const res = abt.residentRef.kind === 'mrn' ? store.residents[abt.residentRef.id] : store.quarantine[abt.residentRef.id];
                        return [residentLabel(res), (res as any)?.mrn || '-', abt.medication, abt.indication || '-', abt.startDate || '-', abt.status];
                      })
                  },
                  { 
                    type: 'table', 
                    title: 'Vaccination Activity', 
                    columns: ['Resident', 'MRN', 'Vaccine', 'Date Given', 'Dose', 'Status'], 
                    rows: (Object.values(store.vaxEvents) as VaxEvent[])
                      .filter(v => {
                        const d = new Date(v.administeredDate || v.dateGiven || v.createdAt);
                        return d >= startObj && d <= endObj;
                      })
                      .map(v => {
                        const res = v.residentRef.kind === 'mrn' ? store.residents[v.residentRef.id] : store.quarantine[v.residentRef.id];
                        return [residentLabel(res), (res as any)?.mrn || '-', v.vaccine, v.administeredDate || v.dateGiven || '-', v.dose || '-', v.status];
                      })
                  },
                ],
              })}
            />
          }
        />
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-indigo-700 uppercase">From</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="border border-indigo-300 rounded-md px-2 py-1 text-sm text-indigo-800 bg-white focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-indigo-700 uppercase">To</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="border border-indigo-300 rounded-md px-2 py-1 text-sm text-indigo-800 bg-white focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <ReportViewer 
          reportId="new-infections" 
          initialFilters={{ startDate, endDate }} 
          headerColorClass="bg-red-50" 
          textColorClass="text-red-900" 
        />
        <ReportViewer 
          reportId="new-abts" 
          initialFilters={{ startDate, endDate }} 
          headerColorClass="bg-amber-50" 
          textColorClass="text-amber-900" 
        />
        <ReportViewer 
          reportId="vax-activity" 
          initialFilters={{ startDate, endDate }} 
          headerColorClass="bg-blue-50" 
          textColorClass="text-blue-900" 
        />
      </div>
    </div>
  );
};
const OnDemandReport: React.FC = () => {
  const { store, activeFacilityId } = useFacilityData();
  const { updateDB } = useDatabase();
  const [dataset, setDataset] = useState<'infections' | 'abts' | 'vax' | 'residents' | string>('infections');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [unitFilter, setUnitFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const TYPE_FILTER_OPTIONS: Record<string, string[]> = {
    infections: ["UTI", "Pneumonia", "Skin/Soft Tissue", "GI", "Bloodstream", "Sepsis", "MRSA", "VRE", "C. diff", "Scabies", "Lice", "Norovirus", "Influenza", "COVID-19", "RSV", "Meningitis", "Pertussis", "Tuberculosis", "Varicella (Chickenpox)", "Measles", "CAUTI", "CLABSI", "VAP", "Surgical Site Infection", "Pressure Ulcer", "Routine surveillance", "Other"],
    abts: ["Respiratory", "Urinary", "Skin/Soft Tissue", "GI", "Bloodstream", "Other"],
    vax: ["Influenza", "Pneumococcal", "Covid-19", "RSV", "Other"],
  };

  const TYPE_FILTER_LABEL: Record<string, string> = {
    infections: 'Category',
    abts: 'Syndrome',
    vax: 'Vaccine Type',
  };

  const TYPE_FILTER_ALL_LABEL: Record<string, string> = {
    infections: 'All Categories',
    abts: 'All Syndromes',
    vax: 'All Vaccine Types',
  };

  type EditModal =
    | { type: 'ip';  recordId: string; residentId: string }
    | { type: 'abt'; recordId: string; residentId: string }
    | { type: 'vax'; recordId: string; residentId: string };

  type LinkModal = {
    type: 'infections' | 'abts' | 'vax';
    recordId: string;
    residentRef: { kind: 'mrn' | 'quarantine'; id: string };
  };

  const [editModal, setEditModal] = useState<EditModal | null>(null);
  const [linkModal, setLinkModal] = useState<LinkModal | null>(null);
  const [linkQuery, setLinkQuery] = useState('');
  const [selectedLinkMrn, setSelectedLinkMrn] = useState<string | null>(null);

  const savedTemplates = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('ltc_report_templates') || '[]') as Array<{ id: string; name: string; columns: Array<{ id: string; label: string; fieldPath: string; displayHeader?: string }> }>;
    } catch { return []; }
  }, []);

  const units = useMemo(() => {
    const s = new Set<string>();
    (Object.values(store.residents) as Resident[]).filter(r => !r.isHistorical && !r.backOfficeOnly).forEach((r: Resident) => { if (r.currentUnit?.trim()) s.add(r.currentUnit.trim()); });
    return Array.from(s).sort();
  }, [store.residents]);


  /** Parallel meta array: one entry per display row with the IDs needed for edit modals. */
  type RowMeta = {
    recordId: string;
    residentId: string;
    residentRefKind: 'mrn' | 'quarantine';
  } | null;

  const { rows, rowMeta } = useMemo(() => {
    const inRange = (dateStr: string | undefined) => {
      if (!dateStr) return true;
      const d = new Date(dateStr);
      if (startDate && d < new Date(startDate)) return false;
      if (endDate && d > new Date(endDate + 'T23:59:59')) return false;
      return true;
    };

    const getRes = (ref: { kind: string; id: string }) =>
      ref.kind === 'mrn' ? store.residents[ref.id] : store.quarantine[ref.id];

    if (dataset === 'infections') {
      const filtered = (Object.values(store.infections) as IPEvent[]).filter(ip => {
        if (!inRange(ip.onsetDate || ip.createdAt)) return false;
        if (statusFilter !== 'all' && ip.status !== statusFilter) return false;
        if (typeFilter !== 'all' && ip.infectionCategory !== typeFilter) return false;
        const res = getRes(ip.residentRef);
        if (unitFilter !== 'all' && (res as any)?.currentUnit !== unitFilter) return false;
        return true;
      });
      return {
        rows: filtered.map(ip => {
          const res = getRes(ip.residentRef);
          return [
            residentLabel(res),
            (res as any)?.mrn || '—',
            (res as any)?.currentUnit || ip.locationSnapshot?.unit || '—',
            (res as any)?.currentRoom || ip.locationSnapshot?.room || '—',
            ip.infectionCategory || '—',
            ip.infectionSite || '—',
            ip.status,
            ip.isolationType || '—',
            ip.ebp ? 'Yes' : 'No',
            ip.organism || '—',
            new Date(ip.onsetDate || ip.createdAt).toLocaleDateString(),
          ];
        }),
        rowMeta: filtered.map(ip => ({ recordId: ip.id, residentId: ip.residentRef.id, residentRefKind: ip.residentRef.kind as 'mrn' | 'quarantine' }) as RowMeta),
      };
    }
    if (dataset === 'abts') {
      const filtered = (Object.values(store.abts) as ABTCourse[]).filter(a => {
        if (!inRange(a.startDate || a.createdAt)) return false;
        if (statusFilter !== 'all' && a.status !== statusFilter) return false;
        if (typeFilter !== 'all' && a.syndromeCategory !== typeFilter) return false;
        const res = getRes(a.residentRef);
        if (unitFilter !== 'all' && (res as any)?.currentUnit !== unitFilter) return false;
        return true;
      });
      return {
        rows: filtered.map(a => {
          const res = getRes(a.residentRef);
          const days = getAbtDays(a.startDate, a.endDate);
          return [
            residentLabel(res),
            (res as any)?.mrn || '—',
            (res as any)?.currentUnit || a.locationSnapshot?.unit || '—',
            (res as any)?.currentRoom || a.locationSnapshot?.room || '—',
            days ? `${a.medication} (Day ${days.current}${days.total ? '/' + days.total : ''})` : a.medication,
            a.indication || '—',
            a.syndromeCategory || '—',
            a.status,
            a.startDate || '—',
            a.endDate || '—',
            a.cultureCollected ? 'Yes' : 'No',
          ];
        }),
        rowMeta: filtered.map(a => ({ recordId: a.id, residentId: a.residentRef.id, residentRefKind: a.residentRef.kind as 'mrn' | 'quarantine' }) as RowMeta),
      };
    }
    if (dataset === 'vax') {
      const filtered = (Object.values(store.vaxEvents) as VaxEvent[]).filter(v => {
        if (!inRange(v.administeredDate || v.dateGiven || v.createdAt)) return false;
        if (statusFilter !== 'all' && v.status !== statusFilter) return false;
        if (typeFilter !== 'all' && v.vaccine !== typeFilter) return false;
        const res = getRes(v.residentRef);
        if (unitFilter !== 'all' && (res as any)?.currentUnit !== unitFilter) return false;
        return true;
      });
      return {
        rows: filtered.map(v => {
          const res = getRes(v.residentRef);
          return [
            residentLabel(res),
            (res as any)?.mrn || '—',
            (res as any)?.currentUnit || '—',
            (res as any)?.currentRoom || '—',
            v.vaccine,
            normalizeVaxStatusDisplay(v.status),
            getVaxDate(v),
            v.declineReason || '—',
            v.dueDate || '—',
          ];
        }),
        rowMeta: filtered.map(v => ({ recordId: v.id, residentId: v.residentRef.id, residentRefKind: v.residentRef.kind as 'mrn' | 'quarantine' }) as RowMeta),
      };
    }
    // residents (no quick edit)
    const filtered = (Object.values(store.residents) as Resident[]).filter(r => !r.isHistorical && !r.backOfficeOnly).filter(r => {
      if (!inRange(r.admissionDate || r.createdAt)) return false;
      if (unitFilter !== 'all' && r.currentUnit !== unitFilter) return false;
      return true;
    });
    return {
      rows: filtered.map(r => {
        const activeAbts = getActiveABT(Object.values(store.abts) as ABTCourse[], r.mrn);
        const activeAbtText = activeAbts.map(a => {
          const days = getAbtDays(a.startDate, a.endDate);
          return days ? `${a.medication} (Day ${days.current}${days.total ? '/' + days.total : ''})` : a.medication;
        }).join(', ') || '—';
        const activeIsolation = (Object.values(store.infections) as IPEvent[]).find(i => i.residentRef.kind === 'mrn' && i.residentRef.id === r.mrn && i.status === 'active' && i.isolationType);
        const devices = normalizeClinicalDevices(r);
        const foleyDay = devices.urinaryCatheter.active ? getDeviceDay(devices.urinaryCatheter.insertedDate) : null;
        const piccDay = devices.picc.active ? getDeviceDay(devices.picc.insertedDate) : null;

        return [
          r.displayName,
          activeAbtText,
          devices.oxygen.enabled ? (devices.oxygen.mode || 'Enabled') : '—',
          foleyDay ? `Day ${foleyDay}` : (devices.urinaryCatheter.active ? 'Active' : '—'),
          piccDay ? `Day ${piccDay}` : (devices.picc.active ? 'Active' : '—'),
          activeIsolation?.isolationType || '—',
          '',
        ];
      }),
      rowMeta: filtered.map(() => null as RowMeta),
    };
  }, [dataset, startDate, endDate, unitFilter, statusFilter, typeFilter, store]);

  const HEADERS: Record<string, string[]> = {
    infections: ['Resident', 'MRN', 'Unit', 'Room', 'Category', 'Site', 'Status', 'Isolation', 'EBP', 'Organism', 'Date'],
    abts: ['Resident', 'MRN', 'Unit', 'Room', 'Medication', 'Indication', 'Syndrome', 'Status', 'Start', 'End', 'Culture'],
    vax: ['Resident', 'MRN', 'Unit', 'Room', 'Vaccine', 'Status', 'Date Given', 'Decline Reason', 'Due Date'],
    residents: ['Resident', 'ABT', 'O2', 'Foley', 'PICC', 'Isolation', 'Notes'],
  };

  // For saved templates, derive headers from template columns
  const activeTemplate = dataset.startsWith('tmpl:')
    ? savedTemplates.find(t => `tmpl:${t.id}` === dataset)
    : null;

  const currentHeaders: string[] = activeTemplate
    ? activeTemplate.columns.map(c => c.displayHeader || c.label)
    : (HEADERS[dataset] || []);

  const STATUS_OPTIONS: Record<string, string[]> = {
    infections: ['active', 'resolved', 'historical'],
    abts: ['active', 'completed', 'discontinued'],
    vax: ['given', 'declined', 'contraindicated', 'documented-historical', 'due', 'overdue'],
    residents: [],
  };

  const handleExportCsv = () => {
    const csvContent = [currentHeaders, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${dataset}_report_${todayLocalDateInputValue()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    exportPDF({
      title: `On Demand Report - ${dataset === 'infections' ? 'Infections' : dataset === 'abts' ? 'Antibiotics' : dataset === 'vax' ? 'Vaccinations' : 'Residents'}`,
      orientation: 'landscape',
      columns: currentHeaders,
      rows,
      filters: {
        Dataset: dataset,
        Unit: unitFilter,
        Status: statusFilter,
        Type: typeFilter,
        StartDate: startDate || 'Not set',
        EndDate: endDate || 'Not set',
      },
    });
  };

  const residentOptions = useMemo(() => {
    return (Object.values(store.residents) as Resident[])
      .filter(r => r.displayName?.trim() && r.mrn?.trim())
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [store.residents]);

  useEffect(() => {
    if (!linkModal) {
      setLinkQuery('');
      setSelectedLinkMrn(null);
      return;
    }
    if (linkModal.residentRef.kind === 'mrn' && store.residents[linkModal.residentRef.id]) {
      setSelectedLinkMrn(linkModal.residentRef.id);
    }
  }, [linkModal, store.residents]);

  const filteredResidentOptions = residentOptions.filter(r => {
    const q = linkQuery.trim().toLowerCase();
    if (!q) return true;
    return r.displayName.toLowerCase().includes(q) || r.mrn.toLowerCase().includes(q);
  });

  const handleSaveLink = () => {
    if (!linkModal || !selectedLinkMrn) return;
    updateDB(draft => {
      const facility = draft.data.facilityData[activeFacilityId];
      const now = new Date().toISOString();
      if (linkModal.type === 'infections' && facility.infections[linkModal.recordId]) {
        facility.infections[linkModal.recordId].residentRef = { kind: 'mrn', id: selectedLinkMrn };
        facility.infections[linkModal.recordId].updatedAt = now;
      }
      if (linkModal.type === 'abts' && facility.abts[linkModal.recordId]) {
        facility.abts[linkModal.recordId].residentRef = { kind: 'mrn', id: selectedLinkMrn };
        facility.abts[linkModal.recordId].updatedAt = now;
      }
      if (linkModal.type === 'vax' && facility.vaxEvents[linkModal.recordId]) {
        facility.vaxEvents[linkModal.recordId].residentRef = { kind: 'mrn', id: selectedLinkMrn };
        facility.vaxEvents[linkModal.recordId].updatedAt = now;
      }

      if (linkModal.residentRef.kind === 'quarantine' && facility.quarantine[linkModal.residentRef.id]) {
        const hasRemainingRefs = [
          ...Object.values(facility.infections || {}),
          ...Object.values(facility.abts || {}),
          ...Object.values(facility.vaxEvents || {}),
        ].some((event: any) => event?.residentRef?.kind === 'quarantine' && event?.residentRef?.id === linkModal.residentRef.id);
        if (!hasRemainingRefs) {
          delete facility.quarantine[linkModal.residentRef.id];
        }
      }
    });
    setLinkModal(null);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow border border-neutral-200 p-6">
        <h3 className="text-base font-bold text-neutral-900 mb-4">On Demand Report Builder</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1 uppercase">Dataset</label>
            <select value={dataset} onChange={e => { setDataset(e.target.value as any); setStatusFilter('all'); setTypeFilter('all'); }} className="w-full border border-neutral-300 rounded-md px-2 py-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500">
              <option value="infections">IP (Infections)</option>
              <option value="abts">ABT (Antibiotics)</option>
              <option value="vax">VAX (Vaccinations)</option>
              <option value="residents">Residents</option>
              {savedTemplates.length > 0 && <option disabled>── Saved Templates ──</option>}
              {savedTemplates.map(t => <option key={t.id} value={`tmpl:${t.id}`}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1 uppercase">Unit</label>
            <select value={unitFilter} onChange={e => setUnitFilter(e.target.value)} className="w-full border border-neutral-300 rounded-md px-2 py-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500">
              <option value="all">All Units</option>
              {units.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1 uppercase">Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full border border-neutral-300 rounded-md px-2 py-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500">
              <option value="all">All Statuses</option>
              {(STATUS_OPTIONS[dataset] || []).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="block text-xs font-medium text-neutral-600 uppercase">Date Range</label>
            <div className="flex gap-1 items-center">
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="flex-1 border border-neutral-300 rounded-md px-2 py-1.5 text-sm" />
              <span className="text-neutral-400 text-xs">–</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="flex-1 border border-neutral-300 rounded-md px-2 py-1.5 text-sm" />
            </div>
          </div>
        </div>
        {TYPE_FILTER_OPTIONS[dataset] && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-neutral-600 mb-1 uppercase">{TYPE_FILTER_LABEL[dataset]}</label>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="w-full border border-neutral-300 rounded-md px-2 py-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500 md:w-64">
              <option value="all">{TYPE_FILTER_ALL_LABEL[dataset]}</option>
              {TYPE_FILTER_OPTIONS[dataset].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-neutral-500">{rows.length} record{rows.length !== 1 ? 's' : ''} found</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 px-3 py-1.5 border border-neutral-300 rounded-md text-xs font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Export CSV
            </button>
            <ExportPdfButton
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-md text-xs font-medium hover:bg-indigo-700"
              filename="on-demand-report"
              buildSpec={() => ({
                title: `On Demand Report - ${dataset === 'infections' ? 'Infections' : dataset === 'abts' ? 'Antibiotics' : dataset === 'vax' ? 'Vaccinations' : 'Residents'}`,
                orientation: 'landscape',
                template: 'LANDSCAPE_TEMPLATE_V1',
                subtitleLines: [
                  `Dataset: ${dataset}`,
                  `Unit: ${unitFilter}`,
                  `Status: ${statusFilter}`,
                  `Type: ${typeFilter}`,
                  `Start: ${startDate || 'Not set'}`,
                  `End: ${endDate || 'Not set'}`,
                ],
                sections: [{ type: 'table', columns: currentHeaders, rows }],
              })}
            />
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className={`px-4 py-5 sm:px-6 border-b ${
            dataset === 'infections' ? 'bg-red-50 border-red-200' :
            dataset === 'abts' ? 'bg-amber-50 border-amber-200' :
            dataset === 'vax' ? 'bg-blue-50 border-blue-200' :
            'bg-indigo-50 border-indigo-200'
          }`}>
             <h3 className={`text-lg leading-6 font-bold ${
                dataset === 'infections' ? 'text-red-900' :
                dataset === 'abts' ? 'text-amber-900' :
                dataset === 'vax' ? 'text-blue-900' :
                'text-indigo-900'
             }`}>
               {dataset === 'infections' ? 'Infection Control Line List' :
                dataset === 'abts' ? 'Antibiotic Course Line List' :
                dataset === 'vax' ? 'Vaccination Line List' :
                'Resident Census Line List'}
             </h3>
             <p className={`text-xs mt-1 ${
                dataset === 'infections' ? 'text-red-700' :
                dataset === 'abts' ? 'text-amber-700' :
                dataset === 'vax' ? 'text-blue-700' :
                'text-indigo-700'
             }`}>
               {rows.length} record{rows.length !== 1 ? 's' : ''} found
             </p>
          </div>
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200 text-sm">
            <thead className="bg-neutral-50">
              <tr>
                {(['infections', 'abts', 'vax'].includes(dataset)) && (
                  <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase whitespace-nowrap">Edit</th>
                )}
                {currentHeaders.map(h => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {rows.length === 0 && (
                <tr><td colSpan={currentHeaders.length + (['infections', 'abts', 'vax'].includes(dataset) ? 1 : 0)} className="px-4 py-8 text-center text-neutral-400">No records match the selected filters</td></tr>
              )}
              {rows.map((row, i) => {
                const meta = rowMeta[i];
                return (
                  <tr key={i}>
                    {meta && (['infections', 'abts', 'vax'].includes(dataset)) && (
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              if (dataset === 'infections') setEditModal({ type: 'ip', recordId: meta.recordId, residentId: meta.residentId });
                              else if (dataset === 'abts') setEditModal({ type: 'abt', recordId: meta.recordId, residentId: meta.residentId });
                              else if (dataset === 'vax') setEditModal({ type: 'vax', recordId: meta.recordId, residentId: meta.residentId });
                            }}
                            title="Quick edit"
                            className="inline-flex items-center justify-center p-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded"
                          >
                            {/* Pencil icon */}
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setLinkModal({ type: dataset as 'infections' | 'abts' | 'vax', recordId: meta.recordId, residentRef: { kind: meta.residentRefKind, id: meta.residentId } })}
                            title="Correct resident/MRN"
                            className="inline-flex items-center justify-center p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded"
                          >
                            <LinkIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                    {!meta && (['infections', 'abts', 'vax'].includes(dataset)) && <td className="px-3 py-2" />}
                    {row.map((cell, j) => (
                      <td key={j} className="px-4 py-2 text-neutral-700 whitespace-nowrap">{cell}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>

      {/* Quick-edit modals */}
      {editModal?.type === 'ip' && (
        <IpEventModal
          residentId={editModal.residentId}
          existingIp={store.infections[editModal.recordId]}
          onClose={() => setEditModal(null)}
        />
      )}
      {editModal?.type === 'abt' && (
        <AbtCourseModal
          residentId={editModal.residentId}
          existingAbt={store.abts[editModal.recordId]}
          onClose={() => setEditModal(null)}
        />
      )}
      {editModal?.type === 'vax' && (
        <VaxEventModal
          residentId={editModal.residentId}
          existingVax={store.vaxEvents[editModal.recordId]}
          onClose={() => setEditModal(null)}
        />
      )}

      {linkModal && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
              <h3 className="text-lg font-bold text-neutral-900">Correct MRN / Resident Link</h3>
              <button onClick={() => setLinkModal(null)} className="text-neutral-500 hover:text-neutral-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
                Current link: <span className="font-medium">{linkModal.residentRef.kind === 'mrn' ? `MRN ${linkModal.residentRef.id}` : `Quarantine ${linkModal.residentRef.id}`}</span>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1 uppercase">Find Resident</label>
                <input
                  type="text"
                  value={linkQuery}
                  onChange={e => setLinkQuery(e.target.value)}
                  placeholder="Search by resident name or MRN"
                  className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div className="border border-neutral-200 rounded-md max-h-72 overflow-y-auto">
                {filteredResidentOptions.map(r => (
                  <button
                    key={r.mrn}
                    type="button"
                    onClick={() => setSelectedLinkMrn(r.mrn)}
                    className={`w-full text-left px-3 py-2 border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50 ${selectedLinkMrn === r.mrn ? 'bg-emerald-50' : ''}`}
                  >
                    <div className="font-medium text-neutral-900">{r.displayName}</div>
                    <div className="text-xs text-neutral-500">MRN: {r.mrn}</div>
                  </button>
                ))}
                {filteredResidentOptions.length === 0 && (
                  <div className="px-3 py-6 text-sm text-neutral-400 text-center">No residents found.</div>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-neutral-200 flex justify-end gap-2">
              <button onClick={() => setLinkModal(null)} className="px-4 py-2 text-sm border border-neutral-300 rounded-md hover:bg-neutral-50">Cancel</button>
              <button onClick={handleSaveLink} disabled={!selectedLinkMrn} className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:bg-neutral-300">Save Link</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const MonthlyAnalytics: React.FC = () => {
  const { store } = useFacilityData();
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [analytics, setAnalytics] = useState<any[]>([]);

  useEffect(() => {
    const savedMetrics = localStorage.getItem('ltc_facility_metrics');
    if (savedMetrics) {
      setMetrics(JSON.parse(savedMetrics));
    }
  }, []);

  useEffect(() => {
    const calculateAnalytics = () => {
      const results: any[] = [];
      Object.entries(metrics).forEach(([month, residentDays]) => {
        const [year, monthNum] = month.split('-');
        const yearNum = parseInt(year, 10);
        const monthNumParsed = parseInt(monthNum, 10);
        const daysInMonth = new Date(yearNum, monthNumParsed, 0).getDate();
        const infections = Object.values(store.infections).filter(ip => {
          const eventDate = new Date(ip.createdAt);
          return eventDate.getFullYear() === yearNum && eventDate.getMonth() + 1 === monthNumParsed;
        });

        const abtDays = Object.values(store.abts).reduce((total, abt) => {
          if (abt.startDate && abt.endDate) {
            const start = new Date(abt.startDate);
            const end = new Date(abt.endDate);
            if (start.getFullYear() === yearNum && start.getMonth() + 1 === monthNumParsed) {
              const diffTime = Math.abs(end.getTime() - start.getTime());
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
              return total + diffDays;
            }
          }
          return total;
        }, 0);

        const infectionRate = residentDays > 0 ? (infections.length / residentDays) * 1000 : 0;
        const aur = residentDays > 0 ? (abtDays / residentDays) * 1000 : 0;
        const averageCensus = daysInMonth > 0 ? residentDays / daysInMonth : 0;

        results.push({
          month,
          residentDays,
          averageCensus: averageCensus.toFixed(1),
          totalInfections: infections.length,
          infectionRate: infectionRate.toFixed(2),
          totalAbtDays: abtDays,
          aur: aur.toFixed(2),
        });
      });
      setAnalytics(results);
    };

    if (store) {
      calculateAnalytics();
    }
  }, [metrics, store]);

  // DOT Trend Chart — rolling 30 days
  const dotTrend = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const abts = Object.values(store.abts || {}) as ABTCourse[];
    const points: { label: string; dot: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(d);
      dayEnd.setHours(23, 59, 59, 999);
      // Count active ABTs on this day
      const count = abts.filter(abt => {
        if (!abt.startDate) return false;
        const start = new Date(abt.startDate);
        const end = abt.endDate ? new Date(abt.endDate) : null;
        return start <= dayEnd && (!end || end >= dayStart);
      }).length;
      const label = `${d.getMonth() + 1}/${d.getDate()}`;
      points.push({ label, dot: count });
    }
    return points;
  }, [store.abts]);

  const maxDot = Math.max(...dotTrend.map(p => p.dot), 1);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
      </div>

      <div className="space-y-6">
        {/* DOT Trend Chart */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 bg-indigo-50 border-b border-indigo-200">
          <h3 className="text-lg leading-6 font-bold text-indigo-900">Days-of-Therapy (DOT) — Rolling 30 Days</h3>
          <p className="text-xs text-indigo-700 mt-1">Active antibiotic courses per calendar day over the past 30 days.</p>
        </div>
        <div className="px-4 py-5 sm:px-6 overflow-x-auto">
          {dotTrend.every(p => p.dot === 0) ? (
            <p className="text-sm text-neutral-400 text-center py-6">No active antibiotic courses recorded in the last 30 days.</p>
          ) : (
            <svg viewBox={`0 0 ${dotTrend.length * 22} 120`} className="w-full" style={{ minWidth: '500px', height: '140px' }} aria-label="DOT trend bar chart">
              {dotTrend.map((p, i) => {
                const barH = Math.max(2, Math.round((p.dot / maxDot) * 80));
                const x = i * 22 + 2;
                const y = 90 - barH;
                const isToday = i === 29;
                return (
                  <g key={i}>
                    <rect
                      x={x}
                      y={y}
                      width={18}
                      height={barH}
                      rx={2}
                      fill={isToday ? '#4f46e5' : '#a5b4fc'}
                      aria-label={`${p.label}: ${p.dot} ABT${p.dot !== 1 ? 's' : ''}`}
                    />
                    {p.dot > 0 && (
                      <text x={x + 9} y={y - 3} textAnchor="middle" fontSize={8} fill="#374151">{p.dot}</text>
                    )}
                    {(i === 0 || i === 9 || i === 19 || i === 29) && (
                      <text x={x + 9} y={108} textAnchor="middle" fontSize={7} fill="#6b7280">{p.label}</text>
                    )}
                  </g>
                );
              })}
              <line x1={0} y1={91} x2={dotTrend.length * 22} y2={91} stroke="#e5e7eb" strokeWidth={1} />
            </svg>
          )}
          <div className="flex items-center gap-4 mt-2 text-xs text-neutral-500">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-indigo-500" /> Today</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-indigo-300" /> Previous days</span>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 bg-indigo-50 border-b border-indigo-200">
          <h3 className="text-lg leading-6 font-bold text-indigo-900">Monthly Analytics</h3>
        </div>
      <div>
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Month</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Resident Days</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Average Census</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Total Infections</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Infection Rate / 1000</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Total ABT Days</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">AUR / 1000</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-neutral-200">
            {analytics.map(row => (
              <tr key={row.month}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-900">{row.month}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">{row.residentDays}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">{row.averageCensus}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">{row.totalInfections}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">{row.infectionRate}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">{row.totalAbtDays}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">{row.aur}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    </div>
    </div>
  );
};

const QapiRollup: React.FC = () => {
  const { store } = useFacilityData();
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

  const [year, monthNum] = selectedMonth.split('-').map(Number);
  const monthStart = useMemo(() => new Date(year, monthNum - 1, 1), [year, monthNum]);
  const monthEnd = useMemo(() => new Date(year, monthNum, 0, 23, 59, 59), [year, monthNum]);

  const inMonth = (dateStr: string | undefined) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d >= monthStart && d <= monthEnd;
  };

  // Infections by category
  const infectionsByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    (Object.values(store.infections) as IPEvent[]).forEach(ip => {
      if (inMonth(ip.onsetDate || ip.createdAt)) {
        const cat = ip.infectionCategory || 'Unknown';
        map[cat] = (map[cat] || 0) + 1;
      }
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [store.infections, monthStart, monthEnd]);

  // Infections by unit
  const infectionsByUnit = useMemo(() => {
    const map: Record<string, number> = {};
    (Object.values(store.infections) as IPEvent[]).forEach(ip => {
      if (inMonth(ip.onsetDate || ip.createdAt)) {
        const res = ip.residentRef.kind === 'mrn' ? store.residents[ip.residentRef.id] : store.quarantine[ip.residentRef.id];
        const unit = ip.locationSnapshot?.unit || (res as any)?.currentUnit || 'Unknown';
        map[unit] = (map[unit] || 0) + 1;
      }
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [store.infections, store.residents, store.quarantine, monthStart, monthEnd]);

  // ABT use rate: active ABTs with starts in month
  const abtCount = useMemo(() =>
    (Object.values(store.abts) as ABTCourse[]).filter(a => inMonth(a.startDate || a.createdAt)).length,
    [store.abts, monthStart, monthEnd]
  );

  const activeResidentCount = useMemo(() =>
    (Object.values(store.residents) as Resident[]).filter(r => !r.isHistorical && !r.backOfficeOnly).filter((r: Resident) => r.status === 'Active').length,
    [store.residents]
  );

  // Vaccine coverage by vaccine type (given this month OR ever given)
  const vaccineTypes = useMemo(() => {
    const s = new Set<string>();
    (Object.values(store.vaxEvents) as VaxEvent[]).forEach(v => s.add(v.vaccine));
    return Array.from(s).sort();
  }, [store.vaxEvents]);

  const vaccineCoverage = useMemo(() => {
    return vaccineTypes.map(vacType => {
      const givenResidents = new Set(
        (Object.values(store.vaxEvents) as VaxEvent[])
          .filter(v => v.vaccine === vacType && v.status === 'given' && v.residentRef.kind === 'mrn')
          .map(v => v.residentRef.id)
      );
      const pct = activeResidentCount > 0 ? ((givenResidents.size / activeResidentCount) * 100).toFixed(1) : '0.0';
      return { vaccine: vacType, given: givenResidents.size, total: activeResidentCount, pct };
    });
  }, [vaccineTypes, store.vaxEvents, activeResidentCount]);

  return (
    <div className="space-y-6">
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 flex items-center gap-3">
        <span className="font-bold text-indigo-900 text-sm">QAPI Rollup</span>
        <input
          type="month"
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          className="border border-indigo-300 rounded-md px-2 py-1 text-sm text-indigo-800 bg-white focus:ring-indigo-500 focus:border-indigo-500"
        />
        <div className="ml-auto flex items-center gap-2">
          <ExportPdfButton
            className="px-4 py-1.5 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
            filename="qapi-rollup"
            buildSpec={() => ({
              title: `QAPI Rollup — ${selectedMonth}`,
              orientation: 'landscape',
              template: 'LANDSCAPE_TEMPLATE_V1',
              subtitleLines: [`Month: ${selectedMonth}`],
              sections: [
                { type: 'table', title: 'Infections by Category', columns: ['Category', 'Count'], rows: infectionsByCategory.map(([cat, cnt]) => [cat, cnt]) },
                { type: 'table', title: 'Infections by Unit', columns: ['Unit', 'Count'], rows: infectionsByUnit.map(([unit, cnt]) => [unit, cnt]) },
                { type: 'table', title: 'ABT Use Rate', columns: ['New ABT Courses (Month)', 'Active Residents', 'Rate per Resident'], rows: [[String(abtCount), String(activeResidentCount), activeResidentCount > 0 ? (abtCount / activeResidentCount * 100).toFixed(1) + '%' : 'N/A']] },
                { type: 'table', title: 'Vaccine Coverage (Cumulative)', columns: ['Vaccine', 'Residents Given', 'Active Census', 'Coverage %'], rows: vaccineCoverage.map((r) => [r.vaccine, String(r.given), String(r.total), r.pct + '%']) },
              ],
            })}
          />
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Infections by Category */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:px-6 bg-red-50 border-b border-red-200">
            <h3 className="text-lg leading-6 font-bold text-red-900">Infections by Category</h3>
            <p className="text-xs text-red-700 mt-1">New infections created in {selectedMonth}</p>
          </div>
          <table className="min-w-full divide-y divide-neutral-200 text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Category</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-neutral-500 uppercase">Count</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {infectionsByCategory.length === 0 && (
                <tr><td colSpan={2} className="px-4 py-6 text-center text-neutral-400">No infections this month</td></tr>
              )}
              {infectionsByCategory.map(([cat, cnt]) => (
                <tr key={cat}>
                  <td className="px-4 py-2 text-neutral-700">{cat}</td>
                  <td className="px-4 py-2 text-right font-semibold text-neutral-900">{cnt}</td>
                </tr>
              ))}
              {infectionsByCategory.length > 0 && (
                <tr className="bg-neutral-50">
                  <td className="px-4 py-2 font-bold text-neutral-700">Total</td>
                  <td className="px-4 py-2 text-right font-bold text-neutral-900">{infectionsByCategory.reduce((s, [, c]) => s + c, 0)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Infections by Unit */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:px-6 bg-amber-50 border-b border-amber-200">
            <h3 className="text-lg leading-6 font-bold text-amber-900">Infections by Unit</h3>
            <p className="text-xs text-amber-700 mt-1">New infections created in {selectedMonth}</p>
          </div>
          <table className="min-w-full divide-y divide-neutral-200 text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Unit</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-neutral-500 uppercase">Count</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {infectionsByUnit.length === 0 && (
                <tr><td colSpan={2} className="px-4 py-6 text-center text-neutral-400">No infections this month</td></tr>
              )}
              {infectionsByUnit.map(([unit, cnt]) => (
                <tr key={unit}>
                  <td className="px-4 py-2 text-neutral-700">{unit}</td>
                  <td className="px-4 py-2 text-right font-semibold text-neutral-900">{cnt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ABT Use Rate */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 bg-emerald-50 border-b border-emerald-200">
          <h3 className="text-lg leading-6 font-bold text-emerald-900">Antibiotic Use Rate</h3>
          <p className="text-xs text-emerald-700 mt-1">New ABT courses started in {selectedMonth}</p>
        </div>
        <div className="px-6 py-4 flex gap-12">
          <div className="text-center">
            <div className="text-3xl font-bold text-emerald-700">{abtCount}</div>
            <div className="text-xs text-neutral-500 mt-1">New ABT Courses</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-neutral-700">{activeResidentCount}</div>
            <div className="text-xs text-neutral-500 mt-1">Active Residents</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-indigo-700">
              {activeResidentCount > 0 ? (abtCount / activeResidentCount * 100).toFixed(1) : '—'}%
            </div>
            <div className="text-xs text-neutral-500 mt-1">ABT Rate (% of census)</div>
          </div>
        </div>
      </div>

      {/* Vaccine Coverage */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 bg-purple-50 border-b border-purple-200">
          <h3 className="text-lg leading-6 font-bold text-purple-900">Vaccine Coverage (Cumulative)</h3>
          <p className="text-xs text-purple-700 mt-1">% of active residents with at least one "given" record</p>
        </div>
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Vaccine</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-neutral-500 uppercase">Given</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-neutral-500 uppercase">Active Census</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-neutral-500 uppercase">Coverage %</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-neutral-200">
            {vaccineCoverage.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-neutral-400">No vaccination records found</td></tr>
            )}
            {vaccineCoverage.map(r => (
              <tr key={r.vaccine}>
                <td className="px-4 py-2 text-neutral-700">{r.vaccine}</td>
                <td className="px-4 py-2 text-right text-neutral-700">{r.given}</td>
                <td className="px-4 py-2 text-right text-neutral-500">{r.total}</td>
                <td className="px-4 py-2 text-right">
                  <span className={`font-semibold ${parseFloat(r.pct) >= 80 ? 'text-green-700' : parseFloat(r.pct) >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                    {r.pct}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
};

// ─── Vaccine Coverage Report ──────────────────────────────────────────────────

const VaccineCoverageReport: React.FC = () => {
  const { store } = useFacilityData();
  const { updateDB } = useDatabase();
  const [selectedVaccine, setSelectedVaccine] = useState<string | null>(null);
  const [showUnlinked, setShowUnlinked] = useState(false);
  const [editingVaxEvent, setEditingVaxEvent] = useState<VaxEvent | undefined>(undefined);

  const result = useMemo(() => computeVaccineCoverage(store), [store]);

  const handleDeleteUnlinkedEvent = (id: string) => {
    if (!confirm('Are you sure you want to delete this VAX event?')) return;
    updateDB(draft => {
      const facilityId = draft.data.facilities.activeFacilityId;
      delete draft.data.facilityData[facilityId].vaxEvents[id];
    });
  };

  const pct = (n: number) =>
    result.totalActiveCensus > 0
      ? ((n / result.totalActiveCensus) * 100).toFixed(1)
      : '0.0';

  // Derive COVID-19 lookback label from the computed since-date
  const covidLookbackLabel = useMemo(() => {
    const sinceMs = new Date(result.covidSinceDate).getTime();
    const nowMs = Date.now();
    const days = Math.round((nowMs - sinceMs) / (24 * 60 * 60 * 1000));
    const months = Math.round(days / 30);
    return months >= 2 ? `last ${months} months` : `last ${days} days`;
  }, [result.covidSinceDate]);

  const coverageRows = [
    {
      label: 'Influenza (current season)',
      count: result.influenza,
      declined: result.declinedInfluenza,
      detail: result.fluSeasonWindow
        ? `Season ${result.fluSeasonWindow.start} → ${result.fluSeasonWindow.end}`
        : '—',
    },
    {
      label: 'Pneumococcal (lifetime)',
      count: result.pneumococcal,
      declined: result.declinedPneumococcal,
      detail: 'Any qualifying event',
    },
    {
      label: `COVID-19 (${covidLookbackLabel})`,
      count: result.covid19,
      declined: result.declinedCovid19,
      detail: `Since ${result.covidSinceDate}`,
    },
    {
      label: 'RSV (lifetime)',
      count: result.rsv,
      declined: result.declinedRsv,
      detail: 'Any qualifying event',
    },
  ];

  const declinedVsCoveredPct = (declined: number, covered: number) =>
    covered > 0 ? ((declined / covered) * 100).toFixed(1) : '0.0';

  const reOfferRows = useMemo(() => {
    const activeMrns = getActiveResidentMrns(store);
    const activeResidents = (Object.values(store.residents) as Resident[])
      .filter(r => activeMrns.has(r.mrn))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    const fluWindow = getFluSeasonWindow(new Date());
    const covidSinceMs = new Date(result.covidSinceDate).getTime();

    const coveredFlu = new Set<string>();
    const coveredPneumo = new Set<string>();
    const coveredCovid = new Set<string>();
    const coveredRsv = new Set<string>();
    const declinedFlu = new Set<string>();
    const declinedPneumo = new Set<string>();
    const declinedCovid = new Set<string>();
    const declinedRsv = new Set<string>();

    (Object.values(store.vaxEvents ?? {}) as VaxEvent[]).forEach(event => {
      const mrn = event.residentRef.kind === 'mrn' ? event.residentRef.id : null;
      if (!mrn || !activeMrns.has(mrn)) return;

      const given = isQualifyingEvent(event);
      const declined = isDeclinedEvent(event);
      if (!given && !declined) return;

      const eventDate = given ? getCanonicalDate(event) : (event.offerDate ?? event.createdAt);
      if (!eventDate) return;
      const eventMs = new Date(eventDate).getTime();

      if (isInfluenza(event.vaccine) && eventMs >= fluWindow.start.getTime() && eventMs <= fluWindow.end.getTime()) {
        if (given) coveredFlu.add(mrn);
        if (declined) declinedFlu.add(mrn);
      }
      if (isPneumococcal(event.vaccine)) {
        if (given) coveredPneumo.add(mrn);
        if (declined) declinedPneumo.add(mrn);
      }
      if (isCovid19(event.vaccine) && eventMs >= covidSinceMs) {
        if (given) coveredCovid.add(mrn);
        if (declined) declinedCovid.add(mrn);
      }
      if (isRsv(event.vaccine)) {
        if (given) coveredRsv.add(mrn);
        if (declined) declinedRsv.add(mrn);
      }
    });

    const buildRow = (label: string, covered: Set<string>, declined: Set<string>) => {
      const residents = activeResidents
        .filter(r => !covered.has(r.mrn))
        .map(r => ({
          mrn: r.mrn,
          displayName: r.displayName,
          unit: r.currentUnit || '—',
          room: r.currentRoom || '—',
          previouslyDeclined: declined.has(r.mrn),
        }));
      return { label, count: residents.length, residents };
    };

    return {
      'Influenza (current season)': buildRow('Influenza (current season)', coveredFlu, declinedFlu),
      'Pneumococcal (lifetime)': buildRow('Pneumococcal (lifetime)', coveredPneumo, declinedPneumo),
      [`COVID-19 (${covidLookbackLabel})`]: buildRow(`COVID-19 (${covidLookbackLabel})`, coveredCovid, declinedCovid),
      'RSV (lifetime)': buildRow('RSV (lifetime)', coveredRsv, declinedRsv),
    };
  }, [store, result.covidSinceDate, covidLookbackLabel]);

  const selectedReOffer = selectedVaccine ? reOfferRows[selectedVaccine as keyof typeof reOfferRows] : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3">
        <DrilldownHeader
          title="Vaccine Coverage Summary"
          subtitle="Counts active residents with qualifying in-house or historical vaccine events"
          right={
            <ExportPdfButton
              filename="vaccine-coverage-summary"
              buildSpec={() => ({
                title: 'Vaccine Coverage Summary',
                orientation: 'landscape',
                template: 'LANDSCAPE_TEMPLATE_V1',
                subtitleLines: [`Active Census: ${result.totalActiveCensus}`],
                sections: [
                  { type: 'table', title: 'Coverage Overview', columns: ['Vaccine', 'Covered', 'Coverage %', 'Declined', 'Declined/Covered %', 'Detail'], rows: coverageRows.map(row => [row.label, row.count, `${pct(row.count)}%`, row.declined, `${declinedVsCoveredPct(row.declined, row.count)}%`, row.detail]) },
                  { type: 'table', title: 'Re-Offer Candidates', columns: ['Vaccine', 'Residents to Re-Offer'], rows: Object.values(reOfferRows).map((entry) => [entry.label, entry.count]) },
                ],
              })}
            />
          }
        />
      </div>

      <div className="space-y-6">
        {/* Summary counts */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 bg-teal-50 border-b border-teal-200">
          <h3 className="text-lg leading-6 font-bold text-teal-900">Coverage Summary</h3>
          <p className="text-xs text-teal-700 mt-1">
            Total Active Census: <span className="font-semibold">{result.totalActiveCensus}</span>
          </p>
        </div>
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Vaccine</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-neutral-500 uppercase">Covered</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-neutral-500 uppercase">Declined</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-neutral-500 uppercase">Not Vaccinated (Available)</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-neutral-500 uppercase">Active Census</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-neutral-500 uppercase">Coverage %</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-neutral-500 uppercase">Declined vs Covered %</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Window</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-neutral-200">
            {coverageRows.map(row => (
              <tr key={row.label}>
                <td className="px-4 py-2 font-medium text-neutral-800">{row.label}</td>
                <td className="px-4 py-2 text-right font-semibold text-neutral-900">{row.count}</td>
                <td className="px-4 py-2 text-right font-semibold text-red-700">{row.declined}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => setSelectedVaccine(row.label)}
                    className="font-semibold text-indigo-700 hover:text-indigo-900 underline"
                  >
                    {reOfferRows[row.label as keyof typeof reOfferRows]?.count ?? 0}
                  </button>
                </td>
                <td className="px-4 py-2 text-right text-neutral-500">{result.totalActiveCensus}</td>
                <td className="px-4 py-2 text-right">
                  <span
                    className={`font-semibold ${
                      parseFloat(pct(row.count)) >= 80
                        ? 'text-green-700'
                        : parseFloat(pct(row.count)) >= 50
                        ? 'text-amber-600'
                        : 'text-red-600'
                    }`}
                  >
                    {pct(row.count)}%
                  </span>
                </td>
                <td className="px-4 py-2 text-right text-red-700 font-semibold">{declinedVsCoveredPct(row.declined, row.count)}%</td>
                <td className="px-4 py-2 text-xs text-neutral-500">{row.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedReOffer && (
        <>
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-4 py-5 sm:px-6 bg-indigo-50 border-b border-indigo-200">
              <DrilldownHeader
                title={`Re-Offer Drill Down — ${selectedReOffer.label}`}
                subtitle={`Not vaccinated active residents available for outreach: ${selectedReOffer.count}`}
                right={
                  <>
                    <ExportPdfButton
                      filename="vaccine-reoffer-drilldown"
                      buildSpec={() => ({
                        title: `Re-Offer Drill Down — ${selectedReOffer.label}`,
                        orientation: 'portrait',
                        template: 'PORTRAIT_TEMPLATE_V1',
                        subtitleLines: [`Candidates: ${selectedReOffer.residents.length}`],
                        sections: [{
                          type: 'table',
                          columns: ['Resident', 'MRN', 'Unit', 'Room', 'Previously Declined'],
                          rows: selectedReOffer.residents.map(r => [r.displayName, r.mrn, r.unit, r.room, r.previouslyDeclined ? 'Yes' : 'No']),
                        }],
                      })}
                    />
                    <button
                      onClick={() => setSelectedVaccine(null)}
                      className="px-2 py-1 text-xs font-medium rounded border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                    >
                      Close
                    </button>
                  </>
                }
              />
            </div>
          <table className="min-w-full divide-y divide-neutral-200 text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Resident</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">MRN</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Unit</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Room</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Prior Decline</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {selectedReOffer.residents.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-neutral-400">No residents need re-offer for this vaccine.</td></tr>
              )}
              {selectedReOffer.residents.map(r => (
                <tr key={r.mrn}>
                  <td className="px-4 py-2 font-medium text-neutral-900">{r.displayName}</td>
                  <td className="px-4 py-2 text-neutral-500">{r.mrn}</td>
                  <td className="px-4 py-2 text-neutral-500">{r.unit}</td>
                  <td className="px-4 py-2 text-neutral-500">{r.room}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${r.previouslyDeclined ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'}`}>
                      {r.previouslyDeclined ? 'Yes' : 'No'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
      )}

      {/* Unlinked events */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg leading-6 font-bold text-amber-900">Unlinked Vaccine Events</h3>
            <p className="text-xs text-amber-700 mt-1">
              Qualifying events that could not be matched to an active census resident.
            </p>
          </div>
          {result.unlinkedEventCount > 0 && (
            <button
              onClick={() => setShowUnlinked(v => !v)}
              className="shrink-0 px-3 py-1.5 bg-white border border-amber-300 text-amber-700 rounded-md text-sm font-medium hover:bg-amber-50"
            >
              {showUnlinked ? 'Hide' : 'View All'}
            </button>
          )}
        </div>
        <div className="px-6 py-4">
          <span className="text-3xl font-bold text-amber-700">{result.unlinkedEventCount}</span>
          <span className="text-sm text-neutral-500 ml-2">event(s) with no active-resident match</span>
        </div>
        {showUnlinked && result.unlinkedEvents.length > 0 && (
          <div className="border-t border-neutral-200 overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200 text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">MRN / Ref</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Resident</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Vaccine</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Source</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-neutral-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200">
                {result.unlinkedEvents.map(event => {
                  // Attempt to look up the resident even for unlinked events — they may be
                  // discharged or historical (still in store.residents) but not in the active set.
                  const resident = store.residents[event.residentRef.id];
                  const eventDate = event.dateGiven ?? event.administeredDate ?? event.createdAt;
                  return (
                    <tr key={event.id} className="hover:bg-amber-50">
                      <td className="px-4 py-2 text-neutral-500 font-mono text-xs">{event.residentRef.id}</td>
                      <td className="px-4 py-2 font-medium text-neutral-900">{resident?.displayName ?? <span className="text-neutral-400 italic">Unknown</span>}</td>
                      <td className="px-4 py-2 text-neutral-700">{event.vaccine || '—'}</td>
                      <td className="px-4 py-2 text-neutral-500">{eventDate ? new Date(eventDate).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-2 text-neutral-500">{event.status}</td>
                      <td className="px-4 py-2 text-neutral-500">{event.source || '—'}</td>
                      <td className="px-4 py-2 text-right space-x-3">
                        <button
                          onClick={() => setEditingVaxEvent(event)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUnlinkedEvent(event.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingVaxEvent && (
        <HistoricalVaxEventModal
          onClose={() => setEditingVaxEvent(undefined)}
          existingEvent={editingVaxEvent}
        />
      )}

      {/* Accuracy risks */}
      {result.accuracyRisks.length > 0 && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:px-6 bg-red-50 border-b border-red-200">
            <h3 className="text-lg leading-6 font-bold text-red-900">Accuracy Risks</h3>
            <p className="text-xs text-red-700 mt-1">
              Issues that may affect report accuracy. Resolve these for a complete count.
            </p>
          </div>
          <ul className="divide-y divide-neutral-100">
            {result.accuracyRisks.map((risk, i) => (
              <li key={i} className="px-4 py-3 text-sm text-red-800 flex items-start gap-2">
                <span className="mt-0.5 text-red-500">⚠</span>
                <span>{risk}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
    </div>
  );
};

export default ReportsConsole;
