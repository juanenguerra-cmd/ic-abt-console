import React, { useEffect, useMemo } from 'react';
import { useFacilityData } from '../../app/providers';
import type { SymptomClass, LineListEvent, ABTCourse, VaxEvent } from '../../domain/models';
import { formatDate, computeAge } from './lineListUtils';
import { usePrint } from '../../print/usePrint';

interface Props {
  tab: SymptomClass;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  unit: string;
  facilityName: string;
  facilityId: string;
  onClose: () => void;
}

// ─── Shared cell styles ──────────────────────────────────────────────────────

const thBase: React.CSSProperties = {
  border: '1px solid #000',
  padding: '2px',
  textAlign: 'center',
  backgroundColor: '#f0f0f0',
  fontFamily: 'Arial, sans-serif',
};

const thRot: React.CSSProperties = {
  ...thBase,
  writingMode: 'vertical-rl' as const,
  transform: 'rotate(180deg)',
  whiteSpace: 'nowrap',
  height: '55px',
  fontSize: '6pt',
};

const td: React.CSSProperties = {
  border: '1px solid #000',
  padding: '2px',
  textAlign: 'center',
  height: '20px',
  fontSize: '7pt',
  fontFamily: 'Arial, sans-serif',
};

const tdL: React.CSSProperties = { ...td, textAlign: 'left' };

// ─── Shared sub-components ───────────────────────────────────────────────────

function PageHeader({
  title,
  page,
  facilityName,
  dateRange,
  colSpan,
  extra,
}: {
  title: string;
  page: string;
  facilityName: string;
  dateRange: string;
  colSpan: number;
  extra?: React.ReactNode;
}) {
  return (
    <table
      style={{
        borderCollapse: 'collapse',
        width: '100%',
        fontFamily: 'Arial, sans-serif',
        fontSize: '8pt',
        marginBottom: '4px',
      }}
    >
      <tbody>
        <tr>
          <td
            style={{
              border: '1px solid #000',
              padding: '3px 6px',
              fontWeight: 700,
              fontSize: '10pt',
              textAlign: 'center',
            }}
            colSpan={colSpan}
          >
            {title}{' '}
            <span style={{ fontWeight: 400, fontSize: '8pt' }}>— {page}</span>
          </td>
        </tr>
        <tr>
          <td
            style={{ border: '1px solid #000', padding: '3px 6px' }}
            colSpan={Math.floor(colSpan / 2)}
          >
            <strong>Facility:</strong> {facilityName}
          </td>
          <td
            style={{ border: '1px solid #000', padding: '3px 6px' }}
            colSpan={colSpan - Math.floor(colSpan / 2)}
          >
            <strong>Date Range:</strong> {dateRange}
          </td>
        </tr>
        {extra}
      </tbody>
    </table>
  );
}

