import React from 'react';
import { FacilityStore, IPEvent, ABTCourse, Resident, ResidentNote, VaxEvent, ShiftLogEntry } from '../../domain/models';
import { getActiveABT, getAbtDays } from '../../utils/countCardDataHelpers';
import { SYMPTOM_HASHTAG_LIBRARY, getSymptomClassForHashtag } from '../../utils/symptomHashtagLibrary';
import { PdfTemplate, PdfOrientation } from '../../pdf/exportPdf';
import { todayLocalDateInputValue } from '../../lib/dateUtils';

export type FilterType = 'date' | 'dateRange' | 'select' | 'text' | 'boolean';

export interface FilterField {
  id: string;
  label: string;
  type: FilterType;
  options?: { label: string; value: any }[];
  defaultValue?: any;
}

export interface ColumnDefinition<T> {
  id: string;
  header: string;
  accessor: (item: T) => React.ReactNode;
  exportValue?: (item: T) => string;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
}

export interface ReportDefinition<T = any> {
  id: string;
  title: string;
  description?: string;
  category: string;
  route?: string;
  filterSchema?: FilterField[];
  datasetResolver: (store: FacilityStore, filters: any) => T[];
  columns: ColumnDefinition<T>[];
  csvSupport?: boolean;
  printSupport?: boolean;
  pdfTemplateMapping?: {
    template: PdfTemplate;
    orientation: PdfOrientation;
  };
}

const residentLabel = (res: any) => {
  if (!res?.displayName) return '—';
  return (res.backOfficeOnly || res.isHistorical || res.status === 'Discharged') ? `${res.displayName} (Historical)` : res.displayName;
};

