import React from 'react';
import { AdmissionScreeningRecord } from '../../domain/models';

type DraftRecord = Omit<AdmissionScreeningRecord, 'id' | 'createdAt' | 'updatedAt'> &
  Partial<Pick<AdmissionScreeningRecord, 'id' | 'createdAt' | 'updatedAt'>>;

function fmt(val: string | null | undefined): string {
  return val?.trim() || '_______________';
}

function fmtBool(val: boolean | null | undefined): string {
  if (val === true) return '☑ Yes';
  if (val === false) return '☑ No';
  return '☐ Yes  ☐ No';
}

function fmtArr(val: string[] | null | undefined): string {
  if (!val || val.length === 0) return '—';
  return val.join(', ');
}

const PrintRow: React.FC<{ label: string; value: string; wide?: boolean }> = ({ label, value, wide }) => (
  <div className={`flex gap-2 py-1 border-b border-neutral-200 text-sm last:border-b-0 ${wide ? 'col-span-2' : ''}`}>
    <span className="font-semibold text-neutral-700 w-52 shrink-0">{label}:</span>
    <span className="text-neutral-900 flex-1">{value}</span>
  </div>
);

const PrintSection: React.FC<{ number: number; title: string; children: React.ReactNode }> = ({
  number,
  title,
  children,
}) => (
  <div className="mb-4" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
    <div
      style={{ background: '#f3f4f6', borderBottom: '1px solid #d1d5db' }}
      className="px-3 py-1.5 border border-neutral-300 mb-1"
    >
      <h3 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
        {number}. {title}
      </h3>
    </div>
    <div className="px-2">{children}</div>
  </div>
);

interface Props {
  record: DraftRecord;
}

