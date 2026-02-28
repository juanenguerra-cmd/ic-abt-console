import React, { useState, useEffect, useMemo } from 'react';
import { useFacilityData } from '../../app/providers';
import { Resident, IPEvent, ABTCourse, VaxEvent, ResidentNote } from '../../domain/models';
import { IpEventModal } from '../ResidentBoard/IpEventModal';
import { AbtCourseModal } from '../ResidentBoard/AbtCourseModal';
import { VaxEventModal } from '../ResidentBoard/VaxEventModal';
import { FileText } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FormsTab } from '../../components/FormsTab';

const ReportsConsole: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const formsRoute = '/reports/forms';
  const [activeTab, setActiveTab] = useState(location.pathname === formsRoute ? 'forms' : 'monthly');

  useEffect(() => {
    if (location.pathname === formsRoute) {
      setActiveTab('forms');
    } else if (activeTab === 'forms') {
      setActiveTab('monthly');
    }
  }, [location.pathname, activeTab]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'forms') {
      navigate(formsRoute);
      return;
    }

    if (location.pathname === formsRoute) {
      navigate('/reports');
    }
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
            data-testid="forms-tab-button"
            onClick={() => handleTabChange('forms')}
            className={`${activeTab === 'forms' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm active:scale-95 inline-flex items-center gap-2`}>
            <FileText className="h-4 w-4" />
            Forms
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
        {activeTab === 'forms' && <FormsTab />}
      </div>
    </div>
  );
};