function SignatureFooter() {
  return (
    <footer style={{ marginTop: '12px', fontFamily: 'Arial, sans-serif', fontSize: '8pt' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          columnGap: '48px',
          rowGap: '12px',
          marginBottom: '8px',
        }}
      >
        {[
          ['Prepared by:', ''],
          ['Title:', ''],
          ['Signature:', ''],
          ['Date / Time:', ''],
        ].map(([label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
            <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{label}</span>
            <span
              style={{
                flex: 1,
                borderBottom: '1px solid #000',
                display: 'inline-block',
                minWidth: '120px',
              }}
            />
          </div>
        ))}
      </div>
      <p
        style={{
          fontSize: '7pt',
          fontStyle: 'italic',
          borderTop: '1px solid #000',
          paddingTop: '4px',
          margin: 0,
        }}
      >
        Confidential – PHI – Do Not Distribute
      </p>
    </footer>
  );
}

// ─── ILI print (2 pages) ──────────────────────────────────────────────────────

interface ILIRow {
  room: string;
  age: string;
  name: string;
  sex: string;
  fluVax: string;
  pneuVax: string;
  onsetDate: string;
  fever: string;
  symptoms: string[];
  abt: string;
}

function ILIPrintPages({
  rows,
  facilityName,
  dateRange,
}: {
  rows: (ILIRow | null)[];
  facilityName: string;
  dateRange: string;
}) {
  return (
    <>
      {/* ── Page 1: Resident info + predisposing factors ── */}
      <div className="form-page" style={{ pageBreakAfter: 'always' }}>
        <PageHeader
          title="INFLUENZA-LIKE ILLNESS LINE LIST"
          page="Page 1 of 2 — Resident Info &amp; Predisposing Factors"
          facilityName={facilityName}
          dateRange={dateRange}
          colSpan={17}
        />
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '7pt' }}>
          <thead>
            <tr>
              <th style={{ ...thBase, fontSize: '6pt' }} rowSpan={2}>Rm</th>
              <th style={{ ...thBase, fontSize: '6pt' }} rowSpan={2}>Age</th>
              <th style={{ ...thBase, fontSize: '6pt' }} rowSpan={2}>Resident Name</th>
              <th style={thBase} colSpan={2}>Sex</th>
              <th style={thBase} colSpan={2}>Influenza Vax</th>
              <th style={thBase} colSpan={2}>Pneum. Vax</th>
              <th style={thBase} colSpan={7}>Predisposing Factors</th>
              <th style={{ ...thBase, fontSize: '6pt' }} rowSpan={2}>Date of Onset</th>
            </tr>
            <tr>
              <th style={thRot}>M</th>
              <th style={thRot}>F</th>
              <th style={thRot}>Y</th>
              <th style={thRot}>N</th>
              <th style={thRot}>Y</th>
              <th style={thRot}>N</th>
              <th style={thRot}>CVD</th>
              <th style={thRot}>COPD</th>
              <th style={thRot}>DM</th>
              <th style={thRot}>Anemia</th>
              <th style={thRot}>Renal</th>
              <th style={thRot}>CA</th>
              <th style={thRot}>Steroids</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td style={td}>{row?.room}</td>
                <td style={td}>{row?.age}</td>
                <td style={tdL}>{row?.name}</td>
                <td style={td}>{row?.sex === 'M' ? '●' : ''}</td>
                <td style={td}>{row?.sex === 'F' ? '●' : ''}</td>
                <td style={td}>{row?.fluVax === 'Y' ? '●' : ''}</td>
                <td style={td}>{row?.fluVax === 'N' ? '●' : ''}</td>
                <td style={td}>{row?.pneuVax === 'Y' ? '●' : ''}</td>
                <td style={td}>{row?.pneuVax === 'N' ? '●' : ''}</td>
                {/* Predisposing factors — blank for manual entry */}
                <td style={td} /><td style={td} /><td style={td} />
                <td style={td} /><td style={td} /><td style={td} /><td style={td} />
                <td style={td}>{row?.onsetDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <SignatureFooter />
      </div>

      {/* ── Page 2: Symptoms + outcomes ── */}
      <div className="form-page" style={{ pageBreakAfter: 'avoid' }}>
        <PageHeader
          title="INFLUENZA-LIKE ILLNESS LINE LIST"
          page="Page 2 of 2 — Symptoms &amp; Outcomes"
          facilityName={facilityName}
          dateRange={dateRange}
          colSpan={17}
        />
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '7pt' }}>
          <thead>
            <tr>
              <th style={{ ...thBase, fontSize: '6pt' }} rowSpan={2}>Rm</th>
              <th style={{ ...thBase, fontSize: '6pt' }} rowSpan={2}>Resident Name</th>
              <th style={{ ...thBase, fontSize: '6pt' }} rowSpan={2}>Date of Onset</th>
              <th style={thBase} colSpan={6}>Symptoms</th>
              <th style={{ ...thBase, fontSize: '6pt' }} rowSpan={2}>Duration of Fever</th>
              <th style={{ ...thBase, fontSize: '6pt' }} rowSpan={2}>Hosp. Date</th>
              <th style={{ ...thBase, fontSize: '6pt' }} rowSpan={2}>Date Died</th>
              <th style={{ ...thBase, fontSize: '6pt' }} rowSpan={2}>Lab Results</th>
              <th style={{ ...thBase, fontSize: '6pt' }} rowSpan={2}>Antibiotic</th>
              <th style={{ ...thBase, fontSize: '6pt' }} rowSpan={2}>X-Ray</th>
              <th style={{ ...thBase, fontSize: '6pt' }} rowSpan={2}>Pneumonia</th>
            </tr>
            <tr>
              <th style={thRot}>Highest Temp</th>
              <th style={thRot}>Cough</th>
              <th style={thRot}>Congestion</th>
              <th style={thRot}>Pharyngitis</th>
              <th style={thRot}>Rhinitis</th>
              <th style={thRot}>Body Aches</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td style={td}>{row?.room}</td>
                <td style={tdL}>{row?.name}</td>
                <td style={td}>{row?.onsetDate}</td>
                <td style={td}>{row?.fever === 'Y' || row?.symptoms.includes('fever') ? '●' : ''}</td>
                <td style={td}>{row?.symptoms.includes('cough') ? '●' : ''}</td>
                <td style={td}>{row?.symptoms.includes('congestion') ? '●' : ''}</td>
                <td style={td}>{row?.symptoms.includes('sore_throat') ? '●' : ''}</td>
                <td style={td}>{row?.symptoms.includes('runny_nose') ? '●' : ''}</td>
                <td style={td}>{row?.symptoms.includes('body_aches') ? '●' : ''}</td>
                {/* Manual-entry blanks */}
                <td style={td} /><td style={td} /><td style={td} />
                <td style={td} />
                <td style={tdL}>{row?.abt}</td>
                <td style={td} /><td style={td} />
              </tr>
            ))}
          </tbody>
        </table>
        <SignatureFooter />
      </div>
    </>
  );
}

