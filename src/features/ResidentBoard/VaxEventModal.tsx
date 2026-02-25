import React, { useState, useEffect } from "react";
import { X, Save, Syringe, FileText, Calendar, AlertTriangle } from "lucide-react";
import { useDatabase, useFacilityData } from "../../app/providers";
import { VaxEvent } from "../../domain/models";
import { v4 as uuidv4 } from "uuid";

interface Props {
  residentId: string;
  existingVax?: VaxEvent;
  onClose: () => void;
}

export const VaxEventModal: React.FC<Props> = ({ residentId, existingVax, onClose }) => {
  const { updateDB } = useDatabase();
  const { activeFacilityId } = useFacilityData();

  // Core Identity & Status
  const [vaccine, setVaccine] = useState(existingVax?.vaccine || "");
  const [status, setStatus] = useState<VaxEvent["status"] | "historical">("given");

  // Dates
  const [dateGiven, setDateGiven] = useState(existingVax?.dateGiven || "");
  const [dueDate, setDueDate] = useState(existingVax?.dueDate || "");
  const [offerDate, setOfferDate] = useState(existingVax?.offerDate || "");
  
  // Declination
  const [declineReason, setDeclineReason] = useState(existingVax?.declineReason || "");

  // Notes
  const [notes, setNotes] = useState("");
  
  // Extended State (Serialized to Notes)
  const [administrationSource, setAdministrationSource] = useState('in_house');
  const [seriesComplete, setSeriesComplete] = useState<boolean | undefined>(undefined);
  const [declineReasonOther, setDeclineReasonOther] = useState("");
  const [offeredBy, setOfferedBy] = useState("");
  const [permanentDeclination, setPermanentDeclination] = useState<boolean>(false);
  const [offerAgainDate, setOfferAgainDate] = useState("");
  const [nextDoseNeeded, setNextDoseNeeded] = useState<'due' | 'scheduled' | 'complete'>('complete');
  const [scheduledDate, setScheduledDate] = useState("");

  useEffect(() => {
    if (existingVax) {
      if (existingVax.status === 'declined') {
        setStatus('declined');
      } else if (existingVax.notes?.includes('"administrationSource":"historical"')) {
        setStatus('historical');
      } else {
        setStatus('given');
      }

      if (existingVax.notes) {
        try {
          const match = existingVax.notes.match(/--- EXTENDED DATA ---\n(.*)/s);
          if (match) {
            const ext = JSON.parse(match[1]);
            setAdministrationSource(ext.administrationSource || 'in_house');
            setSeriesComplete(ext.seriesComplete);
            setDeclineReasonOther(ext.declineReasonOther || "");
            setOfferedBy(ext.offeredBy || "");
            setPermanentDeclination(ext.permanentDeclination || false);
            setOfferAgainDate(ext.offerAgainDate || "");
            setNextDoseNeeded(ext.nextDoseNeeded || 'complete');
            setScheduledDate(ext.scheduledDate || "");
            setNotes(existingVax.notes.replace(/\n\n--- EXTENDED DATA ---\n.*/s, ""));
          } else {
            setNotes(existingVax.notes);
          }
        } catch (e) {
          setNotes(existingVax.notes);
        }
      }
    }
  }, [existingVax]);

  const handleSave = () => {
    if (!vaccine.trim()) {
      alert("Vaccine name is required.");
      return;
    }

    updateDB((draft) => {
      const facility = draft.data.facilityData[activeFacilityId];
      const now = new Date().toISOString();
      const vaxId = existingVax?.id || uuidv4();

      const residentRef = residentId.startsWith("Q:") 
        ? { kind: "quarantine" as const, id: residentId }
        : { kind: "mrn" as const, id: residentId };

      const finalStatus = status === 'historical' ? 'given' : status;

      const extData = {
        administrationSource: status === 'historical' ? administrationSource : 'in_house',
        seriesComplete,
        declineReasonOther,
        offeredBy,
        permanentDeclination,
        offerAgainDate,
        nextDoseNeeded,
        scheduledDate
      };

      const finalNotes = notes.trim() 
        ? notes.trim() + `\n\n--- EXTENDED DATA ---\n${JSON.stringify(extData)}`
        : `--- EXTENDED DATA ---\n${JSON.stringify(extData)}`;

      facility.vaxEvents[vaxId] = {
        id: vaxId,
        residentRef,
        vaccine: vaccine.trim(),
        status: finalStatus as VaxEvent["status"],
        dateGiven: (status === 'given' || status === 'historical') ? (dateGiven || new Date().toISOString().split('T')[0]) : undefined,
        dueDate: (status === 'given' && nextDoseNeeded === 'due') || (status === 'historical' && seriesComplete === false) ? dueDate || undefined : undefined,
        offerDate: status === 'declined' ? (offerDate || new Date().toISOString().split('T')[0]) : undefined,
        declineReason: status === 'declined' ? declineReason || undefined : undefined,
        notes: finalNotes,
        createdAt: existingVax?.createdAt || now,
        updatedAt: now,
      };

      if (status === 'given' && nextDoseNeeded === 'scheduled' && scheduledDate) {
        const scheduledVaxId = uuidv4();
        facility.vaxEvents[scheduledVaxId] = {
          id: scheduledVaxId,
          residentRef,
          vaccine: vaccine.trim(),
          status: 'scheduled',
          dueDate: scheduledDate,
          notes: `Scheduled follow-up for event ${vaxId}`,
          createdAt: now,
          updatedAt: now,
        };
      }
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-50 shrink-0">
          <h2 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
            <Syringe className="w-5 h-5 text-purple-600" />
            {existingVax ? "Edit Vaccination Record" : "New Vaccination Record"}
          </h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 space-y-8">
          
          {/* Core Details */}
          <section>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-1">Vaccine Name <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={vaccine}
                  onChange={e => setVaccine(e.target.value)}
                  placeholder="e.g., Influenza, COVID-19, Pneumococcal"
                  className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Status</label>
                <select 
                  value={status}
                  onChange={e => setStatus(e.target.value as any)}
                  className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="given">Given (In-House)</option>
                  <option value="historical">Historical Record</option>
                  <option value="declined">Declined</option>
                  <option value="contraindicated">Contraindicated</option>
                </select>
              </div>
            </div>
          </section>

          {/* Status: GIVEN */}
          {status === 'given' && (
            <section className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Date Given (required)</label>
                <input 
                  type="date" 
                  value={dateGiven || new Date().toISOString().split('T')[0]} 
                  onChange={e => setDateGiven(e.target.value)} 
                  className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-purple-500 focus:border-purple-500"
                  required 
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Defaults to today. Change if vaccine was given on a different date.
                </p>
              </div>
              
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <label className="block text-sm font-medium text-neutral-700 mb-2">Is another dose needed?</label>
                <div className="space-y-3">
                  <label className="flex items-center gap-2">
                    <input type="radio" name={`next-dose`} value="due" checked={nextDoseNeeded === 'due'} onChange={() => setNextDoseNeeded('due')} />
                    <span className="text-sm font-semibold">Yes - Set due date for next dose</span>
                  </label>
                  {nextDoseNeeded === 'due' && (
                    <input type="date" value={dueDate || ''} onChange={e => setDueDate(e.target.value)} className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-purple-500 focus:border-purple-500" />
                  )}
                  <label className="flex items-center gap-2">
                    <input type="radio" name={`next-dose`} value="scheduled" checked={nextDoseNeeded === 'scheduled'} onChange={() => setNextDoseNeeded('scheduled')} />
                    <span className="text-sm font-semibold">Yes - Schedule next appointment</span>
                  </label>
                  {nextDoseNeeded === 'scheduled' && (
                    <input type="date" value={scheduledDate || ''} onChange={e => setScheduledDate(e.target.value)} className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-purple-500 focus:border-purple-500" />
                  )}
                  <label className="flex items-center gap-2">
                    <input type="radio" name={`next-dose`} value="complete" checked={nextDoseNeeded === 'complete'} onChange={() => setNextDoseNeeded('complete')} />
                    <span className="text-sm font-semibold">No - Series complete</span>
                  </label>
                </div>
              </div>
            </section>
          )}

          {/* Status: HISTORICAL */}
          {status === 'historical' && (
            <section className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">When was this vaccine given? (required)</label>
                <input 
                  type="date" 
                  value={dateGiven || ''} 
                  max={new Date().toISOString().split('T')[0]}
                  onChange={e => setDateGiven(e.target.value)} 
                  className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-purple-500 focus:border-purple-500"
                  required 
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Enter the date from the historical record. Cannot be a future date.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Source of historical record (optional)</label>
                <select value={administrationSource} onChange={e => setAdministrationSource(e.target.value)} className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-purple-500 focus:border-purple-500">
                  <option value="historical">Unspecified historical record</option>
                  <option value="hospital_record">Hospital record</option>
                  <option value="pharmacy_record">Pharmacy record</option>
                  <option value="self_report">Patient self-report</option>
                  <option value="family_report">Family report</option>
                  <option value="other_facility">Other facility record</option>
                  <option value="physician_office">Physician office record</option>
                </select>
              </div>
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <label className="block text-sm font-medium text-neutral-700 mb-2">Is this vaccine series complete?</label>
                <div className="space-y-3">
                  <label className="flex items-center gap-2">
                    <input type="radio" name={`series-complete`} value="complete" checked={seriesComplete === true} onChange={() => setSeriesComplete(true)} />
                    <span className="text-sm font-semibold">Yes - Series complete</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name={`series-complete`} value="incomplete" checked={seriesComplete === false} onChange={() => setSeriesComplete(false)} />
                    <span className="text-sm font-semibold">No - Additional doses needed</span>
                  </label>
                  {seriesComplete === false && (
                    <div className="ml-6 mt-2">
                      <label className="text-xs font-bold text-neutral-500 uppercase mb-1.5 block">When is next dose due?</label>
                      <input type="date" value={dueDate || ''} onChange={e => setDueDate(e.target.value)} className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-purple-500 focus:border-purple-500" />
                    </div>
                  )}
                  <label className="flex items-center gap-2">
                    <input type="radio" name={`series-complete`} value="unknown" checked={seriesComplete === undefined} onChange={() => setSeriesComplete(undefined)} />
                    <span className="text-sm font-semibold">Unknown - Need to verify</span>
                  </label>
                </div>
              </div>
            </section>
          )}

          {/* Status: DECLINED */}
          {status === 'declined' && (
            <section className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Date of Declination (required)</label>
                <input 
                  type="date" 
                  value={offerDate || new Date().toISOString().split('T')[0]} 
                  onChange={e => setOfferDate(e.target.value)} 
                  className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-purple-500 focus:border-purple-500"
                  required 
                />
                <p className="text-xs text-neutral-500 mt-1">Date when vaccine was declined. Defaults to today.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Reason for Declining (required)</label>
                <select value={declineReason} onChange={e => setDeclineReason(e.target.value)} className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-purple-500 focus:border-purple-500" required>
                  <option value="">Select reason...</option>
                  <option value="patient_refusal">Patient refusal</option>
                  <option value="family_refusal">Family/representative refusal</option>
                  <option value="religious_beliefs">Religious beliefs</option>
                  <option value="other">Other (specify in notes)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Vaccine Offered By (optional)</label>
                <input type="text" value={offeredBy} onChange={e => setOfferedBy(e.target.value)} className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-purple-500 focus:border-purple-500" />
              </div>
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                <label className="block text-sm font-medium text-neutral-700 mb-2">Can this vaccine be offered again?</label>
                <div className="space-y-3">
                  <label className="flex items-center gap-2">
                    <input type="radio" name={`can-offer`} value="yes" checked={permanentDeclination === false} onChange={() => setPermanentDeclination(false)} />
                    <span className="text-sm font-semibold">Yes - Can be offered again</span>
                  </label>
                  {permanentDeclination === false && (
                    <div className="ml-6 mt-2">
                      <label className="text-xs font-bold text-neutral-500 uppercase mb-1.5 block">Remind to offer again on (optional)</label>
                      <input type="date" value={offerAgainDate || ''} onChange={e => setOfferAgainDate(e.target.value)} className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-purple-500 focus:border-purple-500" />
                    </div>
                  )}
                  <label className="flex items-center gap-2">
                    <input type="radio" name={`can-offer`} value="no" checked={permanentDeclination === true} onChange={() => setPermanentDeclination(true)} />
                    <span className="text-sm font-semibold">No - Permanent declination</span>
                  </label>
                  {permanentDeclination === true && (
                    <div className="ml-6 mt-2 p-3 bg-red-100 rounded-lg border border-red-300">
                      <p className="text-xs font-bold text-red-800 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> This vaccine will not be offered again.</p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Notes */}
          <section>
            <h3 className="text-sm font-bold text-neutral-900 mb-3 flex items-center gap-2 border-b pb-1">
              <FileText className="w-4 h-4 text-neutral-500" />
              Notes
            </h3>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add any additional narrative notes..."
              className="w-full min-h-[100px] border border-neutral-300 rounded-md p-2 text-sm focus:ring-purple-500 focus:border-purple-500 resize-y"
            />
          </section>

        </div>
        
        <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50 flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-md hover:bg-neutral-100 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm font-medium"
          >
            <Save className="w-4 h-4" />
            Save Vaccination
          </button>
        </div>
      </div>
    </div>
  );
};