const AdmissionScreeningPrintView: React.FC<Props> = ({ record: r }) => {
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div
      className="text-black bg-white"
      style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '11pt', lineHeight: '1.4' }}
    >
      {/* Document Header */}
      <div className="text-center mb-5" style={{ borderBottom: '2px solid #111', paddingBottom: '10px' }}>
        <h1
          className="font-bold uppercase tracking-wide"
          style={{ fontSize: '14pt', marginBottom: '2px' }}
        >
          Infection Prevention Admission Screening
        </h1>
        <p style={{ fontSize: '9pt', color: '#555', margin: 0 }}>
          Complete within 72 hours of admission &nbsp;•&nbsp; Confidential Clinical Record
        </p>
        <p style={{ fontSize: '9pt', color: '#777', marginTop: '2px' }}>Printed: {today}</p>
      </div>

      {/* Resident Header */}
      <div
        className="mb-4"
        style={{ border: '1px solid #999', borderRadius: '4px', padding: '8px 10px' }}
      >
        <div className="grid grid-cols-2 gap-x-8">
          <PrintRow label="Resident Name" value={fmt(r.name)} />
          <PrintRow label="MRN" value={fmt(r.mrn)} />
          <PrintRow label="Room" value={fmt(r.room)} />
          <PrintRow label="Unit" value={fmt(r.unit)} />
          <PrintRow label="Admission Date" value={fmt(r.admitDate)} />
          <PrintRow label="Screening Date" value={fmt(r.screeningDate)} />
          <PrintRow
            label="Days Since Admission"
            value={
              r.daysSinceAdmit !== null && r.daysSinceAdmit !== undefined
                ? String(r.daysSinceAdmit)
                : '—'
            }
          />
          <PrintRow
            label="Screening Status"
            value={r.screeningStatus === 'completed' ? '✓ Completed' : 'Draft'}
          />
          <PrintRow label="Completed By" value={fmt(r.completedBy)} />
          <PrintRow label="Title / Role" value={fmt(r.completedByTitle)} />
        </div>
      </div>

      {/* Section 1: Admission Source */}
      <PrintSection number={1} title="Admission Source & Transfer Information">
        <PrintRow label="Admission Source" value={fmt(r.admissionSource)} />
        <PrintRow label="Recent hospitalization (≤30 days)" value={fmtBool(r.recentHospitalization)} />
        <PrintRow label="Transfer from another facility" value={fmtBool(r.transferFromFacility)} />
      </PrintSection>

      {/* Section 2: Symptoms */}
      <PrintSection number={2} title="Current Infection Symptoms or Diagnosis">
        <PrintRow label="Current symptoms" value={fmtArr(r.currentSymptoms)} />
        <PrintRow label="Current diagnosis / condition" value={fmt(r.currentDiagnosis)} />
      </PrintSection>

      {/* Section 3: Isolation */}
      <PrintSection number={3} title="Isolation / Precaution Status on Admission">
        <PrintRow label="Isolation status on admission" value={fmt(r.isolationStatus)} />
        <PrintRow label="Precaution type / reason" value={fmt(r.precautionType)} />
      </PrintSection>

      {/* Section 4: MDRO */}
      <PrintSection number={4} title="MDRO / Resistant Organism History">
        <PrintRow label="Known MDRO history" value={fmtBool(r.mdroHistory)} />
        {r.mdroHistory && <PrintRow label="MDRO organism(s)" value={fmt(r.mdroOrganism)} />}
        {!r.mdroHistory && <PrintRow label="MDRO organism(s)" value="—" />}
      </PrintSection>

      {/* Section 5: Antibiotics */}
      <PrintSection number={5} title="Recent Antibiotic / Anti-Infective Exposure">
        <PrintRow label="Recent antibiotics (≤90 days)" value={fmtBool(r.recentAntibiotics)} />
        {r.recentAntibiotics && <PrintRow label="Antibiotic details" value={fmt(r.antibioticDetails)} />}
        {!r.recentAntibiotics && <PrintRow label="Antibiotic details" value="—" />}
      </PrintSection>

      {/* Section 6: Devices */}
      <PrintSection number={6} title="Devices / Treatments Present on Admission">
        <PrintRow label="Medical devices present" value={fmtArr(r.devicesPresent)} />
      </PrintSection>

      {/* Section 7: Vaccination */}
      <PrintSection number={7} title="Vaccination / Prevention Review">
        <PrintRow label="Vaccination history reviewed" value={fmtBool(r.vaccinationReviewed)} />
        <PrintRow label="Vaccination notes" value={fmt(r.vaccinationNotes)} />
      </PrintSection>

      {/* Section 8: Follow-up */}
      <PrintSection number={8} title="Follow-Up Actions & Recommendations">
        <PrintRow label="Follow-up actions" value={fmt(r.followUpActions)} />
        <PrintRow label="IC recommendations" value={fmt(r.recommendations)} />
        <PrintRow label="Additional notes" value={fmt(r.notes)} />
      </PrintSection>

      {/* Section 9: Signature */}
      <div className="mb-4" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        <div
          style={{ background: '#f3f4f6', borderBottom: '1px solid #d1d5db' }}
          className="px-3 py-1.5 border border-neutral-300 mb-3"
        >
          <h3 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">9. Signature / Attestation</h3>
        </div>
        <div className="px-2">
          <p style={{ fontSize: '9pt', color: '#555', fontStyle: 'italic', marginBottom: '16px' }}>
            I attest that this admission infection prevention screening was completed accurately
            based on available clinical information at the time of assessment.
          </p>
          <div className="grid grid-cols-2 gap-x-12 gap-y-6 mt-2">
            <div>
              <div style={{ borderBottom: '1px solid #333', height: '24px' }} />
              <p style={{ fontSize: '8pt', color: '#666', marginTop: '2px' }}>Signature</p>
            </div>
            <div>
              <div style={{ borderBottom: '1px solid #333', height: '24px' }} />
              <p style={{ fontSize: '8pt', color: '#666', marginTop: '2px' }}>Date</p>
            </div>
            <div>
              <div style={{ borderBottom: '1px solid #333', height: '24px' }} />
              <p style={{ fontSize: '8pt', color: '#666', marginTop: '2px' }}>Printed Name</p>
            </div>
            <div>
              <div style={{ borderBottom: '1px solid #333', height: '24px' }} />
              <p style={{ fontSize: '8pt', color: '#666', marginTop: '2px' }}>Title / Credential</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdmissionScreeningPrintView;