// ─── GI print (2 pages) ──────────────────────────────────────────────────────

interface GIRow {
  initials: string;
  unit: string;
  room: string;
  onsetDate: string;
  fever: string;
  symptoms: string[];
  providerNotified: string;
  abt: string;
  testOrdered: string;
}

function GIPrintPages({
  rows,
  facilityName,
  dateRange,
}: {
  rows: (GIRow | null)[];
  facilityName: string;
  dateRange: string;
}) {
  return (
    <>
      {/* ── Page 1: Identity + severity ── */}
      <div className="form-page" style={{ pageBreakAfter: 'always' }}>
        <PageHeader
          title="GASTROENTERITIS LINE LIST"
          page="Page 1 of 2 — Identity &amp; Severity"
          facilityName={facilityName}
          dateRange={dateRange}
          colSpan={16}
        />
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '7pt' }}>
          <thead>
            <tr>
              <th style={{ ...thBase, fontSize: '6pt' }} rowSpan={2}>Case Initials</th>
              <th style={{ ...thBase, fontSize: '6pt' }} rowSpan={2}>Unit</th>
              <th style={{ ...thBase, fontSize: '6pt' }} rowSpan={2}>Room #</th>
              <th style={{ ...thBase, fontSize: '6pt' }} rowSpan={2}>Symptom Onset Date</th>
              <th style={thBase} colSpan={12}>Severity</th>
            </tr>
            <tr>
              <th style={thRot}>Fever°</th>
              <th style={thRot}>Tmax</th>
              <th style={thRot}>Nausea</th>
              <th style={thRot}>Vomiting</th>
              <th style={thRot}>Diarrhea</th>
              <th style={thRot}>Abd. Cramps</th>
              <th style={thRot}>Duration</th>
              <th style={thRot}>Physician Seen</th>
              <th style={thRot}>Hospitalized</th>
              <th style={thRot}>Hospital Name</th>
              <th style={thRot}>Died</th>
              <th style={thRot}>Date of Death</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td style={td}>{row?.initials}</td>
                <td style={td}>{row?.unit}</td>
                <td style={td}>{row?.room}</td>
                <td style={td}>{row?.onsetDate}</td>
                <td style={td}>{row?.fever === 'Y' ? '●' : ''}</td>
                <td style={td} />{/* Tmax — manual */}
                <td style={td}>{row?.symptoms.includes('nausea') ? '●' : ''}</td>
                <td style={td}>{row?.symptoms.includes('vomiting') ? '●' : ''}</td>
                <td style={td}>{row?.symptoms.includes('diarrhea') ? '●' : ''}</td>
                <td style={td}>{row?.symptoms.includes('stomach_cramping') ? '●' : ''}</td>
                <td style={td} />{/* Duration — manual */}
                <td style={td}>{row?.providerNotified === 'Y' ? 'Y' : ''}</td>
                <td style={td} />{/* Hospitalized — manual */}
                <td style={td} />{/* Hospital Name — manual */}
                <td style={td} />{/* Died — manual */}
                <td style={td} />{/* Date of Death — manual */}
              </tr>
            ))}
          </tbody>
        </table>
        <SignatureFooter />
      </div>

      {/* ── Page 2: Treatment + labs ── */}
      <div className="form-page" style={{ pageBreakAfter: 'avoid' }}>
        <PageHeader
          title="GASTROENTERITIS LINE LIST"
          page="Page 2 of 2 — Treatment &amp; Lab Testing"
          facilityName={facilityName}
          dateRange={dateRange}
          colSpan={10}
        />
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '7pt' }}>
          <thead>
            <tr>
              <th style={{ ...thBase, fontSize: '6pt' }} rowSpan={2}>Case Initials</th>
              <th style={{ ...thBase, fontSize: '6pt' }} rowSpan={2}>Room #</th>
              <th style={{ ...thBase, fontSize: '6pt' }} rowSpan={2}>Onset Date</th>
              <th style={thBase} colSpan={2}>Treatment</th>
              <th style={thBase} colSpan={5}>Lab Testing</th>
            </tr>
            <tr>
              <th style={thRot}>Antibiotic Y/N/U</th>
              <th style={thRot}>Antidiarrheal Y/N/U</th>
              <th style={thRot}>Lab Y/N/U</th>
              <th style={{ ...thBase, fontSize: '6pt' }}>Specimen Type</th>
              <th style={{ ...thBase, fontSize: '6pt' }}>Collect Date</th>
              <th style={{ ...thBase, fontSize: '6pt' }}>Type of Test</th>
              <th style={{ ...thBase, fontSize: '6pt' }}>Result</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td style={td}>{row?.initials}</td>
                <td style={td}>{row?.room}</td>
                <td style={td}>{row?.onsetDate}</td>
                <td style={td}>{row?.abt}</td>
                <td style={td} />{/* Antidiarrheal — manual */}
                <td style={td}>{row?.testOrdered === 'Y' ? 'Y' : ''}</td>
                <td style={td} /><td style={td} />
                <td style={td} /><td style={td} />
              </tr>
            ))}
          </tbody>
        </table>
        <SignatureFooter />
      </div>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (!parts[0]) return '';
  return parts.length === 1
    ? parts[0][0].toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const MIN_ROWS = 20;