export const REPORT_REGISTRY: Record<string, ReportDefinition> = {
  'active-precautions': {
    id: 'active-precautions',
    title: 'Active Precautions Line List',
    description: 'Survey-Ready: Isolation Roster',
    category: 'survey',
    filterSchema: [
      { id: 'reportDate', label: 'Report Date', type: 'date' }
    ],
    datasetResolver: (store, filters) => {
      const reportDateObj = filters.reportDate ? new Date(filters.reportDate + 'T23:59:59') : null;
      return (Object.values(store.infections) as IPEvent[])
        .filter(ip => {
          if (ip.status !== 'active') return false;
          if (!ip.isolationType) return false;
          if (reportDateObj && new Date(ip.createdAt) > reportDateObj) return false;
          return true;
        })
        .map(ip => {
          const res = ip.residentRef.kind === 'mrn' ? store.residents[ip.residentRef.id] : store.quarantine[ip.residentRef.id];
          return { ip, res };
        });
    },
    columns: [
      { id: 'resident', header: 'Resident', accessor: (d) => residentLabel(d.res) },
      { id: 'mrn', header: 'MRN', accessor: (d) => (d.res as any)?.mrn || '—' },
      { id: 'unit', header: 'Unit', accessor: (d) => d.ip.locationSnapshot?.unit || (d.res as any)?.currentUnit || '—' },
      { id: 'room', header: 'Room', accessor: (d) => d.ip.locationSnapshot?.room || (d.res as any)?.currentRoom || '—' },
      { id: 'category', header: 'Category', accessor: (d) => d.ip.infectionCategory || '—' },
      { id: 'isolation', header: 'Isolation Type', accessor: (d) => d.ip.isolationType || '—' },
      { id: 'organism', header: 'Organism', accessor: (d) => d.ip.organism || '—' },
      { id: 'ebp', header: 'EBP', accessor: (d) => d.ip.ebp ? 'Yes' : 'No' },
    ],
    csvSupport: true,
    printSupport: true,
    pdfTemplateMapping: {
      template: 'ACTIVE_PRECAUTIONS_TEMPLATE_V1',
      orientation: 'landscape'
    }
  },
  'active-abts': {
    id: 'active-abts',
    title: 'Active Antibiotic Courses',
    description: 'Survey-Ready: ABT Utilization Roster',
    category: 'survey',
    filterSchema: [
      { id: 'reportDate', label: 'Report Date', type: 'date' }
    ],
    datasetResolver: (store, filters) => {
      const reportDateObj = filters.reportDate ? new Date(filters.reportDate + 'T23:59:59') : null;
      return getActiveABT(Object.values(store.abts) as ABTCourse[])
        .filter(a => {
          if (reportDateObj && a.startDate && new Date(a.startDate) > reportDateObj) return false;
          return true;
        })
        .map(a => {
          const res = a.residentRef.kind === 'mrn' ? store.residents[a.residentRef.id] : store.quarantine[a.residentRef.id];
          return { abt: a, res };
        });
    },
    columns: [
      { id: 'resident', header: 'Resident', accessor: (d) => residentLabel(d.res) },
      { id: 'mrn', header: 'MRN', accessor: (d) => (d.res as any)?.mrn || '—' },
      { id: 'unit', header: 'Unit', accessor: (d) => d.abt.locationSnapshot?.unit || (d.res as any)?.currentUnit || '—' },
      { id: 'room', header: 'Room', accessor: (d) => d.abt.locationSnapshot?.room || (d.res as any)?.currentRoom || '—' },
      { id: 'medication', header: 'Medication', accessor: (d) => {
        const days = getAbtDays(d.abt.startDate, d.abt.endDate);
        return days ? `${d.abt.medication} (Day ${days.current}${days.total ? '/' + days.total : ''})` : d.abt.medication;
      }},
      { id: 'indication', header: 'Indication', accessor: (d) => d.abt.indication || '—' },
      { id: 'startDate', header: 'Start Date', accessor: (d) => d.abt.startDate || '—' },
      { id: 'culture', header: 'Culture', accessor: (d) => d.abt.cultureCollected ? `Yes${d.abt.cultureCollectionDate ? ' (' + d.abt.cultureCollectionDate + ')' : ''}` : 'No' },
    ],
    csvSupport: true,
    printSupport: true,
    pdfTemplateMapping: {
      template: 'LANDSCAPE_TEMPLATE_V1',
      orientation: 'landscape'
    }
  },
  'recent-admissions': {
    id: 'recent-admissions',
    title: 'Recent Admissions (Last 72h)',
    description: 'Admission Screening Due (<72h)',
    category: 'daily',
    filterSchema: [
      { id: 'reportDate', label: 'Report Date', type: 'date', defaultValue: todayLocalDateInputValue() }
    ],
    datasetResolver: (store, filters) => {
      const reportDate = filters.reportDate || todayLocalDateInputValue();
      const reportDateObj = new Date(reportDate + 'T00:00:00');
      const threeDaysBeforeReport = new Date(reportDateObj);
      threeDaysBeforeReport.setDate(threeDaysBeforeReport.getDate() - 3);

      return (Object.values(store.residents) as Resident[])
        .filter(r => !r.isHistorical && !r.backOfficeOnly)
        .filter((r: Resident) => r.admissionDate && new Date(r.admissionDate) > threeDaysBeforeReport && new Date(r.admissionDate) <= reportDateObj)
        .map((r: Resident) => {
          const hasScreening = (Object.values(store.notes) as ResidentNote[]).some(n =>
            n.residentRef.kind === 'mrn' && n.residentRef.id === r.mrn && n.title?.includes('Admission Screening')
          );
          return { res: r, hasScreening };
        })
        .sort((a, b) => (a.res.admissionDate || '').localeCompare(b.res.admissionDate || ''));
    },
    columns: [
      { id: 'resident', header: 'Resident', accessor: (d) => d.res.displayName },
      { id: 'mrn', header: 'MRN', accessor: (d) => d.res.mrn },
      { id: 'admissionDate', header: 'Admission Date', accessor: (d) => d.res.admissionDate || '—' },
      { id: 'unit', header: 'Unit', accessor: (d) => d.res.currentUnit || '—' },
      { id: 'room', header: 'Room', accessor: (d) => d.res.currentRoom || '—' },
      { id: 'screening', header: 'Screening', accessor: (d) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${d.hasScreening ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {d.hasScreening ? 'Done' : 'Pending'}
        </span>
      ), exportValue: (d) => d.hasScreening ? 'Done' : 'Pending' },
    ],
    csvSupport: true,
    printSupport: true,
    pdfTemplateMapping: {
      template: 'PORTRAIT_TEMPLATE_V1',
      orientation: 'portrait'
    }
  },
  'new-infections': {
    id: 'new-infections',
    title: 'New Infections',
    description: 'Infection events within selected period',
    category: 'weekly',
    filterSchema: [
      { id: 'startDate', label: 'Start Date', type: 'date' },
      { id: 'endDate', label: 'End Date', type: 'date' }
    ],
    datasetResolver: (store, filters) => {
      const start = filters.startDate ? new Date(filters.startDate + 'T00:00:00') : new Date(0);
      const end = filters.endDate ? new Date(filters.endDate + 'T23:59:59') : new Date();

      return (Object.values(store.infections) as IPEvent[])
        .filter(ip => {
          const d = new Date(ip.onsetDate || ip.createdAt);
          return d >= start && d <= end;
        })
        .map(ip => {
          const res = ip.residentRef.kind === 'mrn' ? store.residents[ip.residentRef.id] : store.quarantine[ip.residentRef.id];
          return { ip, res };
        })
        .sort((a, b) => (b.ip.onsetDate || b.ip.createdAt).localeCompare(a.ip.onsetDate || a.ip.createdAt));
    },
    columns: [
      { id: 'resident', header: 'Resident', accessor: (d) => residentLabel(d.res) },
      { id: 'mrn', header: 'MRN', accessor: (d) => (d.res as any)?.mrn || '—' },
      { id: 'date', header: 'Onset/Start', accessor: (d) => d.ip.onsetDate || d.ip.createdAt.split('T')[0] },
      { id: 'category', header: 'Category', accessor: (d) => d.ip.infectionCategory || '—' },
      { id: 'isolation', header: 'Isolation', accessor: (d) => d.ip.isolationType || '—' },
      { id: 'status', header: 'Status', accessor: (d) => d.ip.status },
    ],
    csvSupport: true,
    printSupport: true,
    pdfTemplateMapping: {
      template: 'LANDSCAPE_TEMPLATE_V1',
      orientation: 'landscape'
    }
  },
  'new-abts': {
    id: 'new-abts',
    title: 'New ABT Courses',
    description: 'Antibiotic courses started within selected period',
    category: 'weekly',
    filterSchema: [
      { id: 'startDate', label: 'Start Date', type: 'date' },
      { id: 'endDate', label: 'End Date', type: 'date' }
    ],
    datasetResolver: (store, filters) => {
      const start = filters.startDate ? new Date(filters.startDate + 'T00:00:00') : new Date(0);
      const end = filters.endDate ? new Date(filters.endDate + 'T23:59:59') : new Date();

      return (Object.values(store.abts) as ABTCourse[])
        .filter(a => {
          const d = new Date(a.startDate || a.createdAt);
          return d >= start && d <= end;
        })
        .map(a => {
          const res = a.residentRef.kind === 'mrn' ? store.residents[a.residentRef.id] : store.quarantine[a.residentRef.id];
          return { abt: a, res };
        })
        .sort((a, b) => (b.abt.startDate || '').localeCompare(a.abt.startDate || ''));
    },
    columns: [
      { id: 'resident', header: 'Resident', accessor: (d) => residentLabel(d.res) },
      { id: 'mrn', header: 'MRN', accessor: (d) => (d.res as any)?.mrn || '—' },
      { id: 'medication', header: 'Medication', accessor: (d) => d.abt.medication },
      { id: 'indication', header: 'Indication', accessor: (d) => d.abt.indication || '—' },
      { id: 'startDate', header: 'Start Date', accessor: (d) => d.abt.startDate || '—' },
      { id: 'status', header: 'Status', accessor: (d) => d.abt.status },
    ],
    csvSupport: true,
    printSupport: true,
    pdfTemplateMapping: {
      template: 'LANDSCAPE_TEMPLATE_V1',
      orientation: 'landscape'
    }
  },
  'vax-activity': {
    id: 'vax-activity',
    title: 'Vaccination Activity',
    description: 'Vaccines administered within selected period',
    category: 'weekly',
    filterSchema: [
      { id: 'startDate', label: 'Start Date', type: 'date' },
      { id: 'endDate', label: 'End Date', type: 'date' }
    ],
    datasetResolver: (store, filters) => {
      const start = filters.startDate ? new Date(filters.startDate + 'T00:00:00') : new Date(0);
      const end = filters.endDate ? new Date(filters.endDate + 'T23:59:59') : new Date();

      return (Object.values(store.vaxEvents) as VaxEvent[])
        .filter(v => {
          const d = new Date(v.administeredDate || v.dateGiven || v.createdAt);
          return d >= start && d <= end;
        })
        .map(v => {
          const res = v.residentRef.kind === 'mrn' ? store.residents[v.residentRef.id] : store.quarantine[v.residentRef.id];
          return { vax: v, res };
        })
        .sort((a, b) => (b.vax.administeredDate || b.vax.dateGiven || b.vax.createdAt).localeCompare(a.vax.administeredDate || a.vax.dateGiven || a.vax.createdAt));
    },
    columns: [
      { id: 'resident', header: 'Resident', accessor: (d) => residentLabel(d.res) },
      { id: 'mrn', header: 'MRN', accessor: (d) => (d.res as any)?.mrn || '—' },
      { id: 'vaxType', header: 'Vaccine', accessor: (d) => d.vax.vaccine },
      { id: 'date', header: 'Date Given', accessor: (d) => d.vax.administeredDate || d.vax.dateGiven || '—' },
      { id: 'dose', header: 'Dose', accessor: (d) => d.vax.dose || '—' },
      { id: 'status', header: 'Status', accessor: (d) => d.vax.status },
    ],
    csvSupport: true,
    printSupport: true,
    pdfTemplateMapping: {
      template: 'LANDSCAPE_TEMPLATE_V1',
      orientation: 'landscape'
    }
  },
  'combined-line-list': {
    id: 'combined-line-list',
    title: 'Respiratory / GI Line List',
    description: 'De-duplicated by resident — Respiratory & GI infections with active or recent ABT',
    category: 'clinical',
    datasetResolver: (store) => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const RESPIRATORY_PATTERN = /pneumonia|influenza|covid|rsv|respiratory|\buri\b|\burti\b|\blrti\b|bronchitis|pertussis|tuberculosis|\btb\b/;
      const GI_PATTERN = /norovirus|c\.?\s*diff|cdiff|cdx|gastroenteritis|\bgi\b|gastrointestinal|diarrhea|vomiting|rotavirus|salmonella|e\.?\s*coli/;
      const isRespiratoryOrGI = (text?: string): boolean => {
        if (!text) return false;
        const lower = text.toLowerCase();
        return RESPIRATORY_PATTERN.test(lower) || GI_PATTERN.test(lower);
      };

      const joinInfectionField = (infections: IPEvent[], fn: (i: IPEvent) => string | undefined) =>
        infections.map(fn).filter(Boolean).join(', ') || '-';

      const activeInfections = (Object.values(store.infections) as IPEvent[]).filter(ip =>
        ip.status === 'active' && isRespiratoryOrGI(ip.infectionCategory)
      );
      const relevantAbts = (Object.values(store.abts) as ABTCourse[]).filter(abt => {
        const hasRespOrGI = isRespiratoryOrGI(abt.syndromeCategory) || isRespiratoryOrGI(abt.indication);
        if (!hasRespOrGI) return false;
        if (abt.status === 'active') return true;
        if (abt.status === 'completed' && abt.endDate && new Date(abt.endDate) >= sevenDaysAgo) return true;
        return false;
      });

      const map = new Map<string, {
        res: any;
        infections: IPEvent[];
        abts: ABTCourse[];
      }>();

      const getRes = (ref: any) => ref.kind === 'mrn' ? store.residents[ref.id] : store.quarantine[ref.id];

      activeInfections.forEach(ip => {
        const res = getRes(ip.residentRef);
        if (!res) return;
        const key = (res as any).mrn || (res as any).tempId;
        if (!map.has(key)) {
          map.set(key, { res, infections: [], abts: [] });
        }
        map.get(key)!.infections.push(ip);
      });

      relevantAbts.forEach(abt => {
        const res = getRes(abt.residentRef);
        if (!res) return;
        const key = (res as any).mrn || (res as any).tempId;
        if (!map.has(key)) {
          map.set(key, { res, infections: [], abts: [] });
        }
        map.get(key)!.abts.push(abt);
      });

      return Array.from(map.values()).map(({ res, infections, abts }) => ({
        resident: residentLabel(res),
        mrn: (res as any).mrn || (res as any).tempId || '-',
        unitRoom: `${(res as any).currentUnit || (res as any).unitSnapshot || '-'} / ${(res as any).currentRoom || (res as any).roomSnapshot || '-'}`,
        infections: joinInfectionField(infections, i => i.infectionCategory),
        isolationTypes: joinInfectionField(infections, i => i.isolationType),
        organisms: joinInfectionField(infections, i => i.organism),
        onsetDates: joinInfectionField(infections, i => i.onsetDate),
        abts: abts.map(a => {
          const days = getAbtDays(a.startDate, a.endDate);
          return days ? `${a.medication} (Day ${days.current}${days.total ? '/' + days.total : ''})` : a.medication;
        }).join(', '),
        abtStartDates: abts.map(a => a.startDate || '').filter(Boolean).join(', ') || '-',
        cultureCollected: abts.length > 0
          ? (abts.some(a => a.cultureCollected) ? 'Yes' : 'No')
          : '-',
      }));
    },
    columns: [
      { id: 'resident', header: 'Resident', accessor: (d) => d.resident },
      { id: 'mrn', header: 'MRN', accessor: (d) => d.mrn },
      { id: 'unitRoom', header: 'Unit/Room', accessor: (d) => d.unitRoom },
      { id: 'infections', header: 'Infection(s)', accessor: (d) => d.infections },
      { id: 'isolationTypes', header: 'Isolation', accessor: (d) => d.isolationTypes },
      { id: 'organisms', header: 'Organism(s)', accessor: (d) => d.organisms },
      { id: 'onsetDates', header: 'Onset Date(s)', accessor: (d) => d.onsetDates },
      { id: 'abts', header: 'ABT(s)', headerClassName: 'w-48', accessor: (d) => d.abts },
      { id: 'abtStartDates', header: 'ABT Start', accessor: (d) => d.abtStartDates },
      { id: 'cultureCollected', header: 'Culture', accessor: (d) => d.cultureCollected },
    ],
    csvSupport: true,
    printSupport: true,
    pdfTemplateMapping: {
      template: 'LANDSCAPE_TEMPLATE_V1',
      orientation: 'landscape'
    }
  },
  'mdro-tracking': {
    id: 'mdro-tracking',
    title: 'MDRO Tracking',
    description: 'Line list of residents with Multi-Drug Resistant Organisms',
    category: 'clinical',
    filterSchema: [
      { id: 'status', label: 'Status', type: 'select', options: [
        { label: 'Active', value: 'active' },
        { label: 'Resolved', value: 'resolved' },
        { label: 'Historical', value: 'historical' },
      ], defaultValue: 'active' }
    ],
    datasetResolver: (store, filters) => {
      const statusFilter = filters.status || 'active';
      const mdroList = ['MRSA', 'VRE', 'C. diff', 'CRE', 'ESBL', 'Acinetobacter', 'Candida auris'];
      
      return (Object.values(store.infections) as IPEvent[])
        .filter(ip => {
          if (statusFilter !== 'all' && ip.status !== statusFilter) return false;
          if (!ip.organism) return false;
          
          // Check if organism is an MDRO
          return mdroList.some(mdro => ip.organism?.toLowerCase().includes(mdro.toLowerCase()));
        })
        .map(ip => {
          const res = ip.residentRef.kind === 'mrn' ? store.residents[ip.residentRef.id] : store.quarantine[ip.residentRef.id];
          return { ip, res };
        })
        .sort((a, b) => (b.ip.onsetDate || b.ip.createdAt).localeCompare(a.ip.onsetDate || a.ip.createdAt));
    },
    columns: [
      { id: 'resident', header: 'Resident', accessor: (d) => residentLabel(d.res) },
      { id: 'mrn', header: 'MRN', accessor: (d) => (d.res as any)?.mrn || '—' },
      { id: 'unit', header: 'Unit', accessor: (d) => d.ip.locationSnapshot?.unit || (d.res as any)?.currentUnit || '—' },
      { id: 'room', header: 'Room', accessor: (d) => d.ip.locationSnapshot?.room || (d.res as any)?.currentRoom || '—' },
      { id: 'organism', header: 'MDRO Organism', accessor: (d) => d.ip.organism || '—' },
      { id: 'site', header: 'Site', accessor: (d) => d.ip.infectionSite || '—' },
      { id: 'isolation', header: 'Isolation', accessor: (d) => d.ip.isolationType || '—' },
      { id: 'date', header: 'Onset Date', accessor: (d) => d.ip.onsetDate || d.ip.createdAt.split('T')[0] },
    ],
    csvSupport: true,
    printSupport: true,
    pdfTemplateMapping: {
      template: 'LANDSCAPE_TEMPLATE_V1',
      orientation: 'landscape'
    }
  },
  'device-associated': {
    id: 'device-associated',
    title: 'Device-Associated Infections',
    description: 'Infections linked to clinical devices (CAUTI, CLABSI, VAP)',
    category: 'clinical',
    filterSchema: [
      { id: 'startDate', label: 'Start Date', type: 'date' },
      { id: 'endDate', label: 'End Date', type: 'date' }
    ],
    datasetResolver: (store, filters) => {
      const start = filters.startDate ? new Date(filters.startDate + 'T00:00:00') : new Date(0);
      const end = filters.endDate ? new Date(filters.endDate + 'T23:59:59') : new Date();
      
      const deviceInfections = ['CAUTI', 'CLABSI', 'VAP'];

      return (Object.values(store.infections) as IPEvent[])
        .filter(ip => {
          const d = new Date(ip.onsetDate || ip.createdAt);
          if (d < start || d > end) return false;
          
          return deviceInfections.includes(ip.infectionCategory || '');
        })
        .map(ip => {
          const res = ip.residentRef.kind === 'mrn' ? store.residents[ip.residentRef.id] : store.quarantine[ip.residentRef.id];
          return { ip, res };
        })
        .sort((a, b) => (b.ip.onsetDate || b.ip.createdAt).localeCompare(a.ip.onsetDate || a.ip.createdAt));
    },
    columns: [
      { id: 'resident', header: 'Resident', accessor: (d) => residentLabel(d.res) },
      { id: 'mrn', header: 'MRN', accessor: (d) => (d.res as any)?.mrn || '—' },
      { id: 'unit', header: 'Unit', accessor: (d) => d.ip.locationSnapshot?.unit || (d.res as any)?.currentUnit || '—' },
      { id: 'category', header: 'Infection Type', accessor: (d) => d.ip.infectionCategory || '—' },
      { id: 'organism', header: 'Organism', accessor: (d) => d.ip.organism || '—' },
      { id: 'date', header: 'Onset Date', accessor: (d) => d.ip.onsetDate || d.ip.createdAt.split('T')[0] },
      { id: 'status', header: 'Status', accessor: (d) => d.ip.status },
    ],
    csvSupport: true,
    printSupport: true,
    pdfTemplateMapping: {
      template: 'LANDSCAPE_TEMPLATE_V1',
      orientation: 'landscape'
    }
  },
  'infection-types': {
    id: 'infection-types',
    title: 'Infection Types Summary',
    description: 'Summary of infections by category',
    category: 'clinical',
    filterSchema: [
      { id: 'startDate', label: 'Start Date', type: 'date' },
      { id: 'endDate', label: 'End Date', type: 'date' }
    ],
    datasetResolver: (store, filters) => {
      const start = filters.startDate ? new Date(filters.startDate + 'T00:00:00') : new Date(0);
      const end = filters.endDate ? new Date(filters.endDate + 'T23:59:59') : new Date();

      const counts: Record<string, { category: string; active: number; resolved: number; total: number }> = {};

      (Object.values(store.infections) as IPEvent[]).forEach(ip => {
        const d = new Date(ip.onsetDate || ip.createdAt);
        if (d >= start && d <= end) {
          const cat = ip.infectionCategory || 'Unknown';
          if (!counts[cat]) {
            counts[cat] = { category: cat, active: 0, resolved: 0, total: 0 };
          }
          counts[cat].total++;
          if (ip.status === 'active') counts[cat].active++;
          if (ip.status === 'resolved' || ip.status === 'historical') counts[cat].resolved++;
        }
      });

      return Object.values(counts).sort((a, b) => b.total - a.total);
    },
    columns: [
      { id: 'category', header: 'Infection Category', accessor: (d) => d.category },
      { id: 'active', header: 'Active Cases', accessor: (d) => d.active },
      { id: 'resolved', header: 'Resolved Cases', accessor: (d) => d.resolved },
      { id: 'total', header: 'Total Cases', accessor: (d) => d.total },
    ],
    csvSupport: true,
    printSupport: true,
    pdfTemplateMapping: {
      template: 'PORTRAIT_TEMPLATE_V1',
      orientation: 'portrait'
    }
  },
  'top-antibiotics': {
    id: 'top-antibiotics',
    title: 'Top Antibiotics Utilization',
    description: 'Summary of antibiotic usage by medication',
    category: 'clinical',
    filterSchema: [
      { id: 'startDate', label: 'Start Date', type: 'date' },
      { id: 'endDate', label: 'End Date', type: 'date' }
    ],
    datasetResolver: (store, filters) => {
      const start = filters.startDate ? new Date(filters.startDate + 'T00:00:00') : new Date(0);
      const end = filters.endDate ? new Date(filters.endDate + 'T23:59:59') : new Date();

      const counts: Record<string, { medication: string; active: number; completed: number; total: number }> = {};

      (Object.values(store.abts) as ABTCourse[]).forEach(abt => {
        const d = new Date(abt.startDate || abt.createdAt);
        if (d >= start && d <= end) {
          const med = abt.medication || 'Unknown';
          if (!counts[med]) {
            counts[med] = { medication: med, active: 0, completed: 0, total: 0 };
          }
          counts[med].total++;
          if (abt.status === 'active') counts[med].active++;
          if (abt.status === 'completed' || abt.status === 'discontinued') counts[med].completed++;
        }
      });

      return Object.values(counts).sort((a, b) => b.total - a.total);
    },
    columns: [
      { id: 'medication', header: 'Medication', accessor: (d) => d.medication },
      { id: 'active', header: 'Active Courses', accessor: (d) => d.active },
      { id: 'completed', header: 'Completed/Discontinued', accessor: (d) => d.completed },
      { id: 'total', header: 'Total Courses', accessor: (d) => d.total },
    ],
    csvSupport: true,
    printSupport: true,
    pdfTemplateMapping: {
      template: 'PORTRAIT_TEMPLATE_V1',
      orientation: 'portrait'
    }
  },
  'symptom-watch': {
    id: 'symptom-watch',
    title: 'Symptom Watch & Hashtag Report',
    description: 'Review detected hashtags from clinical notes and shift logs.',
    category: 'clinical',
    filterSchema: [
      { id: 'filterDays', label: 'Period', type: 'select', options: [
        { label: 'Last 24 Hours', value: 1 },
        { label: 'Last 3 Days', value: 3 },
        { label: 'Last 7 Days', value: 7 },
        { label: 'Last 14 Days', value: 14 },
        { label: 'Last 30 Days', value: 30 },
      ], defaultValue: 7 },
      { id: 'filterType', label: 'Source', type: 'select', options: [
        { label: 'All Sources', value: 'all' },
        { label: 'Clinical Notes', value: 'notes' },
        { label: 'Shift Logs', value: 'shiftlog' },
      ], defaultValue: 'all' },
    ],
    datasetResolver: (store, filters) => {
      const filterDays = filters.filterDays || 7;
      const filterType = filters.filterType || 'all';
      const allHashtags = SYMPTOM_HASHTAG_LIBRARY.map(h => h.hashtag.toLowerCase());
      const now = new Date();
      const cutoffDate = new Date(now.getTime() - filterDays * 24 * 60 * 60 * 1000);
      const data: any[] = [];

      // Process Notes
      if (filterType === 'all' || filterType === 'notes') {
        Object.values(store.notes || {}).forEach((note: ResidentNote) => {
          const noteDate = new Date(note.createdAt);
          if (noteDate < cutoffDate) return;

          const lowerBody = note.body?.toLowerCase() || '';
          const words = lowerBody.split(/\s+/);
          const foundTags = new Set<string>();
          
          for (const word of words) {
            const cleanWord = word.replace(/[.,!?;:]+$/, '');
            if (allHashtags.includes(cleanWord) || cleanWord.startsWith('#')) {
               foundTags.add(cleanWord);
            }
          }

          if (foundTags.size > 0) {
            const res = note.residentRef?.id ? store.residents?.[note.residentRef.id] : null;
            const symptomClasses = Array.from(foundTags).map(tag => getSymptomClassForHashtag(tag)).filter(Boolean);
            const uniqueClasses = Array.from(new Set(symptomClasses));

            data.push({
              id: note.id,
              date: note.createdAt,
              type: 'Note',
              residentName: res?.displayName || 'Unknown',
              unit: res?.currentUnit || 'Unknown',
              room: res?.currentRoom || 'Unknown',
              content: note.body,
              hashtags: Array.from(foundTags),
              symptomClass: uniqueClasses.join(', ') || 'Unknown',
            });
          }
        });
      }

      // Process Shift Logs
      if (filterType === 'all' || filterType === 'shiftlog') {
        Object.values(store.shiftLog || {}).forEach((log: ShiftLogEntry) => {
          const logDate = new Date(log.createdAtISO);
          if (logDate < cutoffDate) return;

          if (log.autoGenerated && log.sourceResidentHashtag) {
            const resName = log.residentRefs?.[0]?.name || 'Unknown';
            const symptomClass = getSymptomClassForHashtag(log.sourceResidentHashtag) || 'Unknown';
            
            data.push({
              id: log.id,
              date: log.createdAtISO,
              type: 'Shift Log',
              residentName: resName,
              unit: log.unit || 'Unknown',
              room: '—',
              content: log.body,
              hashtags: [log.sourceResidentHashtag],
              symptomClass,
            });
          }
        });
      }

      return data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },
    columns: [
      { id: 'date', header: 'Date', accessor: (d) => new Date(d.date).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) },
      { id: 'type', header: 'Source', accessor: (d) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${d.type === 'Note' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
          {d.type}
        </span>
      ), exportValue: (d) => d.type },
      { id: 'resident', header: 'Resident', accessor: (d) => d.residentName },
      { id: 'location', header: 'Location', accessor: (d) => `${d.unit} ${d.room !== '—' ? '/ ' + d.room : ''}` },
      { id: 'hashtags', header: 'Hashtags', accessor: (d) => (
        <div className="flex flex-wrap gap-1">
          {d.hashtags.map((tag: string, i: number) => (
            <span key={i} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">
              {tag}
            </span>
          ))}
        </div>
      ), exportValue: (d) => d.hashtags.join(', ') },
      { id: 'class', header: 'Class', accessor: (d) => d.symptomClass !== 'Unknown' ? (
        <span className="px-2 py-1 bg-neutral-100 text-neutral-700 rounded text-xs font-medium uppercase">
          {d.symptomClass}
        </span>
      ) : '—', exportValue: (d) => d.symptomClass },
      { id: 'content', header: 'Content Snippet', accessor: (d) => <div className="line-clamp-2" title={d.content}>{d.content}</div> },
    ],
    csvSupport: true,
    printSupport: true,
    pdfTemplateMapping: {
      template: 'LANDSCAPE_TEMPLATE_V1',
      orientation: 'landscape'
    }
  }
};

export function registerReport<T>(report: ReportDefinition<T>) {
  REPORT_REGISTRY[report.id] = report;
}