const SurveyPacketsReport: React.FC = () => {
  const { store } = useFacilityData();

  const activePrecautions = useMemo(() =>
    (Object.values(store.infections) as IPEvent[]).filter(ip => ip.status === 'active' && ip.isolationType)
      .map(ip => {
        const res = ip.residentRef.kind === 'mrn' ? store.residents[ip.residentRef.id] : store.quarantine[ip.residentRef.id];
        return { ip, res };
      }),
    [store.infections, store.residents, store.quarantine]
  );

  const activeAbts = useMemo(() =>
    (Object.values(store.abts) as ABTCourse[]).filter(a => a.status === 'active')
      .map(a => {
        const res = a.residentRef.kind === 'mrn' ? store.residents[a.residentRef.id] : store.quarantine[a.residentRef.id];
        return { abt: a, res };
      }),
    [store.abts, store.residents, store.quarantine]
  );

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 bg-red-50 border-b border-red-200">
          <h3 className="text-lg leading-6 font-bold text-red-900">Active Precautions Line List</h3>
          <p className="text-xs text-red-700 mt-1">Survey-Ready: Isolation Roster</p>
        </div>
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Resident</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">MRN</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Unit / Room</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Category</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Isolation Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Organism</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-neutral-200">
            {activePrecautions.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-neutral-400">No active precautions</td></tr>
            )}
            {activePrecautions.map(({ ip, res }) => (
              <tr key={ip.id}>
                <td className="px-4 py-3 text-sm font-medium text-neutral-900">{(res as any)?.displayName || '—'}</td>
                <td className="px-4 py-3 text-sm text-neutral-500">{(res as any)?.mrn || '—'}</td>
                <td className="px-4 py-3 text-sm text-neutral-500">{ip.locationSnapshot?.unit || (res as any)?.currentUnit || '—'} / {ip.locationSnapshot?.room || (res as any)?.currentRoom || '—'}</td>
                <td className="px-4 py-3 text-sm text-neutral-500">{ip.infectionCategory || '—'}</td>
                <td className="px-4 py-3 text-sm text-neutral-500">{ip.isolationType || '—'}</td>
                <td className="px-4 py-3 text-sm text-neutral-500">{ip.organism || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 bg-amber-50 border-b border-amber-200">
          <h3 className="text-lg leading-6 font-bold text-amber-900">Active Antibiotic Courses</h3>
          <p className="text-xs text-amber-700 mt-1">Survey-Ready: ABT Utilization Roster</p>
        </div>
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Resident</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">MRN</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Unit / Room</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Medication</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Indication</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Start Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Culture</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-neutral-200">
            {activeAbts.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-neutral-400">No active antibiotic courses</td></tr>
            )}
            {activeAbts.map(({ abt, res }) => (
              <tr key={abt.id}>
                <td className="px-4 py-3 text-sm font-medium text-neutral-900">{(res as any)?.displayName || '—'}</td>
                <td className="px-4 py-3 text-sm text-neutral-500">{(res as any)?.mrn || '—'}</td>
                <td className="px-4 py-3 text-sm text-neutral-500">{abt.locationSnapshot?.unit || (res as any)?.currentUnit || '—'} / {abt.locationSnapshot?.room || (res as any)?.currentRoom || '—'}</td>
                <td className="px-4 py-3 text-sm text-neutral-500">{abt.medication}</td>
                <td className="px-4 py-3 text-sm text-neutral-500">{abt.indication || '—'}</td>
                <td className="px-4 py-3 text-sm text-neutral-500">{abt.startDate || '—'}</td>
                <td className="px-4 py-3 text-sm text-neutral-500">{abt.cultureCollected ? `Yes${abt.cultureCollectionDate ? ' (' + abt.cultureCollectionDate + ')' : ''}` : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const DailyReport: React.FC = () => {
  const { store } = useFacilityData();
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const reportDateObj = useMemo(() => new Date(reportDate + 'T00:00:00'), [reportDate]);
  const threeDaysBeforeReport = useMemo(() => { const d = new Date(reportDateObj); d.setDate(d.getDate() - 3); return d; }, [reportDateObj]);

  const activePrecautions = useMemo(() =>
    (Object.values(store.infections) as IPEvent[]).filter(ip => ip.status === 'active' && ip.isolationType && new Date(ip.createdAt) <= reportDateObj)
      .map(ip => {
        const res = ip.residentRef.kind === 'mrn' ? store.residents[ip.residentRef.id] : store.quarantine[ip.residentRef.id];
        return { ip, res };
      })
      .sort((a, b) => ((a.res as any)?.currentUnit || '').localeCompare((b.res as any)?.currentUnit || '')),
    [store.infections, store.residents, store.quarantine, reportDateObj]
  );

  const activeAbts = useMemo(() =>
    (Object.values(store.abts) as ABTCourse[]).filter(a => a.status === 'active' && (!a.startDate || new Date(a.startDate) <= reportDateObj))
      .map(a => {
        const res = a.residentRef.kind === 'mrn' ? store.residents[a.residentRef.id] : store.quarantine[a.residentRef.id];
        return { abt: a, res };
      })
      .sort((a, b) => ((a.res as any)?.currentUnit || '').localeCompare((b.res as any)?.currentUnit || '')),
    [store.abts, store.residents, store.quarantine, reportDateObj]
  );

  const recentAdmissions = useMemo(() =>
    Object.values(store.residents)
      .filter((r: Resident) => r.admissionDate && new Date(r.admissionDate) > threeDaysBeforeReport && new Date(r.admissionDate) <= reportDateObj)
      .map((r: Resident) => {
        const hasScreening = (Object.values(store.notes) as ResidentNote[]).some(n =>
          n.residentRef.kind === 'mrn' && n.residentRef.id === r.mrn && n.title?.includes('Admission Screening')
        );
        return { res: r, hasScreening };
      })
      .sort((a, b) => (a.res.admissionDate || '').localeCompare(b.res.admissionDate || '')),
    [store.residents, store.notes, threeDaysBeforeReport, reportDateObj]
  );

  return (
    <div className="space-y-6">
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 flex items-center gap-3">
        <span className="font-bold text-indigo-900 text-sm">Daily Report</span>
        <input
          type="date"
          value={reportDate}
          onChange={e => setReportDate(e.target.value)}
          className="border border-indigo-300 rounded-md px-2 py-1 text-sm text-indigo-800 bg-white focus:ring-indigo-500 focus:border-indigo-500"
        />
        <span className="text-indigo-700 text-sm">{new Date(reportDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-4 border-b border-neutral-200 bg-red-50">
          <h3 className="text-base font-bold text-red-900">Active Precautions Line List ({activePrecautions.length})</h3>
          <p className="text-xs text-red-700 mt-0.5">Sortable by unit for floor nurses</p>
        </div>
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Resident</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">MRN</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Unit</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Room</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Category</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Isolation</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Organism</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">EBP</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-neutral-200">
            {activePrecautions.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-neutral-400">No active precautions today</td></tr>
            )}
            {activePrecautions.map(({ ip, res }) => (
              <tr key={ip.id}>
                <td className="px-4 py-2 font-medium text-neutral-900">{(res as any)?.displayName || '—'}</td>
                <td className="px-4 py-2 text-neutral-500">{(res as any)?.mrn || '—'}</td>
                <td className="px-4 py-2 text-neutral-500">{ip.locationSnapshot?.unit || (res as any)?.currentUnit || '—'}</td>
                <td className="px-4 py-2 text-neutral-500">{ip.locationSnapshot?.room || (res as any)?.currentRoom || '—'}</td>
                <td className="px-4 py-2 text-neutral-500">{ip.infectionCategory || '—'}</td>
                <td className="px-4 py-2 text-neutral-500">{ip.isolationType || '—'}</td>
                <td className="px-4 py-2 text-neutral-500">{ip.organism || '—'}</td>
                <td className="px-4 py-2 text-neutral-500">{ip.ebp ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-4 border-b border-neutral-200 bg-amber-50">
          <h3 className="text-base font-bold text-amber-900">Active Antibiotic Courses ({activeAbts.length})</h3>
        </div>
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Resident</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">MRN</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Unit</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Room</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Medication</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Start Date</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Indication</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Culture</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-neutral-200">
            {activeAbts.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-neutral-400">No active antibiotic courses</td></tr>
            )}
            {activeAbts.map(({ abt, res }) => (
              <tr key={abt.id}>
                <td className="px-4 py-2 font-medium text-neutral-900">{(res as any)?.displayName || '—'}</td>
                <td className="px-4 py-2 text-neutral-500">{(res as any)?.mrn || '—'}</td>
                <td className="px-4 py-2 text-neutral-500">{abt.locationSnapshot?.unit || (res as any)?.currentUnit || '—'}</td>
                <td className="px-4 py-2 text-neutral-500">{abt.locationSnapshot?.room || (res as any)?.currentRoom || '—'}</td>
                <td className="px-4 py-2 text-neutral-500">{abt.medication}</td>
                <td className="px-4 py-2 text-neutral-500">{abt.startDate || '—'}</td>
                <td className="px-4 py-2 text-neutral-500">{abt.indication || '—'}</td>
                <td className="px-4 py-2 text-neutral-500">{abt.cultureCollected ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-4 border-b border-neutral-200 bg-emerald-50">
          <h3 className="text-base font-bold text-emerald-900">Admission Screening Due (&lt;72h) ({recentAdmissions.filter(r => !r.hasScreening).length})</h3>
        </div>
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Resident</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">MRN</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Admission Date</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Unit</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Room</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Screening</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-neutral-200">
            {recentAdmissions.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-neutral-400">No recent admissions in the last 72 hours</td></tr>
            )}
            {recentAdmissions.map(({ res, hasScreening }) => (
              <tr key={res.mrn}>
                <td className="px-4 py-2 font-medium text-neutral-900">{res.displayName}</td>
                <td className="px-4 py-2 text-neutral-500">{res.mrn}</td>
                <td className="px-4 py-2 text-neutral-500">{res.admissionDate || '—'}</td>
                <td className="px-4 py-2 text-neutral-500">{res.currentUnit || '—'}</td>
                <td className="px-4 py-2 text-neutral-500">{res.currentRoom || '—'}</td>
                <td className="px-4 py-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${hasScreening ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {hasScreening ? 'Done' : 'Pending'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const WeeklyReport: React.FC = () => {
  const { store } = useFacilityData();
  const defaultEnd = new Date().toISOString().split('T')[0];
  const defaultStart = (() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0]; })();
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

  const startObj = useMemo(() => new Date(startDate + 'T00:00:00'), [startDate]);
  const endObj = useMemo(() => new Date(endDate + 'T23:59:59'), [endDate]);

  const newInfections = useMemo(() =>
    (Object.values(store.infections) as IPEvent[])
      .filter(ip => { const d = new Date(ip.createdAt); return d >= startObj && d <= endObj; })
      .map(ip => {
        const res = ip.residentRef.kind === 'mrn' ? store.residents[ip.residentRef.id] : store.quarantine[ip.residentRef.id];
        return { ip, res };
      })
      .sort((a, b) => b.ip.createdAt.localeCompare(a.ip.createdAt)),
    [store.infections, store.residents, store.quarantine, startObj, endObj]
  );

  const newAbts = useMemo(() =>
    (Object.values(store.abts) as ABTCourse[])
      .filter(a => { const d = new Date(a.startDate || a.createdAt); return d >= startObj && d <= endObj; })
      .map(a => {
        const res = a.residentRef.kind === 'mrn' ? store.residents[a.residentRef.id] : store.quarantine[a.residentRef.id];
        return { abt: a, res };
      })
      .sort((a, b) => (b.abt.startDate || '').localeCompare(a.abt.startDate || '')),
    [store.abts, store.residents, store.quarantine, startObj, endObj]
  );

  const vaxActivity = useMemo(() =>
    (Object.values(store.vaxEvents) as VaxEvent[])
      .filter(v => { const d = new Date(v.createdAt); return d >= startObj && d <= endObj; })
      .map(v => {
        const res = v.residentRef.kind === 'mrn' ? store.residents[v.residentRef.id] : store.quarantine[v.residentRef.id];
        return { vax: v, res };
      })
      .sort((a, b) => b.vax.createdAt.localeCompare(a.vax.createdAt)),
    [store.vaxEvents, store.residents, store.quarantine, startObj, endObj]
  );

  const weekStart = new Date(startDate + 'T00:00:00').toLocaleDateString();
  const weekEnd = new Date(endDate + 'T00:00:00').toLocaleDateString();

  const handlePrint = () => window.print();

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .weekly-report-print, .weekly-report-print * { visibility: visible; }
          .weekly-report-print { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="weekly-report-print space-y-6">
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 flex items-center gap-3 no-print">
        <span className="font-bold text-indigo-900 text-sm">Weekly Report</span>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border border-indigo-300 rounded-md px-2 py-1 text-sm text-indigo-800 bg-white" />
        <span className="text-indigo-500 text-sm">–</span>
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border border-indigo-300 rounded-md px-2 py-1 text-sm text-indigo-800 bg-white" />
        <button onClick={handlePrint} className="ml-auto flex items-center gap-1 px-3 py-1.5 bg-white border border-indigo-300 text-indigo-700 rounded-md text-sm font-medium hover:bg-indigo-50">
          Print / PDF
        </button>
      </div>

      {/* Print header (hidden on screen, visible when printing) */}
      <div className="hidden print:block text-center mb-4">
        <div className="text-xl font-bold">Standard of Care</div>
        <div className="text-sm text-neutral-600">{weekStart} to {weekEnd}</div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-neutral-200 p-4 text-center">
          <div className="text-2xl font-bold text-red-700">{newInfections.length}</div>
          <div className="text-xs text-neutral-500 mt-1">New Infections</div>
        </div>
        <div className="bg-white rounded-lg border border-neutral-200 p-4 text-center">
          <div className="text-2xl font-bold text-amber-700">{newAbts.length}</div>
          <div className="text-xs text-neutral-500 mt-1">New ABT Courses</div>
        </div>
        <div className="bg-white rounded-lg border border-neutral-200 p-4 text-center">
          <div className="text-2xl font-bold text-blue-700">{vaxActivity.length}</div>
          <div className="text-xs text-neutral-500 mt-1">Vax Events</div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-4 border-b border-neutral-200 bg-red-50">
          <h3 className="text-base font-bold text-red-900">New Infections — {weekStart} to {weekEnd} ({newInfections.length})</h3>
        </div>
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Resident</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">MRN</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Unit / Room</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Category</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Status</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Isolation</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Onset Date</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-neutral-200">
            {newInfections.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-neutral-400">No new infections in this date range</td></tr>
            )}
            {newInfections.map(({ ip, res }) => (
              <tr key={ip.id}>
                <td className="px-4 py-2 font-medium text-neutral-900">{(res as any)?.displayName || '—'}</td>
                <td className="px-4 py-2 text-neutral-500">{(res as any)?.mrn || '—'}</td>
                <td className="px-4 py-2 text-neutral-500">{ip.locationSnapshot?.unit || (res as any)?.currentUnit || '—'} / {ip.locationSnapshot?.room || (res as any)?.currentRoom || '—'}</td>
                <td className="px-4 py-2 text-neutral-500">{ip.infectionCategory || '—'}</td>
                <td className="px-4 py-2"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ip.status === 'active' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{ip.status}</span></td>
                <td className="px-4 py-2 text-neutral-500">{ip.isolationType || 'None'}</td>
                <td className="px-4 py-2 text-neutral-500">{new Date(ip.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-4 border-b border-neutral-200 bg-amber-50">
          <h3 className="text-base font-bold text-amber-900">New Antibiotic Starts — {weekStart} to {weekEnd} ({newAbts.length})</h3>
        </div>
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Resident</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">MRN</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Unit / Room</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Medication</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Indication</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Category</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Start Date</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-neutral-200">
            {newAbts.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-neutral-400">No new antibiotic courses in this date range</td></tr>
            )}
            {newAbts.map(({ abt, res }) => (
              <tr key={abt.id}>
                <td className="px-4 py-2 font-medium text-neutral-900">{(res as any)?.displayName || '—'}</td>
                <td className="px-4 py-2 text-neutral-500">{(res as any)?.mrn || '—'}</td>
                <td className="px-4 py-2 text-neutral-500">{abt.locationSnapshot?.unit || (res as any)?.currentUnit || '—'} / {abt.locationSnapshot?.room || (res as any)?.currentRoom || '—'}</td>
                <td className="px-4 py-2 text-neutral-500">{abt.medication}</td>
                <td className="px-4 py-2 text-neutral-500">{abt.indication || '—'}</td>
                <td className="px-4 py-2 text-neutral-500">{abt.syndromeCategory || '—'}</td>
                <td className="px-4 py-2 text-neutral-500">{abt.startDate || '—'}</td>
                <td className="px-4 py-2"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${abt.status === 'active' ? 'bg-amber-100 text-amber-800' : abt.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-neutral-100 text-neutral-800'}`}>{abt.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-4 border-b border-neutral-200 bg-blue-50">
          <h3 className="text-base font-bold text-blue-900">Vaccination Activity — {weekStart} to {weekEnd} ({vaxActivity.length})</h3>
        </div>
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Resident</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">MRN</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Vaccine</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Status</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Date Given</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Decline Reason</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-neutral-200">
            {vaxActivity.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-neutral-400">No vaccination activity in this date range</td></tr>
            )}
            {vaxActivity.map(({ vax, res }) => (
              <tr key={vax.id}>
                <td className="px-4 py-2 font-medium text-neutral-900">{(res as any)?.displayName || '—'}</td>
                <td className="px-4 py-2 text-neutral-500">{(res as any)?.mrn || '—'}</td>
                <td className="px-4 py-2 text-neutral-500">{vax.vaccine}</td>
                <td className="px-4 py-2"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${vax.status === 'given' ? 'bg-green-100 text-green-800' : vax.status === 'declined' ? 'bg-red-100 text-red-800' : 'bg-neutral-100 text-neutral-800'}`}>{vax.status}</span></td>
                <td className="px-4 py-2 text-neutral-500">{vax.dateGiven || '—'}</td>
                <td className="px-4 py-2 text-neutral-500">{vax.declineReason || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </>
  );
};

const OnDemandReport: React.FC = () => {
  const { store } = useFacilityData();
  const [dataset, setDataset] = useState<'infections' | 'abts' | 'vax' | 'residents' | string>('infections');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [unitFilter, setUnitFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  type EditModal =
    | { type: 'ip';  recordId: string; residentId: string }
    | { type: 'abt'; recordId: string; residentId: string }
    | { type: 'vax'; recordId: string; residentId: string };

  const [editModal, setEditModal] = useState<EditModal | null>(null);

  const savedTemplates = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('ltc_report_templates') || '[]') as Array<{ id: string; name: string; columns: Array<{ id: string; label: string; fieldPath: string; displayHeader?: string }> }>;
    } catch { return []; }
  }, []);

  const units = useMemo(() => {
    const s = new Set<string>();
    Object.values(store.residents).forEach((r: Resident) => { if (r.currentUnit?.trim()) s.add(r.currentUnit.trim()); });
    return Array.from(s).sort();
  }, [store.residents]);

  /** Parallel meta array: one entry per display row with the IDs needed for edit modals. */
  type RowMeta = { recordId: string; residentId: string } | null;

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
        if (!inRange(ip.createdAt)) return false;
        if (statusFilter !== 'all' && ip.status !== statusFilter) return false;
        const res = getRes(ip.residentRef);
        if (unitFilter !== 'all' && (res as any)?.currentUnit !== unitFilter) return false;
        return true;
      });
      return {
        rows: filtered.map(ip => {
          const res = getRes(ip.residentRef);
          return [
            (res as any)?.displayName || '—',
            (res as any)?.mrn || '—',
            (res as any)?.currentUnit || ip.locationSnapshot?.unit || '—',
            (res as any)?.currentRoom || ip.locationSnapshot?.room || '—',
            ip.infectionCategory || '—',
            ip.infectionSite || '—',
            ip.status,
            ip.isolationType || '—',
            ip.ebp ? 'Yes' : 'No',
            ip.organism || '—',
            new Date(ip.createdAt).toLocaleDateString(),
          ];
        }),
        rowMeta: filtered.map(ip => ({ recordId: ip.id, residentId: ip.residentRef.id }) as RowMeta),
      };
    }
    if (dataset === 'abts') {
      const filtered = (Object.values(store.abts) as ABTCourse[]).filter(a => {
        if (!inRange(a.startDate || a.createdAt)) return false;
        if (statusFilter !== 'all' && a.status !== statusFilter) return false;
        const res = getRes(a.residentRef);
        if (unitFilter !== 'all' && (res as any)?.currentUnit !== unitFilter) return false;
        return true;
      });
      return {
        rows: filtered.map(a => {
          const res = getRes(a.residentRef);
          return [
            (res as any)?.displayName || '—',
            (res as any)?.mrn || '—',
            (res as any)?.currentUnit || a.locationSnapshot?.unit || '—',
            (res as any)?.currentRoom || a.locationSnapshot?.room || '—',
            a.medication,
            a.indication || '—',
            a.syndromeCategory || '—',
            a.status,
            a.startDate || '—',
            a.endDate || '—',
            a.cultureCollected ? 'Yes' : 'No',
          ];
        }),
        rowMeta: filtered.map(a => ({ recordId: a.id, residentId: a.residentRef.id }) as RowMeta),
      };
    }
    if (dataset === 'vax') {
      const filtered = (Object.values(store.vaxEvents) as VaxEvent[]).filter(v => {
        if (!inRange(v.dateGiven || v.createdAt)) return false;
        if (statusFilter !== 'all' && v.status !== statusFilter) return false;
        const res = getRes(v.residentRef);
        if (unitFilter !== 'all' && (res as any)?.currentUnit !== unitFilter) return false;
        return true;
      });
      return {
        rows: filtered.map(v => {
          const res = getRes(v.residentRef);
          return [
            (res as any)?.displayName || '—',
            (res as any)?.mrn || '—',
            (res as any)?.currentUnit || '—',
            (res as any)?.currentRoom || '—',
            v.vaccine,
            v.status,
            v.dateGiven || '—',
            v.declineReason || '—',
            v.dueDate || '—',
          ];
        }),
        rowMeta: filtered.map(v => ({ recordId: v.id, residentId: v.residentRef.id }) as RowMeta),
      };
    }
    // residents (no quick edit)
    const filtered = (Object.values(store.residents) as Resident[]).filter(r => {
      if (!inRange(r.admissionDate || r.createdAt)) return false;
      if (unitFilter !== 'all' && r.currentUnit !== unitFilter) return false;
      return true;
    });
    return {
      rows: filtered.map(r => [
        r.displayName,
        r.mrn,
        r.currentUnit || '—',
        r.currentRoom || '—',
        r.admissionDate || '—',
        r.attendingMD || '—',
        r.status || '—',
      ]),
      rowMeta: filtered.map(() => null as RowMeta),
    };
  }, [dataset, startDate, endDate, unitFilter, statusFilter, store]);

  const HEADERS: Record<string, string[]> = {
    infections: ['Resident', 'MRN', 'Unit', 'Room', 'Category', 'Site', 'Status', 'Isolation', 'EBP', 'Organism', 'Date'],
    abts: ['Resident', 'MRN', 'Unit', 'Room', 'Medication', 'Indication', 'Syndrome', 'Status', 'Start', 'End', 'Culture'],
    vax: ['Resident', 'MRN', 'Unit', 'Room', 'Vaccine', 'Status', 'Date Given', 'Decline Reason', 'Due Date'],
    residents: ['Resident', 'MRN', 'Unit', 'Room', 'Admission Date', 'Attending MD', 'Status'],
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
    vax: ['given', 'declined', 'contraindicated', 'due', 'overdue'],
    residents: [],
  };

  const handleExportCsv = () => {
    const csvContent = [currentHeaders, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${dataset}_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow border border-neutral-200 p-6">
        <h3 className="text-base font-bold text-neutral-900 mb-4">On Demand Report Builder</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1 uppercase">Dataset</label>
            <select value={dataset} onChange={e => { setDataset(e.target.value as any); setStatusFilter('all'); }} className="w-full border border-neutral-300 rounded-md px-2 py-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500">
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
        <div className="flex items-center justify-between">
          <span className="text-sm text-neutral-500">{rows.length} record{rows.length !== 1 ? 's' : ''} found</span>
          <button onClick={handleExportCsv} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium">
            Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
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

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg leading-6 font-medium text-neutral-900">Monthly Analytics</h3>
      </div>
      <div className="border-t border-neutral-200">
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
  )
}

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
      if (inMonth(ip.createdAt)) {
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
      if (inMonth(ip.createdAt)) {
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
    Object.values(store.residents).filter((r: Resident) => r.status === 'Active').length,
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

  const handleExportCsv = () => {
    const rows: string[][] = [];
    rows.push([`QAPI Rollup — ${selectedMonth}`]);
    rows.push([]);
    rows.push(['Infections by Category']);
    rows.push(['Category', 'Count']);
    infectionsByCategory.forEach(([cat, cnt]) => rows.push([cat, String(cnt)]));
    rows.push([]);
    rows.push(['Infections by Unit']);
    rows.push(['Unit', 'Count']);
    infectionsByUnit.forEach(([unit, cnt]) => rows.push([unit, String(cnt)]));
    rows.push([]);
    rows.push(['ABT Use Rate']);
    rows.push(['New ABT Courses (Month)', 'Active Residents', 'Rate per Resident']);
    rows.push([String(abtCount), String(activeResidentCount), activeResidentCount > 0 ? (abtCount / activeResidentCount * 100).toFixed(1) + '%' : 'N/A']);
    rows.push([]);
    rows.push(['Vaccine Coverage (Cumulative)']);
    rows.push(['Vaccine', 'Residents Given', 'Active Census', 'Coverage %']);
    vaccineCoverage.forEach(r => rows.push([r.vaccine, String(r.given), String(r.total), r.pct + '%']));

    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qapi_rollup_${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
        <button
          onClick={handleExportCsv}
          className="ml-auto px-4 py-1.5 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
        >
          Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Infections by Category */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-4 py-4 border-b border-neutral-200 bg-red-50">
            <h3 className="text-base font-bold text-red-900">Infections by Category</h3>
            <p className="text-xs text-red-700 mt-0.5">New infections created in {selectedMonth}</p>
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
          <div className="px-4 py-4 border-b border-neutral-200 bg-amber-50">
            <h3 className="text-base font-bold text-amber-900">Infections by Unit</h3>
            <p className="text-xs text-amber-700 mt-0.5">New infections created in {selectedMonth}</p>
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
        <div className="px-4 py-4 border-b border-neutral-200 bg-emerald-50">
          <h3 className="text-base font-bold text-emerald-900">Antibiotic Use Rate</h3>
          <p className="text-xs text-emerald-700 mt-0.5">New ABT courses started in {selectedMonth}</p>
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
        <div className="px-4 py-4 border-b border-neutral-200 bg-purple-50">
          <h3 className="text-base font-bold text-purple-900">Vaccine Coverage (Cumulative)</h3>
          <p className="text-xs text-purple-700 mt-0.5">% of active residents with at least one "given" record</p>
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
  );
};

export default ReportsConsole;