export const LineListPrintForm: React.FC<Props> = ({
  tab,
  startDate,
  endDate,
  unit,
  facilityName,
  facilityId,
  onClose,
}) => {
  const { store } = useFacilityData();
  const { requestPrint } = usePrint();

  const dateRange = `${formatDate(startDate)} – ${formatDate(endDate)}`;

  const iliRows = useMemo((): (ILIRow | null)[] => {
    if (tab !== 'resp') return [];
    const allEvents = Object.values(store.lineListEvents ?? {}) as LineListEvent[];
    const abts = Object.values(store.abts ?? {}) as ABTCourse[];
    const vaxEvents = Object.values(store.vaxEvents ?? {}) as VaxEvent[];

    const filtered = allEvents
      .filter((ev) => {
        const day = ev.onsetDateISO.slice(0, 10);
        const unitMatch =
          unit === 'all' || (store.residents[ev.residentId]?.currentUnit ?? '') === unit;
        return (
          ev.symptomClass === 'resp' &&
          ev.facilityId === facilityId &&
          day >= startDate &&
          day <= endDate &&
          unitMatch
        );
      })
      .sort((a, b) => a.onsetDateISO.localeCompare(b.onsetDateISO));

    const mapped: (ILIRow | null)[] = filtered.map((ev) => {
      const resident = store.residents[ev.residentId];
      const abtCourse = abts
        .filter(
          (a) =>
            a.residentRef.kind === 'mrn' &&
            a.residentRef.id === ev.residentId &&
            (a.startDate ?? '') <= ev.onsetDateISO.slice(0, 10) &&
            (a.endDate == null || a.endDate >= ev.onsetDateISO.slice(0, 10))
        )
        .sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''))[0];

      const fluVax = vaxEvents.find(
        (v) =>
          v.residentRef.kind === 'mrn' &&
          v.residentRef.id === ev.residentId &&
          v.vaccine.toLowerCase().includes('influenza') &&
          v.status === 'given'
      );
      const pneuVax = vaxEvents.find(
        (v) =>
          v.residentRef.kind === 'mrn' &&
          v.residentRef.id === ev.residentId &&
          v.vaccine.toLowerCase().includes('pneumo') &&
          v.status === 'given'
      );

      return {
        room: resident?.currentRoom ?? '',
        age: computeAge(resident?.dob, ev.onsetDateISO),
        name: resident?.displayName ?? '',
        sex: resident?.sex ?? '',
        fluVax: fluVax ? 'Y' : 'N',
        pneuVax: pneuVax ? 'Y' : 'N',
        onsetDate: formatDate(ev.onsetDateISO),
        fever: ev.fever === true ? 'Y' : ev.fever === false ? 'N' : 'U',
        symptoms: ev.symptoms ?? [],
        abt: abtCourse?.medication ?? '',
      };
    });

    while (mapped.length < MIN_ROWS) mapped.push(null);
    return mapped;
  }, [store, tab, startDate, endDate, unit, facilityId]);

  const giRows = useMemo((): (GIRow | null)[] => {
    if (tab !== 'gi') return [];
    const allEvents = Object.values(store.lineListEvents ?? {}) as LineListEvent[];
    const abts = Object.values(store.abts ?? {}) as ABTCourse[];

    const filtered = allEvents
      .filter((ev) => {
        const day = ev.onsetDateISO.slice(0, 10);
        const unitMatch =
          unit === 'all' || (store.residents[ev.residentId]?.currentUnit ?? '') === unit;
        return (
          ev.symptomClass === 'gi' &&
          ev.facilityId === facilityId &&
          day >= startDate &&
          day <= endDate &&
          unitMatch
        );
      })
      .sort((a, b) => a.onsetDateISO.localeCompare(b.onsetDateISO));

    const mapped: (GIRow | null)[] = filtered.map((ev) => {
      const resident = store.residents[ev.residentId];
      const abtCourse = abts
        .filter(
          (a) =>
            a.residentRef.kind === 'mrn' &&
            a.residentRef.id === ev.residentId &&
            (a.startDate ?? '') <= ev.onsetDateISO.slice(0, 10) &&
            (a.endDate == null || a.endDate >= ev.onsetDateISO.slice(0, 10))
        )
        .sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''))[0];

      return {
        initials: getInitials(resident?.displayName ?? ''),
        unit: resident?.currentUnit ?? '',
        room: resident?.currentRoom ?? '',
        onsetDate: formatDate(ev.onsetDateISO),
        fever: ev.fever === true ? 'Y' : ev.fever === false ? 'N' : 'U',
        symptoms: ev.symptoms ?? [],
        providerNotified: ev.providerNotified ? 'Y' : 'N',
        abt: abtCourse?.medication ? 'Y' : 'U',
        testOrdered: ev.testOrdered ? 'Y' : 'U',
      };
    });

    while (mapped.length < MIN_ROWS) mapped.push(null);
    return mapped;
  }, [store, tab, startDate, endDate, unit, facilityId]);

  useEffect(() => {
    requestPrint(
      <div className="bg-white text-black font-serif">
        <style>{`
          @page { size: letter landscape; margin: 0.4in 0.35in; }
          .form-page { page-break-after: always; }
          .form-page:last-child { page-break-after: avoid; }
        `}</style>
        {tab === 'resp' ? (
          <ILIPrintPages rows={iliRows} facilityName={facilityName} dateRange={dateRange} />
        ) : (
          <GIPrintPages rows={giRows} facilityName={facilityName} dateRange={dateRange} />
        )}
      </div>
    );
    onClose();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
};
