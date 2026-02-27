import React, { useEffect } from 'react';
import { useFacilityData } from '../../../app/providers';
import { Resident, VaxEvent, IPEvent, ABTCourse } from '../../../domain/models';

interface Props {
  residentId: string;
  onClose: () => void;
}

const Checkbox = ({ label, checked = false }: { label: string, checked?: boolean }) => (
  <div className="flex items-center gap-2">
    <div className={`w-4 h-4 border border-black flex items-center justify-center ${checked ? 'bg-black' : ''}`}>
      {checked && <span className="text-white text-xs">✔</span>}
    </div>
    <span className="text-sm">{label}</span>
  </div>
);

const LinedText = ({ label, text, className = '' }: { label: string, text?: string, className?: string }) => (
  <div className={`flex items-end gap-2 ${className}`}>
    <label className="text-sm whitespace-nowrap">{label}:</label>
    <span className="flex-1 border-b border-black text-sm font-medium pb-0.5">{text || ''}</span>
  </div>
);

export const NewAdmissionIpScreening: React.FC<Props> = ({ residentId, onClose }) => {
  const { store } = useFacilityData();
  const resident = store.residents[residentId];

  useEffect(() => {
    // Give a moment for the component to render before printing
    setTimeout(() => {
      window.print();
      onClose();
    }, 100);
  }, []);

  if (!resident) return null;

  const vaxHistory = (Object.values(store.vaxEvents) as VaxEvent[]).filter(v => v.residentRef.id === residentId && v.status === 'given');
  const ipHistory = (Object.values(store.infections) as IPEvent[]).filter(i => i.residentRef.id === residentId);
  const abtHistory = (Object.values(store.abts) as ABTCourse[]).filter(a => a.residentRef.id === residentId);

  return (
    <div className="printable-form-container bg-white text-black p-8 font-serif">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-form-container, .printable-form-container * {
            visibility: visible;
          }
          .printable-form-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: auto;
            page-break-after: always;
          }
          .form-page {
            page-break-after: always;
            height: 100vh;
          }
          .form-page:last-child {
            page-break-after: avoid;
          }
        }
      `}</style>
      
      {/* Page 1 */}
      <div className="form-page flex flex-col">
        <header className="text-center mb-6">
          <h1 className="text-lg font-bold">Long Beach Nursing & Rehabilitation Center</h1>
          <h2 className="text-md font-bold">NEW ADMISSION IP SCREENING FORM</h2>
        </header>

        <div className="grid grid-cols-3 gap-x-8 gap-y-2 mb-6 text-sm">
          <LinedText label="Resident" text={`${resident.lastName}, ${resident.firstName}`} />
          <LinedText label="MRN" text={resident.mrn} />
          <LinedText label="Room" text={resident.currentRoom} />
          <LinedText label="Unit" text={resident.currentUnit} />
          <LinedText label="Admit Date" text={resident.admissionDate ? new Date(resident.admissionDate).toLocaleDateString() : ''} />
        </div>

        <section className="mb-6">
          <h3 className="font-bold text-sm mb-2">VACCINATION OFFERS</h3>
          <div className="grid grid-cols-3 gap-x-4 gap-y-2">
            <Checkbox label="Offered: Pneumococcal (PPSV23/PCV)" />
            <Checkbox label="Given" />
            <Checkbox label="Declined" />
            <Checkbox label="Offered: Influenza (Flu)" />
            <Checkbox label="Given" />
            <Checkbox label="Declined" />
            <Checkbox label="Offered: COVID-19" />
            <Checkbox label="Given" />
            <Checkbox label="Declined" />
            <Checkbox label="Offered: RSV" />
            <Checkbox label="Given" />
            <Checkbox label="Declined" />
          </div>
        </section>

        <section className="mb-6">
          <h3 className="font-bold text-sm mb-2">CLINICAL ASSESSMENT ON ADMISSION</h3>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            <Checkbox label="Psychotropic Medications" />
            <Checkbox label="MDRO History (MRSA/VRE/CRE)" />
            <Checkbox label="Active Antibiotic Therapy" checked={abtHistory.some(a => a.status === 'active')} />
            <Checkbox label="Active Wound Care" />
            <Checkbox label="Enhanced Barrier Precautions (EBP)" />
            <Checkbox label="Indwelling Device (Foley/PICC/G-tube)" />
            <Checkbox label="Isolation Precautions" />
          </div>
          <LinedText label="If EBP checked, source of infection" className="mt-2" />
          <LinedText label="If Isolation checked, type (Contact/Droplet/Airborne/Other)" className="mt-2" />
        </section>

        <section className="mb-6">
          <h3 className="font-bold text-sm mb-2">COGNITIVE / CAPACITY STATUS</h3>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            <Checkbox label="Intact" checked={resident.cognitiveStatus === 'Intact'} />
            <Checkbox label="Mildly Impaired" checked={resident.cognitiveStatus === 'Mildly Impaired'} />
            <Checkbox label="Severely Impaired" checked={resident.cognitiveStatus === 'Severely Impaired'} />
            <Checkbox label="Unknown / Not Assessed" checked={!resident.cognitiveStatus || resident.cognitiveStatus === 'Unknown'} />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Checkbox label="Education materials modified for cognitive status" checked={resident.cognitiveStatus === 'Mildly Impaired' || resident.cognitiveStatus === 'Severely Impaired'} />
          </div>
          <LinedText label="Capacity notes / surrogate decision maker" className="mt-2" />
        </section>

        <section className="mb-6 flex-1 flex flex-col">
          <h3 className="font-bold text-sm mb-2">SCREENING NOTES</h3>
          <div className="flex-1 border border-black p-2"></div>
        </section>

        <section className="mb-6">
          <h3 className="font-bold text-sm mb-2">HISTORICAL DATA PRIOR TO ADMISSION</h3>
          <div className="text-sm">
            <p className="font-bold">Vaccinations given prior to admission:</p>
            {vaxHistory.length > 0 ? vaxHistory.map(v => (
              <p key={v.id} className="ml-4">• {v.vaccine} ({v.dateGiven ? new Date(v.dateGiven).toLocaleDateString() : 'N/A'})</p>
            )) : <p className="ml-4">• None documented</p>}
            
            <p className="font-bold mt-2">Infection/IP tracker history:</p>
            {ipHistory.length > 0 ? ipHistory.map(i => (
              <p key={i.id} className="ml-4">• {i.infectionCategory} ({i.createdAt ? new Date(i.createdAt).toLocaleDateString() : 'N/A'})</p>
            )) : <p className="ml-4">• None documented</p>}

            <p className="font-bold mt-2">Antibiotic history:</p>
            {abtHistory.length > 0 ? abtHistory.map(a => (
              <p key={a.id} className="ml-4">• {a.medication} ({a.startDate ? new Date(a.startDate).toLocaleDateString() : 'N/A'})</p>
            )) : <p className="ml-4">• None documented</p>}
          </div>
        </section>

        <footer className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm mt-auto">
          <LinedText label="Screened By" />
          <LinedText label="Date/Time" />
          <LinedText label="Title" />
          <LinedText label="Signature" />
        </footer>
      </div>

      {/* Page 2 */}
      <div className="form-page flex flex-col">
        <h3 className="font-bold text-sm mb-4">ADMISSION DEVICE / TREATMENT CHECKLIST</h3>
        <div className="space-y-4 text-sm">
          <div>
            <p className="font-bold">Oxygen</p>
            <div className="ml-4 space-y-1 mt-1">
              <Checkbox label="Resident on oxygen" />
              <div className="flex items-center"><Checkbox label="Liters per minute documented:" /><span className="flex-1 border-b border-black mx-2"></span><span>L/min</span></div>
              <Checkbox label="Order verified/correct" />
              <Checkbox label="Care plan updated and initiated" />
              <Checkbox label="Oxygen signage posted outside room" />
              <div className="flex items-center"><Checkbox label="Mode:" /><span className="mx-2">&</span><Checkbox label="PRN" /><span className="mx-2">&</span><Checkbox label="Continuous" /></div>
            </div>
          </div>
          <div>
            <p className="font-bold">Urinary Catheter</p>
            <div className="ml-4 space-y-1 mt-1">
              <Checkbox label="Resident has urinary catheter" />
              <Checkbox label="Catheter labeled with size/date" />
              <Checkbox label="Catheter order present and current" />
              <Checkbox label="Care plan updated and active" />
              <Checkbox label="Privacy bag in place when indicated" />
            </div>
          </div>
          <div>
            <p className="font-bold">Feeding Tube</p>
            <div className="ml-4 space-y-1 mt-1">
              <Checkbox label="Resident has feeding tube" />
              <Checkbox label="Tube type/size documented" />
              <Checkbox label="Feeding order present and correct" />
              <Checkbox label="Care plan updated and active" />
              <Checkbox label="Tube site care/check completed" />
            </div>
          </div>
        </div>
        <LinedText label="Additional device/treatment checklist notes" className="mt-4" />
      </div>
    </div>
  );
};
